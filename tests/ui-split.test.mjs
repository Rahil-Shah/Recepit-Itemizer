import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stubGemini } from "./helpers/test-server.mjs";
import { openApp, PNG_BYTES } from "./helpers/ui-harness.mjs";

const server = await startTestServer();
let replies = [];
const restore = stubGemini(() => replies.shift() ?? "{}");
test.after(async () => {
  restore();
  await server.close();
});

const rows = (ui) => ui.$$("#receiptLinesList .table-row");
const rowFor = (ui, label) => rows(ui).find((row) => row.textContent.includes(label));

/** Answer the category prompts the sample receipt raises. */
async function answerCategoryPrompts(ui) {
  for (let guard = 0; guard < 12; guard += 1) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (ui.$("#categoryPrompt").classList.contains("hidden")) return;
    if (guard === 0) {
      ui.$("#categoryPromptRemember").checked = true;
      ui.click("#categoryPromptSave");
    } else {
      ui.click("#categoryPromptSkip");
    }
  }
}

async function addPerson(ui, name) {
  ui.type("#personNameInput", name);
  ui.click("#addPersonButton");
  await ui.waitFor(() => ui.$$("#peopleList .person-chip").some((chip) => chip.textContent.includes(name)), {
    message: `${name} to be added`
  });
}

function toggleAssign(ui, label, person) {
  const row = rowFor(ui, label);
  const personRow = [...row.querySelectorAll(".assign-person-row")].find((r) => r.textContent.includes(person));
  const box = personRow.querySelector("input[type=checkbox]");
  box.checked = !box.checked;
  box.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
}

const totalFor = (ui, name) =>
  ui.$$("#splitTotalsList .split-total-row").find((row) => row.textContent.includes(name))?.textContent ?? "";

test("the sample receipt: people, splits, modes, food, ignore, batch, tax, save, edit", async () => {
  const user = await server.signUp({ name: "Rahil" });
  const ui = await openApp(server, { as: user });

  ui.click("#sampleButton");
  await answerCategoryPrompts(ui);
  assert.equal(rows(ui).length, 7);
  assert.match(ui.text("#unassignedCount"), /7 unassigned/);

  await addPerson(ui, "Sam");
  await addPerson(ui, "Dylan");
  // A duplicate name is refused without a request.
  ui.type("#personNameInput", "sam");
  ui.click("#addPersonButton");
  assert.ok(ui.toasts().some((t) => /already in the list/.test(t)));
  ui.key("#personNameInput", "Enter");

  // One line by hand, evenly.
  toggleAssign(ui, "Organic Bananas", "Rahil");
  toggleAssign(ui, "Organic Bananas", "Sam");
  assert.match(ui.text("#unassignedCount"), /6 unassigned/);

  // Percentage, then custom amounts, on another.
  const bread = rowFor(ui, "Sourdough Bread");
  const mode = bread.querySelector(".assign-mode");
  mode.value = "percentage";
  mode.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  toggleAssign(ui, "Sourdough Bread", "Dylan");
  const value = rowFor(ui, "Sourdough Bread").querySelector(".assign-value:not([disabled])");
  ui.type(value, "50");
  assert.match(ui.text("#splitTotalsList"), /not on anyone's tab|unallocated|left/i);
  const amountMode = rowFor(ui, "Sourdough Bread").querySelector(".assign-mode");
  amountMode.value = "amount";
  amountMode.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  ui.type(rowFor(ui, "Sourdough Bread").querySelector(".assign-value:not([disabled])"), "5.25");
  const back = rowFor(ui, "Sourdough Bread").querySelector(".assign-mode");
  back.value = "equal";
  back.dispatchEvent(new ui.window.Event("change", { bubbles: true }));
  toggleAssign(ui, "Sourdough Bread", "Dylan");

  // Food and ignore on single lines.
  ui.click(rowFor(ui, "Greek Yogurt").querySelector(".line-food-check"));
  assert.match(rowFor(ui, "Greek Yogurt").querySelector(".line-food-check").getAttribute("aria-label"), /non-food/);
  ui.click(rowFor(ui, "Vitamins").querySelector(".delete-row"));
  assert.ok(rowFor(ui, "Vitamins").classList.contains("is-ignored"));
  ui.click(rowFor(ui, "Vitamins").querySelector(".delete-row"));

  // Batch: select all, put Dylan on everything, take him off, flag food,
  // ignore and restore, then a shift-click range.
  ui.click("#selectAllLines");
  assert.match(ui.text("#batchCount"), /7 lines selected/);
  const dylan = () => ui.$$("#batchActions .batch-person").find((b) => b.textContent.includes("Dylan"));
  ui.click(dylan());
  assert.match(dylan().className, /is-all/);
  ui.click(dylan());
  assert.match(dylan().className, /is-none/);
  ui.click(ui.$$("#batchActions .batch-flags button")[0]);
  ui.click(ui.$$("#batchActions .batch-flags button")[0]);
  ui.click(ui.$$("#batchActions .batch-flags button")[1]);
  assert.ok(rows(ui).every((row) => row.classList.contains("is-ignored")));
  ui.click(ui.$$("#batchActions .batch-flags button")[1]);
  ui.click("#selectAllLines");
  assert.ok(ui.$("#batchBar").classList.contains("hidden"));

  const selects = () => ui.$$("#receiptLinesList .line-select");
  ui.click(selects()[1]);
  selects()[4].dispatchEvent(new ui.window.MouseEvent("click", { bubbles: true, shiftKey: true }));
  assert.match(ui.text("#batchCount"), /4 lines selected/);
  ui.click(ui.$$("#batchActions .batch-person").find((b) => b.textContent.includes("Rahil")));
  ui.key(ui.document, "Escape");
  assert.ok(ui.$("#batchBar").classList.contains("hidden"));
  ui.click("#batchClearButton");

  // Everything else on Sam, then tax.
  ui.click("#selectAllLines");
  ui.click(ui.$$("#batchActions .batch-person").find((b) => b.textContent.includes("Sam")));
  ui.click("#batchClearButton");
  ui.type("#taxInput", "3.74");
  assert.match(ui.text("#receiptTotal"), /\$53\.70/);
  assert.match(totalFor(ui, "Rahil"), /\$/);

  ui.type("#storeNameInput", "Fresh Market");
  ui.type("#receiptCategory", "Dining");
  ui.click("#saveReceiptButton");
  await ui.waitFor(() => /Saved to history/.test(ui.text("#saveStatus")), { message: "the save" });
  const saved = (await user.get("/api/receipts")).body;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].storeName, "Fresh Market");
  assert.equal(saved[0].category, "Dining");
  await ui.waitFor(() => ui.$$("#recentReceipts .recent-item").length === 1, { message: "recent receipts" });

  // Reopen it from the recent list, change it, save in place.
  ui.click("#recentReceipts .recent-item");
  await ui.waitFor(() => !ui.$("#editBanner").classList.contains("hidden"), { message: "the edit banner" });
  assert.match(ui.text("#editBannerTitle"), /Fresh Market/);
  assert.equal(ui.text("#saveReceiptButton"), "Save changes");
  ui.type("#storeNameInput", "Fresh Market Co");
  ui.click("#saveReceiptButton");
  await ui.waitFor(() => /Changes saved/.test(ui.text("#saveStatus")), { message: "the update" });
  assert.equal((await user.get("/api/receipts")).body[0].storeName, "Fresh Market Co");

  // Cancel editing asks first when there are unsaved changes.
  ui.type("#taxInput", "1");
  ui.confirmAnswer = false;
  ui.click("#cancelEditButton");
  assert.ok(!ui.$("#editBanner").classList.contains("hidden"));
  ui.confirmAnswer = true;
  ui.click("#cancelEditButton");
  assert.ok(ui.$("#editBanner").classList.contains("hidden"));
  assert.equal(rows(ui).length, 0);

  // Removing a person.
  ui.click(ui.$$("#peopleList .person-chip").find((chip) => chip.textContent.includes("Dylan")).querySelector("button"));
  await ui.waitFor(() => !ui.$$("#peopleList .person-chip").some((chip) => chip.textContent.includes("Dylan")), {
    message: "Dylan to go"
  });
  assert.deepEqual(ui.errors, []);
});

test("typing a receipt, pasting JSON, and clearing", async () => {
  const ui = await openApp(server, { as: await server.signUp() });
  ui.type("#receiptText", "Corner Shop\nApples 2.50\nPears 3.10\nTotal 5.60");
  ui.click("#parseButton");
  assert.ok(rows(ui).length >= 2);

  ui.click("#pasteJsonButton");
  ui.click("#importPasteJsonButton");
  assert.match(ui.text("#pasteJsonStatus"), /Paste the JSON/);
  ui.type("#pasteJsonText", "{not json");
  ui.click("#importPasteJsonButton");
  assert.match(ui.text("#pasteJsonStatus"), /Could not parse/);
  ui.type("#pasteJsonText", '{"storeName":"X"}');
  ui.click("#importPasteJsonButton");
  assert.match(ui.text("#pasteJsonStatus"), /items/);
  ui.type(
    "#pasteJsonText",
    '```json\n{"storeName":"Deli","tax":0.5,"total":10.5,"subtotal":10,"items":[{"name":"SANDWICH","price":8,"discount":1},{"name":"SODA","price":3,"lowConfidence":true}]}\n```'
  );
  ui.click("#importPasteJsonButton");
  assert.ok(ui.$("#pasteJsonModal").classList.contains("hidden"));
  assert.equal(ui.$("#storeNameInput").value, "Deli");
  assert.equal(rows(ui).length, 2);
  assert.match(ui.text("#receiptLinesList"), /Sandwich \(was \$8\.00, -\$1\.00 discount\)/);
  await answerCategoryPrompts(ui);

  ui.click("#pasteJsonButton");
  ui.click("#closePasteJsonButton");
  assert.ok(ui.$("#pasteJsonModal").classList.contains("hidden"));

  ui.click("#clearButton");
  assert.equal(rows(ui).length, 0);
  assert.equal(ui.$("#storeNameInput").value, "");
  assert.ok(!ui.$("#emptyState").classList.contains("hidden"));

  // Saving with nothing on the receipt says so.
  ui.click("#saveReceiptButton");
  assert.match(ui.text("#saveStatus"), /Add receipt lines/);
});

test("a photo is read by Gemini into lines, and a failed read offers a retry", async () => {
  const admin = await server.admin();
  const ui = await openApp(server, { as: admin });

  replies.push(
    JSON.stringify({
      storeName: "Costco",
      subtotal: 7,
      tax: 0.5,
      total: 7.5,
      items: [
        { name: "KS WATER", price: 4, itemCode: "12345" },
        { name: "BANANAS", price: 3 }
      ]
    })
  );
  ui.setFiles("#receiptImage", [ui.file("receipt.png", PNG_BYTES, "image/png")]);
  await ui.waitFor(() => rows(ui).length === 2, { message: "the parsed lines" });
  assert.equal(ui.$("#storeNameInput").value, "Costco");
  assert.equal(ui.$("#taxInput").value, "0.5");
  assert.match(ui.text("#ocrStatusText"), /Found 2 lines/);
  assert.ok(!ui.$("#receiptPreviewWrap").classList.contains("hidden"));
  await answerCategoryPrompts(ui);

  // Upstream trouble: the photo is kept and a retry is offered.
  replies.push(new Response("{}", { status: 503 }));
  ui.setFiles("#receiptImage", [ui.file("again.png", PNG_BYTES, "image/png")]);
  await ui.waitFor(() => !ui.$("#retryParseButton").classList.contains("hidden"), { message: "the retry button" });
  assert.match(ui.text("#ocrStatusText"), /second try/);

  ui.click("#clearImageButton");
  assert.ok(ui.$("#retryParseButton").classList.contains("hidden"));
  assert.ok(ui.$("#receiptPreviewWrap").classList.contains("hidden"));

  // Drag and drop goes the same way.
  replies.push(JSON.stringify({ storeName: "Dropped", items: [{ name: "THING", price: 1 }] }));
  const drop = new ui.window.Event("drop", { bubbles: true, cancelable: true });
  drop.dataTransfer = { files: [ui.file("dropped.png", PNG_BYTES, "image/png")] };
  ui.$("#dropzone").dispatchEvent(new ui.window.Event("dragover", { bubbles: true, cancelable: true }));
  assert.ok(ui.$("#dropzone").classList.contains("is-dragging"));
  ui.$("#dropzone").dispatchEvent(drop);
  await ui.waitFor(() => ui.$("#storeNameInput").value === "Dropped", { message: "the dropped photo" });

  // Saved with its photo.
  ui.click("#saveReceiptButton");
  await ui.waitFor(() => /Saved to history/.test(ui.text("#saveStatus")), { message: "the save" });

  // The camera is not available here, so it falls back to the file picker.
  ui.click("#openCameraButton");
  await ui.waitFor(() => /Camera/.test(ui.text("#ocrStatusText")), { message: "the camera fallback" });
});

test("without a Gemini key, a photo sends you to Settings", async () => {
  const ui = await openApp(server, { as: await server.signUp() });
  ui.setFiles("#receiptImage", [ui.file("receipt.png", PNG_BYTES, "image/png")]);
  await ui.waitFor(() => !ui.$("#settingsView").classList.contains("hidden"), { message: "settings to open" });
  assert.match(ui.text("#ocrStatusText"), /Gemini API key/);
});

test("identify items: names every line, then confirm, pick an alternative, and forget", async () => {
  const admin = await server.admin();
  const ui = await openApp(server, { as: admin });
  ui.click("#identifyItemsButton");
  assert.ok(ui.toasts().some((t) => /Itemize a receipt first/.test(t)));

  ui.type("#receiptText", "Walmart\nGV SHRD MOZZ 8Z 3.48\nQQZ XZ9 2.00\nORG BNNA 1.27\nTotal 6.75");
  ui.click("#parseButton");
  await answerCategoryPrompts(ui);
  ui.type("#storeNameInput", "Walmart");
  const ids = rows(ui).map((row) => row.querySelector(".assign-dropdown")?.dataset.lineId);
  assert.equal(ids.length, 3);

  replies.push(
    JSON.stringify({
      items: [
        { id: ids[0], name: "Great Value Shredded Mozzarella", size: "8 oz", confidence: 0.95, alternatives: [{ name: "Mozzarella Sticks", confidence: 0.2 }] },
        { id: ids[1], name: "Mystery Thing", confidence: 0.3, alternatives: [] }
      ]
    }),
    // The model skipped the third line; it is asked again on its own.
    JSON.stringify({ items: [] })
  );
  ui.click("#identifyItemsButton");
  await ui.waitFor(() => /Identified/.test(ui.text("#identifyStatusText")), { message: "identification" });
  assert.match(ui.text("#receiptLinesList"), /Great Value Shredded Mozzarella - 8 oz/);
  assert.match(ui.text("#receiptLinesList"), /Mystery Thing/);
  assert.match(rowFor(ui, "Qqz").querySelector(".confidence-chip").textContent, /30%/);

  // Pick the alternative for the first line.
  const first = rowFor(ui, "Mozz");
  first.querySelector("details.item-detail-dropdown").open = true;
  ui.click(first.querySelector(".item-detail-alternative"));
  assert.match(ui.text("#receiptLinesList"), /Mozzarella Sticks/);

  // Type a name for the second; it is remembered as an alias.
  const second = rowFor(ui, "Qqz");
  const form = second.querySelector(".item-detail-form");
  form.querySelector("input").value = "Sponge";
  form.dispatchEvent(new ui.window.Event("submit", { bubbles: true, cancelable: true }));
  await ui.waitFor(async () => (await admin.get("/api/item-aliases")).body.aliases.length >= 2, { message: "the aliases" });

  // Forget it again.
  const again = rowFor(ui, "Qqz");
  const forget = [...again.querySelectorAll(".item-detail-actions button")].find((b) => /Forget|Clear|Undo|Remove/i.test(b.textContent));
  ui.click(forget);
  assert.doesNotMatch(ui.text("#receiptLinesList"), /Sponge/);

  // Batch identify only the selection.
  ui.click(ui.$$("#receiptLinesList .line-select")[2]);
  replies.push(JSON.stringify({ items: [{ id: ids[2], name: "Organic Bananas", confidence: 0.9 }] }));
  ui.click(ui.$$("#batchActions .batch-flags button")[2]);
  await ui.waitFor(() => /Organic Bananas/.test(ui.text("#receiptLinesList")), { message: "batch identify" });

  // A failing model says so.
  replies.push(new Response("{}", { status: 500 }));
  ui.click("#identifyItemsButton");
  await ui.waitFor(() => ui.toasts().some((t) => /Could not identify/.test(t)), { message: "the failure toast" });
});
