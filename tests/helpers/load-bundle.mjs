// Loads the compiled ReceiptRing namespace bundle (tests/dist/bundle.cjs,
// built by `npm run build:tests`: tsc, then tests/helpers/wrap-bundle.mjs) so
// the browser-targeted namespace code can be exercised under node:test.
//
// Mostly the pure service files, plus the view modules whose exported helpers
// are worth testing on their own -- nothing in the bundle touches the DOM at
// load time, which is the property that matters here. Each call evaluates the
// bundle afresh with the globals it is given (document, window, localStorage,
// fetch, Date, navigator); anything not given is the real global.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bundle.cjs");
const loadBundle = require(bundlePath);

export function createLocalStorageFake() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
}

// Kept for the tests written when the bundle ran in its own realm: a JSON
// round trip compares structure and nothing else.
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadReceiptRing(globals = {}) {
  const localStorage = globals.localStorage ?? createLocalStorageFake();
  const ReceiptRing = loadBundle({ ...globals, localStorage });
  return { ReceiptRing, localStorage };
}
