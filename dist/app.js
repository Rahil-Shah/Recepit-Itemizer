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
            async loadConfig() {
                try {
                    const response = await fetch("/api/gemini-config", { credentials: "same-origin" });
                    if (response.ok) {
                        const config = (await response.json());
                        return {
                            model: config.GEMINI_MODEL || "",
                            hasServerKey: Boolean(config.hasServerKey),
                            hasUserKey: Boolean(config.hasUserKey)
                        };
                    }
                }
                catch {
                }
                return { model: "", hasServerKey: false, hasUserKey: false };
            }
            async saveApiKey(apiKey) {
                const response = await fetch("/api/gemini-key", {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ apiKey })
                });
                if (!response.ok) {
                    const body = (await response.json().catch(() => ({})));
                    throw new Error(body.error || "Could not save the key.");
                }
            }
            async clearApiKey() {
                const response = await fetch("/api/gemini-key", {
                    method: "DELETE",
                    credentials: "same-origin"
                });
                if (!response.ok) {
                    const body = (await response.json().catch(() => ({})));
                    throw new Error(body.error || "Could not clear the key.");
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
            async parseReceiptImage(file, model) {
                const base64Data = await this.fileToBase64(file);
                const proxyResponse = await fetch("/api/gemini/parse", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model, mimeType: file.type, imageBase64: base64Data })
                });
                if (!proxyResponse.ok) {
                    const errText = await proxyResponse.text();
                    throw new Error(`Receipt parsing failed (${proxyResponse.status}): ${errText}`);
                }
                return this.extractParsedJson(await proxyResponse.json());
            }
            extractParsedJson(json) {
                const textResult = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResult) {
                    throw new Error("No response text returned from Gemini.");
                }
                try {
                    const cleanedText = textResult.trim().replace(/^```json/, "").replace(/```$/, "").trim();
                    return JSON.parse(cleanedText);
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
    var Services;
    (function (Services) {
        class AuthApiService {
            async request(path, init) {
                return fetch(path, { credentials: "same-origin", ...init });
            }
            async parseError(response) {
                try {
                    const data = (await response.json());
                    return data.error ?? `Request failed (${response.status}).`;
                }
                catch {
                    return `Request failed (${response.status}).`;
                }
            }
            async me() {
                const response = await this.request("/api/auth/me");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async login(email, password) {
                const response = await this.request("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async register(email, password, name) {
                const response = await this.request("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, name })
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async logout() {
                await this.request("/api/auth/logout", { method: "POST" });
            }
        }
        Services.AuthApiService = AuthApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class BankApiService {
            async request(path, init) {
                return fetch(path, { credentials: "same-origin", ...init });
            }
            async parseError(response) {
                try {
                    const data = (await response.json());
                    return data.error ?? `Request failed (${response.status}).`;
                }
                catch {
                    return `Request failed (${response.status}).`;
                }
            }
            async config() {
                const response = await this.request("/api/teller/config");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async enroll(enrollment) {
                const response = await this.request("/api/teller/enroll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        accessToken: enrollment.accessToken,
                        enrollment: enrollment.enrollment ?? null
                    })
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async sync() {
                const response = await this.request("/api/teller/sync", { method: "POST" });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async listTransactions() {
                const response = await this.request("/api/transactions");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
        }
        Services.BankApiService = BankApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        const FALLBACK_COLORS = ["#7cc4ff", "#f0a6ca", "#c3b1e1", "#ffd6a5", "#9ee7c0", "#e8998d"];
        const CATEGORY_ALIASES = {
            dining: "Dining",
            restaurants: "Dining",
            bar: "Dining",
            coffee: "Dining",
            groceries: "Groceries",
            grocery: "Groceries",
            supermarket: "Groceries",
            transport: "Transport",
            transportation: "Transport",
            fuel: "Transport",
            gas: "Transport",
            travel: "Transport",
            entertainment: "Entertainment",
            health: "Health",
            healthcare: "Health",
            medical: "Health",
            home: "Home",
            utilities: "Home",
            shopping: "Personal",
            clothing: "Personal",
            personal: "Personal",
            general: "Other"
        };
        class SpendingAggregatorService {
            constructor(categories) {
                this.colorByName = new Map();
                for (const category of categories) {
                    this.colorByName.set(category.name, category.color);
                }
            }
            aggregate(receipts, transactions) {
                const byMonth = new Map();
                const add = (dateStr, rawCategory, amount) => {
                    if (!(amount > 0))
                        return;
                    const month = this.monthKey(dateStr);
                    if (!month)
                        return;
                    const category = this.normalize(rawCategory);
                    const bucket = byMonth.get(month) ?? new Map();
                    bucket.set(category, (bucket.get(category) ?? 0) + amount);
                    byMonth.set(month, bucket);
                };
                for (const receipt of receipts) {
                    add(receipt.createdAt, receipt.category, receipt.total ?? 0);
                }
                for (const txn of transactions) {
                    add(txn.date, txn.category, txn.amount < 0 ? -txn.amount : 0);
                }
                return [...byMonth.entries()]
                    .map(([month, bucket]) => ({
                    month,
                    total: [...bucket.values()].reduce((sum, value) => sum + value, 0),
                    categories: [...bucket.entries()]
                        .map(([category, amount]) => ({ category, amount, color: this.color(category) }))
                        .sort((a, b) => b.amount - a.amount)
                }))
                    .sort((a, b) => (a.month < b.month ? 1 : -1));
            }
            monthKey(dateStr) {
                if (typeof dateStr === "string" && /^\d{4}-\d{2}/.test(dateStr)) {
                    return dateStr.slice(0, 7);
                }
                const date = new Date(dateStr);
                if (Number.isNaN(date.getTime()))
                    return null;
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            }
            normalize(raw) {
                if (!raw)
                    return "Other";
                const key = raw.trim().toLowerCase();
                if (CATEGORY_ALIASES[key])
                    return CATEGORY_ALIASES[key];
                return key.charAt(0).toUpperCase() + key.slice(1);
            }
            color(name) {
                const known = this.colorByName.get(name);
                if (known)
                    return known;
                let hash = 0;
                for (let i = 0; i < name.length; i += 1) {
                    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
                }
                return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
            }
        }
        Services.SpendingAggregatorService = SpendingAggregatorService;
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
                    geminiKeyStatus: this.getElement("#geminiKeyStatus", HTMLElement),
                    removeKeyButton: this.getElement("#removeKeyButton", HTMLButtonElement),
                    closeSettingsButton: this.getElement("#closeSettingsButton", HTMLButtonElement),
                    saveSettingsButton: this.getElement("#saveSettingsButton", HTMLButtonElement),
                    authOverlay: this.getElement("#authOverlay", HTMLElement),
                    authForm: this.getElement("#authForm", HTMLFormElement),
                    authTitle: this.getElement("#authTitle", HTMLElement),
                    authNameField: this.getElement("#authNameField", HTMLElement),
                    authName: this.getElement("#authName", HTMLInputElement),
                    authEmail: this.getElement("#authEmail", HTMLInputElement),
                    authPassword: this.getElement("#authPassword", HTMLInputElement),
                    authSubmit: this.getElement("#authSubmit", HTMLButtonElement),
                    authError: this.getElement("#authError", HTMLElement),
                    authSwitchText: this.getElement("#authSwitchText", HTMLElement),
                    authToggle: this.getElement("#authToggle", HTMLButtonElement),
                    logoutButton: this.getElement("#logoutButton", HTMLButtonElement),
                    budgetMonth: this.getElement("#budgetMonth", HTMLSelectElement),
                    budgetRing: this.getElement("#budgetRing", HTMLElement),
                    budgetLegend: this.getElement("#budgetLegend", HTMLElement),
                    connectBankButton: this.getElement("#connectBankButton", HTMLButtonElement),
                    bankStatus: this.getElement("#bankStatus", HTMLElement),
                    transactionsList: this.getElement("#transactionsList", HTMLElement),
                    transactionsEmpty: this.getElement("#transactionsEmpty", HTMLElement)
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
        class AuthView {
            constructor(elements, authApi) {
                this.elements = elements;
                this.authApi = authApi;
                this.mode = "login";
                this.onAuthenticated = null;
            }
            init() {
                this.elements.authForm.addEventListener("submit", (event) => {
                    event.preventDefault();
                    void this.submit();
                });
                this.elements.authToggle.addEventListener("click", () => {
                    this.setMode(this.mode === "login" ? "register" : "login");
                });
                this.setMode("login");
            }
            show() {
                this.elements.authOverlay.classList.remove("hidden");
            }
            hide() {
                this.elements.authOverlay.classList.add("hidden");
            }
            setMode(mode) {
                this.mode = mode;
                const registering = mode === "register";
                this.elements.authTitle.textContent = registering ? "Create account" : "Log in";
                this.elements.authSubmit.textContent = registering ? "Sign up" : "Log in";
                this.elements.authSwitchText.textContent = registering
                    ? "Already have an account?"
                    : "Need an account?";
                this.elements.authToggle.textContent = registering ? "Log in" : "Sign up";
                this.elements.authNameField.classList.toggle("hidden", !registering);
                this.elements.authPassword.setAttribute("autocomplete", registering ? "new-password" : "current-password");
                this.setError("");
            }
            setError(message) {
                this.elements.authError.textContent = message;
                this.elements.authError.classList.toggle("hidden", message === "");
            }
            async submit() {
                const email = this.elements.authEmail.value.trim();
                const password = this.elements.authPassword.value;
                const name = this.elements.authName.value.trim() || null;
                this.setError("");
                this.elements.authSubmit.disabled = true;
                try {
                    const user = this.mode === "register"
                        ? await this.authApi.register(email, password, name)
                        : await this.authApi.login(email, password);
                    this.elements.authForm.reset();
                    this.onAuthenticated?.(user);
                }
                catch (error) {
                    this.setError(error instanceof Error ? error.message : "Something went wrong.");
                }
                finally {
                    this.elements.authSubmit.disabled = false;
                }
            }
        }
        UI.AuthView = AuthView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        const SVG_NS = "http://www.w3.org/2000/svg";
        class BudgetRingView {
            constructor(currencyFormatService) {
                this.currencyFormatService = currencyFormatService;
            }
            render(ringEl, legendEl, month) {
                ringEl.replaceChildren();
                legendEl.replaceChildren();
                if (!month || month.total <= 0) {
                    const empty = document.createElement("p");
                    empty.className = "budget-ring-empty";
                    empty.textContent = "No spending recorded for this month.";
                    ringEl.append(empty);
                    return;
                }
                ringEl.append(this.buildSvg(month));
                legendEl.append(this.buildLegend(month));
            }
            buildSvg(month) {
                const size = 220;
                const stroke = 30;
                const radius = (size - stroke) / 2;
                const cx = size / 2;
                const cy = size / 2;
                const circumference = 2 * Math.PI * radius;
                const svg = document.createElementNS(SVG_NS, "svg");
                svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
                svg.setAttribute("width", String(size));
                svg.setAttribute("height", String(size));
                svg.setAttribute("class", "budget-ring-svg");
                svg.setAttribute("role", "img");
                svg.setAttribute("aria-label", `Spending by category, total ${this.currencyFormatService.format(month.total)}`);
                const track = document.createElementNS(SVG_NS, "circle");
                track.setAttribute("cx", String(cx));
                track.setAttribute("cy", String(cy));
                track.setAttribute("r", String(radius));
                track.setAttribute("fill", "none");
                track.setAttribute("stroke", "rgba(255,255,255,0.07)");
                track.setAttribute("stroke-width", String(stroke));
                svg.append(track);
                let offset = 0;
                for (const slice of month.categories) {
                    const fraction = slice.amount / month.total;
                    const segment = document.createElementNS(SVG_NS, "circle");
                    segment.setAttribute("cx", String(cx));
                    segment.setAttribute("cy", String(cy));
                    segment.setAttribute("r", String(radius));
                    segment.setAttribute("fill", "none");
                    segment.setAttribute("stroke", slice.color);
                    segment.setAttribute("stroke-width", String(stroke));
                    segment.setAttribute("stroke-dasharray", `${fraction * circumference} ${circumference}`);
                    segment.setAttribute("stroke-dashoffset", String(-offset * circumference));
                    segment.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
                    const title = document.createElementNS(SVG_NS, "title");
                    title.textContent = `${slice.category}: ${this.currencyFormatService.format(slice.amount)}`;
                    segment.append(title);
                    svg.append(segment);
                    offset += fraction;
                }
                const totalText = document.createElementNS(SVG_NS, "text");
                totalText.setAttribute("x", String(cx));
                totalText.setAttribute("y", String(cy - 2));
                totalText.setAttribute("text-anchor", "middle");
                totalText.setAttribute("class", "budget-ring-total");
                totalText.textContent = this.currencyFormatService.format(month.total);
                svg.append(totalText);
                const caption = document.createElementNS(SVG_NS, "text");
                caption.setAttribute("x", String(cx));
                caption.setAttribute("y", String(cy + 18));
                caption.setAttribute("text-anchor", "middle");
                caption.setAttribute("class", "budget-ring-caption");
                caption.textContent = "spent";
                svg.append(caption);
                return svg;
            }
            buildLegend(month) {
                const list = document.createElement("ul");
                list.className = "budget-legend-list";
                for (const slice of month.categories) {
                    const item = document.createElement("li");
                    item.className = "budget-legend-item";
                    const swatch = document.createElement("span");
                    swatch.className = "budget-legend-swatch";
                    swatch.style.backgroundColor = slice.color;
                    const label = document.createElement("span");
                    label.className = "budget-legend-label";
                    label.textContent = slice.category;
                    const value = document.createElement("span");
                    value.className = "budget-legend-value";
                    const percent = Math.round((slice.amount / month.total) * 100);
                    value.textContent = `${this.currencyFormatService.format(slice.amount)} · ${percent}%`;
                    item.append(swatch, label, value);
                    list.append(item);
                }
                return list;
            }
        }
        UI.BudgetRingView = BudgetRingView;
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
                const reposition = () => {
                    if (!details.isConnected) {
                        this.teardownPanelPositioning(reposition);
                        return;
                    }
                    this.positionPanel(summary, panel);
                };
                details.addEventListener("toggle", () => {
                    if (details.open) {
                        this.closeOtherDropdowns(details);
                        this.positionPanel(summary, panel);
                        window.addEventListener("scroll", reposition, true);
                        window.addEventListener("resize", reposition);
                    }
                    else {
                        this.teardownPanelPositioning(reposition);
                        this.resetPanelPosition(panel);
                    }
                });
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
                    const name = document.createElement("strong");
                    name.textContent = total.personName;
                    const items = document.createElement("span");
                    items.textContent = `Items ${this.currencyFormatService.format(total.itemTotal)}`;
                    const tax = document.createElement("span");
                    tax.textContent = `Tax ${this.currencyFormatService.format(total.allocatedTax)}`;
                    const final = document.createElement("b");
                    final.textContent = this.currencyFormatService.format(total.finalTotal);
                    row.append(name, items, tax, final);
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
                            const label = document.createElement("span");
                            label.textContent = line.label;
                            const peopleSpan = document.createElement("span");
                            peopleSpan.className = "history-line-people";
                            peopleSpan.textContent = names.length ? names.join(", ") : "Unassigned";
                            const amountEl = document.createElement("b");
                            amountEl.textContent = this.currencyFormatService.format(Number(line.amount));
                            lineRow.append(label, peopleSpan, amountEl);
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
            positionPanel(summary, panel) {
                const margin = 8;
                const summaryRect = summary.getBoundingClientRect();
                panel.style.position = "fixed";
                panel.style.maxHeight = "";
                panel.style.width = `${Math.max(230, summaryRect.width)}px`;
                const panelHeight = panel.scrollHeight;
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                const spaceBelow = viewportHeight - summaryRect.bottom - margin;
                const spaceAbove = summaryRect.top - margin;
                let top;
                if (panelHeight <= spaceBelow || spaceBelow >= spaceAbove) {
                    top = summaryRect.bottom + margin;
                    panel.style.maxHeight = `${Math.max(0, spaceBelow)}px`;
                }
                else {
                    panel.style.maxHeight = `${Math.max(0, spaceAbove)}px`;
                    top = Math.max(margin, summaryRect.top - margin - Math.min(panelHeight, spaceAbove));
                }
                const panelWidth = panel.getBoundingClientRect().width;
                const left = Math.max(margin, Math.min(summaryRect.left, viewportWidth - margin - panelWidth));
                panel.style.top = `${top}px`;
                panel.style.left = `${left}px`;
                panel.style.overflowY = "auto";
            }
            resetPanelPosition(panel) {
                panel.style.position = "";
                panel.style.top = "";
                panel.style.left = "";
                panel.style.width = "";
                panel.style.maxHeight = "";
                panel.style.overflowY = "";
            }
            teardownPanelPositioning(reposition) {
                window.removeEventListener("scroll", reposition, true);
                window.removeEventListener("resize", reposition);
            }
            closeOtherDropdowns(current) {
                document
                    .querySelectorAll("details.assign-dropdown[open]")
                    .forEach((dropdown) => {
                    if (dropdown !== current) {
                        dropdown.open = false;
                    }
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
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, idService, receiptApiService, bankApiService, spendingAggregatorService, budgetRingView) {
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
                this.bankApiService = bankApiService;
                this.spendingAggregatorService = spendingAggregatorService;
                this.budgetRingView = budgetRingView;
                this.receiptLines = [];
                this.people = [];
                this.assignments = [];
                this.lineModes = new Map();
                this.receiptCategory = "Groceries";
                this.cameraStream = null;
                this.isPromptingForCategories = false;
                this.reviewTimer = null;
                this.bankTransactions = [];
                this.monthlySpend = [];
                this.selectedMonth = null;
                this.serverHasGeminiKey = false;
                this.userHasGeminiKey = false;
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
                this.elements.saveSettingsButton.addEventListener("click", () => void this.saveSettings());
                this.elements.removeKeyButton.addEventListener("click", () => void this.removeGeminiKey());
                this.elements.saveReceiptButton.addEventListener("click", () => void this.saveReceipt());
                this.elements.refreshHistoryButton.addEventListener("click", () => void this.loadHistory());
                this.elements.connectBankButton.addEventListener("click", () => void this.connectBank());
                this.elements.budgetMonth.addEventListener("change", () => {
                    this.selectedMonth = this.elements.budgetMonth.value || null;
                    this.renderRing();
                });
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
                if (tab === "budgeting") {
                    void this.loadBudgeting();
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
                const model = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
                if (!this.userHasGeminiKey && !this.serverHasGeminiKey) {
                    this.setOcrStatus("Please add your Gemini API key in Settings first.", 1);
                    this.openSettings();
                    return;
                }
                this.setOcrStatus("Analyzing receipt with Gemini...", 0.15);
                this.elements.parseButton.setAttribute("disabled", "true");
                try {
                    const result = await this.geminiService.parseReceiptImage(file, model);
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
                const config = await this.geminiService.loadConfig();
                this.serverHasGeminiKey = config.hasServerKey;
                this.userHasGeminiKey = config.hasUserKey;
                if (config.model) {
                    localStorage.setItem("gemini_model", config.model);
                }
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
            }
            openSettings() {
                this.elements.geminiApiKey.value = "";
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
                this.renderGeminiKeyStatus();
                this.elements.settingsModal.classList.remove("hidden");
            }
            closeSettings() {
                this.elements.settingsModal.classList.add("hidden");
            }
            renderGeminiKeyStatus(message, isError = false) {
                const status = this.elements.geminiKeyStatus;
                if (message) {
                    status.textContent = message;
                    status.classList.toggle("is-active", !isError);
                    this.elements.removeKeyButton.classList.toggle("hidden", !this.userHasGeminiKey);
                    return;
                }
                if (this.userHasGeminiKey) {
                    status.textContent = "Using your saved personal key.";
                    status.classList.add("is-active");
                }
                else if (this.serverHasGeminiKey) {
                    status.textContent = "Using the shared server key. Add a key to use your own.";
                    status.classList.remove("is-active");
                }
                else {
                    status.textContent = "No key configured yet. Add one to parse receipts.";
                    status.classList.remove("is-active");
                }
                this.elements.removeKeyButton.classList.toggle("hidden", !this.userHasGeminiKey);
            }
            async saveSettings() {
                const key = this.elements.geminiApiKey.value.trim();
                localStorage.setItem("gemini_model", this.elements.geminiModel.value);
                if (!key) {
                    this.closeSettings();
                    return;
                }
                this.elements.saveSettingsButton.setAttribute("disabled", "true");
                try {
                    await this.geminiService.saveApiKey(key);
                    this.userHasGeminiKey = true;
                    this.elements.geminiApiKey.value = "";
                    this.closeSettings();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not save the key.";
                    this.renderGeminiKeyStatus(message, true);
                }
                finally {
                    this.elements.saveSettingsButton.removeAttribute("disabled");
                }
            }
            async removeGeminiKey() {
                this.elements.removeKeyButton.setAttribute("disabled", "true");
                try {
                    await this.geminiService.clearApiKey();
                    this.userHasGeminiKey = false;
                    this.elements.geminiApiKey.value = "";
                    this.renderGeminiKeyStatus();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not clear the key.";
                    this.renderGeminiKeyStatus(message, true);
                }
                finally {
                    this.elements.removeKeyButton.removeAttribute("disabled");
                }
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
                    const title = document.createElement("strong");
                    title.textContent = "Couldn't load history";
                    const detail = document.createElement("span");
                    detail.textContent = error instanceof Error ? error.message : "Is the server running?";
                    this.elements.historyEmpty.replaceChildren(title, detail);
                    this.splitWorkspaceView.renderHistory(this.elements.historyList, []);
                }
            }
            setBankStatus(message) {
                this.elements.bankStatus.textContent = message;
            }
            async connectBank() {
                try {
                    this.setBankStatus("Opening Teller…");
                    const config = await this.bankApiService.config();
                    if (!config.applicationId) {
                        this.setBankStatus("Set TELLER_APPLICATION_ID in .env to connect a bank.");
                        return;
                    }
                    if (typeof TellerConnect === "undefined") {
                        this.setBankStatus("Teller Connect failed to load. Check your connection.");
                        return;
                    }
                    const teller = TellerConnect.setup({
                        applicationId: config.applicationId,
                        environment: config.environment,
                        products: ["transactions"],
                        onSuccess: (enrollment) => void this.handleEnrollment(enrollment),
                        onFailure: () => this.setBankStatus("Bank connection failed."),
                        onExit: () => this.setBankStatus("")
                    });
                    teller.open();
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Could not start Teller.");
                }
            }
            async handleEnrollment(enrollment) {
                try {
                    this.setBankStatus("Linking account…");
                    const result = await this.bankApiService.enroll(enrollment);
                    this.setBankStatus(`Connected ${result.institutionName ?? "bank"}. Syncing…`);
                    const { imported } = await this.bankApiService.sync();
                    this.setBankStatus(`Imported ${imported} transaction${imported === 1 ? "" : "s"}.`);
                    await this.loadBudgeting();
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Enrollment failed.");
                }
            }
            async loadBudgeting() {
                let receipts = [];
                try {
                    receipts = await this.receiptApiService.list();
                }
                catch {
                    receipts = [];
                }
                try {
                    this.bankTransactions = await this.bankApiService.listTransactions();
                }
                catch {
                    this.bankTransactions = [];
                }
                this.monthlySpend = this.spendingAggregatorService.aggregate(receipts, this.bankTransactions);
                this.populateMonths();
                this.renderTransactions();
                this.renderRing();
            }
            populateMonths() {
                const select = this.elements.budgetMonth;
                const previous = this.selectedMonth;
                select.replaceChildren();
                for (const entry of this.monthlySpend) {
                    const option = document.createElement("option");
                    option.value = entry.month;
                    option.textContent = this.formatMonthLabel(entry.month);
                    select.append(option);
                }
                if (this.monthlySpend.length === 0) {
                    this.selectedMonth = null;
                    return;
                }
                this.selectedMonth = this.monthlySpend.some((entry) => entry.month === previous)
                    ? previous
                    : this.monthlySpend[0].month;
                select.value = this.selectedMonth ?? "";
            }
            renderRing() {
                const month = this.monthlySpend.find((entry) => entry.month === this.selectedMonth) ?? null;
                this.budgetRingView.render(this.elements.budgetRing, this.elements.budgetLegend, month);
            }
            formatMonthLabel(key) {
                const [year, month] = key.split("-").map(Number);
                if (!year || !month)
                    return key;
                return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric"
                });
            }
            renderTransactions() {
                const list = this.elements.transactionsList;
                const transactions = this.bankTransactions;
                this.elements.transactionsEmpty.classList.toggle("hidden", transactions.length > 0);
                list.replaceChildren();
                for (const txn of transactions.slice(0, 100)) {
                    const row = document.createElement("div");
                    row.className = "transaction-row";
                    const main = document.createElement("div");
                    main.className = "transaction-main";
                    const desc = document.createElement("span");
                    desc.className = "transaction-desc";
                    desc.textContent = txn.description ?? "Transaction";
                    const meta = document.createElement("span");
                    meta.className = "transaction-meta";
                    const date = new Date(txn.date).toLocaleDateString();
                    meta.textContent = txn.category ? `${date} · ${txn.category}` : date;
                    main.append(desc, meta);
                    const amount = document.createElement("span");
                    amount.className = "transaction-amount";
                    amount.textContent = this.currencyFormatService.format(txn.amount);
                    row.append(main, amount);
                    list.append(row);
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
    const authApiService = new ReceiptRing.Services.AuthApiService();
    const bankApiService = new ReceiptRing.Services.BankApiService();
    const spendingAggregatorService = new ReceiptRing.Services.SpendingAggregatorService(categories);
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    const splitWorkspaceView = new ReceiptRing.UI.SplitWorkspaceView(currencyFormatService);
    const budgetRingView = new ReceiptRing.UI.BudgetRingView(currencyFormatService);
    const authView = new ReceiptRing.UI.AuthView(elements, authApiService);
    const controller = new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, idService, receiptApiService, bankApiService, spendingAggregatorService, budgetRingView);
    let started = false;
    const startApp = () => {
        if (started)
            return;
        started = true;
        controller.start();
    };
    authView.init();
    authView.onAuthenticated = () => {
        authView.hide();
        startApp();
    };
    elements.logoutButton.addEventListener("click", () => {
        void authApiService.logout().finally(() => window.location.reload());
    });
    void (async () => {
        try {
            await authApiService.me();
            authView.hide();
            startApp();
        }
        catch {
            authView.show();
        }
    })();
})(ReceiptRing || (ReceiptRing = {}));
