export function normalizeCategoryName(value = "") {
  if (value == null) {
    return "";
  }

  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const LOCAL_MENU_ASSETS = import.meta.glob("../../assets/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

function normalizeMenuAssetName(value = "") {
  return String(value)
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const MENU_NAME_STOP_WORDS = new Set(["with", "bone", "boneless", "half", "full", "pcs", "pc", "piece", "pieces"]);
const GENERIC_MENU_TOKENS = new Set(["chicken", "mutton", "lamb", "soup", "rice", "masala", "curry", "veg", "vegetable", "main", "course"]);

function getMenuNameTokens(value = "") {
  return String(value)
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({
      chicken: "chicken",
      murgh: "chicken",
      murg: "chicken",
      prawns: "prawn",
      fhirni: "firni",
      biryanii: "biryani",
      tangadi: "tangdi",
    }[token] || token))
    .filter((token) => !MENU_NAME_STOP_WORDS.has(token));
}

function getLocalMenuImage(name = "") {
  const normalizedName = normalizeMenuAssetName(name);
  if (!normalizedName) {
    return "";
  }

  const assets = Object.entries(LOCAL_MENU_ASSETS).map(([assetPath, image]) => ({
    assetName: assetPath.split("/").pop(),
    image,
  }));
  const exactMatch = assets.find(({ assetName }) => normalizeMenuAssetName(assetName) === normalizedName);
  if (exactMatch) {
    return exactMatch.image;
  }

  const itemTokens = getMenuNameTokens(name);
  const fuzzyMatch = assets
    .map(({ assetName, image }) => {
      const distinctiveItemTokens = itemTokens.filter((token) => !GENERIC_MENU_TOKENS.has(token));
      const assetTokens = getMenuNameTokens(assetName).filter((token) => !GENERIC_MENU_TOKENS.has(token));
      const sharedTokens = distinctiveItemTokens.filter((token) => assetTokens.includes(token));
      const strongSharedTokens = sharedTokens.filter((token) => token.length >= 5);
      const score = strongSharedTokens.length * 3 + sharedTokens.length;
      return { image, score, sharedTokens: strongSharedTokens.length };
    })
    .sort((first, second) => second.score - first.score)[0];

  return fuzzyMatch && fuzzyMatch.sharedTokens >= 2 ? fuzzyMatch.image : "";
}

function normalizeMenuCategory(categoryName = "", itemName = "") {
  const category = normalizeCategoryName(categoryName);
  const name = normalizeCategoryName(itemName);
  const searchable = `${category} ${name}`;

  const exactAliases = {
    soup: "soups",
    soups: "soups",
    shorba: "shorba",
    biryani: "rice-biryani",
    rice: "rice-biryani",
    breads: "indian-breads",
    "indian-breads": "indian-breads",
    beverage: "beverages",
    beverages: "beverages",
    dessert: "desserts",
    desserts: "desserts",
  };

  if (exactAliases[category]) {
    return exactAliases[category];
  }
  if (searchable.includes("cooler") || searchable.includes("juice")) {
    return "coolers-juices";
  }
  if (searchable.includes("beverage") || searchable.includes("drink")) {
    return "beverages";
  }
  if (searchable.includes("chinese") || searchable.includes("noodle")) {
    return "chinese-rice-noodles";
  }
  if (searchable.includes("salad") || searchable.includes("chat")) {
    return "salads-chats";
  }
  if (searchable.includes("accompan") || searchable.includes("raita") || searchable.includes("papad")) {
    return "accompaniments";
  }
  if (searchable.includes("sea-food") || searchable.includes("seafood") || searchable.includes("prawn")) {
    return "sea-food";
  }
  if (searchable.includes("kebab") || searchable.includes("tikka") || searchable.includes("chop")) {
    if (searchable.includes("mutton") || searchable.includes("lamb")) {
      return "kebabs-mutton";
    }
    if (searchable.includes("paneer") || searchable.includes("veg") || searchable.includes("mushroom")) {
      return "kebabs-vegetarian";
    }
    return "kebab-chicken";
  }
  if (searchable.includes("appetizer") || searchable.includes("starter")) {
    return searchable.includes("non-veg") || searchable.includes("chicken") ? "appetizers-non-veg" : "appetizers-veg";
  }
  if (searchable.includes("egg") || searchable.includes("anda")) {
    return "main-course-egg";
  }
  if (searchable.includes("mutton") || searchable.includes("lamb")) {
    return "main-course-mutton";
  }
  if (searchable.includes("chicken") || searchable.includes("murgh")) {
    return "main-course-chicken";
  }
  if (searchable.includes("vegetarian") || searchable.includes("vegetable") || searchable.includes("paneer")) {
    return "main-course-vegetarian";
  }
  if (searchable.includes("main-course") || searchable.includes("gravy")) {
    return "main-course-signature-gravies";
  }

  return category;
}

const MENU_IMAGE_BY_CATEGORY = {
  starters: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
  biryani: "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=80",
  desserts: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
  indian: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80",
  chinese: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=900&q=80",
  soup: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80",
  burgers: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  salads: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  beverages: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  drinks: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
};

const MENU_IMAGE_BY_KEYWORD = {
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80",
  noodles: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  pasta: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
};

function getInternetMenuImage(name = "", category = "") {
  const searchTerms = `${name || category} food dish`.trim();
  return `https://loremflickr.com/900/700/${encodeURIComponent(searchTerms)}`;
}

export function getMenuImage(name = "", category = "") {
  const localImage = getLocalMenuImage(name);
  if (localImage) {
    return localImage;
  }

  if (name) {
    return getInternetMenuImage(name, category);
  }
  const normalizedName = String(name).toLowerCase();
  const keyword = Object.keys(MENU_IMAGE_BY_KEYWORD).find((key) => normalizedName.includes(key));
  if (MENU_IMAGE_BY_KEYWORD[keyword]) {
    return MENU_IMAGE_BY_KEYWORD[keyword];
  }
  return MENU_IMAGE_BY_CATEGORY[normalizeCategoryName(category)] ||
    "https://images.unsplash.com/photo-1517248135467-4c7edcad13c4?auto=format&fit=crop&w=900&q=80";
}

export function normalizeApiMenuItems(payload) {
  const list =
    payload?.items ||
    payload?.menuItems ||
    payload?.rows ||
    payload?.data ||
    (Array.isArray(payload) ? payload : []);

  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  return list
    .map((item, index) => {
      const itemName = item.name || item.itemName || item.menuItemName || item.title || "Menu Item";
      const categoryName =
        item?.category?.name ||
        item?.categoryName ||
        item?.category ||
        "menu";

      return {
        id: Number(item.id ?? item.menuItemId ?? index + 1),
        name: itemName,
        category: normalizeMenuCategory(categoryName, itemName),
        databaseImageUrl: item.imageUrl || item.image_url || item.imagePath || item.photoUrl || item.photo || "",
        image: item.image || item.imageUrl || item.image_url || item.imagePath || item.photoUrl || item.photo || getLocalMenuImage(itemName) || getMenuImage(itemName, categoryName),
        price: Number(item.price ?? 0),
        badge: "Menu",
        description: item.description || "",
        rating: 4.5,
        tag: "From API",
        icon: "🍽️",
      };
    })
    .filter((item) => item.id && item.name);
}
