import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";
import { createFakeDocument, FakeElement } from "./helpers/fake-dom.mjs";

// The loader helpers run against a fake document, a fake clock (Date.now)
// and fake timers, so the tests can say exactly when an overlay leaves.
function setup() {
  const document = createFakeDocument();
  const timers = [];
  const window = {
    setTimeout: (callback, ms) => {
      timers.push({ callback, ms });
      return timers.length;
    }
  };
  const clock = { now: 1_000 };
  const { ReceiptRing, context } = loadReceiptRing({ document, window, __clock: clock });
  vm.runInContext("Date.now = () => __clock.now;", context);
  const runTimers = () => {
    while (timers.length > 0) timers.shift().callback();
  };
  return { UI: ReceiptRing.UI, document, clock, timers, runTimers };
}

function classesOf(element) {
  return element.children.map((child) => child.getAttribute("class"));
}

test("the loader mark is the brand's ring round a receipt slip", () => {
  const { UI } = setup();
  const mark = UI.buildLoaderMark();

  assert.equal(mark.getAttribute("viewBox"), "0 0 48 48");
  assert.equal(mark.getAttribute("aria-hidden"), "true");
  assert.deepEqual(classesOf(mark), [
    "loader-track",
    "loader-arc",
    "loader-disc",
    "loader-slip",
    "loader-line",
    "loader-line",
    "loader-line"
  ]);
  // The arc and the lines animate their dashes against these lengths.
  assert.equal(mark.children[1].getAttribute("pathLength"), "100");
  assert.ok(mark.children.slice(4).every((line) => line.getAttribute("pathLength") === "1"));
});

test("createLoader writes what is loading under the mark", () => {
  const { UI } = setup();
  const loader = UI.createLoader({ label: "Building your PDF…", hint: "A whole year takes a moment.", size: "lg" });

  assert.equal(loader.className, "loader loader-lg");
  assert.deepEqual(classesOf(loader), ["loader-mark", "loader-label", "loader-hint"]);
  assert.equal(loader.querySelector(".loader-label").textContent, "Building your PDF…");
  assert.equal(loader.querySelector(".loader-hint").textContent, "A whole year takes a moment.");
  assert.deepEqual(classesOf(UI.createLoader()), ["loader-mark"]);
});

test("an overlay covers the container until its load ends, then fades out", () => {
  const { UI, clock, timers, runTimers } = setup();
  const overlays = new UI.LoadingOverlays();
  const panel = new FakeElement("div");

  const done = overlays.show(panel, "Loading your receipts…");
  const overlay = panel.querySelector(".loading-overlay");
  assert.ok(overlay, "the overlay is in the panel");
  assert.equal(overlay.getAttribute("role"), "status");
  assert.equal(overlay.querySelector(".loader-label").textContent, "Loading your receipts…");
  assert.ok(panel.classList.contains("is-loading"));
  assert.equal(panel.getAttribute("aria-busy"), "true");
  assert.equal(overlays.isLoading(panel), true);

  // Long enough for the overlay to have been seen: it fades rather than vanishing.
  clock.now += 1_000;
  done();
  assert.equal(panel.classList.contains("is-loading"), false);
  assert.equal(panel.hasAttribute("aria-busy"), false);
  assert.ok(overlay.classList.contains("is-leaving"));
  assert.equal(timers.length, 1);
  runTimers();
  assert.equal(panel.querySelector(".loading-overlay"), null);
  assert.equal(overlays.isLoading(panel), false);
});

test("overlapping loads share one overlay, and it leaves with the last of them", () => {
  const { UI, clock, runTimers } = setup();
  const overlays = new UI.LoadingOverlays();
  const panel = new FakeElement("div");

  const first = overlays.show(panel, "Adding up your spending…");
  const second = overlays.show(panel, "Totalling education expenses…", "Fetching rent");
  assert.equal(panel.querySelectorAll(".loading-overlay").length, 1);
  // The newest load says what is happening.
  assert.equal(panel.querySelector(".loader-label").textContent, "Totalling education expenses…");
  assert.equal(panel.querySelector(".loader-hint").textContent, "Fetching rent");

  clock.now += 1_000;
  first();
  first(); // Ending the same load twice must not end the other one.
  assert.equal(overlays.isLoading(panel), true);
  assert.equal(panel.querySelectorAll(".loading-overlay").length, 1);

  second();
  runTimers();
  assert.equal(overlays.isLoading(panel), false);
  assert.equal(panel.querySelectorAll(".loading-overlay").length, 0);
});

test("a load that ends before the overlay would appear never shows it", () => {
  const { UI, clock, timers } = setup();
  const overlays = new UI.LoadingOverlays();
  const panel = new FakeElement("div");

  const done = overlays.show(panel, "Loading…");
  clock.now += 50;
  done();
  // Gone at once: no fade-out, which would have flashed it at full opacity.
  assert.equal(panel.querySelector(".loading-overlay"), null);
  assert.equal(timers.length, 0);
});

test("setBusy disables a button and puts the ring in front of its label", () => {
  const { UI } = setup();
  const button = new FakeElement("button");
  const label = new FakeElement("span");
  label.textContent = "Download";
  button.append(label);

  UI.setBusy(button, true);
  assert.equal(button.disabled, true);
  assert.ok(button.classList.contains("is-busy"));
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(button.children[0].className, "loader loader-sm");

  UI.setBusy(button, true);
  assert.equal(button.querySelectorAll(":scope > .loader").length, 1, "one spinner, however often it is set");

  UI.setBusy(button, false);
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains("is-busy"), false);
  assert.equal(button.hasAttribute("aria-busy"), false);
  assert.equal(button.querySelector(".loader"), null);
  assert.equal(button.textContent, "Download");
});

test("mountLoaders draws the mark into each placeholder, once", () => {
  const { UI, document } = setup();
  const placeholders = [new FakeElement("span"), new FakeElement("span")];
  for (const placeholder of placeholders) {
    placeholder.setAttribute("data-loader", "");
    document.body.append(placeholder);
  }

  UI.mountLoaders(document);
  UI.mountLoaders(document);
  for (const placeholder of placeholders) {
    assert.equal(placeholder.querySelectorAll(".loader-mark").length, 1);
  }
});
