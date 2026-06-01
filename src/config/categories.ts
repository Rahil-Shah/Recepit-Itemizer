namespace ReceiptRing.Config {
  export const CATEGORIES: readonly Domain.Category[] = [
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
        "pasta"
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
        "bowl"
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
        "foil"
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
        "shampoo"
      ]
    },
    {
      name: "Transport",
      color: "#5ca8ff",
      keywords: ["fuel", "gas", "parking", "uber", "lyft", "transit", "metro", "toll", "car wash"]
    },
    {
      name: "Personal",
      color: "#ff89c2",
      keywords: ["shirt", "socks", "cosmetic", "lotion", "beauty", "skincare", "hair", "gift"]
    },
    {
      name: "Entertainment",
      color: "#96dc5c",
      keywords: ["movie", "book", "game", "ticket", "music", "stream", "toy"]
    },
    {
      name: "Other",
      color: "#a5a097",
      keywords: []
    }
  ];
}
