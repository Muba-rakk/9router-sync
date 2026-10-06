const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { updateOpenCode } = require("../src/sync");
const { updateHermesYaml } = require("../src/utils/yaml-updater");
const paths = require("../src/utils/paths");

console.log("[Test Suite] Running 9Router-Sync tests...");

// Test 1: Graceful skip when OpenCode file does not exist
{
  const missingPath = path.join(os.tmpdir(), "non-existent-opencode-" + Date.now() + ".json");
  const res = updateOpenCode(missingPath, [{ id: "test-model" }]);
  assert.strictEqual(res.skipped, true, "Should gracefully skip missing OpenCode config");
  console.log("✔ Test 1 Passed: Graceful OpenCode skip on missing file");
}

// Test 2: OpenCode JSON update with vision & token limits
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-test-"));
  const tmpJson = path.join(tmpDir, "opencode.json");
  fs.writeFileSync(
    tmpJson,
    JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      provider: {
        "9router": {
          npm: "@ai-sdk/openai-compatible",
          options: { baseURL: "http://127.0.0.1:20128/v1" },
          models: {},
        },
      },
    }),
    "utf-8"
  );

  const sampleModels = [
    { id: "test/claude-3-5", context_length: 200000, max_output: 64000, vision: true, tools: true },
    { id: "test/deepseek", context_length: 128000, max_output: 64000, vision: false, tools: true },
  ];

  const res = updateOpenCode(tmpJson, sampleModels);
  assert.strictEqual(res.updated, true, "OpenCode config should be updated");

  const updated = JSON.parse(fs.readFileSync(tmpJson, "utf-8"));
  const m1 = updated.provider["9router"].models["test/claude-3-5"];
  assert.deepStrictEqual(m1.modalities.input, ["text", "image"]);
  assert.strictEqual(m1.limit.context, 200000);

  const m2 = updated.provider["9router"].models["test/deepseek"];
  assert.deepStrictEqual(m2.modalities.input, ["text"]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("✔ Test 2 Passed: OpenCode JSON update & modalities validation");
}

// Test 3: Hermes YAML comment & structure preservation
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "9r-test-"));
  const tmpYaml = path.join(tmpDir, "config.yaml");
  const initialYaml = `# User Custom Comments
model:
  default: custom-model
# Provider Section
providers:
  9router:
    name: 9router
    base_url: http://127.0.0.1:20128/v1
    models: {}
`;
  fs.writeFileSync(tmpYaml, initialYaml, "utf-8");

  const sampleModels = [
    { id: "zd/claude-sonnet-4-5", context_length: 200000, max_output: 64000, vision: true, tools: true },
  ];

  const updated = updateHermesYaml(tmpYaml, sampleModels);
  assert.strictEqual(updated, true, "Hermes YAML should be updated");

  const content = fs.readFileSync(tmpYaml, "utf-8");
  assert.ok(content.includes("# User Custom Comments"), "Comments must be preserved");
  assert.ok(content.includes("# Provider Section"), "Section comments must be preserved");
  assert.ok(content.includes("zd/claude-sonnet-4-5"), "New model must be inserted");
  assert.ok(content.includes("context_length: 200000"), "Context length must be formatted");

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("✔ Test 3 Passed: Hermes YAML comment preservation");
}

// Test 4: Paths helper fallback
{
  const base = paths.get9RouterBaseUrl("20128");
  assert.strictEqual(base, "http://127.0.0.1:20128/v1");
  console.log("✔ Test 4 Passed: Paths helper fallback validation");
}

console.log("\nAll 4 tests passed successfully! 🎉\n");
