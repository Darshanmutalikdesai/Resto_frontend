import React, { useEffect, useState } from "react";
import { PhoneCall, Search, Split } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { getMenuCatalogApi } from "../../lib/api/menuApi";
import { callWaiterApi } from "../../lib/api/serviceApi";
import { CATEGORY_LIST } from "../../data/products";
import { normalizeCategoryName } from "../../lib/api/menuApiHelpers";
import niyaazLogo from "../../assets/image.png";

const CATEGORY_ICONS = {
  starters: { emoji: "🍢", bg: "bg-orange-100" },
  biryani: { emoji: "🍚", bg: "bg-yellow-100" },
  desserts: { emoji: "🍮", bg: "bg-pink-100" },
  "chef-s-special": { emoji: "🍽️", bg: "bg-emerald-100" },
  "house-speciality": { emoji: "👨‍🍳", bg: "bg-red-100" },
  indian: { emoji: "🍛", bg: "bg-orange-100" },
  chinese: { emoji: "🥡", bg: "bg-rose-100" },
  soup: { emoji: "🍲", bg: "bg-amber-100" },
  drinks: { emoji: "🥤", bg: "bg-cyan-100" },
  beverages: { emoji: "🥤", bg: "bg-cyan-100" },
  "main-course": { emoji: "🍛", bg: "bg-amber-100" },
  breads: { emoji: "🫓", bg: "bg-stone-100" },
  pizza: { emoji: "🍕", bg: "bg-red-100" },
  burgers: { emoji: "🍔", bg: "bg-orange-100" },
  salads: { emoji: "🥗", bg: "bg-green-100" },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const [menuItems, setMenuItems] = useState([]);
  const [waiterMessage, setWaiterMessage] = useState("");
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const handleCallWaiter = async () => {
    const tableNumber = window.prompt("Please enter your table number");
    if (!tableNumber?.trim() || isCallingWaiter) {
      return;
    }

    setIsCallingWaiter(true);
    setWaiterMessage("");
    try {
      await callWaiterApi({ tableNumber });
      setWaiterMessage("Waiter called successfully.");
    } catch {
      setWaiterMessage("Unable to call the waiter. Please try again.");
    } finally {
      setIsCallingWaiter(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadMenu = async () => {
      try {
        const items = await getMenuCatalogApi();
        if (isMounted) {
          setMenuItems(items);
        }
      } catch {
        if (isMounted) {
          setMenuItems([]);
        }
      }
    };

    loadMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCategory = normalizeCategoryName(searchParams.get("category"));
  const isAllMenu = selectedCategory === "all";
  const categoryItems = selectedCategory && !isAllMenu
    ? menuItems.filter((product) => product.category === selectedCategory)
    : [];
  const displayItems = isAllMenu ? menuItems : selectedCategory ? categoryItems : menuItems;
  const filteredItems = displayItems.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase().includes(query);
  });
  const previewItems = searchQuery.trim() || selectedCategory ? filteredItems : filteredItems.slice(0, 4);
  const menuSuggestions = menuItems
    .filter((product) => {
      const query = searchQuery.trim().toLowerCase();
      return !query || `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase().includes(query);
    })
    .filter((product, index, products) => products.findIndex((item) => item.name === product.name) === index)
    .slice(0, 6);
  const menuCategories = [
    ...CATEGORY_LIST,
    ...menuItems
      .filter((product) => product.category && !CATEGORY_LIST.some((category) => normalizeCategoryName(category.name) === product.category))
      .map((product) => ({
        id: product.category,
        name: product.category
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        emoji: CATEGORY_ICONS[product.category]?.emoji || "🍽️",
        bg: CATEGORY_ICONS[product.category]?.bg || "bg-gray-100",
      }))
      .filter((category, index, categories) => categories.findIndex((item) => item.id === category.id) === index),
  ];

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="niyaaz-page-enter sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="flex items-center gap-3">
            <img src={niyaazLogo} alt="Niyaaz" className="niyaaz-logo-animation h-11 w-32 object-contain object-left sm:h-16 sm:w-48" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCallWaiter}
              disabled={isCallingWaiter}
              className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm"
            >
              <PhoneCall size={16} />
              {isCallingWaiter ? "Calling..." : "Call Waiter"}
            </button>
          </div>
        </div>
        {waiterMessage && <p className="border-t border-gray-100 px-6 py-2 text-center text-xs font-medium text-emerald-700">{waiterMessage}</p>}
      </div>

      <div className="niyaaz-page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="relative mb-8 flex min-h-14 items-center justify-center">
          <div className={`relative flex items-center overflow-hidden rounded-full border border-emerald-700/10 bg-gray-50 transition-all duration-300 ${isSearchOpen ? "w-full max-w-md px-4" : "w-14"}`}>
            {isSearchOpen && (
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search the menu"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-gray-700 placeholder-gray-400 outline-none"
                type="search"
              />
            )}
            <button
              type="button"
              onClick={() => setIsSearchOpen((open) => !open)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-700/25 transition duration-300 hover:scale-105 hover:bg-emerald-800 active:scale-95"
              aria-label={isSearchOpen ? "Close search" : "Search menu"}
            >
              <Search size={24} strokeWidth={2.5} className="transition-transform duration-300" />
            </button>
          </div>
          {isSearchOpen && menuSuggestions.length > 0 && (
            <div className="absolute top-16 z-40 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-left shadow-xl">
              <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Menu suggestions
              </p>
              {menuSuggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setSearchQuery(product.name);
                    setIsSearchOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <span className="truncate">{product.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-gray-400">{product.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={() => navigate("/split-bill")} className="niyaaz-section-enter mb-10 flex w-full items-center justify-between rounded-[24px] bg-[#06483e] p-6 text-left text-white shadow-xl transition hover:bg-[#075b4e] sm:p-7">
          <span>
            <span className="flex items-center gap-2 font-semibold"><Split size={20} className="text-[#ff7a00]" /> Split the bill</span>
            <span className="mt-2 block text-sm text-white/65">Create or join a group bill with your table.</span>
          </span>
          <span className="rounded-full bg-[#ff7a00] px-4 py-2 text-sm font-bold">Open</span>
        </button>

        <div className="niyaaz-section-enter mb-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Menu Categories</h2>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => navigate("/categories")}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Show All
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {menuCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => navigate(`/home?category=${encodeURIComponent(category.name)}`)}
                className={`flex min-w-[112px] flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:shadow-md ${
                  selectedCategory === normalizeCategoryName(category.name)
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${category.bg}`}>
                  {category.emoji}
                </span>
                <span className="text-xs font-semibold text-gray-800">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="niyaaz-section-enter niyaaz-section-enter-delay mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isAllMenu ? "All Menu" : selectedCategory ? `${searchParams.get("category")} Menu` : "Featured Menu"}
            </h2>
            {!selectedCategory && (
              <button
                type="button"
                onClick={() => navigate("/categories")}
                className="text-sm font-semibold text-red-500 hover:text-red-600"
              >
                See All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {previewItems.length > 0 ? (
              previewItems.map((product) => (
                <div
                  key={product.id}
                  className="niyaaz-card-enter flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  style={{ animationDelay: `${Math.min(previewItems.indexOf(product), 7) * 70}ms` }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-36 w-full object-cover sm:h-40"
                    loading="lazy"
                  />
                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <h3 className="font-bold text-gray-900 text-base mb-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{product.description || product.category || "Fresh menu item"}</p>
                    <div className="flex items-center justify-end gap-3 mb-3">
                      <span className="font-bold text-emerald-600">₹{product.price}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await addToCart(product.id, 1);
                      }}
                      className="mt-auto w-full rounded-xl bg-emerald-600 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-700 sm:px-3 sm:text-sm"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500 min-[480px]:col-span-2 sm:p-8">
                {selectedCategory
                  ? `No ${searchParams.get("category")} items are available yet.`
                  : searchQuery
                    ? `No menu items match "${searchQuery}".`
                    : "No menu items available yet. Connect the backend and refresh the page."}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
