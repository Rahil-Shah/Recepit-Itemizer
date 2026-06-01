"use strict";
var ReceiptRing;
(function (ReceiptRing) {
    var Config;
    (function (Config) {
        Config.CATEGORIES = [
            {
                name: "Groceries",
                color: "#1e7f68",
                keywords: [
                    "apple",
                    "banana",
                    "bread",
                    "milk",
                    "eggs",
                    "yogurt",
                    "cheese",
                    "produce",
                    "market",
                    "grocery",
                    "organic",
                    "cereal",
                    "rice",
                    "pasta"
                ]
            },
            {
                name: "Dining",
                color: "#d25039",
                keywords: [
                    "coffee",
                    "latte",
                    "burger",
                    "pizza",
                    "taco",
                    "restaurant",
                    "cafe",
                    "deli",
                    "sandwich",
                    "salad",
                    "tea",
                    "bowl"
                ]
            },
            {
                name: "Home",
                color: "#d99f2b",
                keywords: [
                    "detergent",
                    "soap",
                    "towel",
                    "paper",
                    "cleaner",
                    "trash",
                    "storage",
                    "kitchen",
                    "home",
                    "batteries",
                    "foil"
                ]
            },
            {
                name: "Health",
                color: "#7f5aa2",
                keywords: [
                    "vitamin",
                    "pharmacy",
                    "medicine",
                    "rx",
                    "bandage",
                    "wellness",
                    "protein",
                    "toothpaste",
                    "shampoo"
                ]
            },
            {
                name: "Transport",
                color: "#2f6fb3",
                keywords: ["fuel", "gas", "parking", "uber", "lyft", "transit", "metro", "toll", "car wash"]
            },
            {
                name: "Personal",
                color: "#c66b8f",
                keywords: ["shirt", "socks", "cosmetic", "lotion", "beauty", "skincare", "hair", "gift"]
            },
            {
                name: "Entertainment",
                color: "#4f8f3d",
                keywords: ["movie", "book", "game", "ticket", "music", "stream", "toy"]
            },
            {
                name: "Other",
                color: "#7c766d",
                keywords: []
            }
        ];
    })(Config = ReceiptRing.Config || (ReceiptRing.Config = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Config;
    (function (Config) {
        Config.SAMPLE_RECEIPT = `FRESH MARKET
Organic bananas        3.49
Sourdough bread        5.25
Greek yogurt           6.99
Paper towels           8.79
Vitamins              13.49
Cold brew coffee       4.75
Reusable storage bags  7.20
Subtotal              49.96
Tax                    3.74
Total                 53.70`;
    })(Config = ReceiptRing.Config || (ReceiptRing.Config = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class IdService {
            create() {
                return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            }
        }
        Services.IdService = IdService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class CurrencyFormatService {
            constructor() {
                this.formatter = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD"
                });
            }
            format(value) {
                return this.formatter.format(Number(value) || 0);
            }
        }
        Services.CurrencyFormatService = CurrencyFormatService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class CategorizationService {
            constructor(categories) {
                this.categories = categories;
            }
            assignCategory(label) {
                const normalizedLabel = label.toLowerCase();
                const category = this.categories.find((candidate) => candidate.keywords.some((keyword) => normalizedLabel.includes(keyword)));
                return category?.name ?? "Other";
            }
        }
        Services.CategorizationService = CategorizationService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ReceiptParserService {
            constructor(categorizationService, idService) {
                this.categorizationService = categorizationService;
                this.idService = idService;
                this.ignoredLabel = /^(total|subtotal|tax|cash|change|visa|mastercard|amex|debit|credit|balance|auth|approval|receipt)\b/i;
                this.amountPattern = /(-?\$?\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*$/;
            }
            parse(text) {
                return text
                    .split(/\n+/)
                    .map((line) => line.replace(/\s+/g, " ").trim())
                    .filter(Boolean)
                    .map((line) => this.parseLine(line))
                    .filter((item) => item !== null);
            }
            parseLine(line) {
                const match = line.match(this.amountPattern);
                if (!match || match.index === undefined)
                    return null;
                const amount = Number(match[1].replace(/[$,]/g, ""));
                const label = line
                    .slice(0, match.index)
                    .replace(/[*#@]/g, "")
                    .replace(/\b\d{4,}\b/g, "")
                    .trim();
                if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount <= 0) {
                    return null;
                }
                return {
                    id: this.idService.create(),
                    label: this.toTitleCase(label),
                    amount: Number(amount.toFixed(2)),
                    category: this.categorizationService.assignCategory(label)
                };
            }
            toTitleCase(value) {
                return value
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ");
            }
        }
        Services.ReceiptParserService = ReceiptParserService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class StorageService {
            constructor(storageKey) {
                this.storageKey = storageKey;
            }
            load() {
                try {
                    const rawValue = localStorage.getItem(this.storageKey);
                    return rawValue ? JSON.parse(rawValue) : [];
                }
                catch {
                    return [];
                }
            }
            save(items) {
                localStorage.setItem(this.storageKey, JSON.stringify(items));
            }
        }
        Services.StorageService = StorageService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class SpendingSummaryService {
            constructor(categories) {
                this.categories = categories;
            }
            getTotals(items) {
                const totals = this.categories.reduce((summary, category) => {
                    summary[category.name] = 0;
                    return summary;
                }, {});
                items.forEach((item) => {
                    totals[item.category] += Number(item.amount || 0);
                });
                return totals;
            }
            getGrandTotal(totals) {
                return Object.values(totals).reduce((sum, value) => sum + value, 0);
            }
        }
        Services.SpendingSummaryService = SpendingSummaryService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ImagePreviewService {
            show(file, image, container) {
                const reader = new FileReader();
                reader.onload = () => {
                    image.src = String(reader.result);
                    container.classList.remove("hidden");
                };
                reader.readAsDataURL(file);
            }
            clear(input, image, container) {
                input.value = "";
                image.removeAttribute("src");
                container.classList.add("hidden");
            }
        }
        Services.ImagePreviewService = ImagePreviewService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        class DomRegistryFactory {
            create() {
                return {
                    sampleButton: this.getElement("#sampleButton", HTMLButtonElement),
                    receiptImage: this.getElement("#receiptImage", HTMLInputElement),
                    dropzone: this.getElement("#dropzone", HTMLElement),
                    receiptPreviewWrap: this.getElement("#receiptPreviewWrap", HTMLElement),
                    receiptPreview: this.getElement("#receiptPreview", HTMLImageElement),
                    clearImageButton: this.getElement("#clearImageButton", HTMLButtonElement),
                    receiptText: this.getElement("#receiptText", HTMLTextAreaElement),
                    parseButton: this.getElement("#parseButton", HTMLButtonElement),
                    clearButton: this.getElement("#clearButton", HTMLButtonElement),
                    addItemButton: this.getElement("#addItemButton", HTMLButtonElement),
                    itemsList: this.getElement("#itemsList", HTMLElement),
                    emptyState: this.getElement("#emptyState", HTMLElement),
                    itemCount: this.getElement("#itemCount", HTMLElement),
                    receiptTotal: this.getElement("#receiptTotal", HTMLElement),
                    ringTotal: this.getElement("#ringTotal", HTMLElement),
                    categoryRing: this.getElement("#categoryRing", SVGSVGElement),
                    categoryList: this.getElement("#categoryList", HTMLElement)
                };
            }
            getElement(selector, constructorReference) {
                const element = document.querySelector(selector);
                if (!(element instanceof constructorReference)) {
                    throw new Error(`Missing expected element: ${selector}`);
                }
                return element;
            }
        }
        UI.DomRegistryFactory = DomRegistryFactory;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        class ItemListView {
            constructor(categories) {
                this.categories = categories;
            }
            render(container, items, handlers) {
                container.innerHTML = "";
                items.forEach((item) => {
                    container.append(this.createRow(item, handlers));
                });
            }
            createRow(item, handlers) {
                const row = document.createElement("div");
                row.className = "table-row";
                row.setAttribute("role", "row");
                row.dataset.id = item.id;
                const labelInput = this.createLabelInput(item, handlers);
                const categorySelect = this.createCategorySelect(item, handlers);
                const amountInput = this.createAmountInput(item, handlers);
                const deleteButton = this.createDeleteButton(item, handlers);
                row.append(labelInput, categorySelect, amountInput, deleteButton);
                return row;
            }
            createLabelInput(item, handlers) {
                const input = document.createElement("input");
                input.className = "table-input";
                input.value = item.label;
                input.setAttribute("aria-label", "Item name");
                input.addEventListener("input", () => handlers.onUpdate(item.id, { label: input.value }));
                return input;
            }
            createCategorySelect(item, handlers) {
                const select = document.createElement("select");
                select.className = "table-select";
                select.setAttribute("aria-label", "Category");
                this.categories.forEach((category) => {
                    const option = document.createElement("option");
                    option.value = category.name;
                    option.textContent = category.name;
                    option.selected = category.name === item.category;
                    select.append(option);
                });
                select.addEventListener("change", () => handlers.onUpdate(item.id, { category: select.value }));
                return select;
            }
            createAmountInput(item, handlers) {
                const input = document.createElement("input");
                input.className = "table-input amount-input";
                input.type = "number";
                input.min = "0";
                input.step = "0.01";
                input.value = String(item.amount);
                input.setAttribute("aria-label", "Amount");
                input.addEventListener("input", () => handlers.onUpdate(item.id, { amount: Number(input.value) }));
                return input;
            }
            createDeleteButton(item, handlers) {
                const button = document.createElement("button");
                button.className = "icon-button delete-row";
                button.type = "button";
                button.textContent = "x";
                button.setAttribute("aria-label", `Remove ${item.label || "item"}`);
                button.addEventListener("click", () => handlers.onDelete(item.id));
                return button;
            }
        }
        UI.ItemListView = ItemListView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        class CategoryRingView {
            constructor(categories) {
                this.categories = categories;
                this.svgNamespace = "http://www.w3.org/2000/svg";
                this.center = 120;
                this.radius = 84;
                this.gapDegrees = 2.6;
            }
            render(container, totals, grandTotal) {
                container.innerHTML = "";
                container.append(this.createBackgroundCircle());
                if (grandTotal <= 0)
                    return;
                let startAngle = -90;
                this.categories
                    .filter((category) => totals[category.name] > 0)
                    .forEach((category) => {
                    const share = totals[category.name] / grandTotal;
                    const sweep = Math.max(share * 360 - this.gapDegrees, 2);
                    container.append(this.createSegment(category, startAngle, startAngle + sweep));
                    startAngle += share * 360;
                });
            }
            setFocus(categoryName) {
                document.querySelectorAll(".ring-segment").forEach((segment) => {
                    const isMuted = Boolean(categoryName) && segment.dataset.category !== categoryName;
                    segment.classList.toggle("is-muted", isMuted);
                });
            }
            createBackgroundCircle() {
                const circle = document.createElementNS(this.svgNamespace, "circle");
                circle.setAttribute("class", "ring-bg");
                circle.setAttribute("cx", String(this.center));
                circle.setAttribute("cy", String(this.center));
                circle.setAttribute("r", String(this.radius));
                return circle;
            }
            createSegment(category, startAngle, endAngle) {
                const path = document.createElementNS(this.svgNamespace, "path");
                path.setAttribute("class", "ring-segment");
                path.setAttribute("stroke", category.color);
                path.setAttribute("d", this.describeArc(startAngle, endAngle));
                path.dataset.category = category.name;
                path.addEventListener("mouseenter", () => this.setFocus(category.name));
                path.addEventListener("mouseleave", () => this.setFocus(null));
                return path;
            }
            describeArc(startAngle, endAngle) {
                const start = this.polarToCartesian(endAngle);
                const end = this.polarToCartesian(startAngle);
                const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
                return [
                    "M",
                    start.x,
                    start.y,
                    "A",
                    this.radius,
                    this.radius,
                    0,
                    largeArcFlag,
                    0,
                    end.x,
                    end.y
                ].join(" ");
            }
            polarToCartesian(angleInDegrees) {
                const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
                return {
                    x: this.center + this.radius * Math.cos(angleInRadians),
                    y: this.center + this.radius * Math.sin(angleInRadians)
                };
            }
        }
        UI.CategoryRingView = CategoryRingView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        class CategorySummaryView {
            constructor(categories, currencyFormatService, ringView) {
                this.categories = categories;
                this.currencyFormatService = currencyFormatService;
                this.ringView = ringView;
            }
            render(container, totals, grandTotal) {
                container.innerHTML = "";
                this.categories.forEach((category) => {
                    const amount = totals[category.name] || 0;
                    const percent = grandTotal > 0 ? Math.round((amount / grandTotal) * 100) : 0;
                    container.append(this.createRow(category, amount, percent));
                });
            }
            createRow(category, amount, percent) {
                const row = document.createElement("div");
                row.className = "category-row";
                row.dataset.category = category.name;
                row.addEventListener("mouseenter", () => this.ringView.setFocus(category.name));
                row.addEventListener("mouseleave", () => this.ringView.setFocus(null));
                const swatch = document.createElement("span");
                swatch.className = "swatch";
                swatch.style.background = category.color;
                const name = document.createElement("span");
                name.className = "category-name";
                name.textContent = category.name;
                const meta = document.createElement("span");
                meta.className = "category-meta";
                meta.textContent = `${this.currencyFormatService.format(amount)} / ${percent}%`;
                row.append(swatch, name, meta);
                return row;
            }
        }
        UI.CategorySummaryView = CategorySummaryView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var App;
    (function (App) {
        class AppController {
            constructor(elements, parserService, storageService, summaryService, currencyFormatService, imagePreviewService, itemListView, ringView, categorySummaryView, idService) {
                this.elements = elements;
                this.parserService = parserService;
                this.storageService = storageService;
                this.summaryService = summaryService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.itemListView = itemListView;
                this.ringView = ringView;
                this.categorySummaryView = categorySummaryView;
                this.idService = idService;
                this.items = this.storageService.load();
            }
            start() {
                this.bindEvents();
                this.render();
            }
            bindEvents() {
                this.elements.sampleButton.addEventListener("click", () => this.loadSample());
                this.elements.receiptImage.addEventListener("change", () => this.handleImageInput());
                this.elements.clearImageButton.addEventListener("click", () => this.clearImage());
                this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
                this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
                this.elements.addItemButton.addEventListener("click", () => this.addItem());
                ["dragenter", "dragover"].forEach((eventName) => {
                    this.elements.dropzone.addEventListener(eventName, (event) => {
                        event.preventDefault();
                        this.elements.dropzone.classList.add("is-dragging");
                    });
                });
                ["dragleave", "drop"].forEach((eventName) => {
                    this.elements.dropzone.addEventListener(eventName, (event) => {
                        event.preventDefault();
                        this.elements.dropzone.classList.remove("is-dragging");
                    });
                });
                this.elements.dropzone.addEventListener("drop", (event) => this.handleImageDrop(event));
            }
            loadSample() {
                this.elements.receiptText.value = ReceiptRing.Config.SAMPLE_RECEIPT;
                this.items = this.parserService.parse(ReceiptRing.Config.SAMPLE_RECEIPT);
                this.render();
            }
            handleImageInput() {
                const file = this.elements.receiptImage.files?.[0];
                if (file) {
                    this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                }
            }
            handleImageDrop(event) {
                const file = event.dataTransfer?.files?.[0];
                if (file) {
                    this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                }
            }
            clearImage() {
                this.imagePreviewService.clear(this.elements.receiptImage, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
            }
            itemizeReceiptText() {
                this.items = this.parserService.parse(this.elements.receiptText.value);
                this.render();
            }
            clearReceipt() {
                this.elements.receiptText.value = "";
                this.items = [];
                this.render();
            }
            addItem() {
                this.items = [
                    ...this.items,
                    {
                        id: this.idService.create(),
                        label: "New item",
                        category: "Other",
                        amount: 0
                    }
                ];
                this.render();
            }
            updateItem(id, patch) {
                this.items = this.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
                this.storageService.save(this.items);
                this.renderSummary();
            }
            deleteItem(id) {
                this.items = this.items.filter((candidate) => candidate.id !== id);
                this.render();
            }
            render() {
                this.storageService.save(this.items);
                this.renderItems();
                this.renderSummary();
            }
            renderItems() {
                this.elements.emptyState.classList.toggle("hidden", this.items.length > 0);
                this.elements.itemCount.textContent = `${this.items.length} ${this.items.length === 1 ? "item" : "items"}`;
                this.itemListView.render(this.elements.itemsList, this.items, {
                    onUpdate: (id, patch) => this.updateItem(id, patch),
                    onDelete: (id) => this.deleteItem(id)
                });
            }
            renderSummary() {
                const totals = this.summaryService.getTotals(this.items);
                const grandTotal = this.summaryService.getGrandTotal(totals);
                this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
                this.elements.ringTotal.textContent = this.currencyFormatService.format(grandTotal);
                this.ringView.render(this.elements.categoryRing, totals, grandTotal);
                this.categorySummaryView.render(this.elements.categoryList, totals, grandTotal);
            }
        }
        App.AppController = AppController;
    })(App = ReceiptRing.App || (ReceiptRing.App = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    const categories = ReceiptRing.Config.CATEGORIES;
    const idService = new ReceiptRing.Services.IdService();
    const currencyFormatService = new ReceiptRing.Services.CurrencyFormatService();
    const categorizationService = new ReceiptRing.Services.CategorizationService(categories);
    const parserService = new ReceiptRing.Services.ReceiptParserService(categorizationService, idService);
    const storageService = new ReceiptRing.Services.StorageService("receipt-ring-items");
    const summaryService = new ReceiptRing.Services.SpendingSummaryService(categories);
    const imagePreviewService = new ReceiptRing.Services.ImagePreviewService();
    const ringView = new ReceiptRing.UI.CategoryRingView(categories);
    const categorySummaryView = new ReceiptRing.UI.CategorySummaryView(categories, currencyFormatService, ringView);
    const itemListView = new ReceiptRing.UI.ItemListView(categories);
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    new ReceiptRing.App.AppController(elements, parserService, storageService, summaryService, currencyFormatService, imagePreviewService, itemListView, ringView, categorySummaryView, idService).start();
})(ReceiptRing || (ReceiptRing = {}));
