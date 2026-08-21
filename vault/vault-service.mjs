// Vault service - the layer the UI talks to.
// Owns lock state, the decrypted entries, and every write to disk.
// Nothing above this layer ever sees the master password or the derived key.

import { randomUUID, randomInt } from "node:crypto";
import { existsSync, copyFileSync, statSync } from "node:fs";
import {
  deriveVaultKey, newKdfBlock, encryptWithKey, decryptWithKey,
  writeVaultFile, readVaultFile, VaultAuthError, VaultFormatError,
} from "./vault-crypto.mjs";

export const DEFAULT_AUTO_LOCK_MS = 15 * 60 * 1000;   // 15 minutes idle
export const AUTO_LOCK_PRESETS = Object.freeze({
  "1 minute": 60 * 1000,
  "5 minutes": 5 * 60 * 1000,
  "15 minutes": DEFAULT_AUTO_LOCK_MS,
  "1 hour": 60 * 60 * 1000,
  "Never": null,          // stays unlocked until lock() or HOLLY quits
});
const MIN_AUTO_LOCK_MS = 1000;
export const CATEGORIES = Object.freeze(["Social", "Banking", "Work", "Shopping", "Entertainment", "Other"]);

/**
 * Accepts a millisecond window, or null/0/false/Infinity for "never".
 * Returns null when auto-lock is off. Rejects nonsense rather than silently
 * disabling the lock, which would be the dangerous failure direction.
 */
function normaliseAutoLock(value) {
  if (value === null || value === false || value === 0 || value === Infinity) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < MIN_AUTO_LOCK_MS) {
    throw new VaultStateError(
      `Auto-lock must be null (never) or a whole number of milliseconds >= ${MIN_AUTO_LOCK_MS}. Got: ${String(value)}`,
    );
  }
  return value;
}

export class VaultLockedError extends Error {
  constructor(message = "The vault is locked.") {
    super(message);
    this.name = "VaultLockedError";
  }
}
export class VaultStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "VaultStateError";
  }
}

/** Shape-check and normalise an entry coming in from the UI. */
function normaliseEntry(input, now) {
  if (!input || typeof input !== "object") throw new VaultStateError("Entry must be an object.");
  const service = String(input.service || "").trim();
  if (!service) throw new VaultStateError("Entry needs a service name.");
  if (typeof input.password !== "string" || input.password.length === 0) {
    throw new VaultStateError("Entry needs a password.");
  }
  const category = CATEGORIES.includes(input.category) ? input.category : "Other";
  return {
    id: typeof input.id === "string" && input.id ? input.id : randomUUID(),
    service,
    username: String(input.username || ""),
    password: input.password,
    url: String(input.url || ""),
    notes: String(input.notes || ""),
    category,
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
    updatedAt: now,
  };
}

export class VaultService {
  #key = null;             // Buffer, only while unlocked
  #kdf = null;             // header block the key was derived from
  #entries = null;         // decrypted entries, only while unlocked
  #lastActivity = 0;
  #path;
  #autoLockMs;
  #now;

  constructor({ vaultPath, autoLockMs = DEFAULT_AUTO_LOCK_MS, now = () => Date.now() } = {}) {
    if (!vaultPath) throw new VaultStateError("vaultPath is required.");
    this.#path = vaultPath;
    this.#autoLockMs = normaliseAutoLock(autoLockMs);
    this.#now = now;
  }

  get path() { return this.#path; }
  get exists() { return existsSync(this.#path); }

  /** 'empty' (no vault yet) | 'locked' | 'unlocked' */
  get state() {
    if (this.#key && !this.#idleExpired()) return "unlocked";
    if (this.#key && this.#idleExpired()) { this.lock(); return "locked"; }
    return this.exists ? "locked" : "empty";
  }

  get isUnlocked() { return this.state === "unlocked"; }

  /** Current idle window in ms, or null when auto-lock is off. */
  get autoLockMs() { return this.#autoLockMs; }
  get autoLockEnabled() { return this.#autoLockMs !== null; }

  /**
   * Change the policy while running, for a settings toggle.
   * Turning it on counts as activity, so flipping the switch does not
   * immediately lock a session that has been idle under "Never".
   */
  setAutoLock(value) {
    const previous = this.#autoLockMs;
    this.#autoLockMs = normaliseAutoLock(value);
    if (this.#key && previous === null && this.#autoLockMs !== null) {
      this.#lastActivity = this.#now();
    }
    return this.#autoLockMs;
  }

  /** ms until auto-lock: null when locked, Infinity when auto-lock is off. */
  get msUntilAutoLock() {
    if (!this.#key) return null;
    if (this.#autoLockMs === null) return Infinity;
    return Math.max(0, this.#autoLockMs - (this.#now() - this.#lastActivity));
  }

  #idleExpired() {
    if (this.#autoLockMs === null) return false;      // "Never"
    return this.#now() - this.#lastActivity >= this.#autoLockMs;
  }

  #assertUnlocked() {
    if (!this.#key) throw new VaultLockedError();
    if (this.#idleExpired()) {
      this.lock();
      throw new VaultLockedError("The vault locked itself after a period of inactivity.");
    }
    this.#lastActivity = this.#now();
  }

  /** Create a brand new empty vault. Refuses to overwrite an existing one. */
  async create(masterPassword) {
    if (this.exists) throw new VaultStateError(`A vault already exists at ${this.#path}. Refusing to overwrite it.`);
    this.#kdf = newKdfBlock();
    this.#key = await deriveVaultKey(masterPassword, this.#kdf);
    this.#entries = [];
    this.#lastActivity = this.#now();
    this.#save();
    return this.state;
  }

  /** Unlock an existing vault. Leaves the service locked if the password is wrong. */
  async unlock(masterPassword) {
    const envelope = readVaultFile(this.#path);      // throws VaultFormatError if unreadable
    const key = await deriveVaultKey(masterPassword, envelope.kdf);
    let entries;
    try {
      entries = decryptWithKey(envelope, key);
    } catch (err) {
      key.fill(0);                                    // never keep a key that did not work
      throw err;                                      // VaultAuthError or VaultFormatError
    }
    if (!Array.isArray(entries)) {
      key.fill(0);
      throw new VaultFormatError("Vault contents are not an entry list.");
    }
    this.#key = key;
    this.#kdf = envelope.kdf;
    this.#entries = entries;
    this.#lastActivity = this.#now();
    return this.state;
  }

  /** Drop the key and the decrypted entries. Safe to call when already locked. */
  lock() {
    if (this.#key) this.#key.fill(0);
    this.#key = null;
    this.#kdf = null;
    if (Array.isArray(this.#entries)) {
      // Overwrite password strings' references before dropping the array.
      for (const e of this.#entries) { e.password = ""; }
      this.#entries.length = 0;
    }
    this.#entries = null;
    this.#lastActivity = 0;
  }

  /** Register user activity so idle auto-lock does not fire mid-session. */
  touch() {
    if (this.#key && !this.#idleExpired()) this.#lastActivity = this.#now();
  }

  #save() {
    const envelope = encryptWithKey(this.#entries, this.#key, this.#kdf);
    // Keep one generation of backup: a bad write or a forgotten password on a
    // re-key should never be the only copy.
    if (existsSync(this.#path) && statSync(this.#path).size > 0) {
      copyFileSync(this.#path, `${this.#path}.bak`);
    }
    writeVaultFile(this.#path, envelope);
  }

  // --- CRUD ---------------------------------------------------------------

  /** All entries, newest-updated first. Returns copies, not internal references. */
  list() {
    this.#assertUnlocked();
    return this.#entries
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => ({ ...e }));
  }

  get(id) {
    this.#assertUnlocked();
    const found = this.#entries.find((e) => e.id === id);
    return found ? { ...found } : null;
  }

  add(entry) {
    this.#assertUnlocked();
    const normalised = normaliseEntry(entry, this.#now());
    if (this.#entries.some((e) => e.id === normalised.id)) {
      normalised.id = randomUUID();                   // never silently overwrite on id clash
    }
    this.#entries.push(normalised);
    this.#save();
    return { ...normalised };
  }

  update(id, patch) {
    this.#assertUnlocked();
    const idx = this.#entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new VaultStateError(`No entry with id ${id}.`);
    const merged = normaliseEntry({ ...this.#entries[idx], ...patch, id }, this.#now());
    merged.createdAt = this.#entries[idx].createdAt;  // creation time is not patchable
    this.#entries[idx] = merged;
    this.#save();
    return { ...merged };
  }

  remove(id) {
    this.#assertUnlocked();
    const idx = this.#entries.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.#entries[idx].password = "";
    this.#entries.splice(idx, 1);
    this.#save();
    return true;
  }

  /** Bulk add, for CSV/JSON import. Returns how many were added. */
  importEntries(list) {
    this.#assertUnlocked();
    if (!Array.isArray(list)) throw new VaultStateError("Import expects an array of entries.");
    const now = this.#now();
    let added = 0;
    for (const raw of list) {
      const normalised = normaliseEntry(raw, now);
      if (this.#entries.some((e) => e.id === normalised.id)) normalised.id = randomUUID();
      this.#entries.push(normalised);
      added++;
    }
    this.#save();
    return added;
  }

  /**
   * Re-key the vault under a new master password. Verifies the old password
   * first, and writes a backup before the new file lands.
   */
  async changeMasterPassword(oldPassword, newPassword) {
    if (!this.exists) throw new VaultStateError("No vault to re-key.");
    await this.unlock(oldPassword);                   // throws VaultAuthError if wrong
    const entries = this.#entries.map((e) => ({ ...e }));
    this.#kdf = newKdfBlock();                        // fresh salt for the new password
    const newKey = await deriveVaultKey(newPassword, this.#kdf);
    this.#key.fill(0);
    this.#key = newKey;
    this.#entries = entries;
    this.#lastActivity = this.#now();
    this.#save();
    return true;
  }
}

// --- Password generation ----------------------------------------------------
// crypto.randomInt is uniform and rejection-samples internally, so there is no
// modulo bias. The non-cryptographic PRNG must never appear in this file.

const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",        // no l
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",         // no I, O
  digits: "23456789",                        // no 0, 1
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};
const AMBIGUOUS_ADDBACK = { lower: "l", upper: "IO", digits: "01", symbols: "" };

export function generatePassword({
  length = 20, lower = true, upper = true, digits = true, symbols = true, avoidAmbiguous = true,
} = {}) {
  if (!Number.isInteger(length) || length < 8 || length > 128) {
    throw new VaultStateError("Password length must be an integer between 8 and 128.");
  }
  const chosen = [];
  for (const [name, on] of Object.entries({ lower, upper, digits, symbols })) {
    if (!on) continue;
    chosen.push(avoidAmbiguous ? SETS[name] : SETS[name] + AMBIGUOUS_ADDBACK[name]);
  }
  if (chosen.length === 0) throw new VaultStateError("At least one character set must be enabled.");
  if (length < chosen.length) throw new VaultStateError("Length is shorter than the number of required character sets.");

  // One character from each enabled set guarantees the password satisfies the
  // stated policy, then fill the rest from the combined pool.
  const out = chosen.map((set) => set[randomInt(set.length)]);
  const pool = chosen.join("");
  while (out.length < length) out.push(pool[randomInt(pool.length)]);

  // Fisher-Yates with a uniform source, so the guaranteed characters are not
  // stuck at the front.
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
