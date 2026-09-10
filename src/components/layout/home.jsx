import { useEffect, useState } from "react";
import { Minus, Plus, PhoneCall, Search, ShoppingBag, Split } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { getMenuCatalogApi } from "../../lib/api/menuApi";
import { callWaiterApi } from "../../lib/api/serviceApi";
import { CATEGORY_LIST } from "../../data/products";
import { normalizeCategoryName } from "../../lib/api/menuApiHelpers";
import niyaazLogo from "../../assets/image.png";

// Reads the current quantity of a product out of whatever shape `cart`
// happens to be (array of items, or an id -> qty map), trying the
// common field names. Falls back to 0 if nothing matches.
function getCartQuantity(cart, productId) {
  if (!cart) return 0;

  if (Array.isArray(cart)) {
    const match = cart.find(
      (entry) =>
        entry?.productId === productId ||
        entry?.id === productId ||
        entry?.menuItemId === productId ||
        entry?.product?.id === productId,
    );
    return Number(match?.quantity ?? match?.qty ?? 0);
  }

  if (typeof cart === "object") {
    return Number(cart[productId] ?? 0);
  }

  return 0;
}

function MenuItemCard({ product, index, quantity, onAdd, onIncrement, onDecrement }) {
  const hasQuantity = quantity > 0;

  return (
    <div
      className="niyaaz-card-enter group flex flex-col overflow-hidden rounded-[26px] border border-gray-100 bg-white shadow-[0_2px_12px_rgba(15,44,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,44,42,0.12)]"
      style={{ animationDelay: `${Math.min(index, 7) * 70}ms` }}
    >
      <div className="relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-36 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-44"
            loading="lazy"
          />
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 text-xs font-medium text-gray-400 sm:h-44">
            <ShoppingBag size={26} className="text-emerald-300" />
          </div>
        )}

        {product.category && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm backdrop-blur">
            {product.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3 className="text-[15px] font-bold leading-tight text-gray-900 sm:text-base">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-xs text-gray-500">
          {product.description || "Fresh, made to order"}
        </p>

        <p className="price-text mt-2 text-base font-bold text-[#06483e]">₹{product.price}</p>

        <div className="mt-2">
          {hasQuantity ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-1.5 py-1.5 text-white shadow-sm">
              <button
                type="button"
                onClick={onDecrement}
                aria-label={`Remove one ${product.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25 active:scale-95"
              >
                <Minus size={15} strokeWidth={2.75} />
              </button>

              <span className="flex flex-col items-center leading-none">
                <span className="text-sm font-bold">{quantity}</span>
                <span className="text-[9px] font-medium uppercase tracking-wide text-white/70">in cart</span>
              </span>

              <button
                type="button"
                onClick={onIncrement}
                aria-label={`Add one more ${product.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 transition hover:bg-white/25 active:scale-95"
              >
                <Plus size={15} strokeWidth={2.75} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-600 hover:text-white active:scale-[0.98] sm:text-sm"
            >
              <Plus size={14} strokeWidth={3} />
              Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cartApi = useCart();
  const { addToCart, cart } = cartApi;
  const [menuItems, setMenuItems] = useState([]);
  const [waiterMessage, setWaiterMessage] = useState("");
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMenuLoading, setIsMenuLoading] = useState(true);

  const handleCallWaiter = async () => {
    if (isCallingWaiter) {
      return;
    }

    try {
      const savedCustomer = JSON.parse(localStorage.getItem("niyaaz-customer") || "{}");
      const tableNumber = (savedCustomer.tableNumber || "").trim();

      if (!tableNumber) {
        setWaiterMessage("Please enter your table number first on the start screen.");
        return;
      }

      setIsCallingWaiter(true);
      setWaiterMessage("");

      await callWaiterApi({ tableNumber });
      setWaiterMessage("Waiter called successfully.");
    } catch {
      setWaiterMessage("Unable to call the waiter. Please try again.");
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // Increment: reuse addToCart, which is assumed to merge quantities
  // for an id already in the cart.
  const handleIncrement = async (productId) => {
    await addToCart(productId, 1);
  };

  // Decrement: try whichever removal/update function CartContext exposes.
  // Falls back to a no-op with a console warning if none is found, so this
  // never throws even if the context shape differs from what's assumed here.
  const handleDecrement = async (productId) => {
    const currentQty = getCartQuantity(cart, productId);

    if (typeof cartApi.updateQuantity === "function") {
      await cartApi.updateQuantity(productId, Math.max(currentQty - 1, 0));
      return;
    }
    if (typeof cartApi.decrementFromCart === "function") {
      await cartApi.decrementFromCart(productId, 1);
      return;
    }
    if (typeof cartApi.removeFromCart === "function") {
      await cartApi.removeFromCart(productId, 1);
      return;
    }

    console.warn("CartContext has no decrement/update/remove function available.");
  };

  useEffect(() => {
    let isMounted = true;

    const loadMenu = async () => {
      setIsMenuLoading(true);

      try {
        const items = await getMenuCatalogApi();
        if (isMounted) {
          setMenuItems(items);
        }
      } catch {
        if (isMounted) {
          setMenuItems([]);
        }
      } finally {
        if (isMounted) {
          setIsMenuLoading(false);
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
  const displayItems = isAllMenu
    ? menuItems
    : selectedCategory
      ? menuItems.filter((product) => {
          const productCategory = normalizeCategoryName(product.category || "");
          const productName = normalizeCategoryName(product.name || "");

          if (productCategory === selectedCategory || productCategory.includes(selectedCategory) || productName.includes(selectedCategory)) {
            return true;
          }

          if (selectedCategory === "rice-biryani") {
            return productCategory.includes("biryani") || productCategory.includes("biriyani") || productName.includes("biryani") || productName.includes("biriyani");
          }

          return false;
        })
      : menuItems;
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
  const menuCategories = CATEGORY_LIST;

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
                onClick={() => {
                  navigate(`/home?category=${encodeURIComponent(category.name)}`);
                }}
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
            {isMenuLoading ? (
              <div className="min-[480px]:col-span-2 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-6 text-center text-gray-500 sm:p-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700">Loading menu...</p>
                </div>
              </div>
            ) : previewItems.length > 0 ? (
              previewItems.map((product, idx) => (
                <MenuItemCard
                  key={product.id}
                  product={product}
                  index={idx}
                  quantity={getCartQuantity(cart, product.id)}
                  onAdd={() => addToCart(product.id, 1)}
                  onIncrement={() => handleIncrement(product.id)}
                  onDecrement={() => handleDecrement(product.id)}
                />
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