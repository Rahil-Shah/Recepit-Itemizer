// Loads the compiled ReceiptRing namespace bundle (tests/dist/bundle.js,
// built by `tsc -p tests/tsconfig.json`) into a fresh vm context so the
// browser-targeted namespace code can be exercised under node:test.
//
// Mostly the pure service files, plus the view modules whose exported helpers
// are worth testing on their own — nothing in the bundle touches the DOM at
// load time, which is the property that matters here. A view class is fine to
// compile in: it only reaches for `document` inside its methods, and those are
// not what these tests call. Browser globals a service reaches for at runtime
// (localStorage) are provided as small in-memory fakes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bundle.js");

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

// Objects built inside the vm context carry that realm's prototypes, which
// assert.deepStrictEqual rejects. Round-trip through JSON to compare
// structure, not realm.
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadReceiptRing(globals = {}) {
  const localStorage = globals.localStorage ?? createLocalStorageFake();
  const context = vm.createContext({ console, localStorage, ...globals });
  vm.runInContext(readFileSync(bundlePath, "utf8"), context, { filename: "bundle.js" });
  return { ReceiptRing: context.ReceiptRing, localStorage };
}
