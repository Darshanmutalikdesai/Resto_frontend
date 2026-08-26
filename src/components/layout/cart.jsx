import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ShoppingBasket,
  Trash2,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { QtyStepper } from "../UI";
import { useCart } from "../../context/CartContext";
import { getMenuCatalogApi } from "../../lib/api/menuApi";
import { createOrderApi } from "../../lib/api/orderApi";
import { checkoutBillGroupApi } from "../../lib/api/billGroupApi";

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
  const gst = subtotal * 0.05;
  const total = subtotal + gst;
  const itemCount = items.reduce((sum, [, qty]) => sum + qty, 0);
  const amountToMinimum = Math.max(0, MIN_ORDER - subtotal);

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
      if (billGroupCode) {
        localStorage.removeItem("niyaaz-bill-group-code");
      }

      let history = [];
      try {
        const storedHistory = JSON.parse(localStorage.getItem("niyaaz-order-history") || "[]");
        history = Array.isArray(storedHistory) ? storedHistory : [];
      } catch {
        history = [];
      }
      localStorage.setItem("niyaaz-order-history", JSON.stringify([
        { ...order, items, total, tableNumber: normalizedTableNumber, createdAt: new Date().toISOString() },
        ...history,
      ]));

      await clearCart();
      setOrderPlaced(true);
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#e8f0eb] px-4 py-8 text-[#06483e] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center gap-3 border-b border-[#06483e]/15 pb-5 text-sm">
          <button type="button" onClick={() => navigate("/home")} className="flex items-center gap-2 font-semibold transition hover:text-[#f45b0c]">
            <ChevronLeft size={18} /> Home
          </button>
          <span className="text-[#06483e]/40">/</span>
          <span className="font-semibold text-[#f45b0c]">Your shopping cart</span>
        </div>

        {items.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[28px] bg-[#f7f0e6] px-6 text-center shadow-sm">
            <ShoppingBasket size={48} className="mb-5 text-[#f45b0c]" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your cart is empty</h1>
            <p className="mt-3 text-[#06483e]/65">Add something delicious from the menu.</p>
            <button type="button" onClick={() => navigate("/home")} className="mt-7 rounded-full bg-[#f45b0c] px-7 py-3 font-bold text-white transition hover:bg-[#d94805]">
              Browse menu
            </button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
            <section className="rounded-[28px] bg-[#f7f0e6] p-5 shadow-sm sm:p-8">
              <div className="mb-8 flex items-end justify-between gap-4 border-b border-[#06483e]/15 pb-5">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Your cart</h1>
                  <p className="mt-2 text-sm text-[#06483e]/65">Review your order before checkout.</p>
                </div>
                <span className="text-sm font-semibold">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_90px_150px_80px] gap-4 border-b border-[#06483e]/15 pb-3 text-xs font-bold uppercase tracking-wider text-[#06483e]/65 sm:grid">
                <span>Products</span><span>Price</span><span>Quantity</span><span>Total</span>
              </div>

              <div className="divide-y divide-[#06483e]/15">
                {items.map(([id, qty], index) => {
                  const product = productMap[String(id)] || menuItems.find((item) => String(item.id) === String(id));
                  if (!product) return null;
                  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
                  return (
                    <div key={id} className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_90px_150px_80px] sm:items-center">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${badgeColor} text-lg font-bold text-white`}>{qty}x</div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#06483e]">{product.name}</p>
                          <p className="mt-1 text-xs text-[#f45b0c]">{product.category || "Freshly prepared"}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-[#06483e]/55">{product.description || "Made fresh for your table."}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{fmt(product.price)}</span>
                      <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                        <QtyStepper qty={qty} onDec={() => updateQty(id, qty - 1)} onInc={() => updateQty(id, qty + 1)} className="rounded-full border-[#06483e]/20 bg-white/50" />
                        <button onClick={() => updateQty(id, 0)} className="text-[#06483e]/45 transition hover:text-red-600" type="button" aria-label={`Remove ${product.name}`}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <span className="text-right text-sm font-bold">{fmt(Number(product.price || 0) * qty)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="rounded-[24px] bg-[#06483e] p-6 text-white shadow-xl sm:p-7 lg:sticky lg:top-8">
              <div className="mb-6 border-b border-white/15 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Order summary</p>
                <div className="mt-4 flex items-end justify-between">
                  <h2 className="text-3xl font-semibold">Subtotal</h2>
                  <span className="text-xl font-bold text-[#ff7a00]">{fmt(subtotal)}</span>
                </div>
                <p className="mt-2 text-xs text-white/65">GST is calculated at 5% of your subtotal.</p>
              </div>

              <div className="space-y-3 border-b border-white/15 pb-5 text-sm">
                <div className="flex justify-between"><span className="text-white/70">GST (5%)</span><span>{fmt(gst)}</span></div>
                <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span className="text-[#ff7a00]">{fmt(total)}</span></div>
              </div>

              {tableError && <p className="mt-5 text-xs text-orange-200">{tableError}</p>}

              <button onClick={handleCheckout} disabled={isCheckingOut} type="button" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff6500] px-5 py-3.5 font-bold text-white transition hover:bg-[#e85400] disabled:cursor-wait disabled:opacity-60">
                <ArrowRight size={18} /> {isCheckingOut ? "Confirming order..." : "Confirm order"}
              </button>
              {amountToMinimum > 0 && <p className="mt-4 text-center text-xs leading-relaxed text-white/65">Add {fmt(amountToMinimum)} more to reach the minimum order.</p>}

            </aside>
          </div>
        )}
      </div>

      {orderPlaced && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl">
            <CheckCircle size={52} className="mx-auto mb-4 text-emerald-600" />
            <h2 className="text-2xl font-bold text-slate-900">Order placed successfully!</h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              We will serve you in another 10 minutes.
            </p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700"
            >
              Back to menu
            </button>
            <button
              type="button"
              onClick={() => navigate("/bill")}
              className="mt-3 w-full rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              View bill history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}