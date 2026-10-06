const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { get9RouterDbDir, getHermesProfilesRoot } = require("./utils/paths");
const { runSync } = require("./sync");

const LOCK_DIR = path.join(os.homedir(), ".9router-sync");
const LOCK_FILE = path.join(LOCK_DIR, "watcher.lock");

function acquireLock() {
  if (!fs.existsSync(LOCK_DIR)) {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  }

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const existingPid = parseInt(fs.readFileSync(LOCK_FILE, "utf-8").trim(), 10);
      if (!isNaN(existingPid)) {
        try {
          process.kill(existingPid, 0); // Check if alive
          console.log(`[9Router-Sync] Watcher is already active (PID: ${existingPid}). Exiting.`);
          process.exit(0);
        } catch (e) {
          // Stale lock file, safe to take over
        }
      }
    } catch (e) {}
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid), "utf-8");

  const cleanup = () => {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf-8").trim(), 10);
        if (pid === process.pid) fs.unlinkSync(LOCK_FILE);
      }
    } catch (e) {}
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
}

function startWatcher(options = {}) {
  acquireLock();

  let debounceTimer = null;
  let isSyncing = false;

  async function trigger(reason) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (isSyncing) return;
      isSyncing = true;
      const timestamp = new Date().toLocaleTimeString();
      if (options.verbose) {
        console.log(`[${timestamp}] [9Router-Sync] Event detected (${reason}). Syncing models...`);
      }
      try {
        const res = await runSync(options);
        if (res.success) {
          console.log(`[${timestamp}] [9Router-Sync] Synced ${res.modelCount} models successfully.`);
        } else if (options.verbose) {
          console.warn(`[${timestamp}] [9Router-Sync] Notice: ${res.error}`);
        }
      } catch (err) {
        console.error(`[${timestamp}] [9Router-Sync] Sync failed:`, err.message);
      } finally {
        isSyncing = false;
      }
    }, 1500);
  }

  // 1. Initial sync on boot
  trigger("Initial startup");

  // 2. Watch 9Router SQLite database directory
  const dbDir = get9RouterDbDir();
  if (fs.existsSync(dbDir)) {
    console.log(`[9Router-Sync] Watching 9Router database: ${dbDir}`);
    try {
      fs.watch(dbDir, (eventType, filename) => {
        if (filename && filename.startsWith("data.sqlite")) {
          trigger("Database change: " + filename);
        }
      });
    } catch (err) {
      console.warn(`[9Router-Sync] Warning: Failed to watch ${dbDir}:`, err.message);
    }
  } else {
    console.log(`[9Router-Sync] 9Router database folder not yet created: ${dbDir}`);
  }

  // 3. Watch Hermes profiles directory for new profile creations
  const profilesDir = getHermesProfilesRoot();
  if (fs.existsSync(profilesDir)) {
    console.log(`[9Router-Sync] Watching Hermes profiles: ${profilesDir}`);
    try {
      fs.watch(profilesDir, (eventType, filename) => {
        if (filename && !filename.startsWith(".")) {
          trigger("Profile change: " + filename);
        }
      });
    } catch (err) {
      /* ignore */
    }
  }

  console.log("[9Router-Sync] Event-driven watcher is running in the background.");
}

module.exports = {
  startWatcher,
};
