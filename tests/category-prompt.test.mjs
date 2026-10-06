import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { loadReceiptRing } from "./helpers/load-bundle.mjs";

// The categorize dialog from public/index.html, driven on its own.
function setup() {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ""));
  const { window } = dom;
  const { document } = window;
  const { ReceiptRing } = loadReceiptRing({ document, window });
  const $ = (id) => document.getElementById(id);
  const elements = {
    categoryPrompt: $("categoryPrompt"),
    categoryPromptItem: $("categoryPromptItem"),
    categoryPromptSelect: $("categoryPromptSelect"),
    categoryPromptRemember: $("categoryPromptRemember"),
    categoryPromptSkip: $("categoryPromptSkip"),
    categoryPromptSave: $("categoryPromptSave")
  };
  const view = new ReceiptRing.UI.CategoryPromptView(ReceiptRing.Config.CATEGORIES, elements);
  const item = { id: "i1", label: "Mystery Thing", amount: 3, category: "Other", categorizationConfidence: 0.2, categorizationSource: "uncertain", needsCategoryReview: true };
  const key = (name, options = {}) => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: name, bubbles: true, ...options }));
  return { window, document, elements, view, item, key };
}

test("lists every category and shows the item", () => {
  const { view, elements, item } = setup();
  assert.equal(elements.categoryPromptSelect.options.length, 8);
  void view.prompt(item);
  assert.equal(elements.categoryPromptItem.textContent, "Mystery Thing");
  assert.equal(elements.categoryPromptSelect.value, "Other");
  assert.ok(!elements.categoryPrompt.classList.contains("hidden"));
});

test("save resolves with the chosen category and whether to remember it", async () => {
  const { view, elements, item } = setup();
  const answer = view.prompt(item);
  elements.categoryPromptSelect.value = "Health";
  elements.categoryPromptRemember.checked = true;
  elements.categoryPromptSave.click();
  assert.deepEqual({ ...(await answer) }, { category: "Health", remember: true });
  assert.ok(elements.categoryPrompt.classList.contains("hidden"));
});

test("skip, Escape and the backdrop all dismiss with no answer", async () => {
  const { view, elements, item, key, window } = setup();
  let answer = view.prompt(item);
  elements.categoryPromptSkip.click();
  assert.equal(await answer, null);

  answer = view.prompt(item);
  key("Escape");
  assert.equal(await answer, null);

  answer = view.prompt(item);
  elements.categoryPrompt.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(await answer, null);

  // Keys do nothing while no prompt is open.
  key("Escape");
});

test("a second prompt settles the first rather than leaving it hanging", async () => {
  const { view, item } = setup();
  const first = view.prompt(item);
  void view.prompt({ ...item, id: "i2" });
  assert.equal(await first, null);
});

test("Tab wraps focus inside the dialog, both ways", () => {
  const { view, elements, item, key, document } = setup();
  void view.prompt(item);
  const focusable = elements.categoryPrompt.querySelectorAll("select, input, button");
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  last.focus();
  key("Tab");
  assert.equal(document.activeElement, first);

  first.focus();
  key("Tab", { shiftKey: true });
  assert.equal(document.activeElement, last);

  // From outside the dialog, Tab comes back in.
  document.body.focus();
  key("Tab");
  assert.equal(document.activeElement, first);

  // In the middle, Tab is left alone.
  focusable[1].focus();
  key("Tab");
  assert.equal(document.activeElement, focusable[1]);
});
