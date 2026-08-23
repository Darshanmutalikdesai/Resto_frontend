const products = [
  null,
  {
    id: 1,
    name: "Fresh Tomatoes",
    price: 40,
    rating: 4.5,
    reviews: 24,
    description: "Fresh red tomatoes",
    unit: "1 kg",
    emoji: "🍅",
    bg: "bg-rose-100",
  },
  {
    id: 2,
    name: "Organic Lettuce",
    price: 60,
    rating: 4.2,
    reviews: 18,
    description: "Fresh organic lettuce",
    unit: "1 head",
    emoji: "🥬",
    bg: "bg-emerald-100",
  },
  {
    id: 3,
    name: "Bananas",
    price: 50,
    rating: 4.7,
    reviews: 33,
    description: "Yellow ripe bananas",
    unit: "6 pcs",
    emoji: "🍌",
    bg: "bg-yellow-100",
  },
  {
    id: 4,
    name: "Carrots",
    price: 35,
    rating: 4.4,
    reviews: 14,
    description: "Fresh orange carrots",
    unit: "1 kg",
    emoji: "🥕",
    bg: "bg-orange-100",
  },
  {
    id: 5,
    name: "Apples",
    price: 80,
    rating: 4.6,
    reviews: 22,
    description: "Red delicious apples",
    unit: "1 kg",
    emoji: "🍎",
    bg: "bg-red-100",
  },
  {
    id: 6,
    name: "Potatoes",
    price: 30,
    rating: 4.3,
    reviews: 19,
    description: "Fresh potatoes",
    unit: "1 kg",
    emoji: "🥔",
    bg: "bg-slate-100",
  },
];

export const PRODUCTS = products;
export const FLASH_DEALS = [1, 3, 5];
export const BEST_SELLING = [2, 4, 6];
export const RELATED = [2, 4];

export const HOME_CATEGORIES = [
  { id: 1, label: "Vegetables", emoji: "🥬", bg: "bg-emerald-100" },
  { id: 2, label: "Fruits", emoji: "🍎", bg: "bg-red-100" },
  { id: 3, label: "Dairy", emoji: "🥛", bg: "bg-sky-100" },
  { id: 4, label: "Bakery", emoji: "🍞", bg: "bg-orange-100" },
  { id: 5, label: "Drinks", emoji: "🥤", bg: "bg-cyan-100" },
  { id: 6, label: "More", emoji: "", bg: "bg-slate-100", isMore: true },
];

export const CATEGORY_LIST = [
  { id: 1, name: "Starters", emoji: "🍢", bg: "bg-orange-100", desc: "Small plates to begin" },
  { id: 2, name: "Biryani", emoji: "🍚", bg: "bg-yellow-100", desc: "Aromatic rice favourites" },
  { id: 3, name: "Desserts", emoji: "🍮", bg: "bg-pink-100", desc: "Something sweet to finish" },
  { id: 4, name: "Chef's Special", emoji: "🍽️", bg: "bg-emerald-100", desc: "Our chef's favourites" },
  { id: 5, name: "House Speciality", emoji: "👨‍🍳", bg: "bg-red-100", desc: "Signature dishes from our kitchen" },
  { id: 6, name: "Indian", emoji: "🍛", bg: "bg-orange-100", desc: "Classic Indian flavours" },
  { id: 7, name: "Chinese", emoji: "🥡", bg: "bg-rose-100", desc: "Popular Chinese favourites" },
  { id: 8, name: "Soup", emoji: "🍲", bg: "bg-amber-100", desc: "Warm and comforting bowls" },
];

export const fmt = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(price);
