# 9Router-Sync 🔄

> **Event-driven, zero-overhead automatic model catalog synchronizer from [9Router](https://github.com/anomalyco/9router) to [Hermes Agent](https://github.com/NousResearch/hermes-agent) (all profiles) and [OpenCode](https://opencode.ai/).**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20(x64)%20Optimized-0078D6.svg?logo=windows)]()

> [!IMPORTANT]
> **Platform Support & Architecture Notice**  
> This project is designed, benchmarked, and **primarily optimized for Windows (x64)** (Windows 10 & 11). The automated silent background launcher (`scripts/install-windows.ps1` via VBS/WScript) is specifically built for Windows. While the underlying Node.js CLI engine contains cross-platform path helpers, automated autostart and headless daemonization out of the box are tailored for Windows x64 environments.

---

## 🎯 The Problem

When using local proxies like **9Router** as an OpenAI-compatible provider:
- **OpenCode** requires custom `@ai-sdk/openai-compatible` models to be explicitly listed inside `provider.<id>.models` in `opencode.json` to be discoverable in the model picker.
- **Hermes Agent** treats explicit `providers.<id>.models` mappings in `config.yaml` as user-curated metadata, so newly added remote models are not automatically registered into completions or sub-profiles.
- Developers often have to manually copy-paste model IDs, vision capabilities, and token context limits into configuration files every time an upstream provider changes.

**`9router-sync` solves this permanently.** It listens for SQLite database changes in 9Router and immediately updates your OpenCode and Hermes configurations in real-time, **without background polling loops or CPU overhead.**

---

## ✨ Features

- **⚡ 100% Event-Driven**: Zero polling loops. Only runs when 9Router's database writes a change (`data.sqlite` / `-wal`) or when a new Hermes profile is created.
- **🛡️ Auto-Detection & Graceful Fallback**:
  - Uses Hermes only? OpenCode is safely skipped without errors.
  - Uses OpenCode only? Hermes is safely skipped without errors.
  - Uses both? Everything is updated in tandem.
- **🧩 Preserves YAML Comments & Structure**: Built with AST-aware YAML serialization to ensure your custom comments, indentation, and keys in Hermes `config.yaml` remain intact.
- **👥 Multi-Profile Support**: Automatically updates the `default` Hermes profile and **all** sub-profiles (`profiles/*`), purging stale disk caches seamlessly.
- **👁️ Full Capabilities Mapping**: Automatically maps vision capabilities (`modalities: ["text", "image"]`) and exact context/output limits (`contextWindow`, `maxOutput`).
- **🪟 Silent Background Daemon**: Windows launcher runs completely headless (`windowsHide: true`), eliminating popup command prompt windows.
- **🔌 OpenCode JIT Plugin**: Includes an optional zero-latency plugin hooking OpenCode's `config` lifecycle to guarantee live models on cold start.

---

## 🏗️ Architecture

```text
┌─────────────────────────┐
│      9Router Panel      │ (Add / Edit / Remove Provider)
└────────────┬────────────┘
             │ Writes
             ▼
┌─────────────────────────┐
│   9Router SQLite DB     │ (%APPDATA%/9router/db/data.sqlite)
└────────────┬────────────┘
             │ Triggers fs.watch (Debounce 1.5s)
             ▼
┌─────────────────────────┐      GET /v1/models      ┌─────────────────────────┐
│   9router-sync Daemon   │ ◄───────────────────────┤   9Router Local Server  │
│   (Headless Background) │                         │  http://127.0.0.1:20128 │
└────────────┬────────────┘                         └─────────────────────────┘
             │
             ├──► 1. OpenCode (~/.config/opencode/opencode.json)
             │       Injects models with modalities & token limits
             │
             ├──► 2. Hermes Profiles (~/.hermes/config.yaml & profiles/*)
             │       Updates providers.9router.models (preserving comments)
             │
             └──► 3. Cache Purge
                     Invalidates provider_models_cache.json
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Operating System**: Windows 10 / 11 (x64) (Tested & Recommended).
- [Node.js](https://nodejs.org/) v18.0.0 or higher.
- [9Router](https://github.com/anomalyco/9router) running locally (default: `http://127.0.0.1:20128/v1`).

---

### Windows (Automated Setup)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/9router-sync.git
   cd 9router-sync
   ```

2. Run the PowerShell installer:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
   ```

   **What the installer does:**
   - Installs minimal npm dependencies (`yaml`).
   - Copies the OpenCode JIT plugin to `~/.config/opencode/plugins/` (if OpenCode is present).
   - Creates a silent startup script in Windows Startup (`9Router_ModelSync.vbs`) that runs headless on system boot.
   - Starts the background watcher immediately.

---

### Linux / macOS / Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Perform a one-time synchronization:
   ```bash
   node bin/9router-sync.js --once
   ```

3. Start the background watcher daemon:
   ```bash
   node bin/9router-sync.js --watch
   ```
   *(You can manage this process using [PM2](https://pm2.keymetrics.io/) or a user-level `systemd` service).*

---

## 💻 CLI Usage

```text
Usage:
  9router-sync [options]

Options:
  --watch          Run event-driven daemon watching 9Router DB & profiles (default)
  --once           Execute a single synchronization run and exit
  --port <port>    Custom 9Router port (default: 20128)
  --hermes-only    Synchronize only Hermes profiles (skip OpenCode)
  --opencode-only  Synchronize only OpenCode config (skip Hermes)
  --verbose, -v    Show detailed event and sync diagnostic logs
  --help, -h       Show help message
  --version        Show version number
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NINEROUTER_URL` | Full base URL for 9Router endpoint | `http://127.0.0.1:20128/v1` |
| `NINEROUTER_PORT` | Custom port for 9Router | `20128` |
| `NINEROUTER_DB_DIR` | Custom path to 9Router SQLite database folder | Auto-detected per OS |
| `OPENCODE_CONFIG` | Custom path to `opencode.json` | `~/.config/opencode/opencode.json` |
| `HERMES_HOME` | Custom Hermes home directory | Auto-detected per OS |

---

## 🧪 Testing

Run the included test suite:
```bash
npm test
```
The test suite validates:
- Graceful skipping when client configuration files are absent.
- Accurate mapping of vision modalities and token limits for OpenCode.
- Accurate preservation of comments, spacing, and keys in Hermes `config.yaml`.
- Path resolution and fallback mechanics.

---

## 🗑️ Uninstallation

### Windows
Run the uninstaller script:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-windows.ps1
```
This stops the running watcher process and removes the Windows Startup launcher.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
