const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { get9RouterDbDir, get9RouterRootDir, getHermesProfilesRoot } = require("./utils/paths");
const { runSync } = require("./sync");

const LOCK_DIR = path.join(os.homedir(), ".9router-sync");
const LOCK_FILE = path.join(LOCK_DIR, "watcher.lock");

function isDatabaseEvent(filename) {
  // On Windows, filename can be null or undefined on coalesced filesystem events
  if (!filename) return true;
  const lower = String(filename).toLowerCase();
  return (
    lower.includes("data.sqlite") ||
    lower.endsWith(".sqlite") ||
    lower.endsWith(".sqlite-wal") ||
    lower.endsWith(".sqlite-shm")
  );
}

function isCatalogEvent(filename) {
  if (!filename) return false;
  const lower = String(filename).toLowerCase();
  return lower.startsWith("model-catalog");
}

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
  let pendingSync = false;
  let lastReason = "";

  async function executeSync() {
    isSyncing = true;
    pendingSync = false;
    const timestamp = new Date().toLocaleTimeString();
    if (options.verbose) {
      console.log(`[${timestamp}] [9Router-Sync] Event detected (${lastReason}). Syncing models...`);
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
      if (pendingSync) {
        trigger("Pending database changes after previous sync");
      }
    }
  }

  function trigger(reason) {
    lastReason = reason;
    if (isSyncing) {
      pendingSync = true;
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeSync();
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
        if (isDatabaseEvent(filename)) {
          trigger("Database change: " + (filename || "unspecified"));
        }
      });
    } catch (err) {
      console.warn(`[9Router-Sync] Warning: Failed to watch ${dbDir}:`, err.message);
    }

    // Direct watch on data.sqlite file if it exists, ensuring modifications are caught
    // even if Windows directory notifications miss in-place buffer writes
    const mainDbFile = path.join(dbDir, "data.sqlite");
    if (fs.existsSync(mainDbFile)) {
      try {
        fs.watch(mainDbFile, (eventType) => {
          trigger(`Database file change (${eventType})`);
        });
      } catch (err) {
        /* fail-open */
      }
    }
  } else {
    console.log(`[9Router-Sync] 9Router database folder not yet created: ${dbDir}`);
  }

  // 3. Watch 9Router root directory for extracted model-catalog changes
  const rootDir = get9RouterRootDir();
  if (fs.existsSync(rootDir)) {
    try {
      fs.watch(rootDir, (eventType, filename) => {
        if (isCatalogEvent(filename)) {
          trigger("Catalog file change: " + filename);
        }
      });
    } catch (err) {
      /* fail-open */
    }
  }

  // 4. Watch Hermes profiles directory for new profile creations
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
  isDatabaseEvent,
  isCatalogEvent,
  startWatcher,
};
