# 9Router-Sync Linux Core Support — Design

Date: 2026-10-27
Status: Approved
Scope: Core Linux fixes only (phase 1)

## Problem

`9router-sync` is Windows-first. On a real Linux install it fails at three
points, so nothing syncs:

1. **Wrong DB path.** `src/utils/paths.js` derives `~/.config/9router/db` on
   non-Windows. Common Linux installs put the SQLite DB at `~/.9router/db`.
   The watcher therefore watches a non-existent directory.
2. **No auth.** `fetch9RouterModels()` (`src/sync.js`) sends no
   `Authorization` header. 9Router with `REQUIRE_API_KEY=true` returns `401`,
   so every sync reports failure.
3. **No Linux autostart.** Only `install-windows.ps1` (VBS) exists. There is
   no systemd unit and no Linux installer/uninstaller.

## Goals (phase 1)

- Correct 9Router DB path detection on Linux.
- Authenticate model fetches via API key.
- Provide systemd `--user` service plus install/uninstall scripts.
- Test path detection and API-key resolution.
- Update README to mark Linux as supported for these basics.

## Non-goals (deferred)

- Baca API key dari SQLite (`apiKeys` table).
- Atomic writes + config backup.
- HTTPS support in the OpenCode plugin.
- Watcher re-arm when DB dir appears later.
- macOS launchd.
- Extended CLI validation.

## Design

### 1. Path detection (`src/utils/paths.js`)

`get9RouterDbDir()`:
- env `NINEROUTER_DB_DIR` wins (unchanged).
- Windows: `%APPDATA%/9router/db` (unchanged).
- Linux/macOS: prefer `~/.9router/db`; if absent, fall back to
  `~/.config/9router/db`. Return `~/.9router/db` when neither exists
  (canonical Linux location).

### 2. API key resolution + auth (`src/sync.js`)

New `get9RouterApiKey()` resolution order:
1. env `NINEROUTER_API_KEY`.
2. `provider["9router"].options.apiKey` from `opencode.json`
   (only when the file exists and parses).
3. Empty string.

`fetch9RouterModels(baseUrl, apiKey, timeoutMs)` adds
`Authorization: Bearer <key>` only when a key is present, so Windows behavior
without a key is unchanged. `runSync()` resolves the key once and passes it.

Resolved key is also exported for reuse.

### 3. OpenCode plugin (`plugins/opencode-plugin.js`)

Pass `Authorization` from `pConfig.options.apiKey` (or
`NINEROUTER_API_KEY`) when fetching models. Windows behavior unchanged when no
key.

### 4. Linux install (`scripts/`)

- `scripts/9router-sync.service` — systemd `--user` unit running
  `node <repo>/bin/9router-sync.js --watch`, `Restart=on-failure`,
  `WantedBy=default.target`.
- `scripts/install-linux.sh` — installs deps, copies/links the OpenCode
  plugin if OpenCode present, installs the unit to
  `~/.config/systemd/user/`, `systemctl --user daemon-reload && enable --now`.
- `scripts/uninstall-linux.sh` — `disable --now`, remove unit, remove plugin,
  clear lock.

State dir stays `~/.9router-sync/watcher.lock` (cross-platform, unchanged).

### 5. Tests (`test/test.js`)

Add:
- Path: `get9RouterDbDir()` on linux returns a path under `~/.9router/db`
  (env override respected).
- Auth: `fetch9RouterModels()` includes/excludes `Authorization` correctly
  (local throwaway HTTP server).

### 6. README

Promote Linux from "untested" to "supported (core): sync + systemd user
service", keep macOS experimental.

## Data flow (unchanged except auth)

```
9Router panel -> data.sqlite -> fs.watch (1.5s debounce)
   -> runSync() -> GET /v1/models (Bearer key)
   -> updateOpenCode() + updateHermes() -> cache purge
```

## Risks

- Two candidate DB paths on Linux: preference order handles both.
- Key in opencode.json may be a literal or `{env:...}` token; phase 1 passes
  it through as-is.
