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
                this.amountPattern = /(-?\$?\s*\d{1,4}(?:(?:,\d{3})+)?[,.]\d{2}|-?\$\s*\d{1,5})\s*$/;
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
                const amount = this.parseAmount(match[1]);
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
            parseAmount(value) {
                const compactValue = value.replace(/[$\s]/g, "");
                const normalizedValue = compactValue.includes(".") || !compactValue.includes(",")
                    ? compactValue.replace(/,/g, "")
                    : compactValue.replace(",", ".");
                return Number(normalizedValue);
            }
        }
        Services.ReceiptParserService = ReceiptParserService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class SplitCalculatorService {
            calculate(people, lines, assignments, tax) {
                const itemTotals = new Map();
                people.forEach((person) => itemTotals.set(person.id, 0));
                lines
                    .filter((line) => !line.ignored)
                    .forEach((line) => {
                    const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
                    this.getLineShares(line, lineAssignments).forEach((amount, personId) => {
                        itemTotals.set(personId, (itemTotals.get(personId) ?? 0) + amount);
                    });
                });
                const subtotal = Array.from(itemTotals.values()).reduce((sum, value) => sum + value, 0);
                return people.map((person) => {
                    const itemTotal = itemTotals.get(person.id) ?? 0;
                    const allocatedTax = subtotal > 0 ? (itemTotal / subtotal) * tax : 0;
                    return {
                        personId: person.id,
                        personName: person.name,
                        itemTotal,
                        allocatedTax,
                        finalTotal: itemTotal + allocatedTax
                    };
                });
            }
            getUnassignedCount(lines, assignments) {
                return lines.filter((line) => !line.ignored && !assignments.some((assignment) => assignment.lineId === line.id)).length;
            }
            getLineShares(line, assignments) {
                const shares = new Map();
                if (assignments.length === 0)
                    return shares;
                if (assignments.every((assignment) => assignment.mode === "equal")) {
                    const share = line.amount / assignments.length;
                    assignments.forEach((assignment) => shares.set(assignment.personId, share));
                    return shares;
                }
                assignments.forEach((assignment) => {
                    if (assignment.mode === "percentage") {
                        shares.set(assignment.personId, line.amount * (assignment.value / 100));
                    }
                    else if (assignment.mode === "amount") {
                        shares.set(assignment.personId, assignment.value);
                    }
                    else {
                        shares.set(assignment.personId, line.amount / assignments.length);
                    }
                });
                return shares;
            }
        }
        Services.SplitCalculatorService = SplitCalculatorService;
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
    var Services;
    (function (Services) {
        class GeminiService {
            async loadDotEnv() {
                try {
                    const apiResponse = await fetch("/api/gemini-config");
                    if (apiResponse.ok) {
                        const config = (await apiResponse.json());
                        if (config && (config.GEMINI_API_KEY || config.GEMINI_MODEL)) {
                            return config;
                        }
                    }
                }
                catch {
                }
                try {
                    const response = await fetch(".env");
                    if (!response.ok)
                        return {};
                    const text = await response.text();
                    const config = {};
                    text.split(/\r?\n/).forEach((line) => {
                        const cleanLine = line.trim();
                        if (!cleanLine || cleanLine.startsWith("#"))
                            return;
                        const index = cleanLine.indexOf("=");
                        if (index === -1)
                            return;
                        const key = cleanLine.slice(0, index).trim();
                        const value = cleanLine.slice(index + 1).trim();
                        config[key] = value;
                    });
                    return config;
                }
                catch {
                    return {};
                }
            }
            fileToBase64(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        const base64 = result.split(",")[1];
                        resolve(base64);
                    };
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
            }
            async parseReceiptImage(file, apiKey, model) {
                const base64Data = await this.fileToBase64(file);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const promptText = `You are an expert receipt parser.

Your job is to analyze a receipt image and extract ONLY the purchasable items, their prices, and receipt totals.

Rules:

1. Extract every purchased item and its corresponding price.
2. Preserve item order exactly as it appears on the receipt.
3. Ignore:
   - Store addresses
   - Phone numbers
   - Loyalty information
   - Cashier information
   - Payment methods
   - Approval codes
   - Card numbers
   - Barcode values
   - Receipt IDs unless needed for totals
4. Do not invent items.
5. If text is unclear, make the best reasonable interpretation.
6. Return valid JSON only.
7. Prices must be numeric values.
8. Extract subtotal, tax, and total whenever available.
9. If an item appears to be a discount or coupon, include it in a separate discounts array.
10. If confidence is low for an item name, still include the item but add a lowConfidence flag.

Return JSON in exactly this format:

{
  "storeName": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "items": [
    {
      "name": string,
      "price": number,
      "lowConfidence": boolean
    }
  ],
  "discounts": [
    {
      "name": string,
      "amount": number
    }
  ]
}

Important:

Only include actual purchasable line items in the items array.

Do not include:
- SUBTOTAL
- TAX
- TOTAL
- CHANGE
- CASH
- VISA
- MASTERCARD
- PAYMENT
- BALANCE

Return only JSON.`;
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: promptText },
                                    {
                                        inlineData: {
                                            mimeType: file.type,
                                            data: base64Data
                                        }
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
                }
                const json = await response.json();
                const textResult = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResult) {
                    throw new Error("No response text returned from Gemini.");
                }
                try {
                    const cleanedText = textResult.trim().replace(/^```json/, "").replace(/```$/, "").trim();
                    const parsed = JSON.parse(cleanedText);
                    return parsed;
                }
                catch (e) {
                    console.error("Failed to parse Gemini JSON output. Raw text:", textResult);
                    throw new Error("Failed to parse the structured receipt JSON from Gemini response.");
                }
            }
        }
        Services.GeminiService = GeminiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ReceiptApiService {
            async save(payload) {
                const response = await fetch("/api/receipts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Save failed (${response.status}): ${message}`);
                }
                return (await response.json());
            }
            async list() {
                const response = await fetch("/api/receipts");
                if (!response.ok) {
                    throw new Error(`Could not load history (${response.status}).`);
                }
                return (await response.json());
            }
        }
        Services.ReceiptApiService = ReceiptApiService;
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
                    ocrStatus: this.getElement("#ocrStatus", HTMLElement),
                    ocrStatusText: this.getElement("#ocrStatusText", HTMLElement),
                    ocrProgressBar: this.getElement("#ocrProgressBar", HTMLElement),
                    receiptText: this.getElement("#receiptText", HTMLTextAreaElement),
                    openCameraButton: this.getElement("#openCameraButton", HTMLButtonElement),
                    cameraModal: this.getElement("#cameraModal", HTMLElement),
                    cameraVideo: this.getElement("#cameraVideo", HTMLVideoElement),
                    cameraCanvas: this.getElement("#cameraCanvas", HTMLCanvasElement),
                    closeCameraButton: this.getElement("#closeCameraButton", HTMLButtonElement),
                    capturePhotoButton: this.getElement("#capturePhotoButton", HTMLButtonElement),
                    parseButton: this.getElement("#parseButton", HTMLButtonElement),
                    clearButton: this.getElement("#clearButton", HTMLButtonElement),
                    receiptLinesList: this.getElement("#receiptLinesList", HTMLElement),
                    emptyState: this.getElement("#emptyState", HTMLElement),
                    unassignedCount: this.getElement("#unassignedCount", HTMLElement),
                    storeNameInput: this.getElement("#storeNameInput", HTMLInputElement),
                    receiptCategory: this.getElement("#receiptCategory", HTMLSelectElement),
                    personNameInput: this.getElement("#personNameInput", HTMLInputElement),
                    addPersonButton: this.getElement("#addPersonButton", HTMLButtonElement),
                    peopleList: this.getElement("#peopleList", HTMLElement),
                    taxInput: this.getElement("#taxInput", HTMLInputElement),
                    splitTotalsList: this.getElement("#splitTotalsList", HTMLElement),
                    saveReceiptButton: this.getElement("#saveReceiptButton", HTMLButtonElement),
                    saveStatus: this.getElement("#saveStatus", HTMLElement),
                    itemCount: this.getElement("#itemCount", HTMLElement),
                    receiptTotal: this.getElement("#receiptTotal", HTMLElement),
                    tabButtons: Array.from(document.querySelectorAll(".tab-button")).filter((element) => element instanceof HTMLButtonElement),
                    receiptsView: this.getElement("#receiptsView", HTMLElement),
                    historyView: this.getElement("#historyView", HTMLElement),
                    budgetingView: this.getElement("#budgetingView", HTMLElement),
                    historyList: this.getElement("#historyList", HTMLElement),
                    historyEmpty: this.getElement("#historyEmpty", HTMLElement),
                    refreshHistoryButton: this.getElement("#refreshHistoryButton", HTMLButtonElement),
                    categoryPrompt: this.getElement("#categoryPrompt", HTMLElement),
                    categoryPromptItem: this.getElement("#categoryPromptItem", HTMLElement),
                    categoryPromptSelect: this.getElement("#categoryPromptSelect", HTMLSelectElement),
                    categoryPromptRemember: this.getElement("#categoryPromptRemember", HTMLInputElement),
                    categoryPromptSkip: this.getElement("#categoryPromptSkip", HTMLButtonElement),
                    categoryPromptSave: this.getElement("#categoryPromptSave", HTMLButtonElement),
                    settingsButton: this.getElement("#settingsButton", HTMLButtonElement),
                    settingsModal: this.getElement("#settingsModal", HTMLElement),
                    geminiApiKey: this.getElement("#geminiApiKey", HTMLInputElement),
                    geminiModel: this.getElement("#geminiModel", HTMLSelectElement),
                    closeSettingsButton: this.getElement("#closeSettingsButton", HTMLButtonElement),
                    saveSettingsButton: this.getElement("#saveSettingsButton", HTMLButtonElement)
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
        const MODE_LABELS = {
            equal: "Split evenly",
            percentage: "Split by percentage",
            amount: "Split by custom amount"
        };
        class SplitWorkspaceView {
            constructor(currencyFormatService) {
                this.currencyFormatService = currencyFormatService;
            }
            renderLines(container, lines, assignments, people, lineModes, handlers) {
                container.innerHTML = "";
                lines.forEach((line) => {
                    const row = document.createElement("div");
                    row.className = "table-row";
                    row.classList.toggle("is-ignored", line.ignored);
                    const name = document.createElement("span");
                    name.className = "line-label";
                    name.textContent = line.label;
                    const assignCell = document.createElement("div");
                    assignCell.className = "assign-cell";
                    assignCell.append(this.buildAssignDropdown(line, assignments, people, lineModes, handlers));
                    const amount = document.createElement("span");
                    amount.className = "amount-cell";
                    amount.textContent = this.currencyFormatService.format(line.amount);
                    const ignore = document.createElement("button");
                    ignore.className = "icon-button delete-row";
                    ignore.type = "button";
                    ignore.textContent = line.ignored ? "+" : "x";
                    ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
                    ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));
                    row.append(name, assignCell, amount, ignore);
                    container.append(row);
                });
            }
            buildAssignDropdown(line, assignments, people, lineModes, handlers) {
                const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
                const mode = lineModes.get(line.id) ?? "equal";
                const details = document.createElement("details");
                details.className = "assign-dropdown";
                const summary = document.createElement("summary");
                summary.className = "assign-summary";
                summary.textContent = this.getAssignmentSummary(lineAssignments, people);
                details.append(summary);
                const panel = document.createElement("div");
                panel.className = "assign-panel-pop";
                if (people.length === 0) {
                    const hint = document.createElement("p");
                    hint.className = "assign-hint";
                    hint.textContent = "Add people first, then assign them here.";
                    panel.append(hint);
                    details.append(panel);
                    return details;
                }
                const modeSelect = document.createElement("select");
                modeSelect.className = "table-select assign-mode";
                Object.keys(MODE_LABELS).forEach((value) => {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = MODE_LABELS[value];
                    modeSelect.append(option);
                });
                modeSelect.value = mode;
                modeSelect.addEventListener("change", () => handlers.onLineModeChange(line.id, modeSelect.value));
                panel.append(modeSelect);
                people.forEach((person) => {
                    const assignment = lineAssignments.find((candidate) => candidate.personId === person.id);
                    const personRow = document.createElement("label");
                    personRow.className = "assign-person-row";
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = Boolean(assignment);
                    checkbox.addEventListener("change", () => handlers.onAssignToggle(line.id, person.id));
                    const personName = document.createElement("span");
                    personName.className = "assign-person-name";
                    personName.textContent = person.name;
                    personRow.append(checkbox, personName);
                    if (mode !== "equal") {
                        const valueInput = document.createElement("input");
                        valueInput.type = "number";
                        valueInput.min = "0";
                        valueInput.step = "0.01";
                        valueInput.className = "table-input assign-value";
                        valueInput.placeholder = mode === "percentage" ? "%" : "$";
                        valueInput.value = assignment ? String(assignment.value) : "";
                        valueInput.disabled = !assignment;
                        valueInput.addEventListener("input", () => handlers.onAssignValueChange(line.id, person.id, Number(valueInput.value)));
                        personRow.append(valueInput);
                    }
                    panel.append(personRow);
                });
                details.append(panel);
                return details;
            }
            renderPeople(container, people, handlers) {
                container.innerHTML = "";
                people.forEach((person) => {
                    const row = document.createElement("div");
                    row.className = "person-chip";
                    const label = document.createElement("span");
                    label.textContent = person.name;
                    const remove = document.createElement("button");
                    remove.type = "button";
                    remove.textContent = "x";
                    remove.setAttribute("aria-label", `Remove ${person.name}`);
                    remove.addEventListener("click", () => handlers.onPersonDelete(person.id));
                    row.append(label, remove);
                    container.append(row);
                });
            }
            renderTotals(container, totals) {
                container.innerHTML = "";
                totals.forEach((total) => {
                    const row = document.createElement("div");
                    row.className = "split-total-row";
                    row.innerHTML = `
          <strong>${total.personName}</strong>
          <span>Items ${this.currencyFormatService.format(total.itemTotal)}</span>
          <span>Tax ${this.currencyFormatService.format(total.allocatedTax)}</span>
          <b>${this.currencyFormatService.format(total.finalTotal)}</b>
        `;
                    container.append(row);
                });
            }
            renderHistory(container, receipts) {
                container.innerHTML = "";
                receipts.forEach((receipt) => {
                    const card = document.createElement("details");
                    card.className = "history-card";
                    const summary = document.createElement("summary");
                    summary.className = "history-summary";
                    const heading = document.createElement("div");
                    heading.className = "history-heading";
                    const title = document.createElement("strong");
                    title.textContent = receipt.storeName || "Untitled receipt";
                    const meta = document.createElement("span");
                    meta.className = "history-meta";
                    const when = new Date(receipt.createdAt).toLocaleDateString();
                    meta.textContent = `${receipt.category} · ${when}`;
                    heading.append(title, meta);
                    const total = document.createElement("b");
                    total.className = "history-total";
                    total.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));
                    summary.append(heading, total);
                    card.append(summary);
                    const body = document.createElement("div");
                    body.className = "history-body";
                    if (receipt.lines.length > 0) {
                        const linesWrap = document.createElement("div");
                        linesWrap.className = "history-lines";
                        receipt.lines.forEach((line) => {
                            const lineRow = document.createElement("div");
                            lineRow.className = "history-line";
                            const names = line.assignments
                                .map((assignment) => assignment.personName)
                                .filter((value) => Boolean(value));
                            lineRow.innerHTML = `
              <span>${line.label}</span>
              <span class="history-line-people">${names.length ? names.join(", ") : "Unassigned"}</span>
              <b>${this.currencyFormatService.format(Number(line.amount))}</b>
            `;
                            linesWrap.append(lineRow);
                        });
                        body.append(linesWrap);
                    }
                    if (receipt.people.length > 0) {
                        const peopleWrap = document.createElement("div");
                        peopleWrap.className = "history-people";
                        peopleWrap.textContent = `People: ${receipt.people.map((person) => person.name).join(", ")}`;
                        body.append(peopleWrap);
                    }
                    card.append(body);
                    container.append(card);
                });
            }
            getAssignmentSummary(lineAssignments, people) {
                const names = lineAssignments
                    .map((assignment) => people.find((person) => person.id === assignment.personId)?.name)
                    .filter((name) => Boolean(name));
                return names.length > 0 ? names.join(", ") : "Assign ▾";
            }
        }
        UI.SplitWorkspaceView = SplitWorkspaceView;
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
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, idService, receiptApiService) {
                this.elements = elements;
                this.parserService = parserService;
                this.categorizationService = categorizationService;
                this.categoryRuleStorageService = categoryRuleStorageService;
                this.storageService = storageService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.geminiService = geminiService;
                this.categoryPromptView = categoryPromptView;
                this.splitWorkspaceView = splitWorkspaceView;
                this.splitCalculatorService = splitCalculatorService;
                this.idService = idService;
                this.receiptApiService = receiptApiService;
                this.receiptLines = [];
                this.people = [];
                this.assignments = [];
                this.lineModes = new Map();
                this.receiptCategory = "Groceries";
                this.cameraStream = null;
                this.isPromptingForCategories = false;
                this.reviewTimer = null;
                this.items = this.storageService.load();
            }
            start() {
                this.bindEvents();
                this.render();
                void this.initGeminiSettings();
            }
            bindEvents() {
                this.elements.sampleButton.addEventListener("click", () => this.loadSample());
                this.elements.dropzone.addEventListener("click", (event) => {
                    if (event.target === this.elements.receiptImage)
                        return;
                    event.preventDefault();
                    this.elements.receiptImage.click();
                });
                this.elements.receiptImage.addEventListener("change", () => this.handleImageInput());
                this.elements.clearImageButton.addEventListener("click", () => this.clearImage());
                this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
                this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
                this.elements.openCameraButton.addEventListener("click", () => void this.openCamera());
                this.elements.closeCameraButton.addEventListener("click", () => this.closeCamera());
                this.elements.capturePhotoButton.addEventListener("click", () => void this.captureCameraPhoto());
                this.elements.addPersonButton.addEventListener("click", () => this.addPerson());
                this.elements.personNameInput.addEventListener("keydown", (event) => {
                    if (event.key === "Enter")
                        this.addPerson();
                });
                this.elements.taxInput.addEventListener("input", () => this.renderTotals());
                this.elements.receiptCategory.addEventListener("change", () => {
                    this.receiptCategory = this.elements.receiptCategory.value;
                });
                this.elements.settingsButton.addEventListener("click", () => this.openSettings());
                this.elements.closeSettingsButton.addEventListener("click", () => this.closeSettings());
                this.elements.saveSettingsButton.addEventListener("click", () => this.saveSettings());
                this.elements.saveReceiptButton.addEventListener("click", () => void this.saveReceipt());
                this.elements.refreshHistoryButton.addEventListener("click", () => void this.loadHistory());
                this.elements.tabButtons.forEach((button) => {
                    button.addEventListener("click", () => this.switchTab(button.dataset.tab));
                });
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
            switchTab(tab) {
                this.elements.tabButtons.forEach((button) => {
                    button.classList.toggle("is-active", button.dataset.tab === tab);
                });
                this.elements.receiptsView.classList.toggle("hidden", tab !== "receipts");
                this.elements.historyView.classList.toggle("hidden", tab !== "history");
                this.elements.budgetingView.classList.toggle("hidden", tab !== "budgeting");
                if (tab === "history") {
                    void this.loadHistory();
                }
            }
            loadSample() {
                this.elements.receiptText.value = ReceiptRing.Config.SAMPLE_RECEIPT;
                this.setItemsFromParse(this.parserService.parse(ReceiptRing.Config.SAMPLE_RECEIPT));
                this.render();
                void this.reviewAmbiguousItems();
            }
            handleImageInput() {
                const file = this.elements.receiptImage.files?.[0];
                if (file) {
                    this.processReceiptImage(file);
                }
            }
            handleImageDrop(event) {
                const file = event.dataTransfer?.files?.[0];
                if (file) {
                    this.processReceiptImage(file);
                }
            }
            clearImage() {
                this.imagePreviewService.clear(this.elements.receiptImage, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                this.receiptLines = [];
                this.assignments = [];
                this.lineModes.clear();
                this.hideOcrStatus();
            }
            setItemsFromParse(items) {
                this.items = items;
                this.receiptLines = this.items.map((item) => ({
                    id: item.id,
                    label: item.label,
                    amount: item.amount,
                    confidence: item.categorizationConfidence * 100,
                    ignored: false
                }));
                this.assignments = [];
                this.lineModes.clear();
            }
            itemizeReceiptText() {
                this.setItemsFromParse(this.parserService.parse(this.elements.receiptText.value));
                this.render();
            }
            clearReceipt() {
                this.elements.receiptText.value = "";
                this.elements.storeNameInput.value = "";
                this.items = [];
                this.receiptLines = [];
                this.assignments = [];
                this.lineModes.clear();
                this.setSaveStatus("");
                this.render();
            }
            render() {
                this.storageService.save(this.items);
                this.renderWorkspace();
                this.renderTotals();
            }
            renderWorkspace() {
                this.elements.emptyState.classList.toggle("hidden", this.receiptLines.length > 0);
                this.elements.itemCount.textContent = `${this.receiptLines.length} ${this.receiptLines.length === 1 ? "line" : "lines"}`;
                const handlers = {
                    onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
                    onPersonDelete: (personId) => this.deletePerson(personId),
                    onAssignToggle: (lineId, personId) => this.toggleAssignment(lineId, personId),
                    onLineModeChange: (lineId, mode) => this.setLineMode(lineId, mode),
                    onAssignValueChange: (lineId, personId, value) => this.setAssignmentValue(lineId, personId, value)
                };
                this.splitWorkspaceView.renderLines(this.elements.receiptLinesList, this.receiptLines, this.assignments, this.people, this.lineModes, handlers);
                this.splitWorkspaceView.renderPeople(this.elements.peopleList, this.people, handlers);
            }
            renderTotals() {
                const unassignedCount = this.splitCalculatorService.getUnassignedCount(this.receiptLines, this.assignments);
                this.elements.unassignedCount.textContent = `${unassignedCount} unassigned`;
                this.elements.unassignedCount.classList.toggle("is-warning", unassignedCount > 0);
                this.splitWorkspaceView.renderTotals(this.elements.splitTotalsList, this.splitCalculatorService.calculate(this.people, this.receiptLines, this.assignments, this.getTaxAmount()));
                const grandTotal = this.getSubtotal() + this.getTaxAmount();
                this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
            }
            async extractAndItemizeReceipt(file) {
                const apiKey = localStorage.getItem("gemini_api_key") || "";
                const model = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
                if (!apiKey) {
                    this.setOcrStatus("Please configure your Gemini API Key in Settings first.", 1);
                    this.openSettings();
                    return;
                }
                this.setOcrStatus("Analyzing receipt with Gemini...", 0.15);
                this.elements.parseButton.setAttribute("disabled", "true");
                try {
                    const result = await this.geminiService.parseReceiptImage(file, apiKey, model);
                    console.log("Gemini parsed receipt output:", result);
                    const storeName = result.storeName || "";
                    const subtotal = typeof result.subtotal === "number" ? result.subtotal : null;
                    const tax = typeof result.tax === "number" ? result.tax : null;
                    const total = typeof result.total === "number" ? result.total : null;
                    this.elements.storeNameInput.value = storeName;
                    this.elements.taxInput.value = String(tax ?? 0);
                    let formattedText = `Store: ${storeName}\n\nItems:\n`;
                    const purchaseItems = [];
                    if (Array.isArray(result.items)) {
                        result.items.forEach((item) => {
                            const label = this.toTitleCase(item.name || "Unknown Item");
                            const amount = typeof item.price === "number" ? item.price : Number(item.price) || 0;
                            const lowConfidence = !!item.lowConfidence;
                            formattedText += `- ${label}: $${amount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;
                            const categorization = this.categorizationService.categorize(label);
                            purchaseItems.push({
                                id: this.idService.create(),
                                label,
                                amount: Number(amount.toFixed(2)),
                                category: categorization.category,
                                categorizationConfidence: lowConfidence ? 0.3 : categorization.confidence,
                                categorizationSource: categorization.source,
                                needsCategoryReview: lowConfidence || categorization.shouldPrompt
                            });
                        });
                    }
                    if (Array.isArray(result.discounts) && result.discounts.length > 0) {
                        formattedText += `\nDiscounts:\n`;
                        result.discounts.forEach((discount) => {
                            const label = this.toTitleCase(discount.name || "Discount") + " (Discount)";
                            const amount = typeof discount.amount === "number" ? discount.amount : Number(discount.amount) || 0;
                            const negativeAmount = -Math.abs(amount);
                            formattedText += `- ${label}: -$${Math.abs(negativeAmount).toFixed(2)}\n`;
                            purchaseItems.push({
                                id: this.idService.create(),
                                label,
                                amount: Number(negativeAmount.toFixed(2)),
                                category: "Other",
                                categorizationConfidence: 1.0,
                                categorizationSource: "saved-rule",
                                needsCategoryReview: false
                            });
                        });
                    }
                    formattedText += `\nSubtotal: $${(subtotal ?? 0).toFixed(2)}\nTax: $${(tax ?? 0).toFixed(2)}\nTotal: $${(total ?? 0).toFixed(2)}`;
                    this.elements.receiptText.value = formattedText;
                    this.setItemsFromParse(purchaseItems);
                    this.setSaveStatus("");
                    this.render();
                    this.setOcrStatus(`Found ${this.receiptLines.length} lines via Gemini`, 1);
                    window.setTimeout(() => this.hideOcrStatus(), 1600);
                }
                catch (error) {
                    console.error("Gemini receipt parsing failed:", error);
                    const message = error instanceof Error ? error.message : "Could not extract text from this receipt.";
                    this.setOcrStatus(message, 1);
                }
                finally {
                    this.elements.parseButton.removeAttribute("disabled");
                }
            }
            async initGeminiSettings() {
                const env = await this.geminiService.loadDotEnv();
                if (env.GEMINI_API_KEY) {
                    localStorage.setItem("gemini_api_key", env.GEMINI_API_KEY);
                }
                if (env.GEMINI_MODEL) {
                    localStorage.setItem("gemini_model", env.GEMINI_MODEL);
                }
                this.elements.geminiApiKey.value = localStorage.getItem("gemini_api_key") || "";
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
            }
            openSettings() {
                this.elements.geminiApiKey.value = localStorage.getItem("gemini_api_key") || "";
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
                this.elements.settingsModal.classList.remove("hidden");
            }
            closeSettings() {
                this.elements.settingsModal.classList.add("hidden");
            }
            saveSettings() {
                const key = this.elements.geminiApiKey.value.trim();
                const model = this.elements.geminiModel.value;
                localStorage.setItem("gemini_api_key", key);
                localStorage.setItem("gemini_model", model);
                this.closeSettings();
            }
            toTitleCase(value) {
                return value
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ");
            }
            setOcrStatus(label, progress) {
                this.elements.ocrStatus.classList.remove("hidden");
                this.elements.ocrStatusText.textContent = label;
                this.elements.ocrProgressBar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
            }
            hideOcrStatus() {
                this.elements.ocrStatus.classList.add("hidden");
                this.elements.ocrProgressBar.style.width = "0%";
            }
            async openCamera() {
                if (!navigator.mediaDevices?.getUserMedia) {
                    this.setOcrStatus("Camera is not available here. Opening file upload instead.", 1);
                    this.elements.receiptImage.click();
                    return;
                }
                try {
                    this.cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: { ideal: "environment" },
                            width: { ideal: 1920 },
                            height: { ideal: 2560 }
                        },
                        audio: false
                    });
                    this.elements.cameraVideo.srcObject = this.cameraStream;
                    this.elements.cameraModal.classList.remove("hidden");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Camera permission was denied.";
                    this.setOcrStatus(`Camera unavailable: ${message}. Opening file upload instead.`, 1);
                    this.elements.receiptImage.click();
                }
            }
            closeCamera() {
                this.cameraStream?.getTracks().forEach((track) => track.stop());
                this.cameraStream = null;
                this.elements.cameraVideo.srcObject = null;
                this.elements.cameraModal.classList.add("hidden");
            }
            async captureCameraPhoto() {
                const video = this.elements.cameraVideo;
                const canvas = this.elements.cameraCanvas;
                const context = canvas.getContext("2d");
                if (!context || video.videoWidth === 0 || video.videoHeight === 0)
                    return;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
                if (!blob)
                    return;
                const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
                this.closeCamera();
                this.processReceiptImage(file);
            }
            processReceiptImage(file) {
                this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                this.setOcrStatus(`Loaded ${file.name || "receipt image"}`, 0.02);
                void this.extractAndItemizeReceipt(file);
            }
            addPerson() {
                const name = this.elements.personNameInput.value.trim();
                if (!name)
                    return;
                const person = { id: this.idService.create(), name };
                this.people = [...this.people, person];
                this.elements.personNameInput.value = "";
                this.render();
            }
            deletePerson(personId) {
                this.people = this.people.filter((person) => person.id !== personId);
                this.assignments = this.assignments.filter((assignment) => assignment.personId !== personId);
                this.render();
            }
            toggleIgnoredLine(lineId) {
                this.receiptLines = this.receiptLines.map((line) => line.id === lineId ? { ...line, ignored: !line.ignored } : line);
                this.assignments = this.assignments.filter((assignment) => assignment.lineId !== lineId);
                this.render();
            }
            toggleAssignment(lineId, personId) {
                const existing = this.assignments.find((assignment) => assignment.lineId === lineId && assignment.personId === personId);
                if (existing) {
                    this.assignments = this.assignments.filter((assignment) => assignment !== existing);
                }
                else {
                    this.assignments = [
                        ...this.assignments,
                        {
                            id: this.idService.create(),
                            lineId,
                            personId,
                            mode: this.lineModes.get(lineId) ?? "equal",
                            value: 0
                        }
                    ];
                }
                this.render();
            }
            setLineMode(lineId, mode) {
                this.lineModes.set(lineId, mode);
                this.assignments = this.assignments.map((assignment) => assignment.lineId === lineId
                    ? { ...assignment, mode, value: mode === "equal" ? 0 : assignment.value }
                    : assignment);
                this.render();
            }
            setAssignmentValue(lineId, personId, value) {
                this.assignments = this.assignments.map((assignment) => assignment.lineId === lineId && assignment.personId === personId
                    ? { ...assignment, value: Number.isFinite(value) ? value : 0 }
                    : assignment);
                this.renderTotals();
            }
            getSubtotal() {
                return this.receiptLines.filter((line) => !line.ignored).reduce((sum, line) => sum + line.amount, 0);
            }
            getTaxAmount() {
                const value = Number(this.elements.taxInput.value);
                return Number.isFinite(value) ? value : 0;
            }
            setSaveStatus(message, isError = false) {
                this.elements.saveStatus.textContent = message;
                this.elements.saveStatus.classList.toggle("is-error", isError);
            }
            async saveReceipt() {
                if (this.receiptLines.length === 0) {
                    this.setSaveStatus("Add receipt lines before saving.", true);
                    return;
                }
                const subtotal = this.getSubtotal();
                const tax = this.getTaxAmount();
                const payload = {
                    storeName: this.elements.storeNameInput.value.trim() || null,
                    category: this.receiptCategory,
                    subtotal,
                    tax,
                    total: subtotal + tax,
                    people: this.people.map((person) => ({ clientId: person.id, name: person.name })),
                    lines: this.receiptLines.map((line) => ({
                        clientId: line.id,
                        label: line.label,
                        amount: line.amount,
                        ignored: line.ignored
                    })),
                    assignments: this.assignments.map((assignment) => ({
                        lineClientId: assignment.lineId,
                        personClientId: assignment.personId,
                        mode: assignment.mode,
                        value: assignment.value
                    }))
                };
                this.elements.saveReceiptButton.setAttribute("disabled", "true");
                this.setSaveStatus("Saving...");
                try {
                    await this.receiptApiService.save(payload);
                    this.setSaveStatus("Saved to history.");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not save receipt.";
                    this.setSaveStatus(message, true);
                }
                finally {
                    this.elements.saveReceiptButton.removeAttribute("disabled");
                }
            }
            async loadHistory() {
                try {
                    const receipts = await this.receiptApiService.list();
                    this.elements.historyEmpty.classList.toggle("hidden", receipts.length > 0);
                    this.splitWorkspaceView.renderHistory(this.elements.historyList, receipts);
                }
                catch (error) {
                    this.elements.historyEmpty.classList.remove("hidden");
                    this.elements.historyEmpty.innerHTML = `<strong>Couldn't load history</strong><span>${error instanceof Error ? error.message : "Is the server running?"}</span>`;
                    this.splitWorkspaceView.renderHistory(this.elements.historyList, []);
                }
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
    const splitCalculatorService = new ReceiptRing.Services.SplitCalculatorService();
    const imagePreviewService = new ReceiptRing.Services.ImagePreviewService();
    const geminiService = new ReceiptRing.Services.GeminiService();
    const receiptApiService = new ReceiptRing.Services.ReceiptApiService();
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    const splitWorkspaceView = new ReceiptRing.UI.SplitWorkspaceView(currencyFormatService);
    new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, idService, receiptApiService).start();
})(ReceiptRing || (ReceiptRing = {}));
