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
                    "gasoline",
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
        Config.BRAND_ABBREVIATIONS = {
            gv: "Great Value",
            mm: "Marketside",
            ks: "Kirkland Signature",
            kirkland: "Kirkland Signature",
            pc: "President's Choice",
            nn: "No Name",
            sb: "Simple Truth",
            st: "Simple Truth",
            gm: "General Mills",
            kh: "Kraft Heinz",
            tj: "Trader Joe's",
            wf: "Whole Foods",
            "365": "365 by Whole Foods",
            hy: "Hy-Vee",
            sw: "Signature Select",
            ss: "Signature Select",
            ah: "Archer Farms",
            gg: "Good & Gather",
            gng: "Good & Gather"
        };
        Config.WORD_ABBREVIATIONS = {
            mlk: "Milk",
            mk: "Milk",
            chz: "Cheese",
            chs: "Cheese",
            ched: "Cheddar",
            chdr: "Cheddar",
            mozz: "Mozzarella",
            moz: "Mozzarella",
            parm: "Parmesan",
            yog: "Yogurt",
            ygrt: "Yogurt",
            crm: "Cream",
            butr: "Butter",
            btr: "Butter",
            eg: "Eggs",
            egs: "Eggs",
            hlf: "Half",
            chkn: "Chicken",
            chk: "Chicken",
            chick: "Chicken",
            brst: "Breast",
            bnls: "Boneless",
            sknls: "Skinless",
            grnd: "Ground",
            gr: "Ground",
            bf: "Beef",
            beff: "Beef",
            prk: "Pork",
            sausg: "Sausage",
            saus: "Sausage",
            bacn: "Bacon",
            tky: "Turkey",
            trky: "Turkey",
            slmn: "Salmon",
            shrmp: "Shrimp",
            tlpa: "Tilapia",
            bnna: "Banana",
            ban: "Banana",
            appl: "Apple",
            tom: "Tomato",
            tmto: "Tomato",
            ptato: "Potato",
            pot: "Potato",
            onn: "Onion",
            onin: "Onion",
            lett: "Lettuce",
            ltce: "Lettuce",
            spnch: "Spinach",
            brocc: "Broccoli",
            brcli: "Broccoli",
            cuke: "Cucumber",
            cucmb: "Cucumber",
            avo: "Avocado",
            strwb: "Strawberry",
            blubr: "Blueberry",
            grp: "Grapes",
            brd: "Bread",
            bgl: "Bagel",
            tort: "Tortilla",
            crckr: "Cracker",
            cerl: "Cereal",
            ceral: "Cereal",
            pnut: "Peanut",
            pb: "Peanut Butter",
            jly: "Jelly",
            sug: "Sugar",
            flr: "Flour",
            ol: "Oil",
            vin: "Vinegar",
            sce: "Sauce",
            sauc: "Sauce",
            ktchp: "Ketchup",
            mayo: "Mayonnaise",
            mstrd: "Mustard",
            past: "Pasta",
            spag: "Spaghetti",
            noodl: "Noodle",
            ric: "Rice",
            bns: "Beans",
            soup: "Soup",
            choc: "Chocolate",
            cky: "Cookie",
            ckie: "Cookie",
            wtr: "Water",
            jce: "Juice",
            juc: "Juice",
            sda: "Soda",
            cof: "Coffee",
            coff: "Coffee",
            cofe: "Coffee",
            esprso: "Espresso",
            bevrg: "Beverage",
            bev: "Beverage",
            ppr: "Paper",
            twl: "Towel",
            tissu: "Tissue",
            dtrgnt: "Detergent",
            detrg: "Detergent",
            lndry: "Laundry",
            dish: "Dish",
            sop: "Soap",
            shmp: "Shampoo",
            cond: "Conditioner",
            tthpst: "Toothpaste",
            deod: "Deodorant",
            razr: "Razor",
            btry: "Battery",
            lightblb: "Light Bulb"
        };
        Config.QUALIFIER_ABBREVIATIONS = {
            org: "Organic",
            orgnc: "Organic",
            nat: "Natural",
            ntrl: "Natural",
            shrd: "Shredded",
            shred: "Shredded",
            slcd: "Sliced",
            slc: "Sliced",
            diced: "Diced",
            chpd: "Chopped",
            frz: "Frozen",
            frzn: "Frozen",
            frsh: "Fresh",
            fz: "Frozen",
            lg: "Large",
            lrg: "Large",
            sm: "Small",
            md: "Medium",
            med: "Medium",
            xl: "Extra Large",
            whl: "Whole",
            wht: "White",
            wheat: "Wheat",
            wh: "Wheat",
            ung: "Unsalted",
            unsltd: "Unsalted",
            sltd: "Salted",
            lofat: "Low Fat",
            lf: "Low Fat",
            ff: "Fat Free",
            nf: "Non Fat",
            rdcd: "Reduced",
            lite: "Light",
            orig: "Original",
            clsc: "Classic",
            var: "Variety",
            asst: "Assorted",
            mlt: "Multi",
            dbl: "Double",
            fam: "Family",
            val: "Value"
        };
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
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(rules));
                }
                catch {
                }
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
                    const parsed = rawRules ? JSON.parse(rawRules) : {};
                    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                        ? parsed
                        : {};
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
                    if (!normalizedKeyword)
                        return;
                    const keywordTokens = this.getTokens(normalizedKeyword);
                    const isPhrase = keywordTokens.length > 1;
                    if (isPhrase && normalizedLabel.includes(normalizedKeyword)) {
                        score += 4.5;
                        matchedTerms.push(keyword);
                        return;
                    }
                    if (!isPhrase && tokens.includes(keywordTokens[0])) {
                        score += 3;
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
                this.amountPattern = /(?:^|\s)(-?\$?\s*\d+(?:,\d{3})*[,.]\d{2}|-?\$\s*\d+)\s*$/;
                this.itemCodePattern = /\b\d{4,}\b/g;
                this.standaloneCodePattern = /^(\d{4,})$/;
            }
            parse(text) {
                const items = [];
                let pendingCode;
                text
                    .split(/\n+/)
                    .map((line) => line.replace(/\s+/g, " ").trim())
                    .filter(Boolean)
                    .forEach((line) => {
                    const standalone = line.match(this.standaloneCodePattern);
                    if (standalone) {
                        pendingCode = standalone[1];
                        return;
                    }
                    const item = this.parseLine(line, pendingCode);
                    pendingCode = undefined;
                    if (item)
                        items.push(item);
                });
                return items;
            }
            parseLine(line, pendingCode) {
                const match = line.match(this.amountPattern);
                if (!match || match.index === undefined)
                    return null;
                const amount = this.parseAmount(match[1]);
                const withoutMarks = line.slice(0, match.index).replace(/[*#@]/g, "");
                const itemCode = this.extractItemCode(withoutMarks) ?? pendingCode;
                const label = withoutMarks.replace(this.itemCodePattern, "").trim();
                if (!label || this.ignoredLabel.test(label) || !Number.isFinite(amount) || amount === 0) {
                    return null;
                }
                const categorization = this.categorizationService.categorize(label);
                return {
                    id: this.idService.create(),
                    label: this.toTitleCase(label),
                    amount: Number(amount.toFixed(2)),
                    ...(itemCode ? { itemCode } : {}),
                    category: categorization.category,
                    categorizationConfidence: categorization.confidence,
                    categorizationSource: categorization.source,
                    needsCategoryReview: categorization.shouldPrompt
                };
            }
            extractItemCode(labelPart) {
                const codes = labelPart.match(this.itemCodePattern);
                if (!codes)
                    return undefined;
                return codes.reduce((longest, code) => (code.length > longest.length ? code : longest));
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
        class LabelNormalizerService {
            constructor() {
                this.sizePattern = /^(\d+(?:\.\d+)?)\s*(z|oz|ozs|g|kg|mg|l|ml|lt|ltr|lb|lbs|ct|pk|pc|pcs|pack|qt|gal|ea)$/i;
                this.quantityPattern = /^(?:x\s*(\d+)|(\d+)\s*x|(\d+)\s*@)$/i;
                this.codePattern = /^\d{4,}$/;
                this.unitNames = {
                    z: "oz",
                    oz: "oz",
                    ozs: "oz",
                    g: "g",
                    kg: "kg",
                    mg: "mg",
                    l: "L",
                    lt: "L",
                    ltr: "L",
                    ml: "mL",
                    lb: "lb",
                    lbs: "lb",
                    ct: "ct",
                    pk: "pk",
                    pc: "pc",
                    pcs: "pc",
                    pack: "pk",
                    qt: "qt",
                    gal: "gal",
                    ea: "ea"
                };
            }
            normalize(label) {
                const rawTokens = this.splitTokens(label);
                const tokens = [];
                const codes = [];
                let size = null;
                let quantity = null;
                rawTokens.forEach((token) => {
                    const sizeMatch = token.match(this.sizePattern);
                    if (sizeMatch && size === null) {
                        size = `${this.trimNumber(sizeMatch[1])} ${this.unitNames[sizeMatch[2].toLowerCase()]}`;
                        return;
                    }
                    if (sizeMatch)
                        return;
                    const quantityMatch = token.match(this.quantityPattern);
                    if (quantityMatch) {
                        const value = Number(quantityMatch[1] ?? quantityMatch[2] ?? quantityMatch[3]);
                        if (Number.isFinite(value) && value > 0 && quantity === null)
                            quantity = value;
                        return;
                    }
                    if (this.codePattern.test(token)) {
                        codes.push(token);
                        return;
                    }
                    tokens.push(token.toLowerCase());
                });
                return { key: tokens.join(" "), tokens, size, quantity, codes };
            }
            keyFor(label) {
                return this.normalize(label).key;
            }
            splitTokens(label) {
                const tokens = label
                    .replace(/[()[\]{},;:!?"']/g, " ")
                    .replace(/\.(?=\s|$)/g, " ")
                    .replace(/([A-Za-z])(\d+(?:\.\d+)?(?:z|oz|g|kg|ml|l|lb|ct|pk)\b)/gi, "$1 $2")
                    .split(/\s+/)
                    .map((token) => token.replace(/^[-*#@/]+|[-*#@/]+$/g, ""))
                    .filter(Boolean);
                return this.joinSpacedSizes(tokens);
            }
            joinSpacedSizes(tokens) {
                const joined = [];
                for (let index = 0; index < tokens.length; index += 1) {
                    const current = tokens[index];
                    const next = tokens[index + 1];
                    if (next !== undefined &&
                        /^\d+(?:\.\d+)?$/.test(current) &&
                        Object.prototype.hasOwnProperty.call(this.unitNames, next.toLowerCase())) {
                        joined.push(`${current}${next}`);
                        index += 1;
                        continue;
                    }
                    joined.push(current);
                }
                return joined;
            }
            trimNumber(value) {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? String(parsed) : value;
            }
        }
        Services.LabelNormalizerService = LabelNormalizerService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        const MAX_DICTIONARY_CONFIDENCE = 0.9;
        const MIN_DICTIONARY_CONFIDENCE = 0.5;
        class DictionaryResolverService {
            constructor(labelNormalizerService, brands = ReceiptRing.Config.BRAND_ABBREVIATIONS, words = ReceiptRing.Config.WORD_ABBREVIATIONS, qualifiers = ReceiptRing.Config.QUALIFIER_ABBREVIATIONS) {
                this.labelNormalizerService = labelNormalizerService;
                this.brands = brands;
                this.plainWordPattern = /^[a-z][a-z'-]{2,}$/;
                this.vowelPattern = /[aeiouy]/;
                this.words = { ...words, ...qualifiers };
                this.qualifierNames = new Set(Object.values(qualifiers).map((name) => name.toLowerCase()));
            }
            expand(label) {
                const normalized = this.labelNormalizerService.normalize(label);
                let brand = null;
                const expandedTokens = [];
                const unknownTokens = [];
                const plainTokens = [];
                const nameParts = [];
                normalized.tokens.forEach((token, index) => {
                    if (index === 0 && brand === null && this.brands[token] !== undefined) {
                        brand = this.brands[token];
                        expandedTokens.push(token);
                        return;
                    }
                    const expansion = this.words[token];
                    if (expansion !== undefined) {
                        expandedTokens.push(token);
                        nameParts.push(expansion);
                        return;
                    }
                    if (this.plainWordPattern.test(token) && this.vowelPattern.test(token)) {
                        plainTokens.push(token);
                        nameParts.push(this.toTitleCase(token));
                        return;
                    }
                    unknownTokens.push(token);
                    nameParts.push(this.toTitleCase(token));
                });
                const name = [brand, ...nameParts].filter(Boolean).join(" ").trim();
                return {
                    name,
                    brand,
                    size: normalized.size,
                    expandedTokens,
                    unknownTokens,
                    plainTokens
                };
            }
            resolve(line) {
                const expansion = this.expand(line.label);
                const total = expansion.expandedTokens.length +
                    expansion.plainTokens.length +
                    expansion.unknownTokens.length;
                if (total === 0 || !expansion.name)
                    return null;
                const understood = expansion.expandedTokens.length + expansion.plainTokens.length;
                const coverage = understood / total;
                if (expansion.expandedTokens.length === 0 && expansion.plainTokens.length === 0) {
                    return null;
                }
                if (!this.namesSomething(expansion))
                    return null;
                const confidence = this.scoreExpansion(expansion, coverage);
                if (confidence < MIN_DICTIONARY_CONFIDENCE)
                    return null;
                return {
                    lineId: line.id,
                    rawLabel: line.label,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    resolvedName: expansion.name,
                    ...(expansion.brand ? { brand: expansion.brand } : {}),
                    ...(expansion.size ? { size: expansion.size } : {}),
                    confidence,
                    source: "dictionary",
                    reasoning: this.describe(expansion),
                    alternatives: [],
                    confirmed: false
                };
            }
            namesSomething(expansion) {
                const nameParts = expansion.name
                    .toLowerCase()
                    .replace(expansion.brand ? expansion.brand.toLowerCase() : "", "")
                    .split(/\s+/)
                    .filter(Boolean);
                return nameParts.some((part) => !this.qualifierNames.has(part));
            }
            scoreExpansion(expansion, coverage) {
                let confidence = MAX_DICTIONARY_CONFIDENCE * coverage;
                confidence -= expansion.unknownTokens.length * 0.05;
                const tokenCount = expansion.expandedTokens.length + expansion.plainTokens.length + expansion.unknownTokens.length;
                if (tokenCount === 1)
                    confidence -= 0.15;
                if (expansion.brand)
                    confidence += 0.05;
                return Math.max(0, Math.min(MAX_DICTIONARY_CONFIDENCE, Number(confidence.toFixed(2))));
            }
            describe(expansion) {
                if (expansion.expandedTokens.length === 0) {
                    return "Read as printed -- no shorthand to expand.";
                }
                const expanded = expansion.expandedTokens.map((token) => token.toUpperCase()).join(", ");
                const suffix = expansion.unknownTokens.length > 0
                    ? ` Could not place ${expansion.unknownTokens.map((t) => t.toUpperCase()).join(", ")}.`
                    : "";
                return `Expanded ${expanded} from the abbreviation list.${suffix}`;
            }
            toTitleCase(token) {
                return token.charAt(0).toUpperCase() + token.slice(1);
            }
        }
        Services.DictionaryResolverService = DictionaryResolverService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ItemAliasStoreService {
            constructor(labelNormalizerService, backend = null) {
                this.labelNormalizerService = labelNormalizerService;
                this.backend = backend;
                this.aliases = new Map();
            }
            async load() {
                if (!this.backend)
                    return;
                try {
                    this.replaceAll(await this.backend.load());
                }
                catch (error) {
                    console.error("Could not load saved item names:", error);
                }
            }
            replaceAll(aliases) {
                this.aliases = new Map(aliases.map((alias) => [this.mapKey(alias.storeKey, alias.lookupKey), alias]));
            }
            all() {
                return [...this.aliases.values()];
            }
            find(line, storeName) {
                const storeKey = this.storeKeyFor(storeName);
                const labelKey = this.labelNormalizerService.keyFor(line.label);
                const codeKey = line.itemCode ? this.codeKeyFor(line.itemCode) : null;
                const candidates = [
                    codeKey ? this.mapKey(storeKey, codeKey) : null,
                    this.mapKey(storeKey, labelKey),
                    codeKey ? this.mapKey("", codeKey) : null,
                    this.mapKey("", labelKey)
                ];
                for (const key of candidates) {
                    if (key === null)
                        continue;
                    const alias = this.aliases.get(key);
                    if (alias)
                        return alias;
                }
                return null;
            }
            resolve(line, storeName) {
                const alias = this.find(line, storeName);
                if (!alias)
                    return null;
                return {
                    lineId: line.id,
                    rawLabel: line.label,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    resolvedName: alias.resolvedName,
                    ...(alias.brand ? { brand: alias.brand } : {}),
                    ...(alias.size ? { size: alias.size } : {}),
                    confidence: 1,
                    source: "saved-alias",
                    reasoning: alias.timesConfirmed > 1
                        ? `You confirmed this ${alias.timesConfirmed} times.`
                        : "You confirmed this before.",
                    alternatives: [],
                    confirmed: true
                };
            }
            remember(identification, storeName) {
                const storeKey = this.storeKeyFor(storeName);
                const lookupKey = identification.itemCode
                    ? this.codeKeyFor(identification.itemCode)
                    : this.labelNormalizerService.keyFor(identification.rawLabel);
                const mapKey = this.mapKey(storeKey, lookupKey);
                const existing = this.aliases.get(mapKey);
                const alias = {
                    lookupKey,
                    storeKey,
                    resolvedName: identification.resolvedName,
                    ...(identification.brand ? { brand: identification.brand } : {}),
                    ...(identification.size ? { size: identification.size } : {}),
                    timesConfirmed: existing && existing.resolvedName === identification.resolvedName
                        ? existing.timesConfirmed + 1
                        : 1,
                    updatedAt: new Date().toISOString()
                };
                this.aliases.set(mapKey, alias);
                void this.backend?.save(alias).catch((error) => {
                    console.error("Could not save that name:", error);
                });
                return alias;
            }
            forget(alias) {
                this.aliases.delete(this.mapKey(alias.storeKey, alias.lookupKey));
                void this.backend?.remove(alias).catch((error) => {
                    console.error("Could not forget that name:", error);
                });
            }
            clear() {
                this.aliases.clear();
            }
            codeKeyFor(itemCode) {
                return `code:${itemCode.replace(/^0+(?=\d)/, "")}`;
            }
            storeKeyFor(storeName) {
                return storeName.trim().toLowerCase().replace(/\s+/g, " ");
            }
            mapKey(storeKey, lookupKey) {
                return `${storeKey}\u0000${lookupKey}`;
            }
        }
        Services.ItemAliasStoreService = ItemAliasStoreService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        const MIN_REPORTABLE_CONFIDENCE = 0.35;
        class ItemIdentityService {
            constructor(aliasStoreService, dictionaryResolverService, aiIdentifier = null) {
                this.aliasStoreService = aliasStoreService;
                this.dictionaryResolverService = dictionaryResolverService;
                this.aiIdentifier = aiIdentifier;
            }
            async identify(lines, known, options = {}) {
                const storeName = options.storeName ?? "";
                const resolved = new Map();
                const report = (progress) => {
                    try {
                        options.onProgress?.(progress);
                    }
                    catch {
                    }
                };
                const pending = lines.filter((line) => {
                    if (line.ignored)
                        return false;
                    if (options.force)
                        return true;
                    return !known.get(line.id)?.confirmed;
                });
                const total = pending.length;
                report({ stage: "aliases", done: 0, total, message: "Checking what you've named before..." });
                const unresolvedByAlias = [];
                pending.forEach((line) => {
                    const alias = this.aliasStoreService.resolve(line, storeName);
                    if (alias) {
                        resolved.set(line.id, alias);
                        return;
                    }
                    unresolvedByAlias.push(line);
                });
                report({
                    stage: "dictionary",
                    done: resolved.size,
                    total,
                    message: "Expanding receipt shorthand..."
                });
                const dictionaryFallbacks = new Map();
                const unresolvedByDictionary = [];
                unresolvedByAlias.forEach((line) => {
                    const expansion = this.dictionaryResolverService.resolve(line);
                    const prefersCodeLookup = Boolean(line.itemCode) && this.aiIdentifier !== null;
                    if (expansion && !prefersCodeLookup) {
                        resolved.set(line.id, expansion);
                        return;
                    }
                    if (expansion)
                        dictionaryFallbacks.set(line.id, expansion);
                    unresolvedByDictionary.push(line);
                });
                if (unresolvedByDictionary.length > 0 && this.aiIdentifier) {
                    const count = unresolvedByDictionary.length;
                    report({
                        stage: "ai",
                        done: resolved.size,
                        total,
                        message: `Looking up ${count} ${count === 1 ? "item" : "items"}...`
                    });
                    const answers = await this.aiIdentifier.identify(unresolvedByDictionary.map((line) => this.toRequest(line)), storeName);
                    const byLineId = new Map(answers.map((answer) => [answer.lineId, answer]));
                    unresolvedByDictionary.forEach((line) => {
                        const answer = byLineId.get(line.id);
                        if (answer && answer.confidence >= MIN_REPORTABLE_CONFIDENCE) {
                            resolved.set(line.id, answer);
                            return;
                        }
                        const fallback = dictionaryFallbacks.get(line.id);
                        if (fallback) {
                            resolved.set(line.id, fallback);
                            return;
                        }
                        resolved.set(line.id, this.unresolved(line, answer ?? null));
                    });
                }
                else {
                    unresolvedByDictionary.forEach((line) => {
                        resolved.set(line.id, this.unresolved(line, null));
                    });
                }
                const identified = [...resolved.values()].filter((identification) => identification.source !== "unresolved").length;
                report({
                    stage: "complete",
                    done: identified,
                    total,
                    message: this.summarize(identified, total)
                });
                return resolved;
            }
            unresolved(line, rejected) {
                const alternatives = rejected
                    ? [{ name: rejected.resolvedName, confidence: rejected.confidence }, ...rejected.alternatives]
                    : [];
                return {
                    lineId: line.id,
                    rawLabel: line.label,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    resolvedName: line.label,
                    confidence: 0,
                    source: "unresolved",
                    reasoning: rejected
                        ? "Only a low-confidence guess -- worth checking by hand."
                        : "Couldn't work out what this is.",
                    alternatives,
                    confirmed: false
                };
            }
            summarize(done, total) {
                if (total === 0)
                    return "Nothing to identify.";
                if (done === 0)
                    return "Couldn't identify anything on this receipt.";
                if (done === total)
                    return `Identified all ${total} ${total === 1 ? "item" : "items"}.`;
                return `Identified ${done} of ${total} items.`;
            }
            toRequest(line) {
                return {
                    lineId: line.id,
                    label: line.label,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    amount: line.amount
                };
            }
        }
        Services.ItemIdentityService = ItemIdentityService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ItemIdentityApiService {
            constructor() {
                this.maxBatchSize = 60;
            }
            async identify(requests, storeName) {
                if (requests.length === 0)
                    return [];
                const batches = [];
                for (let index = 0; index < requests.length; index += this.maxBatchSize) {
                    batches.push(requests.slice(index, index + this.maxBatchSize));
                }
                const results = await Promise.all(batches.map((batch) => this.identifyBatch(batch, storeName)));
                return results.flat();
            }
            async identifyBatch(requests, storeName) {
                const response = await fetch("/api/items/identify", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        storeName,
                        model: this.selectedModel(),
                        items: requests.map((request) => ({
                            id: request.lineId,
                            label: request.label,
                            ...(request.itemCode ? { itemCode: request.itemCode } : {}),
                            amount: request.amount
                        }))
                    })
                });
                if (!response.ok) {
                    const body = (await response.json().catch(() => ({})));
                    throw new Error(body.error || `Could not identify these items (${response.status}).`);
                }
                const payload = (await response.json());
                const byLineId = new Map(requests.map((request) => [request.lineId, request]));
                return (payload.items ?? [])
                    .map((item) => this.toIdentification(item, byLineId.get(item.id)))
                    .filter((identification) => identification !== null);
            }
            toIdentification(item, request) {
                if (!request || !item?.name)
                    return null;
                return {
                    lineId: request.lineId,
                    rawLabel: request.label,
                    ...(request.itemCode ? { itemCode: request.itemCode } : {}),
                    resolvedName: item.name,
                    ...(item.brand ? { brand: item.brand } : {}),
                    ...(item.size ? { size: item.size } : {}),
                    confidence: this.clamp(item.confidence),
                    source: "ai",
                    ...(item.reasoning ? { reasoning: item.reasoning } : {}),
                    alternatives: (item.alternatives ?? [])
                        .filter((alternative) => Boolean(alternative?.name))
                        .map((alternative) => ({
                        name: alternative.name,
                        confidence: this.clamp(alternative.confidence)
                    })),
                    confirmed: false
                };
            }
            selectedModel() {
                return localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
            }
            clamp(value) {
                const confidence = Number(value);
                if (!Number.isFinite(confidence))
                    return 0;
                return Math.max(0, Math.min(1, confidence));
            }
        }
        Services.ItemIdentityApiService = ItemIdentityApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ItemAliasApiService {
            async load() {
                const response = await fetch("/api/item-aliases", { credentials: "same-origin" });
                if (!response.ok) {
                    throw new Error(`Could not load saved item names (${response.status}).`);
                }
                const payload = (await response.json());
                return payload.aliases ?? [];
            }
            async save(alias) {
                const response = await fetch("/api/item-aliases", {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lookupKey: alias.lookupKey,
                        storeKey: alias.storeKey,
                        resolvedName: alias.resolvedName,
                        ...(alias.brand ? { brand: alias.brand } : {}),
                        ...(alias.size ? { size: alias.size } : {})
                    })
                });
                if (!response.ok) {
                    const body = (await response.json().catch(() => ({})));
                    throw new Error(body.error || `Could not save that name (${response.status}).`);
                }
            }
            async remove(alias) {
                const query = new URLSearchParams({
                    lookupKey: alias.lookupKey,
                    storeKey: alias.storeKey
                });
                const response = await fetch(`/api/item-aliases?${query.toString()}`, {
                    method: "DELETE",
                    credentials: "same-origin"
                });
                if (!response.ok) {
                    const body = (await response.json().catch(() => ({})));
                    throw new Error(body.error || `Could not forget that name (${response.status}).`);
                }
            }
        }
        Services.ItemAliasApiService = ItemAliasApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class SplitCalculatorService {
            calculate(people, lines, assignments, tax) {
                const itemCents = new Map();
                const foodCents = new Map();
                people.forEach((person) => {
                    itemCents.set(person.id, 0);
                    foodCents.set(person.id, 0);
                });
                let unallocatedCents = 0;
                const taxCents = this.toCents(tax);
                let receiptCents = taxCents;
                lines
                    .filter((line) => !line.ignored)
                    .forEach((line) => {
                    receiptCents += this.toCents(line.amount);
                    const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
                    if (lineAssignments.length === 0)
                        return;
                    const shares = this.getLineShares(line, lineAssignments);
                    let allocated = 0;
                    shares.forEach((cents, personId) => {
                        itemCents.set(personId, (itemCents.get(personId) ?? 0) + cents);
                        if (line.isFood) {
                            foodCents.set(personId, (foodCents.get(personId) ?? 0) + cents);
                        }
                        allocated += cents;
                    });
                    unallocatedCents += this.toCents(line.amount) - allocated;
                });
                const orderedPeople = [...people];
                const weights = orderedPeople.map((person) => itemCents.get(person.id) ?? 0);
                const taxShares = this.distributeProportionally(taxCents, weights);
                let assignedCents = 0;
                const totals = orderedPeople.map((person, index) => {
                    const itemTotal = weights[index];
                    const allocatedTax = taxShares[index];
                    assignedCents += itemTotal + allocatedTax;
                    const foodItems = foodCents.get(person.id) ?? 0;
                    const [foodTax] = this.distributeProportionally(allocatedTax, [
                        foodItems,
                        itemTotal - foodItems
                    ]);
                    return {
                        personId: person.id,
                        personName: person.name,
                        itemTotal: this.toAmount(itemTotal),
                        foodTotal: this.toAmount(foodItems + foodTax),
                        allocatedTax: this.toAmount(allocatedTax),
                        finalTotal: this.toAmount(itemTotal + allocatedTax)
                    };
                });
                return {
                    totals,
                    unallocated: this.toAmount(unallocatedCents),
                    receiptTotal: this.toAmount(receiptCents),
                    assignedTotal: this.toAmount(assignedCents),
                    isBalanced: receiptCents === assignedCents
                };
            }
            getUnassignedCount(lines, assignments) {
                return lines.filter((line) => !line.ignored && !assignments.some((assignment) => assignment.lineId === line.id)).length;
            }
            getLineShares(line, assignments) {
                const shares = new Map();
                if (assignments.length === 0)
                    return shares;
                const lineCents = this.toCents(line.amount);
                if (assignments.every((assignment) => assignment.mode === "equal")) {
                    const even = this.distributeEvenly(lineCents, assignments.length);
                    assignments.forEach((assignment, index) => shares.set(assignment.personId, even[index]));
                    return shares;
                }
                const equalCount = assignments.filter((assignment) => assignment.mode === "equal").length;
                const equalShares = equalCount > 0 ? this.distributeEvenly(lineCents, assignments.length) : [];
                let equalIndex = 0;
                assignments.forEach((assignment) => {
                    if (assignment.mode === "percentage") {
                        shares.set(assignment.personId, Math.round(lineCents * (assignment.value / 100)));
                    }
                    else if (assignment.mode === "amount") {
                        shares.set(assignment.personId, this.toCents(assignment.value));
                    }
                    else {
                        shares.set(assignment.personId, equalShares[equalIndex]);
                        equalIndex += 1;
                    }
                });
                return shares;
            }
            distributeEvenly(totalCents, count) {
                if (count <= 0)
                    return [];
                const base = Math.trunc(totalCents / count);
                let remainder = totalCents - base * count;
                const step = remainder < 0 ? -1 : 1;
                return Array.from({ length: count }, () => {
                    if (remainder === 0)
                        return base;
                    remainder -= step;
                    return base + step;
                });
            }
            distributeProportionally(totalCents, weights) {
                const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
                if (weightSum === 0 || totalCents === 0)
                    return weights.map(() => 0);
                const exact = weights.map((weight) => (weight / weightSum) * totalCents);
                const result = exact.map((value) => Math.trunc(value));
                let remainder = totalCents - result.reduce((sum, value) => sum + value, 0);
                const step = remainder < 0 ? -1 : 1;
                const byFraction = exact
                    .map((value, index) => ({ index, fraction: Math.abs(value - result[index]) }))
                    .sort((left, right) => right.fraction - left.fraction);
                for (const { index } of byFraction) {
                    if (remainder === 0)
                        break;
                    result[index] += step;
                    remainder -= step;
                }
                return result;
            }
            toCents(value) {
                return Number.isFinite(value) ? Math.round(value * 100) : 0;
            }
            toAmount(cents) {
                return cents / 100;
            }
        }
        Services.SplitCalculatorService = SplitCalculatorService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class LineSelectionService {
            constructor() {
                this.selected = new Set();
                this.anchorId = null;
            }
            get count() {
                return this.selected.size;
            }
            has(lineId) {
                return this.selected.has(lineId);
            }
            ids() {
                return [...this.selected];
            }
            toggle(lineId) {
                if (this.selected.has(lineId)) {
                    this.selected.delete(lineId);
                }
                else {
                    this.selected.add(lineId);
                }
                this.anchorId = lineId;
            }
            selectRange(lines, lineId) {
                const target = lines.findIndex((line) => line.id === lineId);
                const anchor = lines.findIndex((line) => line.id === this.anchorId);
                if (target < 0 || anchor < 0) {
                    this.toggle(lineId);
                    return;
                }
                const start = Math.min(anchor, target);
                const end = Math.max(anchor, target);
                for (let index = start; index <= end; index += 1) {
                    this.selected.add(lines[index].id);
                }
            }
            selectAll(lines) {
                lines.forEach((line) => this.selected.add(line.id));
            }
            clear() {
                this.selected.clear();
                this.anchorId = null;
            }
            isAllSelected(lines) {
                return lines.length > 0 && lines.every((line) => this.selected.has(line.id));
            }
            isAnySelected(lines) {
                return lines.some((line) => this.selected.has(line.id));
            }
            prune(lines) {
                const live = new Set(lines.map((line) => line.id));
                this.selected.forEach((id) => {
                    if (!live.has(id))
                        this.selected.delete(id);
                });
                if (this.anchorId !== null && !live.has(this.anchorId))
                    this.anchorId = null;
            }
        }
        Services.LineSelectionService = LineSelectionService;
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
                    const parsed = rawValue ? JSON.parse(rawValue) : [];
                    return Array.isArray(parsed) ? parsed : [];
                }
                catch {
                    return [];
                }
            }
            save(items) {
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(items));
                }
                catch {
                }
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
        const MAX_DIMENSION = 1600;
        const JPEG_QUALITY = 0.82;
        class ReceiptImageService {
            async toStorableDataUrl(file) {
                try {
                    const source = await this.decode(file);
                    const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(source.width * scale));
                    canvas.height = Math.max(1, Math.round(source.height * scale));
                    const context = canvas.getContext("2d");
                    if (!context)
                        return null;
                    context.drawImage(source, 0, 0, canvas.width, canvas.height);
                    if ("close" in source) {
                        source.close();
                    }
                    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
                }
                catch (error) {
                    console.error("Could not prepare the receipt image for saving:", error);
                    return null;
                }
            }
            async decode(file) {
                if (typeof createImageBitmap === "function") {
                    return createImageBitmap(file, { imageOrientation: "from-image" });
                }
                const url = URL.createObjectURL(file);
                try {
                    return await new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = () => reject(new Error("Could not decode the image."));
                        image.src = url;
                    });
                }
                finally {
                    URL.revokeObjectURL(url);
                }
            }
        }
        Services.ReceiptImageService = ReceiptImageService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class ReceiptParseError extends Error {
            constructor(message, status) {
                super(message);
                this.status = status;
                this.name = "ReceiptParseError";
            }
        }
        Services.ReceiptParseError = ReceiptParseError;
        function isRetryableParseFailure(status) {
            if (status === 0)
                return true;
            return status === 408 || status === 429 || status === 502 || status === 504;
        }
        Services.isRetryableParseFailure = isRetryableParseFailure;
        function retryBackoffMs(attempt) {
            const base = 2000;
            const ceiling = 30000;
            return Math.min(ceiling, base * Math.pow(2, Math.max(0, attempt - 1)));
        }
        Services.retryBackoffMs = retryBackoffMs;
        Services.MAX_PARSE_RETRIES = 4;
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
                    throw new ReceiptParseError(await this.describeFailure(proxyResponse), proxyResponse.status);
                }
                return proxyResponse.json();
            }
            async describeFailure(response) {
                const body = await response.text();
                try {
                    const parsed = JSON.parse(body);
                    if (parsed?.error)
                        return parsed.error;
                }
                catch {
                }
                return `Could not read this receipt (error ${response.status}).`;
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
            imageUrl(receiptId) {
                return `/api/receipts/${encodeURIComponent(receiptId)}/image`;
            }
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
            async update(id, payload) {
                const response = await fetch(`/api/receipts/${encodeURIComponent(id)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Update failed (${response.status}): ${message}`);
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
            async remove(id) {
                const response = await fetch(`/api/receipts/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Delete failed (${response.status}): ${message}`);
                }
            }
            async updateLineFood(receiptId, lineId, isFood) {
                const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/lines/${encodeURIComponent(lineId)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isFood })
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Update failed (${response.status}): ${message}`);
                }
            }
            async getFoodSummary(month) {
                const url = month
                    ? `/api/receipts/food-summary?month=${encodeURIComponent(month)}`
                    : "/api/receipts/food-summary";
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not load food summary (${response.status}).`);
                }
                return (await response.json());
            }
            async linkTransactionToReceipt(receiptId, bankTransactionId) {
                const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/link-transaction`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankTransactionId })
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Link failed (${response.status}): ${message}`);
                }
            }
            async unlinkTransactionFromReceipt(receiptId) {
                const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/link-transaction`, {
                    method: "DELETE"
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Unlink failed (${response.status}): ${message}`);
                }
            }
        }
        Services.ReceiptApiService = ReceiptApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        const ASSIGNMENT_MODES = ["equal", "percentage", "amount"];
        function workspaceFromSavedReceipt(receipt, createId) {
            const assignments = [];
            const lineModes = new Map();
            const identifications = new Map();
            const lines = receipt.lines.map((line) => {
                const identification = identificationFromStored(line, line.identification);
                if (identification)
                    identifications.set(line.id, identification);
                for (const share of line.assignments) {
                    if (!share.personId)
                        continue;
                    const mode = ASSIGNMENT_MODES.includes(share.mode)
                        ? share.mode
                        : "equal";
                    if (!lineModes.has(line.id))
                        lineModes.set(line.id, mode);
                    assignments.push({
                        id: createId(),
                        lineId: line.id,
                        personId: share.personId,
                        mode,
                        value: Number(share.value) || 0
                    });
                }
                return {
                    id: line.id,
                    label: line.label,
                    amount: Number(line.amount) || 0,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    confidence: 100,
                    ignored: line.ignored ?? false,
                    isFood: line.isFood ?? false
                };
            });
            return {
                storeName: receipt.storeName ?? "",
                category: receipt.category,
                tax: Number(receipt.tax) || 0,
                lines,
                assignments,
                lineModes,
                identifications,
                people: receipt.people.map((person) => ({
                    id: person.id,
                    name: person.name,
                    isSelf: Boolean(person.isSelf)
                }))
            };
        }
        Services.workspaceFromSavedReceipt = workspaceFromSavedReceipt;
        function identificationFromStored(line, stored) {
            if (!stored?.resolvedName)
                return null;
            return {
                lineId: line.id,
                rawLabel: line.label,
                ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                resolvedName: stored.resolvedName,
                ...(stored.brand ? { brand: stored.brand } : {}),
                ...(stored.size ? { size: stored.size } : {}),
                confidence: Number(stored.confidence) || 0,
                source: stored.source ?? "unresolved",
                ...(stored.reasoning ? { reasoning: stored.reasoning } : {}),
                alternatives: Array.isArray(stored.alternatives) ? stored.alternatives : [],
                confirmed: Boolean(stored.confirmed)
            };
        }
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
            async createLinkToken() {
                const response = await this.request("/api/plaid/link-token");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async exchange(publicToken, metadata) {
                const response = await this.request("/api/plaid/exchange", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ publicToken, metadata })
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async sync() {
                const response = await this.request("/api/plaid/sync", { method: "POST" });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async listConnections() {
                const response = await this.request("/api/plaid/connections");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async removeConnection(id) {
                const response = await this.request(`/api/plaid/connections/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
            }
            async listTransactions() {
                const response = await this.request("/api/transactions");
                if (!response.ok)
                    throw new Error(await this.parseError(response));
                return (await response.json());
            }
            async updateTransactionFood(id, isFood) {
                const response = await this.request(`/api/bank-transactions/${encodeURIComponent(id)}/food`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isFood })
                });
                if (!response.ok)
                    throw new Error(await this.parseError(response));
            }
        }
        Services.BankApiService = BankApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        class PeopleApiService {
            async list() {
                const response = await fetch("/api/people");
                if (!response.ok) {
                    throw new Error(`Could not load people (${response.status}).`);
                }
                return (await response.json());
            }
            async add(name) {
                const response = await fetch("/api/people", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name })
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Add failed (${response.status}): ${message}`);
                }
                return (await response.json());
            }
            async delete(id) {
                const response = await fetch(`/api/people/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(`Delete failed (${response.status}): ${message}`);
                }
            }
            async search(query) {
                const response = await fetch(`/api/people/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error(`Search failed (${response.status}).`);
                }
                return (await response.json());
            }
        }
        Services.PeopleApiService = PeopleApiService;
    })(Services = ReceiptRing.Services || (ReceiptRing.Services = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var Services;
    (function (Services) {
        function parseRentDateParts(date) {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
            if (!match)
                return null;
            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            if (month < 1 || month > 12 || day < 1 || day > 31)
                return null;
            return { year, month };
        }
        Services.parseRentDateParts = parseRentDateParts;
        function rentMonthKey(year, month) {
            return `${year}-${String(month).padStart(2, "0")}`;
        }
        Services.rentMonthKey = rentMonthKey;
        class RentEntryApiService {
            async parseError(response) {
                try {
                    const data = (await response.json());
                    if (data.error)
                        return data.error;
                }
                catch {
                }
                return `Request failed (${response.status}).`;
            }
            async create(payload) {
                const response = await fetch("/api/rent-entries", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    throw new Error(await this.parseError(response));
                }
                return (await response.json());
            }
            async list(month) {
                const url = month ? `/api/rent-entries?month=${encodeURIComponent(month)}` : "/api/rent-entries";
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not load rent entries (${response.status}).`);
                }
                return (await response.json());
            }
            async update(id, updates) {
                const response = await fetch(`/api/rent-entries/${encodeURIComponent(id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates)
                });
                if (!response.ok) {
                    throw new Error(await this.parseError(response));
                }
                return (await response.json());
            }
            async delete(id) {
                const response = await fetch(`/api/rent-entries/${encodeURIComponent(id)}`, {
                    method: "DELETE"
                });
                if (!response.ok) {
                    throw new Error(await this.parseError(response));
                }
            }
            async getSummary(month) {
                const url = month
                    ? `/api/rent-entries/summary?month=${encodeURIComponent(month)}`
                    : "/api/rent-entries/summary";
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Could not load rent summary (${response.status}).`);
                }
                return (await response.json());
            }
        }
        Services.RentEntryApiService = RentEntryApiService;
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
            aggregate(receipts, transactions, receiptAmounts) {
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
                const attachedReceiptIds = new Set(transactions
                    .map((txn) => txn.linkedReceiptId)
                    .filter((id) => typeof id === "string" && id.length > 0));
                for (const receipt of receipts) {
                    if (attachedReceiptIds.has(receipt.id))
                        continue;
                    const override = receiptAmounts?.get(receipt.id);
                    add(receipt.createdAt, receipt.category, override ?? receipt.total ?? 0);
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
                if (typeof dateStr === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(dateStr)) {
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
    var Services;
    (function (Services) {
        class NotificationService {
            constructor() {
                this.toastContainer = this.ensureContainer();
            }
            show(message, type = "info", duration = 4000) {
                const toast = document.createElement("div");
                toast.className = `toast toast-${type}`;
                toast.setAttribute("role", "status");
                toast.setAttribute("aria-live", "polite");
                toast.textContent = message;
                this.toastContainer.appendChild(toast);
                requestAnimationFrame(() => {
                    toast.classList.add("toast-visible");
                });
                setTimeout(() => {
                    toast.classList.remove("toast-visible");
                    setTimeout(() => {
                        toast.remove();
                    }, 300);
                }, duration);
            }
            success(message, duration) {
                this.show(message, "success", duration);
            }
            error(message, duration) {
                this.show(message, "error", duration);
            }
            info(message, duration) {
                this.show(message, "info", duration);
            }
            ensureContainer() {
                let container = document.querySelector("#toastContainer");
                if (!container) {
                    container = document.createElement("div");
                    container.id = "toastContainer";
                    container.className = "toast-container";
                    document.body.appendChild(container);
                }
                return container;
            }
        }
        Services.NotificationService = NotificationService;
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
                    retryParseButton: this.getElement("#retryParseButton", HTMLButtonElement),
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
                    selectAllLines: this.getElement("#selectAllLines", HTMLInputElement),
                    batchBar: this.getElement("#batchBar", HTMLElement),
                    batchCount: this.getElement("#batchCount", HTMLElement),
                    batchActions: this.getElement("#batchActions", HTMLElement),
                    batchClearButton: this.getElement("#batchClearButton", HTMLButtonElement),
                    identifyItemsButton: this.getElement("#identifyItemsButton", HTMLButtonElement),
                    identifyStatus: this.getElement("#identifyStatus", HTMLElement),
                    identifyStatusText: this.getElement("#identifyStatusText", HTMLElement),
                    identifyProgressBar: this.getElement("#identifyProgressBar", HTMLElement),
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
                    editBanner: this.getElement("#editBanner", HTMLElement),
                    editBannerTitle: this.getElement("#editBannerTitle", HTMLElement),
                    editBannerMeta: this.getElement("#editBannerMeta", HTMLElement),
                    cancelEditButton: this.getElement("#cancelEditButton", HTMLButtonElement),
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
                    pasteJsonButton: this.getElement("#pasteJsonButton", HTMLButtonElement),
                    pasteJsonModal: this.getElement("#pasteJsonModal", HTMLElement),
                    pasteJsonText: this.getElement("#pasteJsonText", HTMLTextAreaElement),
                    pasteJsonStatus: this.getElement("#pasteJsonStatus", HTMLElement),
                    closePasteJsonButton: this.getElement("#closePasteJsonButton", HTMLButtonElement),
                    importPasteJsonButton: this.getElement("#importPasteJsonButton", HTMLButtonElement),
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
                    monthlyTrend: this.getElement("#monthlyTrend", HTMLElement),
                    budgetMonth: this.getElement("#budgetMonth", HTMLSelectElement),
                    budgetRing: this.getElement("#budgetRing", HTMLElement),
                    budgetLegend: this.getElement("#budgetLegend", HTMLElement),
                    connectBankButton: this.getElement("#connectBankButton", HTMLButtonElement),
                    refreshTransactionsButton: this.getElement("#refreshTransactionsButton", HTMLButtonElement),
                    bankStatus: this.getElement("#bankStatus", HTMLElement),
                    bankConnections: this.getElement("#bankConnections", HTMLElement),
                    transactionsList: this.getElement("#transactionsList", HTMLElement),
                    transactionReceiptFile: this.getElement("#transactionReceiptFile", HTMLInputElement),
                    transactionsEmpty: this.getElement("#transactionsEmpty", HTMLElement),
                    addRentEntryButton: this.getElement("#addRentEntryButton", HTMLButtonElement),
                    rentEntriesList: this.getElement("#rentEntriesList", HTMLElement),
                    rentEntryModal: this.getElement("#rentEntryModal", HTMLElement),
                    rentEntryDate: this.getElement("#rentEntryDate", HTMLInputElement),
                    rentEntryAmount: this.getElement("#rentEntryAmount", HTMLInputElement),
                    rentEntryProperty: this.getElement("#rentEntryProperty", HTMLInputElement),
                    rentEntryPhoto: this.getElement("#rentEntryPhoto", HTMLInputElement),
                    rentEntryCancelButton: this.getElement("#rentEntryCancelButton", HTMLButtonElement),
                    rentEntrySaveButton: this.getElement("#rentEntrySaveButton", HTMLButtonElement),
                    receiptLinkModal: this.getElement("#receiptLinkModal", HTMLElement),
                    receiptLinkList: this.getElement("#receiptLinkList", HTMLElement),
                    receiptLinkEmpty: this.getElement("#receiptLinkEmpty", HTMLElement),
                    receiptLinkCancelButton: this.getElement("#receiptLinkCancelButton", HTMLButtonElement),
                    transactionLinkModal: this.getElement("#transactionLinkModal", HTMLElement),
                    transactionLinkList: this.getElement("#transactionLinkList", HTMLElement),
                    transactionLinkEmpty: this.getElement("#transactionLinkEmpty", HTMLElement),
                    transactionLinkCancelButton: this.getElement("#transactionLinkCancelButton", HTMLButtonElement),
                    educationFoodTotal: this.getElement("#educationFoodTotal", HTMLElement),
                    educationRentTotal: this.getElement("#educationRentTotal", HTMLElement),
                    educationExpensesTotal: this.getElement("#educationExpensesTotal", HTMLElement),
                    foodSection: this.getElement("#foodSection", HTMLElement),
                    foodItemsList: this.getElement("#foodItemsList", HTMLElement),
                    foodEmpty: this.getElement("#foodEmpty", HTMLElement),
                    rentSection: this.getElement("#rentSection", HTMLElement),
                    rentEmpty: this.getElement("#rentEmpty", HTMLElement)
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
        class MonthlyTrendView {
            constructor(currencyFormatService) {
                this.currencyFormatService = currencyFormatService;
            }
            render(container, months, selectedMonth, onSelect) {
                const hadFocus = container.contains(document.activeElement);
                container.replaceChildren();
                if (months.length === 0) {
                    const empty = document.createElement("p");
                    empty.className = "budget-ring-empty";
                    empty.textContent = "No spending recorded yet.";
                    container.append(empty);
                    return;
                }
                const chronological = [...months].reverse();
                const max = Math.max(...chronological.map((entry) => entry.total));
                const chart = document.createElement("div");
                chart.className = "trend-chart";
                let selectedBar = null;
                for (const entry of chronological) {
                    const bar = this.buildBar(entry, max, entry.month === selectedMonth, onSelect);
                    if (entry.month === selectedMonth)
                        selectedBar = bar;
                    chart.append(bar);
                }
                container.append(chart);
                if (hadFocus && selectedBar) {
                    selectedBar.focus();
                }
            }
            buildBar(entry, max, isSelected, onSelect) {
                const column = document.createElement("button");
                column.type = "button";
                column.className = "trend-bar-col";
                column.classList.toggle("is-selected", isSelected);
                column.setAttribute("aria-pressed", String(isSelected));
                column.setAttribute("aria-label", `${this.monthLabel(entry.month, true)}: ${this.currencyFormatService.format(entry.total)}`);
                column.addEventListener("click", () => onSelect(entry.month));
                const value = document.createElement("span");
                value.className = "trend-bar-value";
                value.textContent = this.currencyFormatService.format(entry.total);
                const track = document.createElement("span");
                track.className = "trend-bar-track";
                const fill = document.createElement("span");
                fill.className = "trend-bar-fill";
                const percent = max > 0 ? Math.round((entry.total / max) * 100) : 0;
                fill.style.height = `${percent}%`;
                track.append(fill);
                const label = document.createElement("span");
                label.className = "trend-bar-label";
                label.textContent = this.monthLabel(entry.month, false);
                column.append(value, track, label);
                return column;
            }
            monthLabel(key, includeYear) {
                const [year, month] = key.split("-").map(Number);
                if (!year || !month)
                    return key;
                return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
                    month: "short",
                    ...(includeYear ? { year: "numeric" } : {})
                });
            }
        }
        UI.MonthlyTrendView = MonthlyTrendView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var UI;
    (function (UI) {
        const SURE_THRESHOLD = 0.85;
        const LIKELY_THRESHOLD = 0.6;
        function confidenceBand(confidence) {
            if (confidence >= SURE_THRESHOLD)
                return "sure";
            if (confidence >= LIKELY_THRESHOLD)
                return "likely";
            return "unsure";
        }
        UI.confidenceBand = confidenceBand;
        const MODE_LABELS = {
            equal: "Split evenly",
            percentage: "Split by percentage",
            amount: "Split by custom amount"
        };
        class SplitWorkspaceView {
            constructor(currencyFormatService, receiptApiService) {
                this.currencyFormatService = currencyFormatService;
                this.receiptApiService = receiptApiService;
                this.panelListeners = null;
            }
            renderLines(container, lines, assignments, people, lineModes, selectedLineIds, identifications, handlers) {
                const openLineIds = new Set();
                const openDetailLineIds = new Set();
                container
                    .querySelectorAll("details.assign-dropdown[open]")
                    .forEach((dropdown) => {
                    if (dropdown.dataset.lineId)
                        openLineIds.add(dropdown.dataset.lineId);
                });
                container
                    .querySelectorAll("details.item-detail-dropdown[open]")
                    .forEach((dropdown) => {
                    if (dropdown.dataset.lineId)
                        openDetailLineIds.add(dropdown.dataset.lineId);
                });
                this.panelListeners?.abort();
                this.panelListeners = new AbortController();
                container.innerHTML = "";
                lines.forEach((line) => {
                    const isSelected = selectedLineIds.has(line.id);
                    const row = document.createElement("div");
                    row.className = "table-row";
                    row.classList.toggle("is-ignored", line.ignored);
                    row.classList.toggle("is-selected", isSelected);
                    const select = document.createElement("input");
                    select.type = "checkbox";
                    select.className = "line-select";
                    select.checked = isSelected;
                    select.setAttribute("aria-label", `Select ${line.label}`);
                    select.addEventListener("click", (event) => handlers.onLineSelectToggle(line.id, event.shiftKey));
                    const name = this.buildLabelCell(line, identifications.get(line.id), handlers);
                    const foodCheck = document.createElement("button");
                    foodCheck.className = "line-food-check";
                    foodCheck.type = "button";
                    foodCheck.setAttribute("aria-label", line.isFood ? "Mark as non-food" : "Mark as food");
                    foodCheck.setAttribute("aria-pressed", String(line.isFood ?? false));
                    foodCheck.innerHTML = SplitWorkspaceView.getFoodCheckIcon(line.isFood ?? false);
                    foodCheck.addEventListener("click", () => handlers.onLineFood(line.id, !(line.isFood ?? false)));
                    const assignCell = document.createElement("div");
                    assignCell.className = "assign-cell";
                    const dropdown = this.buildAssignDropdown(line, assignments, people, lineModes, handlers);
                    assignCell.append(dropdown);
                    const amount = document.createElement("span");
                    amount.className = "amount-cell";
                    amount.textContent = this.currencyFormatService.format(line.amount);
                    const ignore = document.createElement("button");
                    ignore.className = "icon-button delete-row";
                    ignore.type = "button";
                    ignore.textContent = line.ignored ? "+" : "x";
                    ignore.setAttribute("aria-label", line.ignored ? "Restore line" : "Ignore line");
                    ignore.addEventListener("click", () => handlers.onLineIgnore(line.id));
                    row.append(select, name, foodCheck, assignCell, amount, ignore);
                    container.append(row);
                    if (openLineIds.has(line.id)) {
                        dropdown.open = true;
                        this.anchorDropdown(dropdown);
                    }
                    if (openDetailLineIds.has(line.id)) {
                        const detail = name.querySelector("details.item-detail-dropdown");
                        if (detail) {
                            detail.open = true;
                            this.anchorDropdown(detail);
                        }
                    }
                });
            }
            buildLabelCell(line, identification, handlers) {
                const stack = document.createElement("span");
                stack.className = "line-label-stack";
                const name = document.createElement("span");
                name.className = "line-label";
                name.textContent = line.label;
                stack.append(name);
                const showsResolved = identification !== undefined &&
                    identification.source !== "unresolved" &&
                    !this.saysTheSameThing(identification.resolvedName, line.label);
                if (showsResolved && identification) {
                    const resolved = document.createElement("span");
                    resolved.className = "line-resolved";
                    resolved.classList.toggle("is-confirmed", identification.confirmed);
                    resolved.textContent = this.describeIdentification(identification);
                    const chip = this.buildConfidenceChip(identification);
                    if (chip)
                        resolved.append(" ", chip);
                    stack.append(resolved);
                }
                if (!identification) {
                    const cell = document.createElement("span");
                    cell.className = "line-label-cell";
                    cell.append(stack);
                    return cell;
                }
                return this.buildItemDetail(line, identification, stack, handlers);
            }
            buildItemDetail(line, identification, stack, handlers) {
                const details = document.createElement("details");
                details.className = "item-detail-dropdown";
                details.dataset.lineId = line.id;
                const summary = document.createElement("summary");
                summary.className = "item-detail-summary";
                summary.title = "What is this item?";
                summary.append(stack);
                details.append(summary);
                const panel = document.createElement("div");
                panel.className = "item-detail-pop";
                panel.append(this.buildItemDetailBody(line, identification, handlers));
                details.append(panel);
                this.wirePopover(details, summary, panel);
                const cell = document.createElement("span");
                cell.className = "line-label-cell";
                cell.append(details);
                return cell;
            }
            buildItemDetailBody(line, identification, handlers) {
                const body = document.createElement("div");
                body.className = "item-detail-body";
                const heading = document.createElement("p");
                heading.className = "item-detail-name";
                heading.textContent =
                    identification.source === "unresolved" ? "Not identified" : identification.resolvedName;
                body.append(heading);
                const facts = document.createElement("dl");
                facts.className = "item-detail-facts";
                this.appendFact(facts, "On the receipt", line.label);
                if (line.itemCode)
                    this.appendFact(facts, "Item code", line.itemCode);
                if (identification.brand)
                    this.appendFact(facts, "Brand", identification.brand);
                if (identification.size)
                    this.appendFact(facts, "Size", identification.size);
                this.appendFact(facts, "Price", this.currencyFormatService.format(line.amount));
                body.append(facts);
                const source = document.createElement("p");
                source.className = "item-detail-source";
                source.textContent = this.describeSource(identification);
                body.append(source);
                if (identification.reasoning) {
                    const reasoning = document.createElement("p");
                    reasoning.className = "item-detail-reasoning";
                    reasoning.textContent = identification.reasoning;
                    body.append(reasoning);
                }
                if (identification.alternatives.length > 0) {
                    body.append(this.buildAlternatives(line, identification, handlers));
                }
                body.append(this.buildIdentificationForm(line, identification, handlers));
                return body;
            }
            buildAlternatives(line, identification, handlers) {
                const group = document.createElement("div");
                group.className = "item-detail-alternatives";
                const label = document.createElement("span");
                label.className = "item-detail-subhead";
                label.textContent = identification.source === "unresolved" ? "Best guess" : "Or maybe";
                group.append(label);
                identification.alternatives.forEach((candidate) => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "item-detail-alternative";
                    button.textContent = candidate.name;
                    button.title = `Use "${candidate.name}" and remember it`;
                    button.addEventListener("click", () => handlers.onIdentificationConfirm(line.id, candidate.name));
                    group.append(button);
                });
                return group;
            }
            buildIdentificationForm(line, identification, handlers) {
                const form = document.createElement("form");
                form.className = "item-detail-form";
                const input = document.createElement("input");
                input.type = "text";
                input.className = "table-input";
                input.value =
                    identification.source === "unresolved" ? "" : identification.resolvedName;
                input.placeholder = "What is this item?";
                input.setAttribute("aria-label", `Name for ${line.label}`);
                const actions = document.createElement("div");
                actions.className = "item-detail-actions";
                const confirm = document.createElement("button");
                confirm.type = "submit";
                confirm.className = "btn btn-primary btn-small";
                confirm.textContent = identification.confirmed ? "Update" : "This is right";
                actions.append(confirm);
                if (identification.confirmed) {
                    const forget = document.createElement("button");
                    forget.type = "button";
                    forget.className = "btn btn-ghost btn-small";
                    forget.textContent = "Forget";
                    forget.title = "Stop remembering this name for this item";
                    forget.addEventListener("click", () => handlers.onIdentificationClear(line.id));
                    actions.append(forget);
                }
                form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    const name = input.value.trim();
                    if (!name)
                        return;
                    handlers.onIdentificationConfirm(line.id, name);
                });
                form.append(input, actions);
                return form;
            }
            appendFact(list, label, value) {
                const term = document.createElement("dt");
                term.textContent = label;
                const definition = document.createElement("dd");
                definition.textContent = value;
                list.append(term, definition);
            }
            describeSource(identification) {
                const percent = Math.round(identification.confidence * 100);
                switch (identification.source) {
                    case "user-confirmed":
                        return "You confirmed this name.";
                    case "saved-alias":
                        return "From a name you saved earlier.";
                    case "dictionary":
                        return `Expanded from receipt shorthand - ${percent}% confident.`;
                    case "ai":
                        return `Identified by AI - ${percent}% confident.`;
                    default:
                        return "Nobody could work out what this is.";
                }
            }
            buildConfidenceChip(identification) {
                if (identification.confirmed)
                    return null;
                const band = confidenceBand(identification.confidence);
                if (band === "sure")
                    return null;
                const chip = document.createElement("span");
                chip.className = `confidence-chip is-${band}`;
                const percent = Math.round(identification.confidence * 100);
                chip.textContent = `${percent}%`;
                chip.title =
                    band === "likely"
                        ? `Fairly sure -- ${percent}% confident. Click the item to check it.`
                        : `Not sure -- ${percent}% confident. Worth checking by hand.`;
                chip.setAttribute("aria-label", `${percent} percent confident`);
                return chip;
            }
            describeIdentification(identification) {
                return identification.size
                    ? `${identification.resolvedName} - ${identification.size}`
                    : identification.resolvedName;
            }
            saysTheSameThing(left, right) {
                const flatten = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
                return flatten(left) === flatten(right);
            }
            buildAssignDropdown(line, assignments, people, lineModes, handlers) {
                const lineAssignments = assignments.filter((assignment) => assignment.lineId === line.id);
                const mode = lineModes.get(line.id) ?? "equal";
                const details = document.createElement("details");
                details.className = "assign-dropdown";
                details.dataset.lineId = line.id;
                const summary = document.createElement("summary");
                summary.className = "assign-summary";
                summary.textContent = this.getAssignmentSummary(lineAssignments, people);
                details.append(summary);
                const panel = document.createElement("div");
                panel.className = "assign-panel-pop";
                this.wirePopover(details, summary, panel);
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
            renderBatchActions(container, people, assignStates, lineState, handlers) {
                container.innerHTML = "";
                if (people.length === 0) {
                    const hint = document.createElement("span");
                    hint.className = "batch-hint";
                    hint.textContent = "Add people to assign these lines to.";
                    container.append(hint);
                    container.append(this.buildBatchFlagButtons(lineState, handlers));
                    return;
                }
                const label = document.createElement("span");
                label.className = "batch-label";
                label.textContent = "Assign to";
                container.append(label);
                people.forEach((person) => {
                    const state = assignStates.get(person.id) ?? "none";
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = `batch-person is-${state}`;
                    button.setAttribute("aria-pressed", state === "all" ? "true" : state === "some" ? "mixed" : "false");
                    button.title =
                        state === "all"
                            ? `Take ${person.name} off the selected lines`
                            : `Put ${person.name} on the selected lines`;
                    button.textContent = person.name;
                    button.addEventListener("click", () => handlers.onBatchAssign(person.id));
                    container.append(button);
                });
                container.append(this.buildBatchFlagButtons(lineState, handlers));
            }
            buildBatchFlagButtons(lineState, handlers) {
                const group = document.createElement("span");
                group.className = "batch-flags";
                const food = document.createElement("button");
                food.type = "button";
                food.className = "btn btn-secondary btn-small";
                food.textContent = lineState.allFood ? "Not food" : "Food";
                food.disabled = !lineState.hasActive;
                food.title = lineState.allFood
                    ? "Stop counting the selected lines as food"
                    : "Count the selected lines as food";
                food.addEventListener("click", () => handlers.onBatchFood(!lineState.allFood));
                const ignore = document.createElement("button");
                ignore.type = "button";
                ignore.className = "btn btn-secondary btn-small";
                ignore.textContent = lineState.allIgnored ? "Restore" : "Ignore";
                ignore.title = lineState.allIgnored
                    ? "Put the selected lines back on the receipt"
                    : "Leave the selected lines out of the split";
                ignore.addEventListener("click", () => handlers.onBatchIgnore(!lineState.allIgnored));
                const identify = document.createElement("button");
                identify.type = "button";
                identify.className = "btn btn-secondary btn-small";
                identify.textContent = "Identify";
                identify.disabled = !lineState.hasActive;
                identify.title = "Work out what the selected items actually are";
                identify.addEventListener("click", () => handlers.onBatchIdentify());
                group.append(food, ignore, identify);
                return group;
            }
            renderPeople(container, people, handlers) {
                container.innerHTML = "";
                people.forEach((person) => {
                    const row = document.createElement("div");
                    row.className = "person-chip";
                    row.classList.toggle("is-self", Boolean(person.isSelf));
                    const label = document.createElement("span");
                    label.textContent = person.name;
                    row.append(label);
                    if (person.isSelf) {
                        const you = document.createElement("span");
                        you.className = "person-chip-you";
                        you.textContent = "You";
                        row.append(you);
                    }
                    else {
                        const remove = document.createElement("button");
                        remove.type = "button";
                        remove.textContent = "x";
                        remove.setAttribute("aria-label", `Remove ${person.name}`);
                        remove.addEventListener("click", () => handlers.onPersonDelete(person.id));
                        row.append(remove);
                    }
                    container.append(row);
                });
            }
            renderTotals(container, summary) {
                container.innerHTML = "";
                const anyFood = summary.totals.some((total) => total.foodTotal > 0);
                const anyTax = summary.totals.some((total) => total.allocatedTax !== 0);
                const foodLabel = anyTax ? "Food (incl. tax)" : "Food";
                summary.totals.forEach((total) => {
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
                    row.append(name, items);
                    if (anyFood) {
                        const food = document.createElement("span");
                        food.className = "is-food-line";
                        food.textContent = `${foodLabel} ${this.currencyFormatService.format(total.foodTotal)}`;
                        row.append(food);
                    }
                    row.append(tax, final);
                    container.append(row);
                });
                if (Math.abs(summary.unallocated) >= 0.01) {
                    const row = document.createElement("div");
                    row.className = "split-total-row is-unallocated";
                    const name = document.createElement("strong");
                    name.textContent = "Unallocated";
                    const detail = document.createElement("span");
                    detail.textContent = "Not covered by the amounts entered";
                    const spacer = document.createElement("span");
                    const value = document.createElement("b");
                    value.textContent = this.currencyFormatService.format(summary.unallocated);
                    row.append(name, detail, spacer, value);
                    container.append(row);
                }
                if (summary.totals.length > 0) {
                    container.append(this.buildReconciliation(summary));
                }
            }
            buildReconciliation(summary) {
                const block = document.createElement("div");
                block.className = "split-reconcile";
                block.classList.toggle("is-balanced", summary.isBalanced);
                const addLine = (label, amount, variant = "") => {
                    const line = document.createElement("div");
                    line.className = variant ? `split-reconcile-line ${variant}` : "split-reconcile-line";
                    const text = document.createElement("span");
                    text.textContent = label;
                    const value = document.createElement("b");
                    value.textContent = this.currencyFormatService.format(amount);
                    line.append(text, value);
                    block.append(line);
                };
                addLine("Split across everyone", summary.assignedTotal);
                addLine("Receipt total", summary.receiptTotal);
                const status = document.createElement("div");
                status.className = "split-reconcile-status";
                if (summary.isBalanced) {
                    status.textContent = "Balanced — the split matches the receipt.";
                }
                else {
                    const gap = summary.receiptTotal - summary.assignedTotal;
                    const amount = this.currencyFormatService.format(Math.abs(gap));
                    status.textContent =
                        gap > 0
                            ? `${amount} of the receipt is not on anyone's tab yet.`
                            : `The split is over the receipt total by ${amount}.`;
                }
                block.append(status);
                return block;
            }
            renderHistory(container, receipts, onDelete, onLineFood, onLinkTransaction, onUnlinkTransaction) {
                container.innerHTML = "";
                receipts.forEach((receipt) => {
                    const card = document.createElement("details");
                    card.className = "history-card";
                    card.draggable = true;
                    card.addEventListener("dragstart", (event) => {
                        if (event.dataTransfer) {
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("text/plain", receipt.id);
                        }
                    });
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
                    if (receipt.linkedTransaction) {
                        card.classList.add("is-linked");
                        const linked = document.createElement("span");
                        linked.className = "history-linked-tag";
                        linked.title = `Attached to ${receipt.linkedTransaction.description ?? "a bank transaction"}`;
                        linked.textContent = "Linked";
                        heading.append(linked);
                    }
                    const total = document.createElement("b");
                    total.className = "history-total";
                    total.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));
                    summary.append(heading, total);
                    card.append(summary);
                    const body = document.createElement("div");
                    body.className = "history-body";
                    if (receipt.hasImage) {
                        const figure = document.createElement("a");
                        figure.className = "history-image";
                        figure.href = this.receiptApiService.imageUrl(receipt.id);
                        figure.target = "_blank";
                        figure.rel = "noopener";
                        figure.title = "Open the full-size receipt photo";
                        const photo = document.createElement("img");
                        photo.src = figure.href;
                        photo.loading = "lazy";
                        photo.alt = `Photo of the receipt from ${receipt.storeName || "an unknown store"}`;
                        figure.append(photo);
                        body.append(figure);
                    }
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
                            label.className = "history-line-label";
                            const printed = document.createElement("span");
                            printed.textContent = line.label;
                            label.append(printed);
                            const identified = line.identification;
                            if (identified?.resolvedName && !this.saysTheSameThing(identified.resolvedName, line.label)) {
                                const resolved = document.createElement("span");
                                resolved.className = "line-resolved";
                                resolved.classList.toggle("is-confirmed", Boolean(identified.confirmed));
                                resolved.textContent = identified.size
                                    ? `${identified.resolvedName} - ${identified.size}`
                                    : identified.resolvedName;
                                label.append(resolved);
                            }
                            const foodCheck = document.createElement("button");
                            foodCheck.className = "line-food-check";
                            foodCheck.type = "button";
                            foodCheck.setAttribute("aria-label", line.isFood ? "Mark as non-food" : "Mark as food");
                            foodCheck.setAttribute("aria-pressed", String(line.isFood ?? false));
                            foodCheck.innerHTML = SplitWorkspaceView.getFoodCheckIcon(line.isFood ?? false);
                            if (onLineFood) {
                                foodCheck.addEventListener("click", () => onLineFood(receipt.id, line.id, !(line.isFood ?? false)));
                            }
                            else {
                                foodCheck.disabled = true;
                            }
                            const peopleSpan = document.createElement("span");
                            peopleSpan.className = "history-line-people";
                            peopleSpan.textContent = names.length ? names.join(", ") : "Unassigned";
                            const amountEl = document.createElement("b");
                            amountEl.textContent = this.currencyFormatService.format(Number(line.amount));
                            lineRow.append(label, foodCheck, peopleSpan, amountEl);
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
                    const linked = receipt.linkedTransaction;
                    if (linked) {
                        const detail = document.createElement("div");
                        detail.className = "history-linked-detail";
                        const what = linked.description ?? "Bank transaction";
                        const when = new Date(`${linked.date}T00:00:00`).toLocaleDateString();
                        detail.textContent = `Attached to ${what} · ${when} · ${this.currencyFormatService.format(linked.amount)}`;
                        body.append(detail);
                    }
                    if (onDelete || onLinkTransaction || onUnlinkTransaction) {
                        const actions = document.createElement("div");
                        actions.className = "history-actions";
                        if (linked && onUnlinkTransaction) {
                            const unlink = document.createElement("button");
                            unlink.type = "button";
                            unlink.className = "btn btn-secondary btn-small";
                            unlink.textContent = "Unlink transaction";
                            unlink.addEventListener("click", () => onUnlinkTransaction(receipt));
                            actions.append(unlink);
                        }
                        else if (!linked && onLinkTransaction) {
                            const link = document.createElement("button");
                            link.type = "button";
                            link.className = "btn btn-secondary btn-small";
                            link.textContent = "Link to transaction";
                            link.addEventListener("click", () => onLinkTransaction(receipt));
                            actions.append(link);
                        }
                        if (onDelete) {
                            const deleteButton = document.createElement("button");
                            deleteButton.type = "button";
                            deleteButton.className = "btn btn-danger btn-small";
                            deleteButton.textContent = "Delete receipt";
                            deleteButton.addEventListener("click", () => onDelete(receipt));
                            actions.append(deleteButton);
                        }
                        body.append(actions);
                    }
                    card.append(body);
                    container.append(card);
                });
            }
            wirePopover(details, summary, panel) {
                const reposition = () => {
                    if (!details.isConnected) {
                        this.teardownPanelPositioning(reposition);
                        return;
                    }
                    const summaryRect = summary.getBoundingClientRect();
                    if (summaryRect.bottom < 0 || summaryRect.top > window.innerHeight) {
                        details.open = false;
                        return;
                    }
                    this.positionPanel(summary, panel);
                };
                details.addEventListener("toggle", () => {
                    if (details.open) {
                        this.closeOtherDropdowns(details);
                        this.positionPanel(summary, panel);
                        const signal = this.panelListeners?.signal;
                        window.addEventListener("scroll", reposition, { capture: true, signal });
                        window.addEventListener("resize", reposition, { signal });
                    }
                    else {
                        this.teardownPanelPositioning(reposition);
                        this.resetPanelPosition(panel);
                    }
                });
            }
            anchorDropdown(details) {
                const summary = details.querySelector("summary");
                const panel = details.querySelector(".assign-panel-pop, .item-detail-pop");
                if (summary && panel)
                    this.positionPanel(summary, panel);
            }
            positionPanel(summary, panel) {
                const margin = 8;
                const summaryRect = summary.getBoundingClientRect();
                panel.style.position = "fixed";
                panel.style.maxHeight = "";
                panel.style.width = `${Math.max(230, summaryRect.width)}px`;
                panel.style.top = "0px";
                panel.style.left = "0px";
                const origin = panel.getBoundingClientRect();
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
                const panelWidth = origin.width;
                const left = Math.max(margin, Math.min(summaryRect.left, viewportWidth - margin - panelWidth));
                panel.style.top = `${top - origin.top}px`;
                panel.style.left = `${left - origin.left}px`;
                panel.style.overflowY = "auto";
                panel.classList.add("is-anchored");
            }
            resetPanelPosition(panel) {
                panel.classList.remove("is-anchored");
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
                    .querySelectorAll(SplitWorkspaceView.POPOVER_SELECTOR.split(", ")
                    .map((selector) => `${selector}[open]`)
                    .join(", "))
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
            static getFoodCheckIcon(isFood) {
                const box = isFood
                    ? `<rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/>
           <path d="m7.5 12.4 3 3 6-6.5" fill="none" stroke="var(--surface)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
                    : `<rect x="3.9" y="3.9" width="16.2" height="16.2" rx="4.4" fill="none" stroke="currentColor" stroke-width="1.8"/>`;
                return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="food-check-icon" aria-hidden="true">${box}</svg>`;
            }
        }
        SplitWorkspaceView.POPOVER_SELECTOR = "details.assign-dropdown, details.item-detail-dropdown";
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
                this.activeResolve?.(null);
                this.activeResolve = null;
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
                document.addEventListener("keydown", (event) => {
                    if (this.activeResolve === null)
                        return;
                    if (event.key === "Escape") {
                        this.closePrompt(null);
                        return;
                    }
                    if (event.key === "Tab") {
                        this.keepFocusInDialog(event);
                    }
                });
                this.elements.categoryPrompt.addEventListener("click", (event) => {
                    if (event.target === this.elements.categoryPrompt) {
                        this.closePrompt(null);
                    }
                });
            }
            keepFocusInDialog(event) {
                const focusable = this.elements.categoryPrompt.querySelectorAll("select, input, button, [href], textarea, [tabindex]:not([tabindex='-1'])");
                if (focusable.length === 0)
                    return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement;
                if (event.shiftKey && (active === first || !this.elements.categoryPrompt.contains(active))) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && (active === last || !this.elements.categoryPrompt.contains(active))) {
                    event.preventDefault();
                    first.focus();
                }
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
        class RentEntriesView {
            constructor(currencyFormatService) {
                this.currencyFormatService = currencyFormatService;
            }
            render(container, entries) {
                container.innerHTML = "";
                if (entries.length === 0) {
                    const empty = document.createElement("div");
                    empty.className = "empty-state";
                    const icon = document.createElement("svg");
                    icon.className = "empty-icon";
                    icon.setAttribute("viewBox", "0 0 24 24");
                    icon.setAttribute("fill", "none");
                    icon.setAttribute("aria-hidden", "true");
                    icon.innerHTML = `
          <path d="M9 3.5h6a2 2 0 0 1 2 2v13l-1.6-1.2-1.6 1.2-1.2-1.2-1.2 1.2-1.6-1.2-1.6 1.2v-13a2 2 0 0 1 2-2Z"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M9 8h6M9 11h6M9 14h3"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        `;
                    const title = document.createElement("strong");
                    title.textContent = "No rent entries";
                    const detail = document.createElement("span");
                    detail.textContent = "Add your first monthly rent payment to start tracking.";
                    empty.append(icon, title, detail);
                    container.append(empty);
                    return;
                }
                for (const entry of entries) {
                    const row = document.createElement("div");
                    row.className = "rent-entry-row";
                    const main = document.createElement("div");
                    main.className = "rent-entry-main";
                    const header = document.createElement("div");
                    header.className = "rent-entry-header";
                    const date = document.createElement("span");
                    date.className = "rent-entry-date";
                    date.textContent = this.formatDate(entry.date);
                    const propertyName = document.createElement("span");
                    propertyName.className = "rent-entry-property";
                    propertyName.textContent = entry.propertyName || "Rent payment";
                    header.append(date, propertyName);
                    const meta = document.createElement("span");
                    meta.className = "rent-entry-meta";
                    const photoIndicator = document.createElement("span");
                    photoIndicator.className = "rent-entry-photo-indicator";
                    if (entry.hasPhoto) {
                        photoIndicator.textContent = "📎";
                        photoIndicator.setAttribute("title", "Proof of payment attached");
                    }
                    meta.append(photoIndicator);
                    header.append(meta);
                    main.append(header);
                    const amount = document.createElement("span");
                    amount.className = "rent-entry-amount";
                    amount.textContent = this.currencyFormatService.format(entry.amount);
                    const actions = document.createElement("div");
                    actions.className = "rent-entry-actions";
                    const editButton = document.createElement("button");
                    editButton.type = "button";
                    editButton.className = "btn btn-ghost btn-small";
                    editButton.textContent = "Edit";
                    editButton.setAttribute("aria-label", `Edit rent entry for ${this.formatDate(entry.date)}`);
                    editButton.dataset.entryId = entry.id;
                    const deleteButton = document.createElement("button");
                    deleteButton.type = "button";
                    deleteButton.className = "btn btn-ghost btn-small";
                    deleteButton.textContent = "Delete";
                    deleteButton.setAttribute("aria-label", `Delete rent entry for ${this.formatDate(entry.date)}`);
                    deleteButton.dataset.entryId = entry.id;
                    actions.append(editButton, deleteButton);
                    row.append(main, amount, actions);
                    container.append(row);
                }
            }
            renderForm(modal, entry) {
                const title = modal.querySelector("#rentEntryTitle");
                const dateInput = modal.querySelector("#rentEntryDate");
                const amountInput = modal.querySelector("#rentEntryAmount");
                const propertyInput = modal.querySelector("#rentEntryProperty");
                const photoInput = modal.querySelector("#rentEntryPhoto");
                if (entry) {
                    title.textContent = "Edit rent payment";
                    dateInput.value = entry.date;
                    amountInput.value = String(entry.amount);
                    propertyInput.value = entry.propertyName || "";
                    photoInput.value = "";
                }
                else {
                    title.textContent = "Add rent payment";
                    dateInput.value = "";
                    amountInput.value = "";
                    propertyInput.value = "";
                    photoInput.value = "";
                }
            }
            formatDate(dateString) {
                const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
                if (!match)
                    return dateString;
                const [, year, month, day] = match;
                return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                });
            }
        }
        UI.RentEntriesView = RentEntriesView;
    })(UI = ReceiptRing.UI || (ReceiptRing.UI = {}));
})(ReceiptRing || (ReceiptRing = {}));
var ReceiptRing;
(function (ReceiptRing) {
    var App;
    (function (App) {
        const RECEIPT_TAG_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M6 3.5h12a1 1 0 0 1 1 1v15l-2.4-1.6-2.4 1.6-2.2-1.6-2.2 1.6-2.4-1.6L5 20.5v-16a1 1 0 0 1 1-1Z"
        fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M8.6 8.2h6.8M8.6 11.6h6.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;
        class AppController {
            constructor(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, receiptImageService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, lineSelectionService, idService, receiptApiService, bankApiService, spendingAggregatorService, budgetRingView, monthlyTrendView, peopleApiService, rentEntryApiService, rentEntriesView, notificationService, itemIdentityService, itemAliasStoreService) {
                this.elements = elements;
                this.parserService = parserService;
                this.categorizationService = categorizationService;
                this.categoryRuleStorageService = categoryRuleStorageService;
                this.storageService = storageService;
                this.currencyFormatService = currencyFormatService;
                this.imagePreviewService = imagePreviewService;
                this.receiptImageService = receiptImageService;
                this.geminiService = geminiService;
                this.categoryPromptView = categoryPromptView;
                this.splitWorkspaceView = splitWorkspaceView;
                this.splitCalculatorService = splitCalculatorService;
                this.lineSelectionService = lineSelectionService;
                this.idService = idService;
                this.receiptApiService = receiptApiService;
                this.bankApiService = bankApiService;
                this.spendingAggregatorService = spendingAggregatorService;
                this.budgetRingView = budgetRingView;
                this.monthlyTrendView = monthlyTrendView;
                this.peopleApiService = peopleApiService;
                this.rentEntryApiService = rentEntryApiService;
                this.rentEntriesView = rentEntriesView;
                this.notificationService = notificationService;
                this.itemIdentityService = itemIdentityService;
                this.itemAliasStoreService = itemAliasStoreService;
                this.receiptLines = [];
                this.people = [];
                this.assignments = [];
                this.lineModes = new Map();
                this.foodFlags = new Map();
                this.identifications = new Map();
                this.isIdentifying = false;
                this.isParsing = false;
                this.failedParseFile = null;
                this.parseRetryCount = 0;
                this.retryAvailableAt = 0;
                this.retryCountdownTimer = null;
                this.receiptCategory = "Groceries";
                this.cameraStream = null;
                this.isPromptingForCategories = false;
                this.reviewTimer = null;
                this.bankTransactions = [];
                this.bankConnections = [];
                this.monthlySpend = [];
                this.selectedMonth = null;
                this.serverHasGeminiKey = false;
                this.userHasGeminiKey = false;
                this.receiptImage = null;
                this.editingReceipt = null;
                this.rentEntries = [];
                this.rentMonths = new Set();
                this.editingRentEntryId = null;
                this.receipts = [];
                this.rentEntryByTransaction = new Map();
                this.linkingTransactionId = null;
                this.linkingReceiptId = null;
                this.attachingTransactionId = null;
                this.items = this.storageService.load();
            }
            start() {
                this.bindEvents();
                this.render();
                void this.initGeminiSettings();
                void this.loadPeople();
                void this.itemAliasStoreService.load();
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
                this.elements.retryParseButton.addEventListener("click", () => void this.retryParse());
                this.elements.parseButton.addEventListener("click", () => this.itemizeReceiptText());
                this.elements.clearButton.addEventListener("click", () => this.clearReceipt());
                this.elements.selectAllLines.addEventListener("change", () => this.toggleSelectAll());
                this.elements.batchClearButton.addEventListener("click", () => this.clearLineSelection());
                this.elements.identifyItemsButton.addEventListener("click", () => void this.identifyItems());
                document.addEventListener("keydown", (event) => {
                    if (event.key !== "Escape" || this.lineSelectionService.count === 0)
                        return;
                    if (document.querySelector(".modal-backdrop:not(.hidden)"))
                        return;
                    const active = document.activeElement;
                    if (active instanceof HTMLInputElement && active.type !== "checkbox")
                        return;
                    if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)
                        return;
                    this.clearLineSelection();
                });
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
                this.elements.pasteJsonButton.addEventListener("click", () => this.openPasteJsonModal());
                this.elements.closePasteJsonButton.addEventListener("click", () => this.closePasteJsonModal());
                this.elements.importPasteJsonButton.addEventListener("click", () => this.importPastedJson());
                this.elements.saveReceiptButton.addEventListener("click", () => void this.saveReceipt());
                this.elements.refreshHistoryButton.addEventListener("click", () => void this.loadHistory());
                this.elements.connectBankButton.addEventListener("click", () => void this.connectBank());
                this.elements.refreshTransactionsButton.addEventListener("click", () => void this.refreshTransactions());
                this.elements.budgetMonth.addEventListener("change", () => {
                    this.selectMonth(this.elements.budgetMonth.value || null);
                });
                this.elements.addRentEntryButton.addEventListener("click", () => this.openRentEntryForm());
                this.elements.rentEntryCancelButton.addEventListener("click", () => this.closeRentEntryModal());
                this.elements.rentEntrySaveButton.addEventListener("click", () => void this.saveRentEntry());
                this.elements.rentEntriesList.addEventListener("click", (event) => {
                    const target = event.target;
                    if (target.textContent === "Edit") {
                        const entryId = target.dataset.entryId;
                        const entry = this.rentEntries.find((e) => e.id === entryId);
                        if (entry)
                            this.openRentEntryForm(entry);
                    }
                    else if (target.textContent === "Delete") {
                        const entryId = target.dataset.entryId;
                        const entry = this.rentEntries.find((e) => e.id === entryId);
                        if (entry)
                            void this.deleteRentEntry(entry);
                    }
                });
                this.elements.transactionReceiptFile.addEventListener("change", () => {
                    const file = this.elements.transactionReceiptFile.files?.[0];
                    if (file)
                        void this.attachReceiptFile(file);
                });
                document.addEventListener("click", (event) => {
                    const target = event.target;
                    if (target instanceof Node && this.elements.transactionsList.contains(target))
                        return;
                    this.closeTransactionMenus();
                });
                this.elements.receiptLinkCancelButton.addEventListener("click", () => this.closeReceiptLinkModal());
                this.elements.transactionLinkCancelButton.addEventListener("click", () => this.closeTransactionLinkModal());
                this.elements.receiptLinkList.addEventListener("click", (event) => {
                    const target = event.target;
                    const button = target.closest(".receipt-link-item");
                    if (button instanceof HTMLElement && button.dataset.receiptId) {
                        void this.selectReceiptForLink(button.dataset.receiptId);
                    }
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
                this.bindEducationSectionToggles();
            }
            bindEducationSectionToggles() {
                document.querySelectorAll(".section-toggle").forEach((toggle) => {
                    toggle.addEventListener("click", () => {
                        const section = toggle.closest(".education-section");
                        if (!section)
                            return;
                        const collapsed = section.classList.toggle("is-collapsed");
                        toggle.setAttribute("aria-expanded", String(!collapsed));
                    });
                });
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
                this.elements.receiptImage.value = "";
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
                this.identifications.clear();
                this.lineSelectionService.clear();
                this.receiptImage = null;
                this.failedParseFile = null;
                this.resetRetryBackoff();
                this.hideOcrStatus();
                this.stopEditing();
            }
            setItemsFromParse(items) {
                this.stopEditing();
                this.items = items;
                this.receiptLines = this.items.map((item) => ({
                    id: item.id,
                    label: item.label,
                    amount: item.amount,
                    ...(item.itemCode ? { itemCode: item.itemCode } : {}),
                    confidence: item.categorizationConfidence * 100,
                    ignored: false
                }));
                this.assignments = [];
                this.lineModes.clear();
                this.foodFlags.clear();
                this.identifications.clear();
                this.lineSelectionService.clear();
            }
            itemizeReceiptText() {
                this.setItemsFromParse(this.parserService.parse(this.elements.receiptText.value));
                this.render();
            }
            clearReceipt() {
                this.elements.receiptText.value = "";
                this.elements.storeNameInput.value = "";
                this.items = [];
                this.clearImage();
                this.setSaveStatus("");
                this.render();
            }
            render() {
                this.storageService.save(this.items);
                this.renderWorkspace();
                this.renderTotals();
            }
            renderWorkspace() {
                this.lineSelectionService.prune(this.receiptLines);
                this.elements.emptyState.classList.toggle("hidden", this.receiptLines.length > 0);
                this.elements.itemCount.textContent = `${this.receiptLines.length} ${this.receiptLines.length === 1 ? "line" : "lines"}`;
                const handlers = {
                    onLineSelectToggle: (lineId, extend) => this.toggleLineSelection(lineId, extend),
                    onLineIgnore: (lineId) => this.toggleIgnoredLine(lineId),
                    onPersonDelete: (personId) => this.deletePerson(personId),
                    onAssignToggle: (lineId, personId) => this.toggleAssignment(lineId, personId),
                    onLineModeChange: (lineId, mode) => this.setLineMode(lineId, mode),
                    onAssignValueChange: (lineId, personId, value) => this.setAssignmentValue(lineId, personId, value),
                    onLineFood: (lineId, isFood) => this.toggleLineFood(lineId, isFood),
                    onBatchAssign: (personId) => this.toggleSelectedLinesFor(personId),
                    onBatchFood: (isFood) => this.setSelectedLinesFood(isFood),
                    onBatchIgnore: (ignored) => this.setSelectedLinesIgnored(ignored),
                    onIdentificationConfirm: (lineId, name) => this.confirmIdentification(lineId, name),
                    onIdentificationClear: (lineId) => this.clearIdentification(lineId),
                    onBatchIdentify: () => void this.identifyItems(this.getSelectedLines())
                };
                this.splitWorkspaceView.renderLines(this.elements.receiptLinesList, this.receiptLines, this.assignments, this.people, this.lineModes, new Set(this.lineSelectionService.ids()), this.identifications, handlers);
                this.splitWorkspaceView.renderPeople(this.elements.peopleList, this.people, handlers);
                this.renderSelectAll();
                this.renderBatchBar(handlers);
            }
            renderBatchBar(handlers) {
                const count = this.lineSelectionService.count;
                this.elements.batchBar.classList.toggle("hidden", count === 0);
                if (count === 0)
                    return;
                this.elements.batchCount.textContent = `${count} ${count === 1 ? "line" : "lines"} selected`;
                this.splitWorkspaceView.renderBatchActions(this.elements.batchActions, this.people, this.getBatchAssignStates(), this.getBatchLineState(), handlers);
            }
            getBatchAssignStates() {
                const targets = this.getSelectedLines();
                const states = new Map();
                this.people.forEach((person) => {
                    const held = targets.filter((line) => this.assignments.some((assignment) => assignment.lineId === line.id && assignment.personId === person.id)).length;
                    states.set(person.id, held === 0 ? "none" : targets.length > 0 && held === targets.length ? "all" : "some");
                });
                return states;
            }
            toggleSelectedLinesFor(personId) {
                if (this.getBatchAssignStates().get(personId) === "all") {
                    this.unassignSelectedLinesFrom(personId);
                }
                else {
                    this.assignSelectedLinesTo(personId);
                }
            }
            unassignSelectedLinesFrom(personId) {
                const targetIds = new Set(this.getSelectedLines().map((line) => line.id));
                this.assignments = this.assignments.filter((assignment) => !(assignment.personId === personId && targetIds.has(assignment.lineId)));
                this.render();
            }
            assignSelectedLinesTo(personId) {
                const targets = this.getSelectedLines();
                const additions = [];
                targets.forEach((line) => {
                    const already = this.assignments.some((assignment) => assignment.lineId === line.id && assignment.personId === personId);
                    if (already)
                        return;
                    additions.push({
                        id: this.idService.create(),
                        lineId: line.id,
                        personId,
                        mode: this.lineModes.get(line.id) ?? "equal",
                        value: 0
                    });
                });
                if (additions.length === 0)
                    return;
                this.assignments = [...this.assignments, ...additions];
                this.render();
            }
            getBatchLineState() {
                const active = this.getSelectedLines();
                const all = this.getSelectedLines(true);
                return {
                    hasActive: active.length > 0,
                    allFood: active.length > 0 && active.every((line) => line.isFood === true),
                    allIgnored: all.length > 0 && all.every((line) => line.ignored)
                };
            }
            setSelectedLinesFood(isFood) {
                const targetIds = new Set(this.getSelectedLines().map((line) => line.id));
                if (targetIds.size === 0)
                    return;
                targetIds.forEach((lineId) => this.foodFlags.set(lineId, isFood));
                this.receiptLines = this.receiptLines.map((line) => targetIds.has(line.id) ? { ...line, isFood } : line);
                this.render();
            }
            setSelectedLinesIgnored(ignored) {
                const targetIds = new Set(this.getSelectedLines(true).map((line) => line.id));
                if (targetIds.size === 0)
                    return;
                this.receiptLines = this.receiptLines.map((line) => targetIds.has(line.id) ? { ...line, ignored } : line);
                if (ignored) {
                    this.assignments = this.assignments.filter((assignment) => !targetIds.has(assignment.lineId));
                }
                this.render();
            }
            toStoredIdentification(identification) {
                if (!identification || identification.source === "unresolved")
                    return null;
                return {
                    resolvedName: identification.resolvedName,
                    brand: identification.brand ?? null,
                    size: identification.size ?? null,
                    confidence: identification.confidence,
                    source: identification.source,
                    reasoning: identification.reasoning ?? null,
                    alternatives: identification.alternatives,
                    confirmed: identification.confirmed
                };
            }
            async identifyItems(lines) {
                if (this.isIdentifying)
                    return;
                const target = lines ?? this.receiptLines;
                if (target.length === 0) {
                    this.notificationService.info("Itemize a receipt first, then identify its items.");
                    return;
                }
                this.isIdentifying = true;
                this.elements.identifyItemsButton.setAttribute("disabled", "true");
                try {
                    const resolved = await this.itemIdentityService.identify(target, this.identifications, {
                        storeName: this.elements.storeNameInput.value.trim(),
                        onProgress: (progress) => this.setIdentifyStatus(progress)
                    });
                    resolved.forEach((identification, lineId) => {
                        this.identifications.set(lineId, identification);
                    });
                    this.render();
                    const unresolved = [...resolved.values()].filter((identification) => identification.source === "unresolved").length;
                    if (unresolved > 0) {
                        this.notificationService.info(`${unresolved} ${unresolved === 1 ? "item" : "items"} couldn't be identified. Click one to name it yourself.`);
                    }
                    window.setTimeout(() => this.hideIdentifyStatus(), 2400);
                }
                catch (error) {
                    console.error("Item identification failed:", error);
                    const message = error instanceof Error ? error.message : "Could not identify these items.";
                    this.setIdentifyMessage(message, 1);
                    this.notificationService.error(message);
                }
                finally {
                    this.isIdentifying = false;
                    this.elements.identifyItemsButton.removeAttribute("disabled");
                }
            }
            confirmIdentification(lineId, name) {
                const line = this.receiptLines.find((candidate) => candidate.id === lineId);
                if (!line)
                    return;
                const previous = this.identifications.get(lineId);
                const confirmed = {
                    lineId,
                    rawLabel: line.label,
                    ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                    resolvedName: name,
                    ...(previous && previous.resolvedName === name
                        ? {
                            ...(previous.brand ? { brand: previous.brand } : {}),
                            ...(previous.size ? { size: previous.size } : {})
                        }
                        : {}),
                    confidence: 1,
                    source: "user-confirmed",
                    alternatives: [],
                    confirmed: true
                };
                this.identifications.set(lineId, confirmed);
                this.itemAliasStoreService.remember(confirmed, this.elements.storeNameInput.value.trim());
                this.closeItemDetail(lineId);
                this.render();
            }
            clearIdentification(lineId) {
                const identification = this.identifications.get(lineId);
                if (!identification)
                    return;
                const alias = this.itemAliasStoreService.find({ id: lineId, label: identification.rawLabel, amount: 0, confidence: 0, ignored: false,
                    ...(identification.itemCode ? { itemCode: identification.itemCode } : {}) }, this.elements.storeNameInput.value.trim());
                if (alias)
                    this.itemAliasStoreService.forget(alias);
                this.identifications.delete(lineId);
                this.closeItemDetail(lineId);
                this.render();
            }
            closeItemDetail(lineId) {
                const selector = `details.item-detail-dropdown[data-line-id="${CSS.escape(lineId)}"]`;
                const details = this.elements.receiptLinesList.querySelector(selector);
                if (details)
                    details.open = false;
            }
            setIdentifyStatus(progress) {
                const stageFloor = {
                    aliases: 0.08,
                    dictionary: 0.2,
                    ai: 0.45,
                    complete: 1
                };
                this.setIdentifyMessage(progress.message, stageFloor[progress.stage]);
            }
            setIdentifyMessage(message, ratio) {
                this.elements.identifyStatus.classList.remove("hidden");
                this.elements.identifyStatusText.textContent = message;
                this.elements.identifyProgressBar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
            }
            hideIdentifyStatus() {
                this.elements.identifyStatus.classList.add("hidden");
                this.elements.identifyProgressBar.style.width = "0%";
            }
            getSelectedLines(includeIgnored = false) {
                return this.receiptLines.filter((line) => this.lineSelectionService.has(line.id) && (includeIgnored || !line.ignored));
            }
            clearLineSelection() {
                this.lineSelectionService.clear();
                this.renderWorkspace();
            }
            renderSelectAll() {
                const isAll = this.lineSelectionService.isAllSelected(this.receiptLines);
                this.elements.selectAllLines.checked = isAll;
                this.elements.selectAllLines.indeterminate =
                    !isAll && this.lineSelectionService.isAnySelected(this.receiptLines);
                this.elements.selectAllLines.disabled = this.receiptLines.length === 0;
            }
            renderTotals() {
                const unassignedCount = this.splitCalculatorService.getUnassignedCount(this.receiptLines, this.assignments);
                this.elements.unassignedCount.textContent = `${unassignedCount} unassigned`;
                this.elements.unassignedCount.classList.toggle("is-warning", unassignedCount > 0);
                this.splitWorkspaceView.renderTotals(this.elements.splitTotalsList, this.splitCalculatorService.calculate(this.people, this.receiptLines, this.assignments, this.getTaxAmount()));
                const itemSum = this.getSubtotal();
                const grandTotal = itemSum + this.getTaxAmount();
                this.elements.receiptTotal.textContent = this.currencyFormatService.format(grandTotal);
            }
            async extractAndItemizeReceipt(file) {
                const model = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
                if (!this.userHasGeminiKey && !this.serverHasGeminiKey) {
                    this.setOcrStatus("Please add your Gemini API key in Settings first.", 1);
                    this.openSettings();
                    return;
                }
                if (this.isParsing)
                    return;
                this.isParsing = true;
                this.setOcrStatus("Analyzing receipt with Gemini...", 0.15);
                this.elements.parseButton.setAttribute("disabled", "true");
                try {
                    const result = await this.geminiService.parseReceiptImage(file, model);
                    console.log("Gemini parsed receipt output:", result);
                    this.applyParsedReceiptJson(result);
                    this.failedParseFile = null;
                    this.resetRetryBackoff();
                    this.setOcrStatus(`Found ${this.receiptLines.length} lines via Gemini`, 1);
                    window.setTimeout(() => this.hideOcrStatus(), 1600);
                }
                catch (error) {
                    console.error("Gemini receipt parsing failed:", error);
                    const message = error instanceof Error ? error.message : "Could not extract text from this receipt.";
                    const exhausted = this.parseRetryCount >= ReceiptRing.Services.MAX_PARSE_RETRIES;
                    this.failedParseFile = this.canRetryParse(error) && !exhausted ? file : null;
                    if (this.failedParseFile) {
                        this.beginRetryBackoff();
                    }
                    this.setOcrStatus(exhausted ? `${message} Try a clearer photo, or come back in a few minutes.` : this.withRetryHint(message, this.failedParseFile !== null), 1);
                }
                finally {
                    this.isParsing = false;
                    this.elements.parseButton.removeAttribute("disabled");
                    this.renderRetryButton();
                }
            }
            applyParsedReceiptJson(result) {
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
                        const itemCode = typeof item.itemCode === "string" ? item.itemCode.trim() : "";
                        const price = typeof item.price === "number" ? item.price : Number(item.price) || 0;
                        const discount = typeof item.discount === "number" ? item.discount : Number(item.discount) || 0;
                        const finalAmount = Math.max(0, price - discount);
                        const lowConfidence = !!item.lowConfidence;
                        let itemLabel = label;
                        if (discount > 0.01) {
                            itemLabel += ` (was $${price.toFixed(2)}, ${discount > 0 ? "-" : ""}$${Math.abs(discount).toFixed(2)} discount)`;
                            formattedText += `- ${itemLabel}: $${finalAmount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;
                        }
                        else {
                            formattedText += `- ${label}: $${finalAmount.toFixed(2)}${lowConfidence ? " (low confidence)" : ""}\n`;
                        }
                        const categorization = this.categorizationService.categorize(label);
                        purchaseItems.push({
                            id: this.idService.create(),
                            label: itemLabel,
                            amount: Number(finalAmount.toFixed(2)),
                            ...(itemCode ? { itemCode } : {}),
                            category: categorization.category,
                            categorizationConfidence: lowConfidence ? 0.3 : categorization.confidence,
                            categorizationSource: categorization.source,
                            needsCategoryReview: lowConfidence || categorization.shouldPrompt
                        });
                    });
                }
                formattedText += `\nSubtotal: $${(subtotal ?? 0).toFixed(2)}\nTax: $${(tax ?? 0).toFixed(2)}\nTotal: $${(total ?? 0).toFixed(2)}`;
                this.elements.receiptText.value = formattedText;
                this.setItemsFromParse(purchaseItems);
                this.setSaveStatus("");
                this.render();
            }
            openPasteJsonModal() {
                this.elements.pasteJsonText.value = "";
                this.setPasteJsonStatus("");
                this.elements.pasteJsonModal.classList.remove("hidden");
            }
            closePasteJsonModal() {
                this.elements.pasteJsonModal.classList.add("hidden");
            }
            setPasteJsonStatus(message, isError = false) {
                this.elements.pasteJsonStatus.textContent = message;
                this.elements.pasteJsonStatus.classList.toggle("is-error", isError);
                this.elements.pasteJsonStatus.classList.toggle("is-active", Boolean(message) && !isError);
            }
            importPastedJson() {
                const raw = this.elements.pasteJsonText.value.trim();
                if (!raw) {
                    this.setPasteJsonStatus("Paste the JSON Gemini gave you first.", true);
                    return;
                }
                let parsed;
                try {
                    const cleaned = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();
                    parsed = JSON.parse(cleaned);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Invalid JSON.";
                    this.setPasteJsonStatus(`Could not parse that as JSON: ${message}`, true);
                    return;
                }
                if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
                    this.setPasteJsonStatus('That JSON needs an "items" array to import.', true);
                    return;
                }
                this.applyParsedReceiptJson(parsed);
                this.closePasteJsonModal();
                this.setOcrStatus(`Found ${this.receiptLines.length} lines from pasted JSON`, 1);
                window.setTimeout(() => this.hideOcrStatus(), 1600);
            }
            async initGeminiSettings() {
                const config = await this.geminiService.loadConfig();
                this.serverHasGeminiKey = config.hasServerKey;
                this.userHasGeminiKey = config.hasUserKey;
                if (config.model) {
                    localStorage.setItem("gemini_model", config.model);
                }
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
            }
            openSettings() {
                this.elements.geminiApiKey.value = "";
                this.elements.geminiModel.value = localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite";
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
                this.renderRetryButton();
            }
            hideOcrStatus() {
                this.elements.ocrStatus.classList.add("hidden");
                this.elements.ocrProgressBar.style.width = "0%";
                this.renderRetryButton();
            }
            renderRetryButton() {
                const offered = this.failedParseFile !== null && !this.isParsing;
                this.elements.retryParseButton.classList.toggle("hidden", !offered);
                if (!offered) {
                    this.elements.retryParseButton.disabled = true;
                    return;
                }
                const waitMs = this.retryAvailableAt - Date.now();
                const waiting = waitMs > 0;
                this.elements.retryParseButton.disabled = waiting;
                const label = waiting ? `Try again in ${Math.ceil(waitMs / 1000)}s` : "Try again";
                if (this.elements.retryParseButton.textContent !== label) {
                    this.elements.retryParseButton.textContent = label;
                }
            }
            canRetryParse(error) {
                if (error instanceof ReceiptRing.Services.ReceiptParseError) {
                    return ReceiptRing.Services.isRetryableParseFailure(error.status);
                }
                return true;
            }
            withRetryHint(message, canRetry) {
                return canRetry ? `${message} This often clears up on a second try.` : message;
            }
            async retryParse() {
                const file = this.failedParseFile;
                if (!file || this.isParsing || Date.now() < this.retryAvailableAt)
                    return;
                this.parseRetryCount += 1;
                await this.extractAndItemizeReceipt(file);
            }
            resetRetryBackoff() {
                this.parseRetryCount = 0;
                this.retryAvailableAt = 0;
                if (this.retryCountdownTimer !== null) {
                    window.clearInterval(this.retryCountdownTimer);
                    this.retryCountdownTimer = null;
                }
            }
            beginRetryBackoff() {
                this.retryAvailableAt = Date.now() + ReceiptRing.Services.retryBackoffMs(this.parseRetryCount + 1);
                if (this.retryCountdownTimer !== null)
                    window.clearInterval(this.retryCountdownTimer);
                this.retryCountdownTimer = window.setInterval(() => {
                    this.renderRetryButton();
                    if (Date.now() >= this.retryAvailableAt && this.retryCountdownTimer !== null) {
                        window.clearInterval(this.retryCountdownTimer);
                        this.retryCountdownTimer = null;
                    }
                }, 250);
                this.renderRetryButton();
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
                this.stopEditing();
                this.failedParseFile = null;
                this.resetRetryBackoff();
                this.imagePreviewService.show(file, this.elements.receiptPreview, this.elements.receiptPreviewWrap);
                this.setOcrStatus(`Loaded ${file.name || "receipt image"}`, 0.02);
                this.receiptImage = this.receiptImageService.toStorableDataUrl(file);
                void this.extractAndItemizeReceipt(file);
            }
            async loadPeople() {
                try {
                    const people = await this.peopleApiService.list();
                    this.people = people;
                    this.render();
                }
                catch (error) {
                    console.error("Failed to load people:", error);
                }
            }
            addPerson() {
                const name = this.elements.personNameInput.value.trim();
                if (!name)
                    return;
                if (this.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                    this.notificationService.error("This person is already in the list.");
                    return;
                }
                this.elements.addPersonButton.setAttribute("disabled", "true");
                void (async () => {
                    try {
                        const person = await this.peopleApiService.add(name);
                        this.people = [...this.people, person];
                        this.elements.personNameInput.value = "";
                        this.render();
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : "Could not add person.";
                        this.notificationService.error(message);
                    }
                    finally {
                        this.elements.addPersonButton.removeAttribute("disabled");
                    }
                })();
            }
            deletePerson(personId) {
                void (async () => {
                    try {
                        await this.peopleApiService.delete(personId);
                        this.people = this.people.filter((person) => person.id !== personId);
                        this.assignments = this.assignments.filter((assignment) => assignment.personId !== personId);
                        this.render();
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : "Could not delete person.";
                        this.notificationService.error(message);
                    }
                })();
            }
            toggleSelectAll() {
                if (this.lineSelectionService.isAllSelected(this.receiptLines)) {
                    this.lineSelectionService.clear();
                }
                else {
                    this.lineSelectionService.selectAll(this.receiptLines);
                }
                this.renderWorkspace();
            }
            toggleLineSelection(lineId, extendFromAnchor) {
                if (extendFromAnchor) {
                    this.lineSelectionService.selectRange(this.receiptLines, lineId);
                }
                else {
                    this.lineSelectionService.toggle(lineId);
                }
                this.renderWorkspace();
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
            toggleLineFood(lineId, isFood) {
                this.foodFlags.set(lineId, isFood);
                this.receiptLines = this.receiptLines.map((line) => line.id === lineId ? { ...line, isFood } : line);
                this.render();
            }
            async updateLineFood(receiptId, lineId, isFood) {
                try {
                    await this.receiptApiService.updateLineFood(receiptId, lineId, isFood);
                    await this.loadHistory();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not update line.";
                    this.notificationService.error(`Failed to update food flag. ${message}`);
                }
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
                this.elements.saveReceiptButton.setAttribute("disabled", "true");
                this.setSaveStatus("Saving...");
                const imageDataUrl = this.receiptImage ? await this.receiptImage : null;
                const editing = this.editingReceipt;
                const payload = this.buildReceiptPayload(imageDataUrl);
                try {
                    if (editing) {
                        const saved = await this.receiptApiService.update(editing.id, payload);
                        this.setSaveStatus("Changes saved.");
                        if (this.editingReceipt?.id === saved.id) {
                            this.editingReceipt = saved;
                            this.renderEditingState();
                        }
                    }
                    else {
                        await this.receiptApiService.save(payload);
                        this.setSaveStatus(imageDataUrl ? "Saved to history with the receipt photo." : "Saved to history.");
                    }
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not save receipt.";
                    this.setSaveStatus(message, true);
                }
                finally {
                    this.elements.saveReceiptButton.removeAttribute("disabled");
                }
            }
            buildReceiptPayload(imageDataUrl) {
                const subtotal = this.getSubtotal();
                const tax = this.getTaxAmount();
                return {
                    storeName: this.elements.storeNameInput.value.trim() || null,
                    category: this.receiptCategory,
                    subtotal,
                    tax,
                    total: subtotal + tax,
                    people: this.people
                        .filter((person) => this.assignments.some((assignment) => assignment.personId === person.id))
                        .map((person) => ({ clientId: person.id })),
                    lines: this.receiptLines.map((line) => ({
                        clientId: line.id,
                        label: line.label,
                        amount: line.amount,
                        ignored: line.ignored,
                        isFood: this.foodFlags.get(line.id) ?? false,
                        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                        identification: this.toStoredIdentification(this.identifications.get(line.id))
                    })),
                    assignments: this.assignments.map((assignment) => ({
                        lineClientId: assignment.lineId,
                        personClientId: assignment.personId,
                        mode: assignment.mode,
                        value: assignment.value
                    })),
                    imageDataUrl
                };
            }
            stopEditing() {
                this.editingReceipt = null;
                this.renderEditingState();
            }
            renderEditingState() {
                const receipt = this.editingReceipt;
                this.elements.editBanner.classList.toggle("hidden", receipt === null);
                this.elements.saveReceiptButton.textContent = receipt ? "Save changes" : "Save to history";
                if (!receipt)
                    return;
                this.elements.editBannerTitle.textContent = receipt.storeName || "Untitled receipt";
                this.elements.editBannerMeta.textContent = `Saved ${new Date(receipt.createdAt).toLocaleDateString()}`;
            }
            async loadHistory() {
                try {
                    const receipts = await this.receiptApiService.list();
                    this.receipts = receipts;
                    this.elements.historyEmpty.classList.toggle("hidden", receipts.length > 0);
                    this.splitWorkspaceView.renderHistory(this.elements.historyList, receipts, (receipt) => void this.deleteReceipt(receipt), (receiptId, lineId, isFood) => void this.updateLineFood(receiptId, lineId, isFood), (receipt) => this.openTransactionLinkModal(receipt.id), (receipt) => void this.unlinkReceiptFromHistory(receipt));
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
            async deleteReceipt(receipt) {
                const label = receipt.storeName || "this receipt";
                if (!window.confirm(`Delete ${label}? This can't be undone.`)) {
                    return;
                }
                try {
                    await this.receiptApiService.remove(receipt.id);
                    if (this.editingReceipt?.id === receipt.id)
                        this.clearReceipt();
                    await this.loadHistory();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Please try again.";
                    this.notificationService.error(`Couldn't delete receipt. ${message}`);
                }
            }
            setBankStatus(message) {
                this.elements.bankStatus.textContent = message;
            }
            async connectBank() {
                try {
                    this.setBankStatus("Opening Plaid…");
                    if (typeof Plaid === "undefined") {
                        this.setBankStatus("Plaid Link failed to load. Check your connection.");
                        return;
                    }
                    const { linkToken } = await this.bankApiService.createLinkToken();
                    if (!linkToken) {
                        this.setBankStatus("Set PLAID_CLIENT_ID and PLAID_SECRET in .env to connect a bank.");
                        return;
                    }
                    const handler = Plaid.create({
                        token: linkToken,
                        onSuccess: (publicToken, metadata) => void this.handleLinkSuccess(publicToken, metadata),
                        onExit: (error) => this.setBankStatus(error ? "Bank connection failed." : "")
                    });
                    handler.open();
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Could not start Plaid.");
                }
            }
            async handleLinkSuccess(publicToken, metadata) {
                try {
                    this.setBankStatus("Linking account…");
                    const result = await this.bankApiService.exchange(publicToken, metadata);
                    const bank = result.institutionName ?? "bank";
                    this.setBankStatus(result.replaced ? `Reconnected ${bank}, replacing the earlier link. Syncing…` : `Connected ${bank}. Syncing…`);
                    const sync = await this.bankApiService.sync();
                    if (sync.pending && sync.imported === 0) {
                        this.setBankStatus("Connected. Your bank is still preparing transactions — reopen Budgeting in a minute.");
                    }
                    else {
                        this.setBankStatus(this.describeSync(sync));
                    }
                    await this.loadBudgeting({ sync: false });
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Bank linking failed.");
                }
            }
            describeSync(result) {
                const imported = `Imported ${result.imported} transaction${result.imported === 1 ? "" : "s"}.`;
                const errors = result.errors ?? [];
                if (errors.length === 0)
                    return imported;
                const details = errors
                    .map((error) => `${error.institutionName ?? "A bank"}: ${error.message}`)
                    .join(" ");
                const hint = errors.some((error) => error.reconnectRequired)
                    ? " Use Connect bank to reconnect it — that replaces the old link instead of duplicating it."
                    : "";
                return `${imported} ${details}${hint}`;
            }
            async refreshTransactions() {
                this.elements.refreshTransactionsButton.setAttribute("disabled", "true");
                try {
                    this.setBankStatus("Refreshing…");
                    const sync = await this.bankApiService.sync();
                    if (sync.pending && sync.imported === 0 && (sync.errors ?? []).length === 0) {
                        this.setBankStatus("Your bank is still preparing transactions — try again in a minute.");
                    }
                    else {
                        this.setBankStatus(this.describeSync(sync));
                    }
                    await this.loadBudgeting({ sync: false });
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Could not refresh transactions.");
                }
                finally {
                    this.elements.refreshTransactionsButton.removeAttribute("disabled");
                }
            }
            async loadBudgeting(options = {}) {
                if (options.sync !== false) {
                    try {
                        await this.bankApiService.sync();
                    }
                    catch {
                    }
                }
                try {
                    this.receipts = await this.receiptApiService.list();
                }
                catch {
                    this.receipts = [];
                }
                try {
                    this.bankTransactions = await this.bankApiService.listTransactions();
                }
                catch {
                    this.bankTransactions = [];
                }
                try {
                    this.bankConnections = await this.bankApiService.listConnections();
                }
                catch {
                    this.bankConnections = [];
                }
                this.monthlySpend = this.spendingAggregatorService.aggregate(this.receipts, this.bankTransactions, this.getSelfShares());
                await this.refreshRentMonths();
                this.populateMonths();
                this.renderConnections();
                this.renderRentEntries();
                void this.renderEducationExpenses();
                this.renderTransactions();
                this.renderTrend();
                this.renderRing();
            }
            getSelfShares() {
                const shares = new Map();
                for (const receipt of this.receipts) {
                    const self = receipt.people.find((person) => person.isSelf);
                    if (!self)
                        continue;
                    const lines = receipt.lines.map((line) => ({
                        id: line.id,
                        label: line.label,
                        amount: Number(line.amount) || 0,
                        ...(line.itemCode ? { itemCode: line.itemCode } : {}),
                        confidence: 1,
                        ignored: line.ignored ?? false,
                        isFood: line.isFood ?? false
                    }));
                    const assignments = [];
                    for (const line of receipt.lines) {
                        for (const assignment of line.assignments) {
                            if (!assignment.personId)
                                continue;
                            assignments.push({
                                id: `${line.id}:${assignment.personId}`,
                                lineId: line.id,
                                personId: assignment.personId,
                                mode: assignment.mode ?? "equal",
                                value: Number(assignment.value) || 0
                            });
                        }
                    }
                    if (assignments.length === 0)
                        continue;
                    const people = receipt.people.map((person) => ({
                        id: person.id,
                        name: person.name,
                        isSelf: person.isSelf
                    }));
                    const summary = this.splitCalculatorService.calculate(people, lines, assignments, Number(receipt.tax) || 0);
                    const mine = summary.totals.find((total) => total.personId === self.id);
                    if (mine)
                        shares.set(receipt.id, mine.finalTotal);
                }
                return shares;
            }
            async refreshRentMonths() {
                try {
                    const entries = await this.rentEntryApiService.list();
                    this.rentMonths = new Set(entries.map((entry) => ReceiptRing.Services.rentMonthKey(entry.year, entry.month)));
                    this.rentEntryByTransaction = new Map(entries
                        .filter((entry) => typeof entry.bankTransactionId === "string" && entry.bankTransactionId.length > 0)
                        .map((entry) => [entry.bankTransactionId, entry.id]));
                }
                catch (error) {
                    console.error("Failed to load rent months:", error);
                }
            }
            populateMonths() {
                const select = this.elements.budgetMonth;
                const previous = this.selectedMonth;
                select.replaceChildren();
                const months = new Set(this.monthlySpend.map((entry) => entry.month));
                for (const month of this.rentMonths) {
                    months.add(month);
                }
                const ordered = [...months].sort((a, b) => (a < b ? 1 : -1));
                for (const month of ordered) {
                    const option = document.createElement("option");
                    option.value = month;
                    option.textContent = this.formatMonthLabel(month);
                    select.append(option);
                }
                if (ordered.length === 0) {
                    this.selectedMonth = null;
                    return;
                }
                this.selectedMonth = previous !== null && ordered.includes(previous) ? previous : ordered[0];
                select.value = this.selectedMonth;
            }
            renderConnections() {
                const container = this.elements.bankConnections;
                container.replaceChildren();
                if (this.bankConnections.length === 0)
                    return;
                for (const connection of this.bankConnections) {
                    const row = document.createElement("div");
                    row.className = "bank-connection-row";
                    const main = document.createElement("div");
                    main.className = "bank-connection-main";
                    const name = document.createElement("span");
                    name.className = "bank-connection-name";
                    name.textContent = connection.institutionName ?? "Linked bank";
                    const meta = document.createElement("span");
                    meta.className = "bank-connection-meta";
                    const accounts = `${connection.accounts} account${connection.accounts === 1 ? "" : "s"}`;
                    const transactions = `${connection.transactions} transaction${connection.transactions === 1 ? "" : "s"}`;
                    meta.textContent = `${accounts} · ${transactions}`;
                    main.append(name, meta);
                    const remove = document.createElement("button");
                    remove.type = "button";
                    remove.className = "btn btn-ghost btn-small";
                    remove.textContent = "Remove";
                    remove.addEventListener("click", () => void this.removeConnection(connection));
                    row.append(main, remove);
                    container.append(row);
                }
            }
            async removeConnection(connection) {
                const label = connection.institutionName ?? "this bank";
                if (!window.confirm(`Remove ${label}? Its ${connection.transactions} imported transaction${connection.transactions === 1 ? "" : "s"} will be deleted. Saved receipts are not affected.`)) {
                    return;
                }
                try {
                    this.setBankStatus("Removing…");
                    await this.bankApiService.removeConnection(connection.id);
                    this.setBankStatus(`Removed ${label}.`);
                    await this.loadBudgeting({ sync: false });
                }
                catch (error) {
                    this.setBankStatus(error instanceof Error ? error.message : "Could not remove the bank.");
                }
            }
            renderRing() {
                const month = this.monthlySpend.find((entry) => entry.month === this.selectedMonth) ?? null;
                this.budgetRingView.render(this.elements.budgetRing, this.elements.budgetLegend, month);
            }
            renderTrend() {
                this.monthlyTrendView.render(this.elements.monthlyTrend, this.monthlySpend, this.selectedMonth, (month) => this.selectMonth(month));
            }
            selectMonth(month) {
                this.selectedMonth = month;
                this.elements.budgetMonth.value = month ?? "";
                this.renderTrend();
                this.renderRing();
                this.renderRentEntries();
                void this.renderEducationExpenses();
                this.renderTransactions();
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
            formatTransactionDate(value) {
                const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
                if (!match)
                    return new Date(value).toLocaleDateString();
                const [, year, month, day] = match;
                return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
            }
            renderTransactions() {
                const list = this.elements.transactionsList;
                const transactions = this.selectedMonth
                    ? this.bankTransactions.filter((txn) => this.spendingAggregatorService.monthKey(txn.date) === this.selectedMonth)
                    : this.bankTransactions;
                this.elements.transactionsEmpty.classList.toggle("hidden", transactions.length > 0);
                this.setTransactionsEmptyMessage(transactions.length === 0);
                list.replaceChildren();
                for (const txn of transactions.slice(0, 100)) {
                    list.append(this.buildTransactionRow(txn));
                }
            }
            buildTransactionRow(txn) {
                const row = document.createElement("div");
                row.className = "transaction-row";
                row.dataset.transactionId = txn.id;
                const main = document.createElement("div");
                main.className = "transaction-main";
                const desc = document.createElement("span");
                desc.className = "transaction-desc";
                desc.textContent = txn.description ?? "Transaction";
                const meta = document.createElement("span");
                meta.className = "transaction-meta";
                const date = this.formatTransactionDate(txn.date);
                meta.textContent = txn.category ? `${date} \u00b7 ${txn.category}` : date;
                main.append(desc);
                const linkedReceipt = this.findLinkedReceipt(txn);
                const tags = document.createElement("div");
                tags.className = "transaction-tags";
                if (this.rentEntryByTransaction.has(txn.id)) {
                    tags.append(this.buildTransactionTag("Rent", "is-rent"));
                }
                if (txn.linkedReceiptId) {
                    const name = linkedReceipt?.storeName?.trim();
                    tags.append(this.buildTransactionTag(name ? `Receipt \u00b7 ${name}` : "Receipt", "is-receipt", RECEIPT_TAG_ICON));
                    row.classList.add("has-receipt");
                }
                const submeta = document.createElement("div");
                submeta.className = "transaction-submeta";
                submeta.append(meta, tags);
                main.append(submeta);
                const actions = document.createElement("div");
                actions.className = "transaction-actions";
                actions.append(this.buildFoodToggle(txn), this.buildTransactionMenu(txn, linkedReceipt));
                const amount = document.createElement("span");
                amount.className = "transaction-amount";
                amount.textContent = this.currencyFormatService.format(txn.amount);
                row.addEventListener("dragover", (event) => {
                    event.preventDefault();
                    row.classList.add("is-drag-over");
                });
                row.addEventListener("dragleave", () => {
                    row.classList.remove("is-drag-over");
                });
                row.addEventListener("drop", (event) => {
                    event.preventDefault();
                    row.classList.remove("is-drag-over");
                    const receiptId = event.dataTransfer?.getData("text/plain");
                    if (receiptId) {
                        void this.linkReceiptToTransaction(receiptId, txn.id);
                    }
                });
                row.append(main, actions, amount);
                return row;
            }
            buildTransactionTag(text, variant, iconSvg) {
                const tag = document.createElement("span");
                tag.className = `transaction-tag ${variant}`;
                if (iconSvg) {
                    const icon = document.createElement("span");
                    icon.className = "transaction-tag-icon";
                    icon.innerHTML = iconSvg;
                    tag.append(icon);
                }
                const label = document.createElement("span");
                label.className = "transaction-tag-text";
                label.textContent = text;
                tag.append(label);
                return tag;
            }
            buildFoodToggle(txn) {
                const toggle = document.createElement("button");
                toggle.type = "button";
                toggle.className = "line-food-check txn-food-toggle";
                toggle.classList.toggle("is-on", txn.isFood);
                toggle.setAttribute("aria-pressed", String(txn.isFood));
                toggle.setAttribute("aria-label", txn.isFood ? "Remove food flag" : "Count as food");
                toggle.title = txn.isFood
                    ? "Counted as food in education expenses"
                    : "Count this transaction as food in education expenses";
                toggle.innerHTML = ReceiptRing.UI.SplitWorkspaceView.getFoodCheckIcon(txn.isFood);
                const label = document.createElement("span");
                label.className = "txn-food-label";
                label.textContent = "Food";
                toggle.append(label);
                toggle.addEventListener("click", () => void this.toggleTransactionFood(txn.id, !txn.isFood));
                return toggle;
            }
            buildTransactionMenu(txn, linkedReceipt) {
                const menu = document.createElement("details");
                menu.className = "txn-menu";
                const trigger = document.createElement("summary");
                trigger.className = "txn-menu-trigger";
                trigger.setAttribute("aria-label", "Transaction options");
                trigger.setAttribute("title", "Transaction options");
                trigger.textContent = "\u22ef";
                menu.append(trigger);
                const panel = document.createElement("div");
                panel.className = "txn-menu-panel";
                const addItem = (label, onSelect, variant = "") => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = variant ? `txn-menu-item ${variant}` : "txn-menu-item";
                    button.textContent = label;
                    button.addEventListener("click", () => {
                        menu.open = false;
                        onSelect();
                    });
                    panel.append(button);
                };
                const rentEntryId = this.rentEntryByTransaction.get(txn.id);
                if (rentEntryId) {
                    addItem("Remove rent payment", () => void this.removeTransactionRent(rentEntryId), "is-danger");
                }
                else {
                    addItem("Log as rent payment", () => void this.logTransactionAsRent(txn));
                }
                addItem(txn.isFood ? "Remove food flag" : "Count as food", () => void this.toggleTransactionFood(txn.id, !txn.isFood));
                if (txn.linkedReceiptId) {
                    const receiptId = txn.linkedReceiptId;
                    if (linkedReceipt?.hasImage) {
                        addItem("Open receipt photo", () => this.openReceiptPhoto(receiptId));
                    }
                    addItem("Detach receipt", () => void this.detachReceipt(txn), "is-danger");
                }
                else {
                    addItem("Attach a receipt file\u2026", () => this.promptForReceiptFile(txn.id));
                    addItem("Link a saved receipt\u2026", () => this.openReceiptLinkModal(txn.id));
                }
                menu.append(panel);
                menu.addEventListener("toggle", () => {
                    if (menu.open)
                        this.closeTransactionMenus(menu);
                });
                return menu;
            }
            closeTransactionMenus(except) {
                this.elements.transactionsList
                    .querySelectorAll("details.txn-menu[open]")
                    .forEach((menu) => {
                    if (menu !== except)
                        menu.open = false;
                });
            }
            findLinkedReceipt(txn) {
                if (!txn.linkedReceiptId)
                    return null;
                return this.receipts.find((receipt) => receipt.id === txn.linkedReceiptId) ?? null;
            }
            openReceiptPhoto(receiptId) {
                window.open(this.receiptApiService.imageUrl(receiptId), "_blank", "noopener");
            }
            async logTransactionAsRent(txn) {
                const parts = ReceiptRing.Services.parseRentDateParts(txn.date);
                if (!parts) {
                    this.notificationService.error("This transaction has no usable date.");
                    return;
                }
                const amount = Math.abs(txn.amount);
                if (!(amount > 0)) {
                    this.notificationService.error("A rent payment needs a non-zero amount.");
                    return;
                }
                try {
                    await this.rentEntryApiService.create({
                        year: parts.year,
                        month: parts.month,
                        amount,
                        propertyName: txn.description ?? undefined,
                        date: txn.date,
                        bankTransactionId: txn.id
                    });
                    await this.refreshRentMonths();
                    this.populateMonths();
                    this.selectMonth(ReceiptRing.Services.rentMonthKey(parts.year, parts.month));
                    this.notificationService.success("Logged as a rent payment.");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not log the rent payment.";
                    this.notificationService.error(message);
                }
            }
            async removeTransactionRent(rentEntryId) {
                try {
                    await this.rentEntryApiService.delete(rentEntryId);
                    await this.refreshRentMonths();
                    this.populateMonths();
                    this.selectMonth(this.selectedMonth);
                    this.notificationService.success("Rent payment removed.");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not remove the rent payment.";
                    this.notificationService.error(message);
                }
            }
            promptForReceiptFile(transactionId) {
                this.attachingTransactionId = transactionId;
                this.elements.transactionReceiptFile.value = "";
                this.elements.transactionReceiptFile.click();
            }
            async attachReceiptFile(file) {
                const transactionId = this.attachingTransactionId;
                this.attachingTransactionId = null;
                if (!transactionId)
                    return;
                const txn = this.bankTransactions.find((candidate) => candidate.id === transactionId);
                if (!txn)
                    return;
                try {
                    const imageDataUrl = await this.receiptImageService.toStorableDataUrl(file);
                    if (!imageDataUrl) {
                        this.notificationService.error("That file could not be read as an image.");
                        return;
                    }
                    const label = (txn.description ?? "Transaction").slice(0, 200);
                    const amount = Math.abs(txn.amount);
                    const saved = await this.receiptApiService.save({
                        storeName: label,
                        category: this.categorizationService.categorize(label).category,
                        subtotal: null,
                        tax: null,
                        total: amount,
                        people: [],
                        lines: [{ clientId: this.idService.create(), label, amount, ignored: false }],
                        assignments: [],
                        imageDataUrl
                    });
                    await this.receiptApiService.linkTransactionToReceipt(saved.id, transactionId);
                    this.receipts = [saved, ...this.receipts];
                    this.applyReceiptLink(transactionId, saved.id);
                    this.renderTransactions();
                    this.notificationService.success("Receipt attached.");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not attach the receipt.";
                    this.notificationService.error(`Failed to attach the receipt. ${message}`);
                }
            }
            async detachReceipt(txn) {
                const receiptId = txn.linkedReceiptId;
                if (!receiptId)
                    return;
                try {
                    await this.receiptApiService.unlinkTransactionFromReceipt(receiptId);
                    this.applyReceiptLink(txn.id, null);
                    this.renderTransactions();
                    this.notificationService.success("Receipt detached.");
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not detach the receipt.";
                    this.notificationService.error(`Failed to detach the receipt. ${message}`);
                }
            }
            applyReceiptLink(transactionId, receiptId) {
                this.bankTransactions = this.bankTransactions.map((txn) => txn.id === transactionId ? { ...txn, linkedReceiptId: receiptId } : txn);
                this.monthlySpend = this.spendingAggregatorService.aggregate(this.receipts, this.bankTransactions, this.getSelfShares());
                this.renderTrend();
                this.renderRing();
            }
            async toggleTransactionFood(transactionId, isFood) {
                try {
                    await this.bankApiService.updateTransactionFood(transactionId, isFood);
                    this.bankTransactions = this.bankTransactions.map((txn) => txn.id === transactionId ? { ...txn, isFood } : txn);
                    this.renderTransactions();
                    void this.renderEducationExpenses();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not update the transaction.";
                    this.notificationService.error(`Failed to update food flag. ${message}`);
                }
            }
            setTransactionsEmptyMessage(isEmpty) {
                if (!isEmpty)
                    return;
                const heading = this.elements.transactionsEmpty.querySelector("strong");
                const detail = this.elements.transactionsEmpty.querySelector("span");
                const hasAnyTransactions = this.bankTransactions.length > 0;
                if (heading) {
                    heading.textContent = hasAnyTransactions ? "No transactions this month" : "No transactions yet";
                }
                if (detail) {
                    detail.textContent = hasAnyTransactions
                        ? "Pick another month to see its activity."
                        : "Connect a bank to import read-only transactions.";
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
            renderRentEntries() {
                void (async () => {
                    try {
                        const month = this.selectedMonth ?? this.spendingAggregatorService.monthKey(new Date().toISOString());
                        if (!month) {
                            this.rentEntriesView.render(this.elements.rentEntriesList, []);
                            return;
                        }
                        this.rentEntries = await this.rentEntryApiService.list(month);
                        this.rentEntriesView.render(this.elements.rentEntriesList, this.rentEntries);
                    }
                    catch (error) {
                        console.error("Failed to load rent entries:", error);
                        this.rentEntriesView.render(this.elements.rentEntriesList, []);
                    }
                })();
            }
            openRentEntryForm(entry) {
                this.editingRentEntryId = entry?.id ?? null;
                this.rentEntriesView.renderForm(this.elements.rentEntryModal, entry);
                this.elements.rentEntryModal.classList.remove("hidden");
            }
            closeRentEntryModal() {
                this.editingRentEntryId = null;
                this.elements.rentEntryModal.classList.add("hidden");
            }
            async saveRentEntry() {
                const date = this.elements.rentEntryDate.value.trim();
                const amount = Number(this.elements.rentEntryAmount.value);
                const propertyName = this.elements.rentEntryProperty.value.trim();
                const photoFile = this.elements.rentEntryPhoto.files?.[0];
                if (!date || !amount || amount <= 0) {
                    this.notificationService.error("Please fill in the date and amount.");
                    return;
                }
                const parts = ReceiptRing.Services.parseRentDateParts(date);
                if (!parts) {
                    this.notificationService.error("Please enter the date as YYYY-MM-DD.");
                    return;
                }
                this.elements.rentEntrySaveButton.setAttribute("disabled", "true");
                try {
                    const { year, month } = parts;
                    let photoDataUrl;
                    if (photoFile) {
                        photoDataUrl = await this.fileToDataUrl(photoFile);
                    }
                    const payload = {
                        year,
                        month,
                        amount,
                        propertyName: propertyName || undefined,
                        date,
                        photoDataUrl
                    };
                    const wasEditing = this.editingRentEntryId !== null;
                    if (this.editingRentEntryId) {
                        await this.rentEntryApiService.update(this.editingRentEntryId, {
                            amount,
                            propertyName: propertyName || undefined,
                            date,
                            photoDataUrl
                        });
                    }
                    else {
                        await this.rentEntryApiService.create(payload);
                    }
                    this.notificationService.success(wasEditing ? "Rent entry updated." : "Rent entry saved.");
                    this.closeRentEntryModal();
                    const savedMonth = ReceiptRing.Services.rentMonthKey(year, month);
                    this.rentMonths.add(savedMonth);
                    this.populateMonths();
                    this.selectMonth(savedMonth);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not save rent entry.";
                    if (message.includes("already exists")) {
                        this.notificationService.error("A rent entry already exists for this month. Please edit the existing entry.");
                    }
                    else {
                        this.notificationService.error(message);
                    }
                }
                finally {
                    this.elements.rentEntrySaveButton.removeAttribute("disabled");
                }
            }
            async deleteRentEntry(entry) {
                const label = this.formatTransactionDate(entry.date);
                if (!window.confirm(`Delete rent entry for ${label}? This can't be undone.`)) {
                    return;
                }
                try {
                    await this.rentEntryApiService.delete(entry.id);
                    this.notificationService.success("Rent entry deleted.");
                    await this.refreshRentMonths();
                    this.populateMonths();
                    this.selectMonth(this.selectedMonth);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not delete rent entry.";
                    this.notificationService.error(`Failed to delete rent entry. ${message}`);
                }
            }
            fileToDataUrl(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(reader.result);
                    };
                    reader.onerror = () => {
                        reject(new Error("Could not read file."));
                    };
                    reader.readAsDataURL(file);
                });
            }
            openReceiptLinkModal(transactionId) {
                this.linkingTransactionId = transactionId;
                this.elements.receiptLinkEmpty.classList.add("hidden");
                this.renderReceiptLinkList();
                this.elements.receiptLinkModal.classList.remove("hidden");
            }
            closeReceiptLinkModal() {
                this.linkingTransactionId = null;
                this.elements.receiptLinkModal.classList.add("hidden");
            }
            renderReceiptLinkList() {
                const list = this.elements.receiptLinkList;
                list.replaceChildren();
                void (async () => {
                    try {
                        const receipts = await this.receiptApiService.list();
                        this.receipts = receipts;
                        if (receipts.length === 0) {
                            this.elements.receiptLinkEmpty.classList.remove("hidden");
                            return;
                        }
                        receipts.forEach((receipt) => {
                            const card = document.createElement("button");
                            card.className = "receipt-link-item";
                            card.type = "button";
                            card.dataset.receiptId = receipt.id;
                            const main = document.createElement("div");
                            main.className = "receipt-link-main";
                            const storeName = document.createElement("strong");
                            storeName.textContent = receipt.storeName || "Untitled receipt";
                            const meta = document.createElement("span");
                            meta.className = "receipt-link-meta";
                            const when = new Date(receipt.createdAt).toLocaleDateString();
                            meta.textContent = `${receipt.category} · ${when}`;
                            const amount = document.createElement("span");
                            amount.className = "receipt-link-amount";
                            amount.textContent = this.currencyFormatService.format(Number(receipt.total ?? 0));
                            main.append(storeName, meta, amount);
                            card.append(main);
                            if (receipt.hasImage) {
                                const thumb = document.createElement("img");
                                thumb.className = "receipt-link-thumb";
                                thumb.src = this.receiptApiService.imageUrl(receipt.id);
                                thumb.alt = `Receipt from ${receipt.storeName || "an unknown store"}`;
                                card.append(thumb);
                            }
                            list.append(card);
                        });
                    }
                    catch (error) {
                        const msg = document.createElement("p");
                        msg.textContent = "Could not load receipts.";
                        list.append(msg);
                    }
                })();
            }
            openTransactionLinkModal(receiptId) {
                this.linkingReceiptId = receiptId;
                this.elements.transactionLinkEmpty.classList.add("hidden");
                this.renderTransactionLinkList();
                this.elements.transactionLinkModal.classList.remove("hidden");
            }
            closeTransactionLinkModal() {
                this.linkingReceiptId = null;
                this.elements.transactionLinkModal.classList.add("hidden");
            }
            renderTransactionLinkList() {
                const list = this.elements.transactionLinkList;
                list.replaceChildren();
                void (async () => {
                    try {
                        const transactions = await this.bankApiService.listTransactions();
                        this.bankTransactions = transactions;
                        const available = transactions
                            .filter((txn) => !txn.linkedReceiptId)
                            .sort((a, b) => (a.date < b.date ? 1 : -1));
                        if (available.length === 0) {
                            this.elements.transactionLinkEmpty.classList.remove("hidden");
                            return;
                        }
                        available.slice(0, 100).forEach((txn) => {
                            const card = document.createElement("button");
                            card.className = "transaction-link-item";
                            card.type = "button";
                            const main = document.createElement("div");
                            main.className = "transaction-link-main";
                            const desc = document.createElement("strong");
                            desc.textContent = txn.description ?? "Transaction";
                            const meta = document.createElement("span");
                            meta.className = "transaction-link-meta";
                            const when = this.formatTransactionDate(txn.date);
                            meta.textContent = txn.category ? `${when} · ${txn.category}` : when;
                            main.append(desc, meta);
                            const amount = document.createElement("span");
                            amount.className = "transaction-link-amount";
                            amount.textContent = this.currencyFormatService.format(txn.amount);
                            card.append(main, amount);
                            card.addEventListener("click", () => void this.selectTransactionForLink(txn.id));
                            list.append(card);
                        });
                    }
                    catch (error) {
                        const msg = document.createElement("p");
                        msg.className = "assign-hint";
                        msg.textContent =
                            error instanceof Error ? error.message : "Could not load transactions.";
                        list.append(msg);
                    }
                })();
            }
            async selectTransactionForLink(transactionId) {
                const receiptId = this.linkingReceiptId;
                if (!receiptId)
                    return;
                if (await this.linkReceiptToTransaction(receiptId, transactionId)) {
                    this.closeTransactionLinkModal();
                    await this.loadHistory();
                }
            }
            async unlinkReceiptFromHistory(receipt) {
                try {
                    await this.receiptApiService.unlinkTransactionFromReceipt(receipt.id);
                    const transactionId = receipt.linkedTransaction?.id;
                    if (transactionId)
                        this.applyReceiptLink(transactionId, null);
                    this.notificationService.success("Receipt unlinked from its transaction.");
                    await this.loadHistory();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not unlink receipt.";
                    this.notificationService.error(message);
                }
            }
            async selectReceiptForLink(receiptId) {
                if (!this.linkingTransactionId)
                    return;
                if (await this.linkReceiptToTransaction(receiptId, this.linkingTransactionId)) {
                    this.closeReceiptLinkModal();
                }
            }
            async linkReceiptToTransaction(receiptId, transactionId) {
                try {
                    await this.receiptApiService.linkTransactionToReceipt(receiptId, transactionId);
                    this.applyReceiptLink(transactionId, receiptId);
                    this.renderTransactions();
                    this.notificationService.success("Receipt attached to the transaction.");
                    return true;
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Could not link receipt to transaction.";
                    this.notificationService.error(`Failed to attach the receipt. ${message}`);
                    return false;
                }
            }
            buildFoodReceiptRow(group) {
                const details = document.createElement("details");
                details.className = "food-receipt";
                const summary = document.createElement("summary");
                summary.className = "food-receipt-summary";
                const label = document.createElement("span");
                label.className = "food-item-label";
                label.textContent = group.storeName || "Unknown store";
                const meta = document.createElement("span");
                meta.className = "food-item-store";
                const itemCount = `${group.items.length} ${group.items.length === 1 ? "item" : "items"}`;
                meta.textContent = `${this.formatTransactionDate(group.date)} · ${itemCount}`;
                const amount = document.createElement("span");
                amount.className = "food-item-amount";
                amount.textContent = this.currencyFormatService.format(group.total);
                summary.append(label, meta, amount);
                details.append(summary);
                const body = document.createElement("div");
                body.className = "food-receipt-items";
                for (const item of group.items) {
                    const row = document.createElement("div");
                    row.className = "food-receipt-item";
                    const itemLabel = document.createElement("span");
                    itemLabel.className = "food-receipt-item-label";
                    itemLabel.textContent = item.label;
                    const note = document.createElement("span");
                    note.className = "food-receipt-item-note";
                    if (item.shared) {
                        const names = item.sharedWith.length > 0 ? ` with ${item.sharedWith.join(", ")}` : "";
                        note.textContent = `your share of ${this.currencyFormatService.format(item.fullAmount)}${names}`;
                    }
                    const itemAmount = document.createElement("span");
                    itemAmount.className = "food-receipt-item-amount";
                    itemAmount.textContent = this.currencyFormatService.format(item.amount);
                    row.append(itemLabel, note, itemAmount);
                    body.append(row);
                }
                if (group.taxTotal !== 0) {
                    const taxRow = document.createElement("div");
                    taxRow.className = "food-receipt-item is-tax";
                    const taxLabel = document.createElement("span");
                    taxLabel.className = "food-receipt-item-label";
                    taxLabel.textContent = "Tax on your food";
                    const spacer = document.createElement("span");
                    spacer.className = "food-receipt-item-note";
                    const taxAmount = document.createElement("span");
                    taxAmount.className = "food-receipt-item-amount";
                    taxAmount.textContent = this.currencyFormatService.format(group.taxTotal);
                    taxRow.append(taxLabel, spacer, taxAmount);
                    body.append(taxRow);
                }
                details.append(body);
                return details;
            }
            async renderEducationExpenses() {
                try {
                    const month = this.selectedMonth ?? (this.spendingAggregatorService.monthKey(new Date().toISOString()) ?? undefined);
                    const foodSummary = await this.receiptApiService.getFoodSummary(month);
                    const rentSummary = await this.rentEntryApiService.getSummary(month);
                    const foodTotal = foodSummary.foodTotal;
                    const rentTotal = rentSummary.rentTotal;
                    const combinedTotal = foodTotal + rentTotal;
                    this.elements.educationFoodTotal.textContent = this.currencyFormatService.format(foodTotal);
                    this.elements.educationRentTotal.textContent = this.currencyFormatService.format(rentTotal);
                    this.elements.educationExpensesTotal.textContent = this.currencyFormatService.format(combinedTotal);
                    const foodList = this.elements.foodItemsList;
                    foodList.replaceChildren();
                    const foodReceipts = foodSummary.foodReceipts ?? [];
                    const foodTransactions = foodSummary.foodTransactions ?? [];
                    this.elements.foodEmpty.classList.toggle("hidden", foodReceipts.length + foodTransactions.length > 0);
                    const appendFoodRow = (labelText, sourceText, amountValue) => {
                        const row = document.createElement("div");
                        row.className = "food-item-row";
                        row.classList.toggle("is-credit", amountValue < 0);
                        const label = document.createElement("span");
                        label.className = "food-item-label";
                        label.textContent = labelText;
                        const store = document.createElement("span");
                        store.className = "food-item-store";
                        store.textContent = sourceText;
                        const amount = document.createElement("span");
                        amount.className = "food-item-amount";
                        amount.textContent = this.currencyFormatService.format(amountValue);
                        row.append(label, store, amount);
                        foodList.append(row);
                    };
                    for (const group of foodReceipts) {
                        foodList.append(this.buildFoodReceiptRow(group));
                    }
                    for (const txn of foodTransactions) {
                        appendFoodRow(txn.description || "Bank transaction", `Bank · ${this.formatTransactionDate(txn.date)}`, txn.amount);
                    }
                    this.elements.rentEmpty.classList.toggle("hidden", rentSummary.entries.length > 0);
                }
                catch (error) {
                    console.error("Failed to render education expenses:", error);
                    this.elements.foodEmpty.classList.remove("hidden");
                    this.elements.rentEmpty.classList.remove("hidden");
                }
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
    const lineSelectionService = new ReceiptRing.Services.LineSelectionService();
    const imagePreviewService = new ReceiptRing.Services.ImagePreviewService();
    const receiptImageService = new ReceiptRing.Services.ReceiptImageService();
    const geminiService = new ReceiptRing.Services.GeminiService();
    const receiptApiService = new ReceiptRing.Services.ReceiptApiService();
    const authApiService = new ReceiptRing.Services.AuthApiService();
    const bankApiService = new ReceiptRing.Services.BankApiService();
    const peopleApiService = new ReceiptRing.Services.PeopleApiService();
    const spendingAggregatorService = new ReceiptRing.Services.SpendingAggregatorService(categories);
    const rentEntryApiService = new ReceiptRing.Services.RentEntryApiService();
    const notificationService = new ReceiptRing.Services.NotificationService();
    const labelNormalizerService = new ReceiptRing.Services.LabelNormalizerService();
    const itemAliasStoreService = new ReceiptRing.Services.ItemAliasStoreService(labelNormalizerService, new ReceiptRing.Services.ItemAliasApiService());
    const dictionaryResolverService = new ReceiptRing.Services.DictionaryResolverService(labelNormalizerService);
    const itemIdentityService = new ReceiptRing.Services.ItemIdentityService(itemAliasStoreService, dictionaryResolverService, new ReceiptRing.Services.ItemIdentityApiService());
    const elements = new ReceiptRing.UI.DomRegistryFactory().create();
    const categoryPromptView = new ReceiptRing.UI.CategoryPromptView(categories, elements);
    const splitWorkspaceView = new ReceiptRing.UI.SplitWorkspaceView(currencyFormatService, receiptApiService);
    const budgetRingView = new ReceiptRing.UI.BudgetRingView(currencyFormatService);
    const monthlyTrendView = new ReceiptRing.UI.MonthlyTrendView(currencyFormatService);
    const rentEntriesView = new ReceiptRing.UI.RentEntriesView(currencyFormatService);
    const authView = new ReceiptRing.UI.AuthView(elements, authApiService);
    const controller = new ReceiptRing.App.AppController(elements, parserService, categorizationService, categoryRuleStorageService, storageService, currencyFormatService, imagePreviewService, receiptImageService, geminiService, categoryPromptView, splitWorkspaceView, splitCalculatorService, lineSelectionService, idService, receiptApiService, bankApiService, spendingAggregatorService, budgetRingView, monthlyTrendView, peopleApiService, rentEntryApiService, rentEntriesView, notificationService, itemIdentityService, itemAliasStoreService);
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
