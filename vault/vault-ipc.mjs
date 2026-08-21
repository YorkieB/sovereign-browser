// vault-ipc.mjs - main-process side of the vault bridge.
//
// The security rule this file exists to enforce: a vault channel may only be
// served to the one webContents that owns the vault UI. HOLLY renders arbitrary
// web pages; if any of them could reach these handlers, the vault is gone.
// Checking that a preload was attached is NOT sufficient - the guard must live
// here, in main, and be keyed on the caller's identity.

import { ipcMain } from "electron";
import { VaultLockedError, VaultStateError, generatePassword } from "./vault-service.mjs";
import { VaultAuthError, VaultFormatError } from "./vault-crypto.mjs";

/** Map an error to a stable code the UI can branch on. Never leak a stack. */
function toFailure(err) {
  const code =
    err instanceof VaultAuthError ? "AUTH" :
    err instanceof VaultLockedError ? "LOCKED" :
    err instanceof VaultFormatError ? "FORMAT" :
    err instanceof VaultStateError ? "STATE" :
    "UNKNOWN";
  if (code === "UNKNOWN") {
    // Unexpected faults are logged in main but not described to the renderer.
    console.error("[vault-ipc] unexpected error:", err);
    return { ok: false, code, message: "The vault hit an unexpected problem. See the HOLLY log." };
  }
  return { ok: false, code, message: err.message };
}

function isPlainString(v) { return typeof v === "string"; }

/**
 * @param service   a VaultService instance
 * @param isAuthorised  (event) => boolean - decides whether this caller may use the vault
 * @param options   { onAutoLockChanged } - called after a successful policy
 *                  change so the caller can persist it. Persistence is the
 *                  caller's job: this module does not touch the disk.
 */
export function registerVaultIpc(service, isAuthorised, options) {
  if (typeof isAuthorised !== "function") {
    throw new Error("registerVaultIpc requires an isAuthorised(event) predicate.");
  }
  const onAutoLockChanged = options && typeof options.onAutoLockChanged === "function"
    ? options.onAutoLockChanged
    : null;

  const handlers = {
    "vault:state": () => service.state,
    "vault:status": () => ({
      state: service.state,
      exists: service.exists,
      autoLockEnabled: service.autoLockEnabled,
      autoLockMs: service.autoLockMs,
      // Infinity does not survive structured clone as a number the UI can use.
      msUntilAutoLock: service.msUntilAutoLock === Infinity ? null : service.msUntilAutoLock,
    }),

    "vault:create": async (pw) => {
      if (!isPlainString(pw)) throw new VaultStateError("Master password must be a string.");
      return service.create(pw);
    },
    "vault:unlock": async (pw) => {
      if (!isPlainString(pw)) throw new VaultStateError("Master password must be a string.");
      return service.unlock(pw);
    },
    "vault:lock": () => { service.lock(); return "locked"; },
    "vault:touch": () => { service.touch(); return true; },
    "vault:change-master": async (oldPw, newPw) => {
      if (!isPlainString(oldPw) || !isPlainString(newPw)) {
        throw new VaultStateError("Both passwords must be strings.");
      }
      return service.changeMasterPassword(oldPw, newPw);
    },

    "vault:list": () => service.list(),
    "vault:get": (id) => {
      if (!isPlainString(id)) throw new VaultStateError("Entry id must be a string.");
      return service.get(id);
    },
    "vault:add": (entry) => service.add(entry),
    "vault:update": (id, patch) => {
      if (!isPlainString(id)) throw new VaultStateError("Entry id must be a string.");
      return service.update(id, patch);
    },
    "vault:remove": (id) => {
      if (!isPlainString(id)) throw new VaultStateError("Entry id must be a string.");
      return service.remove(id);
    },
    "vault:import": (entries) => service.importEntries(entries),

    "vault:set-auto-lock": (value) => {
      const applied = service.setAutoLock(value);
      // Only after the service accepted it: an invalid value throws above and
      // never reaches here, so a rejected change is never persisted.
      if (onAutoLockChanged) {
        try {
          onAutoLockChanged(applied);
        } catch (err) {
          console.warn("[vault-ipc] could not persist the auto-lock policy:", err.message);
        }
      }
      return applied;
    },
    "vault:generate": (options) => generatePassword(options || {}),
  };

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isAuthorised(event)) {
        // Deliberately terse. An unauthorised caller learns nothing about the
        // vault's existence or state.
        const url = event.senderFrame ? event.senderFrame.url : "unknown";
        console.warn(`[vault-ipc] BLOCKED ${channel} from unauthorised frame: ${url}`);
        return { ok: false, code: "FORBIDDEN", message: "Not permitted." };
      }
      try {
        return { ok: true, value: await fn(...args) };
      } catch (err) {
        return toFailure(err);
      }
    });
  }

  return Object.keys(handlers);
}

/** Remove every vault handler, e.g. on teardown. */
export function unregisterVaultIpc(channels) {
  for (const c of channels) ipcMain.removeHandler(c);
}
