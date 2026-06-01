"use strict";
var ReceiptRing;
(function (ReceiptRing) {
    var Config;
    (function (Config) {
        Config.CATEGORIES = [
            {
                name: "Groceries",
                color: "#43d6a3",
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
                    "pasta",
                    "flour",
                    "sugar",
                    "butter",
                    "juice",
                    "chicken",
                    "beef",
                    "fish",
                    "lettuce",
                    "tomato",
                    "avocado",
                    "potato",
                    "onion",
                    "snack",
                    "chips",
                    "sauce",
                    "water"
                ]
            },
            {
                name: "Dining",
                color: "#ff6d5f",
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
                    "bowl",
                    "espresso",
                    "grill",
                    "bar",
                    "bakery",
                    "donut",
                    "sushi",
                    "noodle",
                    "meal",
                    "combo",
                    "takeout"
                ]
            },
            {
                name: "Home",
                color: "#f8bd45",
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
                    "foil",
                    "tissue",
                    "napkin",
                    "laundry",
                    "dish",
                    "sponge",
                    "wipes",
                    "bulb",
                    "decor",
                    "hardware",
                    "garden"
                ]
            },
            {
                name: "Health",
                color: "#b58cff",
                keywords: [
                    "vitamin",
                    "pharmacy",
                    "medicine",
                    "rx",
                    "bandage",
                    "wellness",
                    "protein",
                    "toothpaste",
                    "shampoo",
                    "ibuprofen",
                    "acetaminophen",
                    "allergy",
                    "first aid",
                    "mouthwash",
                    "deodorant",
                    "supplement",
                    "clinic"
                ]
            },
            {
                name: "Transport",
                color: "#5ca8ff",
                keywords: [
                    "fuel",
                    "gas",
                    "parking",
                    "uber",
                    "lyft",
                    "transit",
                    "metro",
                    "toll",
                    "car wash",
                    "bus",
                    "train",
                    "taxi",
                    "airfare",
                    "rideshare",
                    "oil change"
                ]
            },
            {
                name: "Personal",
                color: "#ff89c2",
                keywords: [
                    "shirt",
                    "socks",
                    "cosmetic",
                    "lotion",
                    "beauty",
                    "skincare",
                    "hair",
                    "gift",
                    "jeans",
                    "shoes",
                    "jacket",
                    "makeup",
                    "perfume",
                    "razor",
                    "clothing"
                ]
            },
            {
                name: "Entertainment",
                color: "#96dc5c",
                keywords: [
                    "movie",
                    "book",
                    "game",
                    "ticket",
                    "music",
                    "stream",
                    "toy",
                    "concert",
                    "theater",
                    "museum",
                    "bowling",
                    "arcade",
                    "subscription"
                ]
            },
            {
                name: "Other",
                color: "#a5a097",
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
        class CategoryRuleStorageService {
            constructor(storageKey) {
                this.storageKey = storageKey;
            }
            getCategoryFor(label) {
                const normalizedLabel = this.normalizeLabel(label);
                return this.loadRules()[normalizedLabel]?.category ?? null;
            }
            saveRule(label, category) {
                const normalizedLabel = this.normalizeLabel(label);
                if (!normalizedLabel)
                    return;
                const rules = this.loadRules();
                rules[normalizedLabel] = {
                    normalizedLabel,
                    category,
                    createdAt: new Date().toISOString()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(rules));
            }
            normalizeLabel(label) {
                return label
                    .toLowerCase()
                    .replace(/&/g, " and ")
                    .replace(/[^a-z0-9\s]/g, " ")
                    .replace(/\b(\d+(\.\d+)?|oz|lb|lbs|ct|pk|pkg|ea|each|small|medium|large)\b/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            }
            loadRules() {
                try {
                    const rawRules = localStorage.getItem(this.storageKey);
                    return rawRules ? JSON.parse(rawRules) : {};
                }
                catch {
                    return {};
                }
            }
        }
        Services.CategoryRuleStorageService = CategoryRuleStorageService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class CategorizationService {
            constructor(categories, ruleStorageService) {
                this.categories = categories;
                this.ruleStorageService = ruleStorageService;
                this.promptThreshold = 0.66;
            }
            categorize(label) {
                const savedCategory = this.ruleStorageService.getCategoryFor(label);
                if (savedCategory) {
                    return {
                        category: savedCategory,
                        confidence: 1,
                        source: "saved-rule",
                        matchedTerms: [],
                        shouldPrompt: false
                    };
                }
                const normalizedLabel = this.ruleStorageService.normalizeLabel(label);
                const tokens = this.getTokens(normalizedLabel);
                const scoredCategories = this.categories
                    .filter((category) => category.name !== "Other")
                    .map((category) => this.scoreCategory(category, normalizedLabel, tokens))
                    .sort((left, right) => right.score - left.score);
                const bestMatch = scoredCategories[0];
                const runnerUp = scoredCategories[1];
                if (!bestMatch || bestMatch.score <= 0) {
                    return this.createUncertainResult("Other", 0.18);
                }
                const margin = bestMatch.score - (runnerUp?.score ?? 0);
                const confidence = Math.min(0.96, 0.48 + bestMatch.score * 0.095 + margin * 0.055);
                if (confidence < this.promptThreshold) {
                    return this.createUncertainResult(bestMatch.category.name, confidence, bestMatch.matchedTerms);
                }
                return {
                    category: bestMatch.category.name,
                    confidence,
                    source: "keyword-match",
                    matchedTerms: bestMatch.matchedTerms,
                    shouldPrompt: false
                };
            }
            scoreCategory(category, normalizedLabel, tokens) {
                const matchedTerms = [];
                let score = 0;
                category.keywords.forEach((keyword) => {
                    const normalizedKeyword = this.ruleStorageService.normalizeLabel(keyword);
                    const keywordTokens = this.getTokens(normalizedKeyword);
                    if (normalizedKeyword && normalizedLabel.includes(normalizedKeyword)) {
                        score += keywordTokens.length > 1 ? 4.5 : 3;
                        matchedTerms.push(keyword);
                        return;
                    }
                    const overlap = keywordTokens.filter((token) => tokens.includes(token)).length;
                    if (overlap > 0) {
                        score += overlap * 1.25;
                        matchedTerms.push(keyword);
                    }
                });
                return { category, score, matchedTerms };
            }
            createUncertainResult(category, confidence, matchedTerms = []) {
                return {
                    category,
                    confidence,
                    source: "uncertain",
                    matchedTerms,
                    shouldPrompt: true
                };
            }
            getTokens(value) {
                const stopWords = new Set(["and", "the", "with", "for", "fresh", "organic", "item"]);
                return value
                    .split(" ")
                    .map((token) => token.trim())
                    .map((token) => this.stemToken(token))
                    .filter((token) => token.length > 1 && !stopWords.has(token));
            }
            stemToken(token) {
                if (token.endsWith("ies") && token.length > 4) {
                    return `${token.slice(0, -3)}y`;
                }
                if (token.endsWith("es") && token.length > 3) {
                    return token.slice(0, -2);
                }
                if (token.endsWith("s") && token.length > 3) {
                    return token.slice(0, -1);
                }
                return token;
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
                const categorization = this.categorizationService.categorize(label);
                return {
                    id: this.idService.create(),
                    label: this.toTitleCase(label),
                    amount: Number(amount.toFixed(2)),
                    category: categorization.category,
                    categorizationConfidence: categorization.confidence,
                    categorizationSource: categorization.source,
                    needsCategoryReview: categorization.shouldPrompt
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
                    categoryList: this.getElement("#categoryList", HTMLElement),
                    categoryPrompt: this.getElement("#categoryPrompt", HTMLElement),
                    categoryPromptItem: this.getElement("#categoryPromptItem", HTMLElement),
                    categoryPromptSelect: this.getElement("#categoryPromptSelect", HTMLSelectElement),
                    categoryPromptRemember: this.getElement("#categoryPromptRemember", HTMLInputElement),
                    categoryPromptSkip: this.getElement("#categoryPromptSkip", HTMLButtonElement),
                    categoryPromptSave: this.getElement("#categoryPromptSave", HTMLButtonElement)
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
                input.addEventListener("change", () => handlers.onUpdate(item.id, { label: input.value }));
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
                swatch.style.color = category.color;
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
    var UI;
    (function (UI) {
        class CategoryPromptView {
            constructor(categories, elements) {
                this.categories = categories;
                this.elements = elements;
                this.activeResolve = null;
                this.renderOptions();
                this.bindEvents();
            }
            prompt(item) {
                this.elements.categoryPromptItem.textContent = item.label;
                this.elements.categoryPromptSelect.value = item.category;
                this.elements.categoryPromptRemember.checked = false;
                this.elements.categoryPrompt.classList.remove("hidden");
                this.elements.categoryPromptSelect.focus();
                return new Promise((resolve) => {
                    this.activeResolve = resolve;
                });
            }
            renderOptions() {
                this.elements.categoryPromptSelect.innerHTML = "";
                this.categories.forEach((category) => {
                    const option = document.createElement("option");
                    option.value = category.name;
                    option.textContent = category.name;
                    this.elements.categoryPromptSelect.append(option);
                });
            }
            bindEvents() {
                this.elements.categoryPromptSave.addEventListener("click", () => this.resolvePrompt());
                this.elements.categoryPromptSkip.addEventListener("click", () => this.closePrompt(null));
                this.elements.categoryPrompt.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") {
                        this.closePrompt(null);
                    }
                });
            }
            resolvePrompt() {
                this.closePrompt({
                    category: this.elements.categoryPromptSelect.value,
                    remember: this.elements.categoryPromptRemember.checked
                });
            }
            closePrompt(result) {
                this.elements.categoryPrompt.classList.add("hidden");
                const resolve = this.activeResolve;
                this.activeResolve = null;
                resolve?.(result);
            }
        }
        UI.CategoryPromptView = CategoryPromptView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var App;
    (function (App) {
        class AppController {
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, itemListView, ringView, categorySummaryView, categoryPromptView, idService) {
                this.elements = elements;
                this.parserService = parserService;
                this.categorizationService = categorizationService;
                this.categoryRuleStorageService = categoryRuleStorageService;
                this.storageService = storageService;
                this.summaryService = summaryService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.itemListView = itemListView;
                this.ringView = ringView;
                this.categorySummaryView = categorySummaryView;
                this.categoryPromptView = categoryPromptView;
                this.idService = idService;
                this.isPromptingForCategories = false;
                this.reviewTimer = null;
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
                void this.reviewAmbiguousItems();
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
                void this.reviewAmbiguousItems();
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
                        amount: 0,
                        categorizationConfidence: 0,
                        categorizationSource: "uncertain",
                        needsCategoryReview: false
                    }
                ];
                this.render();
            }
            updateItem(id, patch) {
                const shouldRenderItems = patch.label !== undefined;
                this.items = this.items.map((item) => {
                    if (item.id !== id)
                        return item;
                    const nextItem = { ...item, ...patch };
                    if (patch.label !== undefined && nextItem.label.trim().length > 2 && nextItem.label !== "New item") {
                        const categorization = this.categorizationService.categorize(nextItem.label);
                        nextItem.category = categorization.category;
                        nextItem.categorizationConfidence = categorization.confidence;
                        nextItem.categorizationSource = categorization.source;
                        nextItem.needsCategoryReview = categorization.shouldPrompt;
                        this.scheduleCategoryReview();
                    }
                    if (patch.category !== undefined) {
                        nextItem.categorizationConfidence = 1;
                        nextItem.categorizationSource = "saved-rule";
                        nextItem.needsCategoryReview = false;
                    }
                    return nextItem;
                });
                this.storageService.save(this.items);
                if (shouldRenderItems) {
                    this.renderItems();
                }
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
            scheduleCategoryReview() {
                if (this.reviewTimer !== null) {
                    window.clearTimeout(this.reviewTimer);
                }
                this.reviewTimer = window.setTimeout(() => {
                    this.reviewTimer = null;
                    void this.reviewAmbiguousItems();
                }, 650);
            }
            async reviewAmbiguousItems() {
                if (this.isPromptingForCategories)
                    return;
                this.isPromptingForCategories = true;
                try {
                    let item = this.items.find((candidate) => candidate.needsCategoryReview);
                    while (item) {
                        const result = await this.categoryPromptView.prompt(item);
                        if (result) {
                            this.applyPromptResult(item.id, result);
                        }
                        else {
                            this.markItemReviewed(item.id);
                        }
                        this.render();
                        item = this.items.find((candidate) => candidate.needsCategoryReview);
                    }
                }
                finally {
                    this.isPromptingForCategories = false;
                }
            }
            applyPromptResult(id, result) {
                const item = this.items.find((candidate) => candidate.id === id);
                if (!item)
                    return;
                if (result.remember) {
                    this.categoryRuleStorageService.saveRule(item.label, result.category);
                }
                this.items = this.items.map((candidate) => candidate.id === id
                    ? {
                        ...candidate,
                        category: result.category,
                        categorizationConfidence: 1,
                        categorizationSource: result.remember ? "saved-rule" : "keyword-match",
                        needsCategoryReview: false
                    }
                    : candidate);
            }
            markItemReviewed(id) {
                this.items = this.items.map((candidate) => candidate.id === id ? { ...candidate, needsCategoryReview: false } : candidate);
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
    const categoryRuleStorageService = new ReceiptRing.Services.CategoryRuleStorageService("receipt-ring-category-rules");
    const categorizationService = new ReceiptRing.Services.CategorizationService(categories, categoryRuleStorageService);
    const parserService = new ReceiptRing.Services.ReceiptParserService(categorizationService, idService);
    const storageService = new ReceiptRing.Services.StorageService("receipt-ring-items");
    const summaryService = new ReceiptRing.Services.SpendingSummaryService(categories);
    const imagePreviewService = new ReceiptRing.Services.ImagePreviewService();
    const ringView = new ReceiptRing.UI.CategoryRingView(categories);
    const categorySummaryView = new ReceiptRing.UI.CategorySummaryView(categories, currencyFormatService, ringView);
    const itemListView = new ReceiptRing.UI.ItemListView(categories);
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, itemListView, ringView, categorySummaryView, categoryPromptView, idService).start();
})(ReceiptRing || (ReceiptRing = {}));
