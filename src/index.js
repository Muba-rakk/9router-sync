const { runSync, fetch9RouterModels, updateHermes, updateOpenCode } = require("./sync");
const { startWatcher } = require("./watcher");
const paths = require("./utils/paths");

module.exports = {
  runSync,
  startWatcher,
  fetch9RouterModels,
  updateHermes,
  updateOpenCode,
  paths,
};
