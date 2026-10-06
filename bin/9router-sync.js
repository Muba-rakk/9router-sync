#!/usr/bin/env node

const { runSync } = require("../src/sync");
const { startWatcher } = require("../src/watcher");

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
9Router Auto-Sync
Event-driven model catalog synchronizer from 9Router to Hermes Agent & OpenCode.

Usage:
  9router-sync [options]

Options:
  --watch          Run event-driven daemon watching 9Router DB & Hermes profiles (default)
  --once           Execute a single synchronization run and exit
  --port <port>    Custom 9Router port (default: 20128)
  --hermes-only    Synchronize only Hermes profiles (skip OpenCode)
  --opencode-only  Synchronize only OpenCode config (skip Hermes)
  --verbose, -v    Show detailed event and sync diagnostic logs
  --help, -h       Show this help message
  --version        Show version number

Environment Variables:
  NINEROUTER_URL      Full base URL for 9Router (e.g. http://127.0.0.1:20128/v1)
  NINEROUTER_PORT     Port for 9Router (e.g. 20128)
  NINEROUTER_DB_DIR   Directory path to 9Router SQLite database
  OPENCODE_CONFIG     Path to custom opencode.json file
  HERMES_HOME         Path to custom Hermes home directory
`);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version")) {
    const pkg = require("../package.json");
    console.log(`9router-sync v${pkg.version}`);
    process.exit(0);
  }

  const options = {
    once: args.includes("--once"),
    hermesOnly: args.includes("--hermes-only"),
    opencodeOnly: args.includes("--opencode-only"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    port: null,
  };

  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    options.port = args[portIdx + 1];
  }

  if (options.once) {
    console.log("[9Router-Sync] Performing one-time synchronization...");
    const res = await runSync(options);
    if (!res.success) {
      console.error("[9Router-Sync] Error:", res.error);
      process.exit(1);
    }

    console.log(`[9Router-Sync] Success! Found ${res.modelCount} models:`);
    if (res.opencode) {
      if (res.opencode.skipped) {
        console.log(`  - OpenCode: Skipped (${res.opencode.reason})`);
      } else if (res.opencode.updated) {
        console.log("  - OpenCode: Updated");
      } else {
        console.log("  - OpenCode: Already up-to-date");
      }
    }
    if (res.hermes) {
      if (res.hermes.skipped) {
        console.log(`  - Hermes: Skipped (${res.hermes.reason})`);
      } else {
        console.log(`  - Hermes: ${res.hermes.updatedCount} profile(s) updated`);
      }
    }
    process.exit(0);
  }

  // Default: start watcher daemon
  startWatcher(options);
}

main().catch((err) => {
  console.error("[9Router-Sync] Fatal error:", err);
  process.exit(1);
});
