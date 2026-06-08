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
                    const text = this.cleanExtractedText(this.getStructuredText(result.data));
                    candidates.push(this.scoreCandidate(pass.name, text, result.data.confidence));
                }
                const bestCandidate = candidates.sort((left, right) => right.score - left.score)[0];
                if (!bestCandidate || bestCandidate.text.length < 8) {
                    throw new Error("I could not read enough text from this receipt. Try a flatter, brighter photo.");
                }
                onProgress({
                    label: `Best read found ${bestCandidate.itemLineCount} likely item lines`,
                    progress: 1
                });
                return bestCandidate.text;
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
                const baseCanvas = this.createBaseCanvas(image);
                return [
                    {
                        name: "adaptive receipt",
                        canvas: this.createAdaptiveThresholdCanvas(baseCanvas)
                    },
                    {
                        name: "balanced receipt",
                        canvas: this.createContrastCanvas(baseCanvas, 1.42, 112)
                    },
                    {
                        name: "sharp receipt",
                        canvas: this.createBinaryCanvas(baseCanvas)
                    }
                ];
            }
            createBaseCanvas(image) {
                const crop = this.detectReceiptCrop(image);
                const targetWidth = Math.min(Math.max(crop.sw, 1500), 1900);
                const scale = targetWidth / crop.sw;
                const targetHeight = Math.round(crop.sh * scale);
                const canvas = document.createElement("canvas");
                const context = this.getContext(canvas);
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = "high";
                context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetWidth, targetHeight);
                return canvas;
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
                    { name: "adaptive receipt", image: adaptive.canvas, pageSegmentationMode: "4" },
                    { name: "balanced receipt", image: balanced.canvas, pageSegmentationMode: "6" },
                    { name: "sparse price scan", image: sharp.canvas, pageSegmentationMode: "11" },
                    { name: "full receipt fallback", image: balanced.canvas, pageSegmentationMode: "3" }
                ];
            }
            getStructuredText(data) {
                const lines = data.blocks
                    ?.flatMap((block) => block.paragraphs)
                    .flatMap((paragraph) => paragraph.lines)
                    .filter((line) => line.text.trim().length > 0)
                    .sort((left, right) => {
                    const rowDistance = left.bbox.y0 - right.bbox.y0;
                    return Math.abs(rowDistance) > 12 ? rowDistance : left.bbox.x0 - right.bbox.x0;
                })
                    .map((line) => line.text) ?? [];
                return lines.length > 0 ? lines.join("\n") : data.text;
            }
            scoreCandidate(name, text, confidence) {
                const lines = text.split("\n").filter(Boolean);
                const itemLineCount = lines.filter((line) => this.receiptPricePattern.test(line)).length;
                const amountDensity = itemLineCount / Math.max(1, lines.length);
                const score = confidence + itemLineCount * 28 + amountDensity * 26 + Math.min(text.length / 28, 24);
                return {
                    name,
                    text,
                    confidence,
                    itemLineCount,
                    score
                };
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
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, receiptOcrService, itemListView, ringView, categorySummaryView, categoryPromptView, idService) {
                this.elements = elements;
                this.parserService = parserService;
                this.categorizationService = categorizationService;
                this.categoryRuleStorageService = categoryRuleStorageService;
                this.storageService = storageService;
                this.summaryService = summaryService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.receiptOcrService = receiptOcrService;
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
                    void this.extractAndItemizeReceipt(file);
                }
            }
            handleImageDrop(event) {
                const file = event.dataTransfer?.files?.[0];
                if (file) {
                    this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                    void this.extractAndItemizeReceipt(file);
                }
            }
            clearImage() {
                this.imagePreviewService.clear(this.elements.receiptImage, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                this.hideOcrStatus();
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
            async extractAndItemizeReceipt(file) {
                this.setOcrStatus("Starting OCR", 0.04);
                this.elements.parseButton.setAttribute("disabled", "true");
                try {
                    const text = await this.receiptOcrService.recognize(file, (progress) => {
                        this.setOcrStatus(progress.label, progress.progress);
                    });
                    this.elements.receiptText.value = text;
                    this.items = this.parserService.parse(text);
                    this.render();
                    if (this.items.length === 0) {
                        this.setOcrStatus("Text found, but no item prices were detected. You can edit the text and itemize it.", 1);
                        return;
                    }
                    this.setOcrStatus(`Found ${this.items.length} ${this.items.length === 1 ? "item" : "items"}`, 1);
                    window.setTimeout(() => this.hideOcrStatus(), 1600);
                    void this.reviewAmbiguousItems();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not extract text from this receipt.";
                    this.setOcrStatus(message, 1);
                }
                finally {
                    this.elements.parseButton.removeAttribute("disabled");
                }
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
    const receiptOcrService = new ReceiptRing.Services.ReceiptOcrService();
    const ringView = new ReceiptRing.UI.CategoryRingView(categories);
    const categorySummaryView = new ReceiptRing.UI.CategorySummaryView(categories, currencyFormatService, ringView);
    const itemListView = new ReceiptRing.UI.ItemListView(categories);
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, summaryService, currencyFormatService, imagePreviewService, receiptOcrService, itemListView, ringView, categorySummaryView, categoryPromptView, idService).start();
})(ReceiptRing || (ReceiptRing = {}));
