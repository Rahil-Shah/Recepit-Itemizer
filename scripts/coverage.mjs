// Runs the whole test suite with V8 coverage and reports it against the
// source files: server.mjs and server/**, and src/** (the browser code, which
// the tests load as a compiled bundle; its inline source map leads back to the
// TypeScript). Fails when line coverage drops under the threshold.
//
//   npm run coverage            text summary + coverage/lcov.info
import { spawnSync } from "node:child_process";
import { rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoverageReport } from "monocart-coverage-reports";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = path.join(root, "coverage", "raw");
const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? 80);

rmSync(path.join(root, "coverage"), { recursive: true, force: true });

const build = spawnSync("npm", ["run", "build:tests"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const tests = readdirSync(path.join(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join("tests", name));
const run = spawnSync(process.execPath, ["--test", "--test-reporter=dot", ...tests], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_V8_COVERAGE: raw }
});

const report = new CoverageReport({
  name: "Receipt Ring",
  outputDir: path.join(root, "coverage"),
  reports: ["console-summary", ["console-details", { skipPercent: 100 }], "lcovonly"],
  entryFilter: (entry) =>
    entry.url.startsWith(`file://${root}/`) &&
    !entry.url.includes("/node_modules/") &&
    (entry.url.includes("/server/") || entry.url.endsWith("/server.mjs") || entry.url.endsWith("/tests/dist/bundle.cjs") || entry.url.endsWith("/tests/dist/app.cjs")),
  sourceFilter: (sourcePath) => /(^|\/)(src|server)\//.test(sourcePath) || sourcePath.endsWith("server.mjs"),
  sourcePath: (filePath) => filePath.replace(/^.*?(?=(src|server)\/)/, ""),
  // Files no test loads count too, at zero, so the number cannot be raised by
  // simply never touching a file.
  all: {
    dir: ["./src", "./server"],
    filter: (filePath) => /\.(ts|mjs)$/.test(filePath) && !filePath.includes("/fonts/")
  }
});
await report.addFromDir(raw);
const results = await report.generate();

const lines = results.summary.lines.pct;
console.log(`\nLine coverage ${lines}% (threshold ${THRESHOLD}%)`);
if (run.status !== 0) {
  console.error("Some tests failed.");
  process.exit(run.status ?? 1);
}
if (lines < THRESHOLD) {
  console.error(`Coverage is under ${THRESHOLD}%.`);
  process.exit(1);
}
