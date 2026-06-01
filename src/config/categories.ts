namespace ReceiptRing.Config {
  export const CATEGORIES: readonly Domain.Category[] = [
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
}
