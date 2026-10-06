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

// Overridable globals. Anything not passed falls back to the real global.
// The event classes are here so the UI tests can hand the app jsdom's while
// Node's stay global for everything else in the process (the test database's
// socket server dispatches Node events).
const NAMES = [
  "document", "window", "localStorage", "fetch", "Date", "navigator",
  "Event", "CustomEvent", "EventTarget", "MouseEvent", "KeyboardEvent"
];

function wrap(input, output) {
  const source = readFileSync(path.join(dist, input), "utf8");
  const marker = "//# sourceMappingURL=";
  const at = source.lastIndexOf(marker);
  const code = at >= 0 ? source.slice(0, at) : source;
  const map = at >= 0 ? source.slice(at).trim() : "";
  const header =
    "module.exports = function loadBundle(__g) { " +
    NAMES.map((name) => `var ${name} = "${name}" in __g ? __g.${name} : globalThis.${name};`).join(" ") +
    " ";
  // The header shares line 1 with the bundle so every later line keeps the
  // line number the source map was written for.
  writeFileSync(path.join(dist, output), `${header}${code}\nreturn ReceiptRing;\n};\n${map}\n`);
}

// The pure-service bundle most tests load, and the whole app (main.ts
// included) that the UI tests drive in jsdom.
wrap("bundle.js", "bundle.cjs");
wrap("app.js", "app.cjs");
