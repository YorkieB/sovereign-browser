// Vault crypto core - master password -> scrypt -> AES-256-GCM.
// Node stdlib only. No dependencies, no network, no logging of secrets.
//
// Format (JSON envelope, versioned so KDF cost can be raised later):
//   { v, kdf: { name, N, r, p, salt }, cipher, iv, tag, ct }
// The header (v + kdf + cipher) is bound into the ciphertext as AAD, so a
// downgrade of the KDF parameters fails authentication instead of silently
// weakening the vault.

import { randomBytes, scrypt as scryptCb, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { writeFileSync, readFileSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// --- Parameters -----------------------------------------------------------
// N=65536 (2^16) costs ~64 MB and ~0.4s on a modern desktop. Raise N here for
// new vaults; existing vaults keep their own N from their header.
export const KDF_DEFAULTS = Object.freeze({ name: "scrypt", N: 65536, r: 8, p: 1 });
const KEY_BYTES = 32;   // AES-256
const SALT_BYTES = 32;
const IV_BYTES = 12;    // GCM standard
const TAG_BYTES = 16;
const VERSION = 1;

// --- Errors ---------------------------------------------------------------
// Distinct types so callers can tell "wrong password" from "file is damaged"
// without string-matching, and so neither path ever leaks plaintext.
export class VaultAuthError extends Error {
  constructor(message = "Could not unlock the vault: wrong master password, or the file has been altered.") {
    super(message);
    this.name = "VaultAuthError";
  }
}
export class VaultFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "VaultFormatError";
  }
}

// --- Key derivation -------------------------------------------------------
async function deriveKey(masterPassword, salt, kdf) {
  if (typeof masterPassword !== "string" || masterPassword.length === 0) {
    throw new VaultFormatError("Master password must be a non-empty string.");
  }
  // scrypt needs maxmem raised explicitly: it defaults to 32 MB and N=65536
  // needs 128*N*r = 64 MB. Without this it throws ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
  const maxmem = 256 * kdf.N * kdf.r;
  return scrypt(masterPassword.normalize("NFKC"), salt, KEY_BYTES, {
    N: kdf.N, r: kdf.r, p: kdf.p, maxmem,
  });
}

function headerAad(header) {
  // Canonical, key-order-stable serialisation of the authenticated header.
  return Buffer.from(JSON.stringify({
    v: header.v,
    cipher: header.cipher,
    kdf: { name: header.kdf.name, N: header.kdf.N, r: header.kdf.r, p: header.kdf.p, salt: header.kdf.salt },
  }), "utf-8");
}

function validateEnvelope(env) {
  if (!env || typeof env !== "object") throw new VaultFormatError("Vault file is not a JSON object.");
  if (env.v !== VERSION) throw new VaultFormatError(`Unsupported vault version: ${env.v} (this build reads v${VERSION}).`);
  if (env.cipher !== "aes-256-gcm") throw new VaultFormatError(`Unsupported cipher: ${env.cipher}`);
  if (!env.kdf || env.kdf.name !== "scrypt") throw new VaultFormatError("Unsupported or missing KDF.");
  for (const field of ["salt"]) {
    if (typeof env.kdf[field] !== "string") throw new VaultFormatError(`Vault header is missing kdf.${field}.`);
  }
  for (const field of ["iv", "tag", "ct"]) {
    if (typeof env[field] !== "string") throw new VaultFormatError(`Vault file is missing '${field}'.`);
  }
  for (const field of ["N", "r", "p"]) {
    if (!Number.isInteger(env.kdf[field]) || env.kdf[field] < 1) {
      throw new VaultFormatError(`Vault header has an invalid kdf.${field}.`);
    }
  }
}

// --- Public API -----------------------------------------------------------

/**
 * Derive a vault key from a master password and an existing header's KDF block.
 * Callers that hold the key can then encrypt/decrypt without re-deriving, and
 * without keeping the master password in memory.
 */
export async function deriveVaultKey(masterPassword, kdf) {
  const salt = Buffer.from(kdf.salt, "base64");
  return deriveKey(masterPassword, salt, kdf);
}

/** Build a fresh KDF block (new random salt) for a brand new vault. */
export function newKdfBlock(kdfOverride) {
  const kdf = { ...KDF_DEFAULTS, ...(kdfOverride || {}) };
  return { name: kdf.name, N: kdf.N, r: kdf.r, p: kdf.p, salt: randomBytes(SALT_BYTES).toString("base64") };
}

/** Encrypt with an already-derived key. The kdf block must be the one the key came from. */
export function encryptWithKey(data, key, kdf) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new VaultFormatError(`Vault key must be a ${KEY_BYTES}-byte Buffer.`);
  }
  const iv = randomBytes(IV_BYTES);
  const header = { v: VERSION, cipher: "aes-256-gcm", kdf };
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(headerAad(header));
  const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  plaintext.fill(0);
  return { ...header, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

/** Decrypt with an already-derived key. Throws VaultAuthError on wrong key or tampering. */
export function decryptWithKey(envelope, key) {
  validateEnvelope(envelope);
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new VaultFormatError(`Vault key must be a ${KEY_BYTES}-byte Buffer.`);
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  if (tag.length !== TAG_BYTES) throw new VaultFormatError("Auth tag is the wrong length.");

  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(headerAad(envelope));
  decipher.setAuthTag(tag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]);
  } catch (err) {
    throw new VaultAuthError();
  }
  try {
    return JSON.parse(plaintext.toString("utf-8"));
  } catch (err) {
    throw new VaultFormatError(`Vault decrypted but its contents are not valid JSON: ${err.message}`);
  } finally {
    plaintext.fill(0);
  }
}

/** Encrypt a JSON-serialisable value into a vault envelope object. */
export async function encryptVault(data, masterPassword, kdfOverride) {
  const kdf = { ...KDF_DEFAULTS, ...(kdfOverride || {}) };
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);

  const header = {
    v: VERSION,
    cipher: "aes-256-gcm",
    kdf: { name: kdf.name, N: kdf.N, r: kdf.r, p: kdf.p, salt: salt.toString("base64") },
  };

  const key = await deriveKey(masterPassword, salt, kdf);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(headerAad(header));
    const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    plaintext.fill(0);
    return { ...header, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
  } finally {
    key.fill(0);
  }
}

/** Decrypt a vault envelope. Throws VaultAuthError on wrong password or tampering. */
export async function decryptVault(envelope, masterPassword) {
  validateEnvelope(envelope);
  const kdf = envelope.kdf;
  const salt = Buffer.from(kdf.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  if (tag.length !== TAG_BYTES) throw new VaultFormatError("Auth tag is the wrong length.");

  const key = await deriveKey(masterPassword, salt, kdf);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(headerAad(envelope));
    decipher.setAuthTag(tag);
    let plaintext;
    try {
      plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]);
    } catch (err) {
      // GCM authentication failure. Deliberately does not distinguish wrong
      // password from tampering - the caller cannot act differently and the
      // distinction would leak information.
      throw new VaultAuthError();
    }
    try {
      return JSON.parse(plaintext.toString("utf-8"));
    } catch (err) {
      throw new VaultFormatError(`Vault decrypted but its contents are not valid JSON: ${err.message}`);
    } finally {
      plaintext.fill(0);
    }
  } finally {
    key.fill(0);
  }
}

/** Write a vault to disk atomically: temp file, then rename over the target. */
export function writeVaultFile(path, envelope) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(envelope), { encoding: "utf-8", mode: 0o600 });
  renameSync(tmp, path);   // rename is atomic on the same volume
  if (existsSync(tmp)) unlinkSync(tmp);
}

/** Read and parse a vault file. */
export function readVaultFile(path) {
  if (!existsSync(path)) throw new VaultFormatError(`No vault file at ${path}`);
  const raw = readFileSync(path, { encoding: "utf-8" });
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new VaultFormatError(`Vault file at ${path} is not valid JSON: ${err.message}`);
  }
}

/** Constant-time compare, for any future check that touches secret material. */
export function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
