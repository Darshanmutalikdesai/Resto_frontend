import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ShoppingBasket,
  Trash2,
  ArrowRight,
  CheckCircle,
  ReceiptText,
} from "lucide-react";
import { QtyStepper } from "../UI";
import { useCart } from "../../context/CartContext";
import { getMenuCatalogApi } from "../../lib/api/menuApi";
import { createOrderApi } from "../../lib/api/orderApi";
import { checkoutBillGroupApi } from "../../lib/api/billGroupApi";
import { readLocalHistory, saveLocalHistory } from "../../lib/orderHistory";

const MIN_ORDER = 20;

const fmt = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(price || 0);

// Rotates through a small palette so basket rows read distinctly, matching
// the "1x / 2x" badge treatment from the design without hardcoding colors.
const BADGE_COLORS = ["bg-emerald-600", "bg-amber-500", "bg-sky-600", "bg-violet-600"];

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, updateQty, clearCart } = useCart();
  const [menuItems, setMenuItems] = useState([]);
  const [customerName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("niyaaz-customer") || "{}").name || "";
    } catch {
      return "";
    }
  });
  const [customerPhone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("niyaaz-customer") || "{}").phone || "";
    } catch {
      return "";
    }
  });
  const [tableError, setTableError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

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

  const productMap = useMemo(
    () => Object.fromEntries(menuItems.map((product) => [String(product.id), product])),
    [menuItems]
  );

  const items = Object.entries(cart).filter(([, qty]) => qty > 0);
  const subtotal = items.reduce((sum, [id, qty]) => {
    const product = productMap[String(id)] || menuItems.find((item) => String(item.id) === String(id));
    return sum + Number(product?.price || 0) * qty;
  }, 0);
  const total = subtotal;
  const itemCount = items.reduce((sum, [, qty]) => sum + qty, 0);
  const amountToMinimum = Math.max(0, MIN_ORDER - subtotal);
  const progressToMinimum = MIN_ORDER > 0 ? Math.min(100, (subtotal / MIN_ORDER) * 100) : 100;

  const handleCheckout = async () => {
    if (!items.length || isCheckingOut) {
      return;
    }

    const normalizedCustomerName = customerName.trim();
    const normalizedCustomerPhone = customerPhone.trim();
    let savedCustomer = {};
    try {
      savedCustomer = JSON.parse(localStorage.getItem("niyaaz-customer") || "{}");
    } catch {
      savedCustomer = {};
    }
    const normalizedTableNumber = String(savedCustomer.tableNumber || "").trim();
    if (!normalizedCustomerName || !normalizedCustomerPhone || !normalizedTableNumber) {
      setTableError("Please return to the start screen and add your table number first.");
      return;
    }

    setTableError("");
    setIsCheckingOut(true);
    try {
      const checkoutPayload = {
        items: items.map(([id, qty]) => ({
          menuItemId: Number(id),
          itemId: Number(id),
          quantity: qty,
        })),
        total,
        customerName: normalizedCustomerName,
        customerPhone: normalizedCustomerPhone,
        tableNumber: normalizedTableNumber,
      };
      const billGroupCode = localStorage.getItem("niyaaz-bill-group-code")?.trim();
      const order = billGroupCode
        ? await checkoutBillGroupApi(billGroupCode)
        : await createOrderApi(checkoutPayload);
      const orderItems = items.map(([id, qty]) => {
        const product = productMap[String(id)] || menuItems.find((item) => String(item.id) === String(id));
        const price = Number(product?.price || 0);

        return {
          menuItemId: Number(id),
          name: product?.name || `Item ${id}`,
          quantity: qty,
          price,
          total: price * qty,
        };
      });

      const history = readLocalHistory();
      saveLocalHistory([
        {
          ...order,
          items: orderItems,
          total,
          customerName: normalizedCustomerName,
          customerPhone: normalizedCustomerPhone,
          tableNumber: normalizedTableNumber,
          createdAt: new Date().toISOString(),
        },
        ...history,
      ]);

      await clearCart();
      if (billGroupCode) {
        localStorage.removeItem("niyaaz-bill-group-code");
      }
      setOrderPlaced(true);
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="relative min-h-screen cart-page px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="cart-home-button flex items-center gap-1.5 rounded-full px-3.5 py-2 font-semibold shadow-sm transition"
          >
            <ChevronLeft size={16} /> Home
          </button>
          <span className="text-[#06483e]/30">/</span>
          <span className="font-semibold text-[#f45b0c]">Your shopping cart</span>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty-state flex min-h-[58vh] flex-col items-center justify-center rounded-[32px] border px-6 text-center shadow-[0_8px_24px_rgba(6,72,62,0.06)]">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff1e6]">
              <ShoppingBasket size={34} className="text-[#f45b0c]" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your cart is empty</h1>
            <p className="mt-3 max-w-xs text-sm text-[#06483e]/60">
              Add something delicious from the menu to get started.
            </p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#f45b0c] px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(244,91,12,0.3)] transition hover:bg-[#d94805] active:scale-95"
            >
              Browse menu
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section className="rounded-[28px] border border-[#06483e]/8 bg-white p-4 shadow-[0_8px_24px_rgba(6,72,62,0.05)] sm:p-6">
              <div className="mb-6 flex items-end justify-between gap-4 border-b border-[#06483e]/10 pb-5">
                <div>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Your cart</h1>
                  <p className="mt-1 text-xs text-[#06483e]/55 sm:text-sm">Review your order before checkout.</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f4efe6] px-3 py-1.5 text-xs font-bold text-[#06483e]">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_90px_160px_90px] gap-4 pb-3 text-[11px] font-bold uppercase tracking-wider text-[#06483e]/45 sm:grid">
                <span>Product</span><span>Price</span><span>Quantity</span><span className="text-right">Total</span>
              </div>

              <div className="flex flex-col gap-3 sm:gap-0 sm:divide-y sm:divide-[#06483e]/8">
                {items.map(([id, qty], index) => {
                  const product = productMap[String(id)] || menuItems.find((item) => String(item.id) === String(id));
                  if (!product) return null;
                  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
                  return (
                    <div
                      key={id}
                      className="grid gap-3 rounded-2xl bg-[#faf8f4] p-3 sm:grid-cols-[minmax(0,1fr)_90px_160px_90px] sm:items-center sm:rounded-none sm:bg-transparent sm:p-0 sm:py-5"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${badgeColor} text-base font-black text-white shadow-sm sm:h-20 sm:w-20`}>
                          {qty}x
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-[#06483e]">{product.name}</p>
                          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#f45b0c]">
                            {product.category || "Freshly prepared"}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-[#06483e]/50 sm:line-clamp-2">
                            {product.description || "Made fresh for your table."}
                          </p>
                        </div>
                      </div>

                      <span className="hidden text-sm font-semibold text-[#06483e]/80 sm:block">{fmt(product.price)}</span>

                      <div className="flex items-center justify-between border-t border-[#06483e]/8 pt-3 sm:border-0 sm:pt-0 sm:justify-start sm:gap-3">
                        <span className="text-xs font-semibold text-[#06483e]/60 sm:hidden">{fmt(product.price)} each</span>
                        <div className="flex items-center gap-3">
                          <QtyStepper
                            qty={qty}
                            onDec={() => updateQty(id, qty - 1)}
                            onInc={() => updateQty(id, qty + 1)}
                            className="rounded-full border-[#06483e]/15 bg-white"
                          />
                          <button
                            onClick={() => updateQty(id, 0)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#06483e]/40 transition hover:bg-red-50 hover:text-red-600"
                            type="button"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <span className="text-right text-sm font-black text-[#06483e] sm:text-base">
                        {fmt(Number(product.price || 0) * qty)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="rounded-[28px] bg-[#06483e] p-6 text-white shadow-[0_16px_40px_rgba(6,72,62,0.28)] sm:p-7 lg:sticky lg:top-8">
              <div className="mb-5 flex items-center gap-2 text-white/70">
                <ReceiptText size={16} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Order summary</p>
              </div>

              <div className="space-y-2.5 border-b border-white/12 pb-5 text-sm text-white/75">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">{fmt(subtotal)}</span>
                </div>
              </div>

              <div className="flex items-baseline justify-between py-5">
                <span className="text-lg font-bold">Total</span>
                <span className="text-3xl font-black text-[#ff7a00]">{fmt(total)}</span>
              </div>

              {amountToMinimum > 0 && (
                <div className="mb-5 rounded-2xl bg-white/8 p-3.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#ff7a00] transition-all duration-500"
                      style={{ width: `${progressToMinimum}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-center text-xs leading-relaxed text-white/65">
                    Add {fmt(amountToMinimum)} more to reach the minimum order.
                  </p>
                </div>
              )}

              {tableError && (
                <p className="mb-4 rounded-xl bg-orange-500/15 px-3 py-2 text-xs text-orange-200">{tableError}</p>
              )}

              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff6500] px-5 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(255,101,0,0.35)] transition hover:bg-[#e85400] disabled:cursor-wait disabled:opacity-60"
              >
                {isCheckingOut ? "Confirming order..." : "Confirm order"}
                {!isCheckingOut && <ArrowRight size={17} strokeWidth={2.5} />}
              </button>
            </aside>
          </div>
        )}
      </div>

      {orderPlaced && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06483e]/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white px-6 py-9 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle size={36} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-[#06483e]">Order placed successfully!</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#06483e]/60">
              We will serve you in another 10 minutes.
            </p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="mt-7 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-emerald-700"
            >
              Back to menu
            </button>
            <button
              type="button"
              onClick={() => navigate("/bill")}
              className="mt-3 w-full rounded-2xl border border-[#06483e]/15 px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-[#06483e] transition hover:bg-[#f4efe6]"
            >
              View bill history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}