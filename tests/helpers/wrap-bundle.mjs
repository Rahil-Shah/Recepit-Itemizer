// Wraps the compiled test bundle (tests/dist/bundle.js) as a CommonJS module,
// tests/dist/bundle.cjs, exporting one function that evaluates the bundle and
// returns its ReceiptRing namespace.
//
// The bundle is browser code written for script tags: it reads globals such as
// document, window, localStorage and fetch. The wrapper declares those as
// locals taken from the argument, so each test hands in its own fakes, and
// each call evaluates the bundle afresh, so no state leaks between tests.
//
// It is a real file loaded by require() rather than code run through vm, so
// coverage tools see it like any other module and follow its inline source map
// back to the TypeScript under src/.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const source = readFileSync(path.join(dist, "bundle.js"), "utf8");

const marker = "//# sourceMappingURL=";
const at = source.lastIndexOf(marker);
const code = at >= 0 ? source.slice(0, at) : source;
const map = at >= 0 ? source.slice(at).trim() : "";

// Overridable globals. Anything not passed falls back to the real global.
const NAMES = ["document", "window", "localStorage", "fetch", "Date", "navigator"];
const header =
  "module.exports = function loadBundle(__g) { " +
  NAMES.map((name) => `var ${name} = "${name}" in __g ? __g.${name} : globalThis.${name};`).join(" ") +
  " ";
// The header shares line 1 with the bundle so every later line keeps the line
// number the source map was written for.
writeFileSync(path.join(dist, "bundle.cjs"), `${header}${code}\nreturn ReceiptRing;\n};\n${map}\n`);
