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

function resolveImageUrl(imageUrl = "") {
  const value = String(imageUrl || "").trim();
  if (!value || /^https?:\/\//i.test(value)) {
    return value;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return new URL(value, apiBaseUrl).toString();
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

      const imageUrl = resolveImageUrl(item.imageUrl || item.image_url || item.imagePath || item.photoUrl || item.photo || "");

      return {
        id: Number(item.id ?? item.menuItemId ?? index + 1),
        name: itemName,
        serialNumber: String(item.serialNumber ?? item.serialNo ?? item.serial ?? item.number ?? ""),
        category: normalizeMenuCategory(categoryName, itemName),
        databaseImageUrl: imageUrl,
        image: imageUrl,
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

export function normalizeSerialMenuItems(payload) {
  const data = payload?.items || payload?.menuItems || payload?.rows || payload?.data || payload;
  const entries = Array.isArray(data)
    ? data.map((item) => [undefined, item])
    : data && typeof data === "object" && (data.serialNumber || data.name)
      ? [[undefined, data]]
      : data && typeof data === "object"
        ? Object.entries(data)
        : [];

  return entries
    .map(([serialKey, value], index) => {
      const item = value && typeof value === "object" ? value : { name: value };
      const serialNumber = item.serialNumber ?? item.serialNo ?? item.serial ?? item.number ?? serialKey ?? index + 1;
      const name = item.name || item.itemName || item.menuItemName || item.title || `Menu item ${serialNumber}`;
      const id = item.id ?? item.menuItemId ?? item.menu_item_id ?? serialNumber;
      const imageUrl = resolveImageUrl(item.imageUrl || item.image_url || item.imagePath || item.photoUrl || item.photo || "");

      return {
        id: String(id),
        name: String(name),
        serialNumber: String(serialNumber),
        category: item?.category?.name || item.categoryName || item.category || "Menu",
        imageUrl,
        price: item.price ?? 0,
      };
    })
    .filter((item) => item.name && item.serialNumber);
}
