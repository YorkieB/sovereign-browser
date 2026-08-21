// Vault settings: small, non-secret preferences that must survive a restart.
//
// Deliberately NOT stored inside the vault. The auto-lock policy has to be
// known before the vault is unlocked - putting it inside would mean unlocking
// to find out how long you stay unlocked for. Nothing secret goes in here.
//
// Every failure path returns defaults rather than throwing. A corrupt or
// hand-edited settings file must never stop the browser opening, and must
// never silently disable the lock: an unreadable value falls back to the
// default window, not to "never".

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';

export const DEFAULT_SETTINGS = Object.freeze({
  autoLockMs: 15 * 60 * 1000,
});

const MIN_AUTO_LOCK_MS = 1000;

/** null means "never"; anything invalid falls back to the default. */
function coerceAutoLock(value) {
  if (value === null) return null;
  if (Number.isInteger(value) && value >= MIN_AUTO_LOCK_MS) return value;
  return DEFAULT_SETTINGS.autoLockMs;
}

export function readSettings(path) {
  if (!path || !existsSync(path)) return { ...DEFAULT_SETTINGS };
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    console.warn('[vault-settings] could not read', path, '-', err.message);
    return { ...DEFAULT_SETTINGS };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[vault-settings] settings file is not valid JSON, using defaults:', err.message);
    return { ...DEFAULT_SETTINGS };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    autoLockMs: 'autoLockMs' in parsed ? coerceAutoLock(parsed.autoLockMs) : DEFAULT_SETTINGS.autoLockMs,
  };
}

/** Atomic write, so a crash mid-save cannot leave a half-written file. */
export function writeSettings(path, settings) {
  if (!path) return false;
  const clean = { autoLockMs: coerceAutoLock(settings ? settings.autoLockMs : undefined) };
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(clean, null, 2), { encoding: 'utf-8', mode: 0o600 });
    renameSync(tmp, path);
    if (existsSync(tmp)) unlinkSync(tmp);
    return true;
  } catch (err) {
    console.warn('[vault-settings] could not write', path, '-', err.message);
    return false;
  }
}
