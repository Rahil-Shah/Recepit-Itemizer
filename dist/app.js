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
        class PaddleOcrProvider {
            constructor() {
                this.name = "PaddleOCR";
            }
            async recognize(_file, _onProgress) {
                throw new Error("PaddleOCR provider is installed but not active in the static bundle. Move the app to an ESM bundler to enable @paddleocr/paddleocr-js as the primary OCR engine.");
            }
        }
        Services.PaddleOcrProvider = PaddleOcrProvider;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class NoopOcrRepairService {
            async repair(document) {
                return document;
            }
        }
        Services.NoopOcrRepairService = NoopOcrRepairService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class NoopAiCategorizationService {
            async categorize(items) {
                return items;
            }
        }
        Services.NoopAiCategorizationService = NoopAiCategorizationService;
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
            parseOcr(document) {
                return document.lines
                    .map((line) => this.parseSpatialLine(line, document.imageWidth))
                    .filter((item) => item !== null);
            }
            parseReceiptLines(document) {
                return document.lines
                    .map((line) => this.parseReceiptLine(line, document.imageWidth))
                    .filter((line) => line !== null);
            }
            extractMetadata(document) {
                const lines = document.lines.map((line) => this.getLineText(line));
                const text = lines.join("\n");
                const amountNear = (label) => {
                    const line = lines.find((candidate) => label.test(candidate));
                    const match = line?.match(this.amountPattern);
                    return match ? this.parseAmount(match[1]) : null;
                };
                const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
                const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM)?)\b/i);
                const receiptMatch = text.match(/\b(?:receipt|trans|transaction|order|invoice|ref)[\s#:.-]*([A-Z0-9-]{4,})\b/i);
                return {
                    storeName: lines.find((line) => /[A-Za-z]{3,}/.test(line) && !this.ignoredLabel.test(line)) ?? "",
                    date: dateMatch?.[1] ?? "",
                    time: timeMatch?.[1] ?? "",
                    receiptNumber: receiptMatch?.[1] ?? "",
                    subtotal: amountNear(/^sub\s*total|subtotal/i),
                    tax: amountNear(/^tax\b|sales tax/i),
                    total: amountNear(/^total\b|amount due|balance due/i)
                };
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
            parseSpatialLine(line, imageWidth) {
                const words = line.words.slice().sort((left, right) => left.x - right.x);
                const priceSpan = this.findPriceSpan(words, imageWidth);
                if (!priceSpan)
                    return null;
                const priceWord = words[priceSpan.startIndex];
                const labelWords = words
                    .slice(0, priceSpan.startIndex)
                    .filter((word) => word.x < priceWord.x)
                    .map((word) => word.text);
                const label = labelWords.join(" ").replace(/[*#@]/g, "").replace(/\b\d{4,}\b/g, "").trim();
                const amount = this.parseAmount(priceSpan.text);
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
            parseReceiptLine(line, imageWidth) {
                const words = line.words.slice().sort((left, right) => left.x - right.x);
                const priceSpan = this.findPriceSpan(words, imageWidth);
                if (!priceSpan)
                    return null;
                const priceWord = words[priceSpan.startIndex];
                const label = words
                    .slice(0, priceSpan.startIndex)
                    .filter((word) => word.x < priceWord.x)
                    .map((word) => word.text)
                    .join(" ")
                    .replace(/[*#@]/g, "")
                    .replace(/\b\d{4,}\b/g, "")
                    .trim();
                const amount = this.parseAmount(priceSpan.text);
                if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount <= 0) {
                    return null;
                }
                const minX = Math.min(...line.words.map((word) => word.x));
                const minY = Math.min(...line.words.map((word) => word.y));
                const maxX = Math.max(...line.words.map((word) => word.x + word.width));
                const maxY = Math.max(...line.words.map((word) => word.y + word.height));
                return {
                    id: line.id,
                    label: this.toTitleCase(label),
                    amount: Number(amount.toFixed(2)),
                    confidence: line.confidence,
                    ignored: false,
                    ocrLineId: line.id,
                    bounds: {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    }
                };
            }
            findPriceSpan(words, imageWidth) {
                let bestSpan = null;
                let bestScore = 0;
                words.forEach((_word, index) => {
                    for (let endIndex = index; endIndex < Math.min(words.length, index + 3); endIndex += 1) {
                        const spanWords = words.slice(index, endIndex + 1);
                        const text = spanWords.map((word) => word.text).join("");
                        if (!this.amountPattern.test(text))
                            continue;
                        const rightMost = Math.max(...spanWords.map((word) => word.x + word.width));
                        const confidence = spanWords.reduce((sum, word) => sum + word.confidence, 0) / Math.max(1, spanWords.length);
                        const rightBias = rightMost / imageWidth;
                        const score = confidence + rightBias * 35;
                        if (score > bestScore && rightBias > 0.42) {
                            bestScore = score;
                            bestSpan = { startIndex: index, endIndex, text };
                        }
                    }
                });
                return bestSpan;
            }
            getLineText(line) {
                return line.words
                    .slice()
                    .sort((left, right) => left.x - right.x)
                    .map((word) => word.text)
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();
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
    var Services;
    (function (Services) {
        class ReceiptOcrService {
            constructor() {
                this.receiptPricePattern = /\s(?:\$?\s*)?\d{1,4}(?:[,.]\d{2})\s*$/;
                this.workerPromise = null;
            }
            async recognize(file, onProgress) {
                if (typeof Tesseract === "undefined") {
                    throw new Error("OCR engine did not load. Refresh the page and try again.");
                }
                const tesseract = Tesseract;
                onProgress({ label: "Preparing receipt image", progress: 0.05 });
                const variants = await this.createReceiptImageVariants(file);
                const worker = await this.getWorker(tesseract, onProgress);
                const passes = this.createOcrPasses(variants);
                const candidates = [];
                for (let index = 0; index < passes.length; index += 1) {
                    const pass = passes[index];
                    const baseProgress = 0.18 + (index / passes.length) * 0.72;
                    onProgress({ label: `Reading ${pass.name}`, progress: baseProgress });
                    await worker.setParameters({
                        tessedit_pageseg_mode: pass.pageSegmentationMode,
                        preserve_interword_spaces: "1",
                        user_defined_dpi: "300"
                    });
                    const result = await worker.recognize(pass.image, {}, { text: true, blocks: true });
                    const lines = this.normalizeLines(result.data, pass.transform);
                    const text = this.getTextFromLines(lines);
                    candidates.push(this.scoreCandidate(pass.name, text, lines, result.data.confidence));
                }
                const bestCandidate = this.buildConsensusCandidate(candidates);
                if (!bestCandidate || bestCandidate.text.length < 8) {
                    throw new Error("I could not read enough text from this receipt. Try a flatter, brighter photo.");
                }
                onProgress({
                    label: `Best read found ${bestCandidate.itemLineCount} likely item lines`,
                    progress: 1
                });
                const firstVariant = variants[0];
                return {
                    provider: "Tesseract consensus",
                    text: bestCandidate.text,
                    lines: bestCandidate.lines,
                    confidence: bestCandidate.confidence,
                    imageWidth: firstVariant.transform.originalWidth,
                    imageHeight: firstVariant.transform.originalHeight,
                    artifacts: variants.map((variant) => ({
                        label: variant.name,
                        dataUrl: variant.canvas.toDataURL("image/jpeg", 0.78),
                        width: variant.canvas.width,
                        height: variant.canvas.height
                    })),
                    quality: this.analyzeImageQuality(variants[0].canvas)
                };
            }
            async getWorker(tesseract, onProgress) {
                if (!this.workerPromise) {
                    const workerPath = new URL("vendor/tesseract/worker.min.js", window.location.href).href;
                    const corePath = new URL("vendor/tesseract-core", window.location.href).href;
                    const langPath = new URL("vendor/tessdata", window.location.href).href;
                    this.workerPromise = tesseract.createWorker("eng", 1, {
                        workerPath,
                        corePath,
                        langPath,
                        logger: (message) => {
                            onProgress({
                                label: this.humanizeStatus(message.status),
                                progress: Math.min(0.95, Math.max(0.08, message.progress * 0.18))
                            });
                        }
                    });
                }
                return this.workerPromise;
            }
            async createReceiptImageVariants(file) {
                const image = await this.loadImage(file);
                const { canvas: baseCanvas, transform } = this.createBaseCanvas(image);
                return [
                    {
                        name: "adaptive receipt",
                        canvas: this.createAdaptiveThresholdCanvas(baseCanvas),
                        transform
                    },
                    {
                        name: "balanced receipt",
                        canvas: this.createContrastCanvas(baseCanvas, 1.42, 112),
                        transform
                    },
                    {
                        name: "sharp receipt",
                        canvas: this.createBinaryCanvas(baseCanvas),
                        transform
                    }
                ];
            }
            createBaseCanvas(image) {
                const crop = this.detectReceiptCrop(image);
                const targetWidth = Math.min(Math.max(crop.sw, 1800), 2400);
                const scale = targetWidth / crop.sw;
                const targetHeight = Math.round(crop.sh * scale);
                const canvas = document.createElement("canvas");
                const context = this.getContext(canvas);
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = "high";
                context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetWidth, targetHeight);
                return {
                    canvas,
                    transform: {
                        originalWidth: image.naturalWidth,
                        originalHeight: image.naturalHeight,
                        crop,
                        scale
                    }
                };
            }
            detectReceiptCrop(image) {
                const probeWidth = 640;
                const scale = probeWidth / image.naturalWidth;
                const probeHeight = Math.max(1, Math.round(image.naturalHeight * scale));
                const probe = document.createElement("canvas");
                const context = this.getContext(probe);
                probe.width = probeWidth;
                probe.height = probeHeight;
                context.drawImage(image, 0, 0, probeWidth, probeHeight);
                const pixels = context.getImageData(0, 0, probeWidth, probeHeight).data;
                let minX = probeWidth;
                let minY = probeHeight;
                let maxX = 0;
                let maxY = 0;
                let matchedPixels = 0;
                for (let y = 0; y < probeHeight; y += 1) {
                    for (let x = 0; x < probeWidth; x += 1) {
                        const index = (y * probeWidth + x) * 4;
                        const red = pixels[index];
                        const green = pixels[index + 1];
                        const blue = pixels[index + 2];
                        const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
                        const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
                        if (luminance > 142 && saturation < 72) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                            matchedPixels += 1;
                        }
                    }
                }
                const matchedRatio = matchedPixels / (probeWidth * probeHeight);
                if (matchedRatio < 0.08 || matchedRatio > 0.92 || maxX <= minX || maxY <= minY) {
                    return { sx: 0, sy: 0, sw: image.naturalWidth, sh: image.naturalHeight };
                }
                const margin = 18;
                const sx = Math.max(0, Math.round((minX - margin) / scale));
                const sy = Math.max(0, Math.round((minY - margin) / scale));
                const ex = Math.min(image.naturalWidth, Math.round((maxX + margin) / scale));
                const ey = Math.min(image.naturalHeight, Math.round((maxY + margin) / scale));
                return {
                    sx,
                    sy,
                    sw: Math.max(1, ex - sx),
                    sh: Math.max(1, ey - sy)
                };
            }
            createContrastCanvas(source, contrast, midpoint) {
                const canvas = this.cloneCanvas(source);
                const context = this.getContext(canvas);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                const data = pixels.data;
                for (let index = 0; index < data.length; index += 4) {
                    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
                    const contrasted = this.clamp((gray - midpoint) * contrast + 142);
                    data[index] = contrasted;
                    data[index + 1] = contrasted;
                    data[index + 2] = contrasted;
                }
                context.putImageData(pixels, 0, 0);
                return canvas;
            }
            createBinaryCanvas(source) {
                const canvas = this.createContrastCanvas(source, 1.62, 118);
                const context = this.getContext(canvas);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                const data = pixels.data;
                const threshold = this.getOtsuThreshold(data);
                for (let index = 0; index < data.length; index += 4) {
                    const value = data[index] > threshold ? 255 : 0;
                    data[index] = value;
                    data[index + 1] = value;
                    data[index + 2] = value;
                }
                context.putImageData(pixels, 0, 0);
                return canvas;
            }
            createAdaptiveThresholdCanvas(source) {
                const canvas = this.cloneCanvas(source);
                const context = this.getContext(canvas);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                const { width, height } = canvas;
                const gray = new Uint8ClampedArray(width * height);
                const integral = new Uint32Array((width + 1) * (height + 1));
                for (let y = 0; y < height; y += 1) {
                    let rowSum = 0;
                    for (let x = 0; x < width; x += 1) {
                        const pixelIndex = y * width + x;
                        const dataIndex = pixelIndex * 4;
                        const value = Math.round(pixels.data[dataIndex] * 0.299 + pixels.data[dataIndex + 1] * 0.587 + pixels.data[dataIndex + 2] * 0.114);
                        gray[pixelIndex] = value;
                        rowSum += value;
                        integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
                    }
                }
                const radius = Math.max(18, Math.round(width / 70));
                for (let y = 0; y < height; y += 1) {
                    const y0 = Math.max(0, y - radius);
                    const y1 = Math.min(height - 1, y + radius);
                    for (let x = 0; x < width; x += 1) {
                        const x0 = Math.max(0, x - radius);
                        const x1 = Math.min(width - 1, x + radius);
                        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
                        const sum = integral[(y1 + 1) * (width + 1) + x1 + 1] -
                            integral[y0 * (width + 1) + x1 + 1] -
                            integral[(y1 + 1) * (width + 1) + x0] +
                            integral[y0 * (width + 1) + x0];
                        const localMean = sum / area;
                        const value = gray[y * width + x] < localMean - 10 ? 0 : 255;
                        const dataIndex = (y * width + x) * 4;
                        pixels.data[dataIndex] = value;
                        pixels.data[dataIndex + 1] = value;
                        pixels.data[dataIndex + 2] = value;
                    }
                }
                context.putImageData(pixels, 0, 0);
                return canvas;
            }
            createOcrPasses(variants) {
                const adaptive = variants.find((variant) => variant.name === "adaptive receipt") ?? variants[0];
                const balanced = variants.find((variant) => variant.name === "balanced receipt") ?? variants[0];
                const sharp = variants.find((variant) => variant.name === "sharp receipt") ?? variants[0];
                return [
                    { name: "adaptive receipt", image: adaptive.canvas, transform: adaptive.transform, pageSegmentationMode: "4" },
                    { name: "balanced receipt", image: balanced.canvas, transform: balanced.transform, pageSegmentationMode: "6" },
                    { name: "sparse price scan", image: sharp.canvas, transform: sharp.transform, pageSegmentationMode: "11" },
                    { name: "full receipt fallback", image: balanced.canvas, transform: balanced.transform, pageSegmentationMode: "3" }
                ];
            }
            normalizeLines(data, transform) {
                const rawLines = data.blocks
                    ?.flatMap((block) => block.paragraphs)
                    .flatMap((paragraph) => paragraph.lines)
                    .filter((line) => line.text.trim().length > 0) ?? [];
                const words = rawLines.flatMap((line, lineIndex) => (line.words.length > 0 ? line.words : [this.createFallbackWord(line)]).map((word, wordIndex) => this.normalizeWord(word, transform, `ocr-${lineIndex}-${wordIndex}`)));
                if (words.length === 0) {
                    return this.createFallbackLines(data.text, transform);
                }
                return this.clusterWordsIntoReceiptLines(words);
            }
            clusterWordsIntoReceiptLines(words) {
                const cleanWords = words
                    .filter((word) => word.text.trim().length > 0)
                    .sort((left, right) => this.getWordCenterY(left) - this.getWordCenterY(right));
                const medianWordHeight = this.getMedian(cleanWords.map((word) => word.height));
                const rowThreshold = Math.max(4, Math.min(10, medianWordHeight * 0.48));
                const groups = [];
                cleanWords.forEach((word) => {
                    const centerY = this.getWordCenterY(word);
                    const group = groups.find((candidate) => {
                        const groupCenter = this.getMedian(candidate.map((candidateWord) => this.getWordCenterY(candidateWord)));
                        const groupHeight = this.getMedian(candidate.map((candidateWord) => candidateWord.height));
                        const adaptiveThreshold = Math.max(4, Math.min(10, Math.min(groupHeight, word.height) * 0.52));
                        return Math.abs(groupCenter - centerY) <= Math.min(rowThreshold, adaptiveThreshold);
                    });
                    if (group) {
                        group.push(word);
                    }
                    else {
                        groups.push([word]);
                    }
                });
                return groups
                    .map((group, index) => this.createLineFromWords(group, index))
                    .filter((line) => line.words.length > 0)
                    .sort((left, right) => this.getLineY(left) - this.getLineY(right));
            }
            createLineFromWords(words, index) {
                const sortedWords = words
                    .slice()
                    .sort((left, right) => left.x - right.x)
                    .map((word, wordIndex) => ({
                    ...word,
                    id: `line-${index}-word-${wordIndex}`
                }));
                const confidence = sortedWords.reduce((sum, word) => sum + word.confidence, 0) / Math.max(1, sortedWords.length);
                return {
                    id: `line-${index}-${Math.round(this.getMedian(sortedWords.map((word) => this.getWordCenterY(word))))}`,
                    words: sortedWords,
                    confidence
                };
            }
            normalizeWord(word, transform, id) {
                return {
                    id,
                    text: this.repairReceiptLine(word.text),
                    confidence: this.normalizeConfidence(word.confidence),
                    x: transform.crop.sx + word.bbox.x0 / transform.scale,
                    y: transform.crop.sy + word.bbox.y0 / transform.scale,
                    width: Math.max(1, (word.bbox.x1 - word.bbox.x0) / transform.scale),
                    height: Math.max(1, (word.bbox.y1 - word.bbox.y0) / transform.scale)
                };
            }
            createFallbackWord(line) {
                return {
                    text: line.text,
                    confidence: line.confidence,
                    bbox: line.bbox
                };
            }
            createFallbackLines(text, transform) {
                return this.cleanExtractedText(text)
                    .split("\n")
                    .map((line, index) => ({
                    id: `fallback-${index}`,
                    confidence: 50,
                    words: [
                        {
                            id: `fallback-word-${index}`,
                            text: line,
                            confidence: 50,
                            x: transform.crop.sx,
                            y: transform.crop.sy + index * 24,
                            width: transform.crop.sw,
                            height: 22
                        }
                    ]
                }));
            }
            scoreCandidate(name, text, ocrLines, confidence) {
                const textLines = text.split("\n").filter(Boolean);
                const itemLineCount = textLines.filter((lineText) => this.receiptPricePattern.test(lineText)).length;
                const amountDensity = itemLineCount / Math.max(1, textLines.length);
                const score = confidence + itemLineCount * 28 + amountDensity * 26 + Math.min(text.length / 28, 24);
                return {
                    name,
                    text,
                    lines: ocrLines,
                    confidence,
                    itemLineCount,
                    score
                };
            }
            buildConsensusCandidate(candidates) {
                if (candidates.length === 0)
                    return null;
                const groupedLines = [];
                const allLines = candidates
                    .flatMap((candidate) => candidate.lines)
                    .sort((left, right) => this.getLineY(left) - this.getLineY(right));
                allLines.forEach((line) => {
                    const y = this.getLineY(line);
                    const group = groupedLines.find((candidateGroup) => {
                        const lineHeight = this.getLineHeight(line);
                        const groupHeight = this.getLineHeight(candidateGroup[0]);
                        const threshold = Math.max(5, Math.min(12, Math.min(lineHeight, groupHeight) * 0.62));
                        return Math.abs(this.getLineCenterY(candidateGroup[0]) - this.getLineCenterY(line)) <= threshold;
                    });
                    if (group) {
                        group.push(line);
                    }
                    else {
                        groupedLines.push([line]);
                    }
                });
                const consensusLines = groupedLines
                    .map((group, index) => this.getBestLineForGroup(group, index))
                    .sort((left, right) => this.getLineY(left) - this.getLineY(right));
                const text = this.getTextFromLines(consensusLines);
                const confidence = consensusLines.reduce((sum, line) => sum + line.confidence, 0) / Math.max(1, consensusLines.length);
                return this.scoreCandidate("consensus", text, consensusLines, confidence);
            }
            getBestLineForGroup(group, index) {
                const best = group
                    .slice()
                    .sort((left, right) => this.scoreLine(right) - this.scoreLine(left))[0];
                return {
                    ...best,
                    id: `consensus-line-${index}`,
                    confidence: Math.min(99, group.reduce((sum, line) => sum + line.confidence, 0) / group.length + Math.min(group.length - 1, 3) * 2),
                    words: best.words.map((word, wordIndex) => ({
                        ...word,
                        id: `consensus-${index}-${wordIndex}`
                    }))
                };
            }
            scoreLine(line) {
                const text = this.getLineText(line);
                return line.confidence + (this.receiptPricePattern.test(text) ? 36 : 0) + Math.min(text.length, 40);
            }
            getTextFromLines(lines) {
                return lines.map((line) => this.getLineText(line)).filter(Boolean).join("\n");
            }
            getLineText(line) {
                return this.cleanExtractedText(line.words.map((word) => word.text).join(" "));
            }
            getLineY(line) {
                return Math.min(...line.words.map((word) => word.y));
            }
            getLineCenterY(line) {
                return this.getMedian(line.words.map((word) => this.getWordCenterY(word)));
            }
            getLineHeight(line) {
                return this.getMedian(line.words.map((word) => word.height));
            }
            getWordCenterY(word) {
                return word.y + word.height / 2;
            }
            getMedian(values) {
                if (values.length === 0)
                    return 0;
                const sortedValues = values.slice().sort((left, right) => left - right);
                const middle = Math.floor(sortedValues.length / 2);
                return sortedValues.length % 2 === 0
                    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
                    : sortedValues[middle];
            }
            cleanExtractedText(text) {
                return text
                    .split("\n")
                    .map((line) => this.repairReceiptLine(line))
                    .filter((line) => line.length > 0)
                    .join("\n");
            }
            repairReceiptLine(line) {
                const normalizedLine = line
                    .replace(/[|{}[\]_=~`]/g, " ")
                    .replace(/[^\w\s$.,:;#@*%&+-]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                const amountMatch = normalizedLine.match(/(.+?\s)([$S]?\s*[0-9OoQDSIl|B]{1,4}(?:[.,:;][0-9OoQDSIl|B]{2})?)$/);
                if (!amountMatch)
                    return normalizedLine;
                const rawAmount = amountMatch[2];
                let repairedAmount = rawAmount
                    .replace(/[OoQ]/g, "0")
                    .replace(/[Il|]/g, "1")
                    .replace(/S/g, "5")
                    .replace(/B/g, "8")
                    .replace(/[:;]/g, ".")
                    .replace(/\s+/g, "");
                if (!/[.,]/.test(rawAmount) && /[OoQDSIl|B]/.test(rawAmount)) {
                    const sign = repairedAmount.startsWith("$") ? "$" : "";
                    const digits = repairedAmount.replace("$", "");
                    if (/^\d{3,5}$/.test(digits)) {
                        repairedAmount = `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
                    }
                }
                return `${amountMatch[1].trim()} ${repairedAmount}`;
            }
            getOtsuThreshold(data) {
                const histogram = new Uint32Array(256);
                const pixelCount = data.length / 4;
                for (let index = 0; index < data.length; index += 4) {
                    histogram[data[index]] += 1;
                }
                let sum = 0;
                for (let value = 0; value < 256; value += 1) {
                    sum += value * histogram[value];
                }
                let sumBackground = 0;
                let weightBackground = 0;
                let maxVariance = 0;
                let threshold = 128;
                for (let value = 0; value < 256; value += 1) {
                    weightBackground += histogram[value];
                    if (weightBackground === 0)
                        continue;
                    const weightForeground = pixelCount - weightBackground;
                    if (weightForeground === 0)
                        break;
                    sumBackground += value * histogram[value];
                    const meanBackground = sumBackground / weightBackground;
                    const meanForeground = (sum - sumBackground) / weightForeground;
                    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
                    if (variance > maxVariance) {
                        maxVariance = variance;
                        threshold = value;
                    }
                }
                return threshold;
            }
            analyzeImageQuality(canvas) {
                const context = this.getContext(canvas);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                const gray = new Float32Array(canvas.width * canvas.height);
                let min = 255;
                let max = 0;
                for (let index = 0; index < gray.length; index += 1) {
                    const dataIndex = index * 4;
                    const value = pixels.data[dataIndex] * 0.299 + pixels.data[dataIndex + 1] * 0.587 + pixels.data[dataIndex + 2] * 0.114;
                    gray[index] = value;
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
                const laplacianValues = [];
                for (let y = 1; y < canvas.height - 1; y += 1) {
                    for (let x = 1; x < canvas.width - 1; x += 1) {
                        const center = gray[y * canvas.width + x] * -4;
                        const laplacian = center +
                            gray[(y - 1) * canvas.width + x] +
                            gray[(y + 1) * canvas.width + x] +
                            gray[y * canvas.width + x - 1] +
                            gray[y * canvas.width + x + 1];
                        laplacianValues.push(laplacian);
                    }
                }
                const mean = laplacianValues.reduce((sum, value) => sum + value, 0) / Math.max(1, laplacianValues.length);
                const blurVariance = laplacianValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, laplacianValues.length);
                const contrast = max - min;
                const warnings = [];
                if (blurVariance < 95)
                    warnings.push("Receipt image appears blurry. Consider retaking the photo.");
                if (contrast < 70)
                    warnings.push("Receipt image has low contrast. Try brighter, more even lighting.");
                return { blurVariance, contrast, warnings };
            }
            cloneCanvas(source) {
                const canvas = document.createElement("canvas");
                const context = this.getContext(canvas);
                canvas.width = source.width;
                canvas.height = source.height;
                context.drawImage(source, 0, 0);
                return canvas;
            }
            getContext(canvas) {
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) {
                    throw new Error("Could not prepare receipt image for OCR.");
                }
                return context;
            }
            clamp(value) {
                return Math.max(0, Math.min(255, value));
            }
            normalizeConfidence(confidence) {
                return confidence <= 1 ? confidence * 100 : confidence;
            }
            loadImage(file) {
                return new Promise((resolve, reject) => {
                    const image = new Image();
                    const objectUrl = URL.createObjectURL(file);
                    image.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve(image);
                    };
                    image.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(new Error("Could not load the receipt image."));
                    };
                    image.src = objectUrl;
                });
            }
            humanizeStatus(status) {
                const words = status.replace(/_/g, " ").trim();
                return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Reading receipt";
            }
        }
        Services.ReceiptOcrService = ReceiptOcrService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class GeminiService {
            async loadDotEnv() {
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
                    ocrOverlay: this.getElement("#ocrOverlay", HTMLElement),
                    ocrReviewTools: this.getElement("#ocrReviewTools", HTMLElement),
                    ocrOverlayToggle: this.getElement("#ocrOverlayToggle", HTMLInputElement),
                    diagnosticsToggle: this.getElement("#diagnosticsToggle", HTMLButtonElement),
                    diagnosticsPanel: this.getElement("#diagnosticsPanel", HTMLElement),
                    diagnosticsGrid: this.getElement("#diagnosticsGrid", HTMLElement),
                    diagnosticsText: this.getElement("#diagnosticsText", HTMLElement),
                    diagnosticsSummary: this.getElement("#diagnosticsSummary", HTMLElement),
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
                    addItemButton: document.createElement("button"),
                    receiptLinesList: this.getElement("#receiptLinesList", HTMLElement),
                    emptyState: this.getElement("#emptyState", HTMLElement),
                    unassignedCount: this.getElement("#unassignedCount", HTMLElement),
                    receiptCategory: this.getElement("#receiptCategory", HTMLSelectElement),
                    personNameInput: this.getElement("#personNameInput", HTMLInputElement),
                    addPersonButton: this.getElement("#addPersonButton", HTMLButtonElement),
                    peopleList: this.getElement("#peopleList", HTMLElement),
                    assignmentMode: this.getElement("#assignmentMode", HTMLSelectElement),
                    assignmentValue: this.getElement("#assignmentValue", HTMLInputElement),
                    assignLinesButton: this.getElement("#assignLinesButton", HTMLButtonElement),
                    taxInput: this.getElement("#taxInput", HTMLInputElement),
                    splitTotalsList: this.getElement("#splitTotalsList", HTMLElement),
                    itemCount: this.getElement("#itemCount", HTMLElement),
                    receiptTotal: this.getElement("#receiptTotal", HTMLElement),
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
        class SplitWorkspaceView {
            constructor(currencyFormatService) {
                this.currencyFormatService = currencyFormatService;
            }
            renderLines(container, lines, assignments, people, selectedLineIds, handlers) {
                container.innerHTML = "";
                lines.forEach((line) => {
                    const row = document.createElement("div");
                    row.className = "table-row";
                    row.classList.toggle("is-selected", selectedLineIds.has(line.id));
                    row.classList.toggle("is-ignored", line.ignored);
                    const name = document.createElement("button");
                    name.className = "line-select-button";
                    name.type = "button";
                    name.textContent = line.label;
                    name.addEventListener("click", () => handlers.onLineToggle(line.id));
                    const assigned = document.createElement("span");
                    assigned.className = "assignment-summary";
                    assigned.textContent = this.getAssignmentSummary(line.id, assignments, people);
                    const amount = document.createElement("span");
                    amount.className = "amount-cell";
                    amount.textContent = this.currencyFormatService.format(line.amount);
                    const ignore = document.createElement("button");
                    ignore.className = "icon-button delete-row";
                    ignore.type = "button";
                    ignore.textContent = line.ignored ? "+" : "x";
                    ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
                    ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));
                    row.append(name, assigned, amount, ignore);
                    container.append(row);
                });
            }
            renderPeople(container, people, activePersonId, handlers) {
                container.innerHTML = "";
                people.forEach((person) => {
                    const row = document.createElement("div");
                    row.className = "person-chip";
                    row.classList.toggle("is-active", person.id === activePersonId);
                    const select = document.createElement("button");
                    select.type = "button";
                    select.textContent = person.name;
                    select.addEventListener("click", () => handlers.onPersonSelect(person.id));
                    const remove = document.createElement("button");
                    remove.type = "button";
                    remove.textContent = "x";
                    remove.setAttribute("aria-label", `Remove ${person.name}`);
                    remove.addEventListener("click", () => handlers.onPersonDelete(person.id));
                    row.append(select, remove);
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
            getAssignmentSummary(lineId, assignments, people) {
                const names = assignments
                    .filter((assignment) => assignment.lineId === lineId)
                    .map((assignment) => people.find((person) => person.id === assignment.personId)?.name)
                    .filter((name) => Boolean(name));
                return names.length > 0 ? names.join(", ") : "Unassigned";
            }
        }
        UI.SplitWorkspaceView = SplitWorkspaceView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        class OcrOverlayView {
            render(container, document, handlers) {
                container.innerHTML = "";
                if (!document)
                    return;
                document.lines.forEach((line) => {
                    const lineElement = this.createLineElement(line, document, handlers);
                    container.append(lineElement);
                    line.words.forEach((word) => {
                        container.append(this.createWordElement(word, line, document, handlers));
                    });
                });
            }
            setVisible(container, isVisible) {
                container.classList.toggle("is-hidden", !isVisible);
            }
            highlightLine(container, lineId) {
                container.querySelectorAll("[data-ocr-line-id]").forEach((element) => {
                    element.classList.toggle("is-selected", element.getAttribute("data-ocr-line-id") === lineId);
                });
            }
            highlightLines(container, lineIds) {
                container.querySelectorAll("[data-ocr-line-id]").forEach((element) => {
                    const lineId = element.getAttribute("data-ocr-line-id");
                    element.classList.toggle("is-selected", Boolean(lineId && lineIds.has(lineId)));
                });
            }
            createLineElement(line, document, handlers) {
                const box = this.getLineBox(line);
                const element = documentFragmentElement("button");
                element.type = "button";
                element.className = `ocr-line-box ${this.getConfidenceClass(line.confidence)}`;
                element.title = `Line confidence: ${Math.round(line.confidence)}%`;
                element.setAttribute("data-ocr-line-id", line.id);
                this.positionElement(element, box, document);
                element.addEventListener("click", () => handlers.onLineSelect(line.id));
                return element;
            }
            createWordElement(word, line, document, handlers) {
                const element = documentFragmentElement("button");
                element.type = "button";
                element.className = `ocr-word-box ${this.getConfidenceClass(word.confidence)}`;
                element.textContent = word.text;
                element.title = `${word.text} (${Math.round(word.confidence)}%)`;
                element.setAttribute("data-ocr-line-id", line.id);
                element.setAttribute("data-ocr-word-id", word.id);
                this.positionElement(element, word, document);
                element.addEventListener("click", (event) => {
                    event.stopPropagation();
                    handlers.onLineSelect(line.id);
                    this.editWord(element, word, handlers);
                });
                return element;
            }
            editWord(element, word, handlers) {
                const input = document.createElement("input");
                input.className = "ocr-word-editor";
                input.value = word.text;
                element.replaceChildren(input);
                input.focus();
                input.select();
                const save = () => {
                    const nextText = input.value.trim();
                    if (nextText && nextText !== word.text) {
                        handlers.onWordUpdate(word.id, nextText);
                    }
                    else {
                        element.textContent = word.text;
                    }
                };
                input.addEventListener("change", save);
                input.addEventListener("blur", save, { once: true });
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter")
                        input.blur();
                    if (event.key === "Escape") {
                        element.textContent = word.text;
                    }
                });
            }
            getLineBox(line) {
                const minX = Math.min(...line.words.map((word) => word.x));
                const minY = Math.min(...line.words.map((word) => word.y));
                const maxX = Math.max(...line.words.map((word) => word.x + word.width));
                const maxY = Math.max(...line.words.map((word) => word.y + word.height));
                return {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            }
            positionElement(element, box, document) {
                element.style.left = `${(box.x / document.imageWidth) * 100}%`;
                element.style.top = `${(box.y / document.imageHeight) * 100}%`;
                element.style.width = `${(box.width / document.imageWidth) * 100}%`;
                element.style.height = `${(box.height / document.imageHeight) * 100}%`;
            }
            getConfidenceClass(confidence) {
                if (confidence >= 95)
                    return "is-high";
                if (confidence >= 80)
                    return "is-medium";
                return "is-low";
            }
        }
        UI.OcrOverlayView = OcrOverlayView;
        function documentFragmentElement(tagName) {
            return document.createElement(tagName);
        }
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
    var UI;
    (function (UI) {
        class DiagnosticsView {
            render(grid, textOutput, summary, document, metadata, items) {
                grid.innerHTML = "";
                textOutput.textContent = "";
                if (!document) {
                    summary.textContent = "No OCR run";
                    return;
                }
                summary.textContent = `${Math.round(document.confidence)}% confidence / ${items.length} items`;
                document.artifacts.forEach((artifact) => grid.append(this.createArtifactCard(artifact)));
                grid.append(this.createTextCard("Image quality", document.quality.warnings.join("\n") || "No warnings"));
                grid.append(this.createTextCard("Metadata", JSON.stringify(metadata, null, 2)));
                grid.append(this.createTextCard("Parsed items", JSON.stringify(items, null, 2)));
                textOutput.textContent = document.text;
            }
            createArtifactCard(artifact) {
                const card = document.createElement("article");
                card.className = "diagnostics-card";
                const title = document.createElement("strong");
                title.textContent = artifact.label;
                const image = document.createElement("img");
                image.src = artifact.dataUrl;
                image.alt = artifact.label;
                card.append(title, image);
                return card;
            }
            createTextCard(titleText, contentText) {
                const card = document.createElement("article");
                card.className = "diagnostics-card";
                const title = document.createElement("strong");
                title.textContent = titleText;
                const content = document.createElement("pre");
                content.textContent = contentText;
                card.append(title, content);
                return card;
            }
        }
        UI.DiagnosticsView = DiagnosticsView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var App;
    (function (App) {
        class AppController {
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, receiptOcrService, geminiService, itemListView, ringView, categorySummaryView, categoryPromptView, ocrOverlayView, diagnosticsView, splitWorkspaceView, splitCalculatorService, idService) {
                this.elements = elements;
                this.parserService = parserService;
                this.categorizationService = categorizationService;
                this.categoryRuleStorageService = categoryRuleStorageService;
                this.storageService = storageService;
                this.summaryService = summaryService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.receiptOcrService = receiptOcrService;
                this.geminiService = geminiService;
                this.itemListView = itemListView;
                this.ringView = ringView;
                this.categorySummaryView = categorySummaryView;
                this.categoryPromptView = categoryPromptView;
                this.ocrOverlayView = ocrOverlayView;
                this.diagnosticsView = diagnosticsView;
                this.splitWorkspaceView = splitWorkspaceView;
                this.splitCalculatorService = splitCalculatorService;
                this.idService = idService;
                this.receiptLines = [];
                this.people = [];
                this.assignments = [];
                this.selectedLineIds = new Set();
                this.activePersonId = null;
                this.receiptCategory = "Dining";
                this.ocrDocument = null;
                this.metadata = null;
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
                this.elements.assignLinesButton.addEventListener("click", () => this.assignSelectedLines());
                this.elements.taxInput.addEventListener("input", () => this.render());
                this.elements.receiptCategory.addEventListener("change", () => {
                    this.receiptCategory = this.elements.receiptCategory.value;
                });
                this.elements.ocrOverlayToggle.addEventListener("change", () => this.ocrOverlayView.setVisible(this.elements.ocrOverlay, this.elements.ocrOverlayToggle.checked));
                this.elements.diagnosticsToggle.addEventListener("click", () => {
                    this.elements.diagnosticsPanel.classList.toggle("hidden");
                });
                this.elements.settingsButton.addEventListener("click", () => this.openSettings());
                this.elements.closeSettingsButton.addEventListener("click", () => this.closeSettings());
                this.elements.saveSettingsButton.addEventListener("click", () => this.saveSettings());
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
                this.ocrDocument = null;
                this.metadata = null;
                this.receiptLines = [];
                this.assignments = [];
                this.selectedLineIds.clear();
                this.elements.ocrOverlay.innerHTML = "";
                this.elements.ocrReviewTools.classList.add("hidden");
                this.hideOcrStatus();
            }
            itemizeReceiptText() {
                this.items = this.parserService.parse(this.elements.receiptText.value);
                this.receiptLines = this.items.map((item) => ({
                    id: item.id,
                    label: item.label,
                    amount: item.amount,
                    confidence: item.categorizationConfidence * 100,
                    ignored: false
                }));
                this.metadata = null;
                this.render();
            }
            clearReceipt() {
                this.elements.receiptText.value = "";
                this.items = [];
                this.receiptLines = [];
                this.assignments = [];
                this.selectedLineIds.clear();
                this.ocrDocument = null;
                this.metadata = null;
                this.elements.ocrOverlay.innerHTML = "";
                this.elements.ocrReviewTools.classList.add("hidden");
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
                    this.renderSplitWorkspace();
                }
                this.renderSummary();
            }
            deleteItem(id) {
                this.items = this.items.filter((candidate) => candidate.id !== id);
                this.render();
            }
            render() {
                this.storageService.save(this.items);
                this.renderSplitWorkspace();
                this.renderSummary();
                this.renderDiagnostics();
            }
            renderSplitWorkspace() {
                this.elements.emptyState.classList.toggle("hidden", this.receiptLines.length > 0);
                this.elements.itemCount.textContent = `${this.receiptLines.length} ${this.receiptLines.length === 1 ? "line" : "lines"}`;
                const unassignedCount = this.splitCalculatorService.getUnassignedCount(this.receiptLines, this.assignments);
                this.elements.unassignedCount.textContent = `${unassignedCount} unassigned`;
                this.elements.unassignedCount.classList.toggle("is-warning", unassignedCount > 0);
                this.splitWorkspaceView.renderLines(this.elements.receiptLinesList, this.receiptLines, this.assignments, this.people, this.selectedLineIds, {
                    onLineToggle: (lineId) => this.toggleLineSelection(lineId),
                    onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
                    onPersonSelect: (personId) => this.selectPerson(personId),
                    onPersonDelete: (personId) => this.deletePerson(personId)
                });
                this.splitWorkspaceView.renderPeople(this.elements.peopleList, this.people, this.activePersonId, {
                    onLineToggle: (lineId) => this.toggleLineSelection(lineId),
                    onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
                    onPersonSelect: (personId) => this.selectPerson(personId),
                    onPersonDelete: (personId) => this.deletePerson(personId)
                });
                this.splitWorkspaceView.renderTotals(this.elements.splitTotalsList, this.splitCalculatorService.calculate(this.people, this.receiptLines, this.assignments, this.getTaxAmount()));
            }
            renderSummary() {
                const grandTotal = this.receiptLines.filter((line) => !line.ignored).reduce((sum, line) => sum + line.amount, 0) + this.getTaxAmount();
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
                    this.metadata = {
                        storeName,
                        date: "",
                        time: "",
                        receiptNumber: "",
                        subtotal,
                        tax,
                        total
                    };
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
                    this.items = purchaseItems;
                    this.receiptLines = this.items.map((item) => ({
                        id: item.id,
                        label: item.label,
                        amount: item.amount,
                        confidence: item.categorizationConfidence * 100,
                        ignored: false
                    }));
                    this.ocrDocument = {
                        provider: `Gemini (${model})`,
                        text: formattedText,
                        lines: [],
                        confidence: 100,
                        imageWidth: 800,
                        imageHeight: 600,
                        artifacts: [],
                        quality: {
                            blurVariance: 100,
                            contrast: 100,
                            warnings: []
                        }
                    };
                    this.assignments = [];
                    this.selectedLineIds.clear();
                    this.renderOcrOverlay();
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
            renderOcrOverlay() {
                this.elements.ocrReviewTools.classList.toggle("hidden", !this.ocrDocument);
                this.ocrOverlayView.render(this.elements.ocrOverlay, this.ocrDocument, {
                    onLineSelect: (lineId) => this.toggleLineSelection(lineId),
                    onWordUpdate: (wordId, text) => this.updateOcrWord(wordId, text)
                });
                this.ocrOverlayView.setVisible(this.elements.ocrOverlay, this.elements.ocrOverlayToggle.checked);
            }
            updateOcrWord(wordId, text) {
                if (!this.ocrDocument)
                    return;
                this.ocrDocument = {
                    ...this.ocrDocument,
                    lines: this.ocrDocument.lines.map((line) => ({
                        ...line,
                        words: line.words.map((word) => word.id === wordId ? { ...word, text, confidence: 100 } : word)
                    }))
                };
                this.ocrDocument = {
                    ...this.ocrDocument,
                    text: this.ocrDocument.lines.map((line) => line.words.map((word) => word.text).join(" ")).join("\n")
                };
                this.metadata = this.parserService.extractMetadata(this.ocrDocument);
                this.receiptLines = this.parserService.parseReceiptLines(this.ocrDocument);
                this.items = this.parserService.parseOcr(this.ocrDocument);
                this.elements.receiptText.value = this.ocrDocument.text;
                this.renderOcrOverlay();
                this.render();
            }
            renderDiagnostics() {
                this.diagnosticsView.render(this.elements.diagnosticsGrid, this.elements.diagnosticsText, this.elements.diagnosticsSummary, this.ocrDocument, this.metadata, this.receiptLines.map((line) => ({
                    id: line.id,
                    label: line.label,
                    amount: line.amount,
                    category: "Other",
                    categorizationConfidence: line.confidence / 100,
                    categorizationSource: "uncertain",
                    needsCategoryReview: false
                })));
            }
            addPerson() {
                const name = this.elements.personNameInput.value.trim();
                if (!name)
                    return;
                const person = { id: this.idService.create(), name };
                this.people = [...this.people, person];
                this.activePersonId = person.id;
                this.elements.personNameInput.value = "";
                this.render();
            }
            selectPerson(personId) {
                this.activePersonId = personId;
                this.render();
            }
            deletePerson(personId) {
                this.people = this.people.filter((person) => person.id !== personId);
                this.assignments = this.assignments.filter((assignment) => assignment.personId !== personId);
                if (this.activePersonId === personId)
                    this.activePersonId = this.people[0]?.id ?? null;
                this.render();
            }
            toggleLineSelection(lineId) {
                if (this.selectedLineIds.has(lineId)) {
                    this.selectedLineIds.delete(lineId);
                }
                else {
                    this.selectedLineIds.add(lineId);
                }
                this.ocrOverlayView.highlightLines(this.elements.ocrOverlay, this.selectedLineIds);
                this.render();
            }
            toggleIgnoredLine(lineId) {
                this.receiptLines = this.receiptLines.map((line) => line.id === lineId ? { ...line, ignored: !line.ignored } : line);
                this.assignments = this.assignments.filter((assignment) => assignment.lineId !== lineId);
                this.selectedLineIds.delete(lineId);
                this.render();
            }
            assignSelectedLines() {
                if (!this.activePersonId || this.selectedLineIds.size === 0)
                    return;
                const mode = this.elements.assignmentMode.value;
                const rawValue = Number(this.elements.assignmentValue.value);
                const value = mode === "equal" ? 0 : Number.isFinite(rawValue) ? rawValue : 0;
                const nextAssignments = this.assignments.filter((assignment) => !this.selectedLineIds.has(assignment.lineId) || assignment.personId !== this.activePersonId);
                this.selectedLineIds.forEach((lineId) => {
                    nextAssignments.push({
                        id: this.idService.create(),
                        lineId,
                        personId: this.activePersonId,
                        mode,
                        value
                    });
                });
                this.assignments = nextAssignments;
                this.selectedLineIds.clear();
                this.renderOcrOverlay();
                this.render();
            }
            getTaxAmount() {
                const value = Number(this.elements.taxInput.value);
                return Number.isFinite(value) ? value : 0;
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
    const splitCalculatorService = new ReceiptRing.Services.SplitCalculatorService();
    const imagePreviewService = new ReceiptRing.Services.ImagePreviewService();
    const receiptOcrService = new ReceiptRing.Services.ReceiptOcrService();
    const geminiService = new ReceiptRing.Services.GeminiService();
    const ringView = new ReceiptRing.UI.CategoryRingView(categories);
    const categorySummaryView = new ReceiptRing.UI.CategorySummaryView(categories, currencyFormatService, ringView);
    const itemListView = new ReceiptRing.UI.ItemListView(categories);
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    const ocrOverlayView = new ReceiptRing.UI.OcrOverlayView();
    const diagnosticsView = new ReceiptRing.UI.DiagnosticsView();
    const splitWorkspaceView = new ReceiptRing.UI.SplitWorkspaceView(currencyFormatService);
    new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, receiptOcrService, geminiService, itemListView, ringView, categorySummaryView, categoryPromptView, ocrOverlayView, diagnosticsView, splitWorkspaceView, splitCalculatorService, idService).start();
})(ReceiptRing || (ReceiptRing = {}));
