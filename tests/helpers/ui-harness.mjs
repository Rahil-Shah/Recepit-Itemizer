// Drives the real front end -- public/index.html and the app compiled from
// src/ (main.ts included) -- in jsdom, against the real API on a test server
// (tests/helpers/test-server.mjs). Each UI test file is its own process, so
// the browser globals installed here live only as long as that file.
//
//   const ui = await openApp(server, { as: await server.signUp() });
//   ui.click("#sampleButton");
//   await ui.waitFor(() => ui.$$(".table-row").length > 1);
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { JPEG_DATA_URL } from "./test-server.mjs";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadApp = require(path.join(root, "tests", "dist", "app.cjs"));

// jsdom's own constructors, put on the global object so the app's
// `instanceof HTMLButtonElement`, `new Event(...)` and friends see the same
// classes as the document they run against.
function installGlobals(window) {
  // Node's own versions stay: the app hands these to Node's fetch, which
  // rejects jsdom's AbortSignal and URL objects.
  const keep = new Set([
    "undefined", "globalThis", "global", "process", "console", "fetch", "Buffer", "queueMicrotask",
    "AbortController", "AbortSignal", "URL", "URLSearchParams", "TextEncoder", "TextDecoder",
    "Headers", "Request", "Response", "Blob", "ReadableStream", "WebSocket", "Performance",
    "Event", "CustomEvent", "EventTarget", "MessageEvent", "MessageChannel", "MessagePort", "DOMException"
  ]);
  for (const name of Object.getOwnPropertyNames(window)) {
    if (keep.has(name) || name.startsWith("_")) continue;
    if (/^[A-Z]/.test(name) || ["CSS", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia"].includes(name)) {
      try {
        Object.defineProperty(globalThis, name, { value: window[name], configurable: true, writable: true });
      } catch {
        // A read-only global Node owns; the app does not need jsdom's copy.
      }
    }
  }
  for (const name of ["history", "location", "sessionStorage", "innerWidth", "innerHeight"]) {
    Object.defineProperty(globalThis, name, { get: () => window[name], configurable: true });
  }
  globalThis.window = window;
  globalThis.document = window.document;
}

/**
 * Open the app as `as` (a signed-in TestClient from server.signUp), or as a
 * visitor when `as` is omitted.
 */
export async function openApp(server, { as = null, setup } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    // jsdom announces what it does not implement (navigation, canvas); the
    // app copes with both, so only real script errors are kept.
    if (!/Not implemented/.test(error.message)) errors.push(error);
  });

  const html = readFileSync(path.join(root, "public", "index.html"), "utf8").replace(/<script[^>]*src=[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, { url: `${server.baseUrl}/`, pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  installGlobals(window);

  const client = as ?? server.client();
  const downloads = [];
  const notImplemented = [];

  // What a browser has and jsdom does not.
  window.CSS ??= {};
  window.CSS.escape ??= (value) => String(value).replace(/["\\\]\[]/g, "\\$&");
  globalThis.CSS = window.CSS;
  window.scrollTo = () => {};
  window.confirm = () => (ui.confirmAnswer === undefined ? true : ui.confirmAnswer);
  window.open = (url) => {
    notImplemented.push(["open", url]);
    return null;
  };
  window.URL.createObjectURL = (blob) => {
    ui.lastBlob = blob;
    return `blob:${server.baseUrl}/${downloads.length}`;
  };
  window.URL.revokeObjectURL = () => {};
  // The app's URL is Node's (see installGlobals), so it needs the same stand-in.
  globalThis.URL.createObjectURL = window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = window.URL.revokeObjectURL;
  window.HTMLAnchorElement.prototype.click = function click() {
    if (this.download) downloads.push({ name: this.download, blob: ui.lastBlob, href: this.href });
  };
  window.HTMLMediaElement.prototype.play = async () => {};
  // jsdom decodes no images and draws on no canvas. The app downscales every
  // photo through both, so they stand in here: any image "decodes" to 40x30,
  // and a canvas hands back a tiny real JPEG.
  window.createImageBitmap = async () => ({ width: 40, height: 30, close() {} });
  globalThis.createImageBitmap = window.createImageBitmap;
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  window.HTMLCanvasElement.prototype.toDataURL = () => JPEG_DATA_URL;
  window.HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
    callback(new window.Blob([Buffer.from(JPEG_DATA_URL.split(",")[1], "base64")], { type: "image/jpeg" }));
  };

  // The app's requests go to the test server, carrying this client's session.
  async function appFetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : String(input?.url ?? input), `${server.baseUrl}/`);
    const headers = new Headers(init.headers ?? {});
    if (client.cookie) headers.set("Cookie", client.cookie);
    let body = init.body;
    if (body instanceof window.Blob) body = Buffer.from(await body.arrayBuffer());
    const response = await fetch(url, { method: init.method ?? "GET", headers, body, signal: init.signal, redirect: "manual" });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = /rr_session=([^;]*)/.exec(setCookie);
      if (match) client.cookie = match[1] ? `rr_session=${match[1]}` : null;
    }
    ui.requests.push(`${init.method ?? "GET"} ${url.pathname}${url.search}`);
    return response;
  }
  window.fetch = appFetch;

  const ui = {
    window,
    document: window.document,
    client,
    downloads,
    errors,
    notImplemented,
    requests: [],
    confirmAnswer: undefined,
    lastBlob: null,
    $: (selector) => window.document.querySelector(selector),
    $$: (selector) => [...window.document.querySelectorAll(selector)],
    text: (selector) => window.document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    click(target) {
      const element = typeof target === "string" ? window.document.querySelector(target) : target;
      if (!element) throw new Error(`nothing to click: ${target}`);
      element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
      return element;
    },
    type(target, value) {
      const element = typeof target === "string" ? window.document.querySelector(target) : target;
      if (!element) throw new Error(`nothing to type into: ${target}`);
      element.value = value;
      element.dispatchEvent(new window.Event("input", { bubbles: true }));
      element.dispatchEvent(new window.Event("change", { bubbles: true }));
      return element;
    },
    key(target, key, options = {}) {
      const element = typeof target === "string" ? window.document.querySelector(target) : target;
      element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, ...options }));
    },
    /** A File the app can read, made from bytes. */
    file(name, bytes, type) {
      return new window.File([bytes], name, { type });
    },
    setFiles(target, files) {
      const input = typeof target === "string" ? window.document.querySelector(target) : target;
      Object.defineProperty(input, "files", { value: files, configurable: true });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    },
    async waitFor(check, { timeout = 8000, message = "condition" } = {}) {
      const started = Date.now();
      for (;;) {
        let value;
        try {
          value = await check();
        } catch {
          value = false;
        }
        if (value) return value;
        if (Date.now() - started > timeout) {
          throw new Error(
            `timed out waiting for ${message}. Toasts: ${ui.toasts().join(" | ")}. Requests: ${ui.requests.slice(-6).join(", ")}. Errors: ${errors.map((e) => e.message).join(" | ")}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    },
    /** Wait until no request has started for a moment. */
    async settle(quietMs = 120) {
      let count = -1;
      while (count !== ui.requests.length) {
        count = ui.requests.length;
        await new Promise((resolve) => setTimeout(resolve, quietMs));
      }
    },
    toasts: () => [...window.document.querySelectorAll(".toast")].map((toast) => toast.textContent.trim()),
    close() {
      window.close();
    }
  };

  if (setup) await setup(ui);

  loadApp({
    window,
    document: window.document,
    localStorage: window.localStorage,
    fetch: appFetch,
    navigator: window.navigator,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    EventTarget: window.EventTarget,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent
  });
  await ui.waitFor(() => window.document.body.dataset.auth !== "pending", { message: "the session check" });
  if (as) await ui.waitFor(() => window.document.body.dataset.access, { message: "the app to start" });
  await ui.settle();
  return ui;
}

/** A small PNG, decoded by nothing in jsdom but accepted by the server. */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
