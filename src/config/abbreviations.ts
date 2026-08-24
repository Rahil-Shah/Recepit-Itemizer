namespace ReceiptRing.Config {
  /**
   * Receipt shorthand, expanded.
   *
   * Two tables rather than one, because the two kinds of token behave
   * differently when a name is rebuilt. A brand is a proper noun that belongs
   * at the front ("Great Value Shredded Mozzarella"); a word is just a word.
   * Merging them produced names like "Shredded Great Value Mozzarella".
   *
   * Everything here is store-agnostic shorthand seen across chains. Anything
   * specific to one retailer belongs in a saved alias, not here -- the point of
   * this table is the long tail that no user should have to teach the app.
   */

  /** Store and manufacturer brands, keyed by the prefix receipts print. */
  export const BRAND_ABBREVIATIONS: Readonly<Record<string, string>> = {
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

  /**
   * Word-level shorthand. Keys are lowercase and matched whole, never as
   * substrings -- "org" means organic, but "orgn" is not three-quarters of it,
   * and substring matching turned "borg" into "bOrganic".
   */
  export const WORD_ABBREVIATIONS: Readonly<Record<string, string>> = {
    // Dairy and eggs
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

    // Meat and fish
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

    // Produce
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

    // Pantry
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

    // Drinks
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

    // Household and personal
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

  /**
   * Modifiers, kept apart from the nouns above.
   *
   * These describe an item without ever being one. A label that expands to
   * nothing but qualifiers -- "ORG", "SHRD FRZN" -- has not been identified,
   * it has been described, and the resolver needs to be able to tell the
   * difference before it reports a confident "Organic" as a product.
   */
  export const QUALIFIER_ABBREVIATIONS: Readonly<Record<string, string>> = {
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
}
