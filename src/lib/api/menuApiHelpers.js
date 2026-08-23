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

export function getMenuImage(name = "", category = "") {
  const normalizedName = String(name).toLowerCase();
  const keyword = Object.keys(MENU_IMAGE_BY_KEYWORD).find((key) => normalizedName.includes(key));
  return MENU_IMAGE_BY_KEYWORD[keyword] || MENU_IMAGE_BY_CATEGORY[normalizeCategoryName(category)] ||
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
      const categoryName =
        item?.category?.name ||
        item?.categoryName ||
        item?.category ||
        "menu";

      return {
        id: Number(item.id ?? item.menuItemId ?? index + 1),
        name: item.name || "Menu Item",
        category: normalizeCategoryName(categoryName),
        image: item.image || item.imageUrl || item.photoUrl || getMenuImage(item.name, categoryName),
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
