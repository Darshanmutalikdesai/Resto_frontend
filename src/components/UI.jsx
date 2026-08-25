import React from "react";
import { FileText, Home, ShoppingCart, Utensils } from "lucide-react";

export const GreenButton = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition ${className}`}
    type="button"
  >
    {children}
  </button>
);

export const ScreenHeader = ({ title, subtitle, right, className = "" }) => (
  <div className={`mb-6 flex items-center justify-between ${className}`}>
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const QtyStepper = ({ qty, onInc, onDec, className = "" }) => (
  <div className={`flex items-center gap-2 border border-gray-300 rounded-lg ${className}`}>
    <button onClick={onDec} className="px-3 py-1 hover:bg-gray-100" type="button">
      −
    </button>
    <span className="px-4 py-1">{qty}</span>
    <button onClick={onInc} className="px-3 py-1 hover:bg-gray-100" type="button">
      +
    </button>
  </div>
);

export const ProductTile = ({ product = {}, qty = 0, onAdd, className = "" }) => (
  <div className={`bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition ${className}`}>
    <div className={`h-40 flex items-center justify-center text-4xl ${product.bg || "bg-gray-100"}`}>
      {product.emoji || "🍏"}
    </div>
    <div className="p-4">
      <h3 className="font-semibold text-lg text-gray-900 mb-1">{product.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{product.unit || product.description || "Fresh grocery item"}</p>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-xl font-bold text-emerald-600">₹{product.price ?? "0"}</span>
      </div>
      <button onClick={onAdd} className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white" type="button">
        Add to cart{qty ? ` (${qty})` : ""}
      </button>
    </div>
  </div>
);

export const BottomNav = ({ active = "home", cartCount = 0, onNavigate }) => {
  const items = [
    { key: "home", label: "Home", icon: Home, path: "/home" },
    { key: "menu", label: "Menu", icon: Utensils, path: "/categories" },
    { key: "cart", label: "Cart", icon: ShoppingCart, path: "/cart" },
    { key: "bill", label: "Bill", icon: FileText, path: "/bill" },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 rounded-t-[22px] border border-white/10 bg-[#111827]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm sm:bottom-4 sm:w-[min(92vw,420px)] sm:rounded-[24px] sm:pb-2"
    >
      <div className="flex items-center gap-1">
        {items.map(({ key, label, icon: Icon, path }) => {
          const isActive = active === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate?.(path)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-medium transition ${
                isActive ? "bg-white text-gray-950 shadow-sm" : "text-white/60 hover:text-white"
              }`}
            >
              <span className="relative">
                <Icon size={18} strokeWidth={2.2} />
                {key === "cart" && cartCount > 0 && (
                  <span className="absolute -right-3 -top-3 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {cartCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
