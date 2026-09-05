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
  { id: "soups", name: "Soups", emoji: "🍲", bg: "bg-amber-100", desc: "Warm and comforting bowls" },
  { id: "shorba", name: "Shorba", emoji: "🥣", bg: "bg-orange-100", desc: "Traditional rich broths" },
  { id: "kebab-chicken", name: "Kebab - Chicken", emoji: "🍢", bg: "bg-red-100", desc: "Tandoori chicken kebabs" },
  { id: "kebabs-vegetarian", name: "Kebabs - Vegetarian", emoji: "🥗", bg: "bg-emerald-100", desc: "Vegetarian kebabs" },
  { id: "kebabs-mutton", name: "Kebabs - Mutton", emoji: "🍖", bg: "bg-rose-100", desc: "Mutton kebabs and chops" },
  { id: "appetizers-veg", name: "Appetizers - Veg", emoji: "🥬", bg: "bg-green-100", desc: "Vegetarian starters" },
  { id: "appetizers-non-veg", name: "Appetizers - Non Veg", emoji: "🍗", bg: "bg-red-100", desc: "Chicken and seafood starters" },
  { id: "sea-food", name: "Sea Food", emoji: "🍤", bg: "bg-cyan-100", desc: "Fresh seafood dishes" },
  { id: "main-course-signature-gravies", name: "Signature Gravies", emoji: "🍛", bg: "bg-orange-100", desc: "Niyaaz signature gravies" },
  { id: "main-course-chicken", name: "Main Course - Chicken", emoji: "🍗", bg: "bg-amber-100", desc: "Chicken main course" },
  { id: "main-course-mutton", name: "Main Course - Mutton", emoji: "🍖", bg: "bg-red-100", desc: "Mutton main course" },
  { id: "main-course-egg", name: "Main Course - Egg", emoji: "🥚", bg: "bg-yellow-100", desc: "Egg favourites" },
  { id: "main-course-vegetarian", name: "Main Course - Vegetarian", emoji: "🥘", bg: "bg-emerald-100", desc: "Vegetarian main course" },
  { id: "rice-biryani", name: "Rice & Biryani", emoji: "🍚", bg: "bg-yellow-100", desc: "Aromatic rice favourites" },
  { id: "indian-breads", name: "Indian Breads", emoji: "🫓", bg: "bg-stone-100", desc: "Fresh breads from the tandoor" },
  { id: "accompaniments", name: "Accompaniments", emoji: "🥗", bg: "bg-lime-100", desc: "Salads, raita and sides" },
  { id: "chinese-rice-noodles", name: "Chinese Rice & Noodles", emoji: "🥡", bg: "bg-rose-100", desc: "Chinese rice and noodles" },
  { id: "salads-chats", name: "Salads & Chats", emoji: "🥗", bg: "bg-green-100", desc: "Fresh salads and chats" },
  { id: "beverages", name: "Beverages", emoji: "🥤", bg: "bg-cyan-100", desc: "Tea, coffee and drinks" },
  { id: "coolers-juices", name: "Coolers & Juices", emoji: "🍹", bg: "bg-sky-100", desc: "Refreshing coolers and juices" },
  { id: "desserts", name: "Desserts", emoji: "🍮", bg: "bg-pink-100", desc: "Something sweet to finish" },
];

export const fmt = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(price);
