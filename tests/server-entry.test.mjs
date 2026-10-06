import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// server.mjs is the process entry: it checks the environment, builds the
// Prisma client and the app, and listens only when run directly.
function run(env, script) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    env: { PATH: process.env.PATH, NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE ?? "", ...env },
    encoding: "utf8"
  });
}

const goodEnv = {
  DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:1/none",
  TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
  AUTH_SESSION_SECRET: "test-secret",
  ALLOW_PUBLIC_SIGNUP: "true",
  DOTENV_CONFIG_PATH: "/nonexistent/.env"
};

test("importing the entry builds the app without listening", () => {
  const result = run(goodEnv, `const app = (await import("./server.mjs")).default; console.log(typeof app.listen); process.exit(0);`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /function/);
});

test("a missing DATABASE_URL fails the import with the reason", () => {
  const result = run({ ...goodEnv, DATABASE_URL: "" }, `try { await import("./server.mjs"); } catch (e) { console.log(e.message); }`);
  assert.match(result.stdout, /DATABASE_URL is not set/);
});

test("a missing encryption key fails the import with the reason", () => {
  const result = run({ ...goodEnv, TOKEN_ENCRYPTION_KEY: "" }, `try { await import("./server.mjs"); } catch (e) { console.log(e.message); }`);
  assert.match(result.stdout, /TOKEN_ENCRYPTION_KEY is not set/);
});

test("run directly, it listens on PORT", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; if (out.includes("running at")) { console.log("LISTENING"); child.kill("SIGTERM"); } });
    setTimeout(() => { child.kill("SIGKILL"); }, 15000);
    child.on("exit", () => process.exit(0));
  `], { cwd: root, env: { PATH: process.env.PATH, NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE ?? "", ...goodEnv }, encoding: "utf8" });
  assert.match(result.stdout, /LISTENING/, result.stderr);
});

test("run directly with a bad environment, it exits non-zero", () => {
  const result = spawnSync(process.execPath, ["server.mjs"], {
    cwd: root,
    env: { PATH: process.env.PATH, ...goodEnv, AUTH_SESSION_SECRET: "" },
    encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AUTH_SESSION_SECRET is not set/);
});
