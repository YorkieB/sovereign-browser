# Vault UI (vendored build)

Built output of the Keychain password-manager UI, copied in from its own
repository. **Do not edit these files** - they are generated, and any change
here is lost on the next build.

## Provenance

| | |
|---|---|
| Source repo | `yorkiebrown1/password-manager` (private) |
| Branch | `holly-vault-integration` |
| Commit | `baec7ba` - "Serve Space Grotesk locally instead of from Google Fonts" |
| Built | 21 August 2026 |
| Build command | `npm run build` (Vite, `base: './'`) |

To change the vault UI: edit the source repo, `npm run build`, and copy
`dist/` over this directory as a single logged action.

## Why the build and not the source

The UI is React + Vite and needs a build step; HOLLY has no bundler and
should not grow one. Vendoring the output keeps HOLLY's startup to loading a
file, and keeps 500-odd npm packages out of this repository.

## Constraints this build must satisfy

These are properties of the vault window, not preferences - re-check them
after any rebuild:

- **No network requests.** The vault window must not phone anywhere. Space
  Grotesk is bundled locally rather than fetched from Google Fonts, which
  would otherwise reveal when the vault is opened. `index.html` contains no
  `https://` references; the only `fetch()` in the bundle is Vite's
  modulepreload polyfill acting on local hrefs.
- **Relative asset paths.** Loaded over `file://`, so `base: './'` is
  required - absolute paths resolve against the drive root and 404.
- **No storage of its own.** Entries live in the encrypted vault via the IPC
  bridge. The UI holds decrypted entries in React state only while unlocked.
