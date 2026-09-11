import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChefHat, FileText, Flame, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CookingLoader from "../CookingLoader";
import { getCombinedBillApi } from "../../lib/api/billGroupApi";
import { generateOrderBillApi, myOrdersApi } from "../../lib/api/orderApi";
import { getApiErrorMessage } from "../../lib/apiClient";
import {
  clearGeneratedBill,
  readGeneratedBill,
  readLocalHistory,
  saveGeneratedBill,
} from "../../lib/orderHistory";

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const GST_RATE = 0.18;

function getOrderItems(order) {
  const items = order?.items || order?.orderItems || order?.data?.items || order?.data?.orderItems || [];

  if (Array.isArray(items)) {
    return items;
  }

  if (items && typeof items === "object") {
    return Object.entries(items).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  }

  return [];
}

function getItemId(item) {
  return item?.menuItemId ?? item?.itemId ?? item?.productId ?? item?.menuItem?.id ?? item?.product?.id;
}

function getItemQuantity(item) {
  return Number(item?.quantity ?? item?.qty ?? 1);
}

function getItemPrice(item) {
  return Number(item?.price ?? item?.unitPrice ?? item?.menuItem?.price ?? item?.product?.price ?? 0);
}

function getItemAmount(item) {
  return Number(item?.total ?? item?.lineTotal ?? item?.amount ?? getItemPrice(item) * getItemQuantity(item));
}

function mergeBillItems(billItems, fallbackItems) {
  return billItems.map((item, index) => {
    const itemId = getItemId(item);
    const fallback = fallbackItems.find((candidate) => String(getItemId(candidate)) === String(itemId)) || fallbackItems[index];
    const quantity = getItemQuantity(item);
    const amount = getItemAmount(item) || getItemAmount(fallback);

    return {
      ...fallback,
      ...item,
      name: item?.name || item?.itemName || item?.menuItemName || item?.menuItem?.name || fallback?.name || fallback?.itemName,
      price: getItemPrice(item) || getItemPrice(fallback),
      quantity,
      total: amount,
    };
  });
}

function getBillGroupItems(groupBill) {
  const items = groupBill?.combined?.items || groupBill?.items || [];

  if (Array.isArray(items)) {
    return items;
  }

  return [];
}

function getOrderBill(response) {
  return response?.bill
    || response?.data?.bill
    || response?.data?.data?.bill
    || (response?.items || response?.totalAmount || response?.orderNumber ? response : null);
}

// Empty-bill state — same visual language as CookingLoader (brand mark,
// steaming pot scene, eyebrow + heading rhythm) but themed around
// "no order yet" instead of "menu is loading". Reuses the existing
// .cooking-loader__* classes so it picks up the same stylesheet.
function AwaitingOrder({ onBrowseMenu }) {
  return (
    <main className="cooking-loader" aria-label="No order placed yet">
      <div className="cooking-loader__pattern" />
      <div className="cooking-loader__content">
        <div className="cooking-loader__brand">
          <span className="cooking-loader__brand-mark" aria-hidden="true">
            <ChefHat size={22} strokeWidth={2.5} />
          </span>
          <span>NIYAAZ</span>
        </div>

        <div className="cooking-loader__scene" aria-hidden="true">
          <div className="cooking-loader__steam cooking-loader__steam--one" />
          <div className="cooking-loader__steam cooking-loader__steam--two" />
          <div className="cooking-loader__steam cooking-loader__steam--three" />
          <div className="cooking-loader__pot">
            <div className="cooking-loader__food" />
            <div className="cooking-loader__handle cooking-loader__handle--left" />
            <div className="cooking-loader__handle cooking-loader__handle--right" />
          </div>
          <div className="cooking-loader__flame"><Flame size={25} fill="currentColor" /></div>
          <Sparkles className="cooking-loader__spark cooking-loader__spark--one" size={18} />
          <Sparkles className="cooking-loader__spark cooking-loader__spark--two" size={14} />
        </div>

        <p className="cooking-loader__eyebrow">No order placed yet</p>
        <h1>Your bill will appear<br /><em>once you order.</em></h1>
        <p className="cooking-loader__note">Add a few dishes, then come back to view the receipt</p>

        <button
          type="button"
          onClick={onBrowseMenu}
          className="cooking-loader__cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "1.5rem",
            padding: "0.85rem 1.75rem",
            borderRadius: "9999px",
            border: "2.5px solid #e0764a",
            background: "transparent",
            color: "#e0764a",
            fontWeight: 800,
            fontSize: "0.95rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "background-color 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e0764a";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#e0764a";
          }}
        >
          <span>Browse Menu</span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </main>
  );
}

export default function Bill() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(readLocalHistory);
  const savedGeneratedBill = readGeneratedBill();
  const [orderBill, setOrderBill] = useState(savedGeneratedBill?.bill || null);
  const [generatedBillExpiresAt, setGeneratedBillExpiresAt] = useState(savedGeneratedBill?.expiresAt || null);
  const [groupBill, setGroupBill] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [message, setMessage] = useState("");

  const loadOrders = async () => {
    setIsLoading(true);
    const localOrders = readLocalHistory();
    try {
      const response = await myOrdersApi();
      const bill = getOrderBill(response);
      if (bill && !readGeneratedBill()) {
        setOrderBill(bill);
      }
      const remoteOrders = response?.orders || response?.data?.orders || response?.data || response;
      if (Array.isArray(remoteOrders)) {
        const localIds = new Set(localOrders.map((order) => order.id || order.orderId || order.orderNumber).filter(Boolean));
        setOrders([
          ...localOrders,
          ...remoteOrders.filter((order) => !localIds.has(order.id || order.orderId || order.orderNumber)),
        ]);
      }
      setMessage("");
    } catch {
      setMessage("Showing orders confirmed on this device.");
      if (!readGeneratedBill()) {
        setOrderBill(null);
      }
      setOrders(localOrders);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupBill = async () => {
    const storedBillGroupCode = localStorage.getItem("niyaaz-bill-group-code")?.trim();

    if (!storedBillGroupCode) {
      setGroupBill(null);
      return;
    }

    try {
      const bill = await getCombinedBillApi(storedBillGroupCode);
      setGroupBill(bill);
    } catch {
      setGroupBill(null);
    }
  };

  const handleGenerateBill = async () => {
    const currentOrderId = currentOrder ? currentOrder.id ?? currentOrder.orderId ?? currentOrder.orderNumber : null;

    if (!currentOrderId) {
      setMessage("No order is available to generate a bill for.");
      return;
    }

    setIsGeneratingBill(true);
    setMessage("");

    try {
      const result = await generateOrderBillApi(currentOrderId);
      const billData = result?.bill ?? result?.data?.bill ?? result?.data ?? result;
      const generatedBill = typeof billData === "object" && billData ? billData : currentOrder;
      const expiresAt = saveGeneratedBill(generatedBill);
      setOrderBill(generatedBill);
      setGeneratedBillExpiresAt(expiresAt);

      setOrders((previousOrders) =>
        previousOrders.map((order) => {
          const orderId = order.id ?? order.orderId ?? order.orderNumber;

          if (String(orderId) !== String(currentOrderId)) {
            return order;
          }

          return {
            ...order,
            ...(typeof billData === "object" && billData ? billData : {}),
          };
        }),
      );

      setMessage(result?.message || "Bill generated successfully.");
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to generate bill."));
    } finally {
      setIsGeneratingBill(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadGroupBill();
  }, []);

  useEffect(() => {
    if (!generatedBillExpiresAt) {
      return undefined;
    }

    const remaining = Math.max(0, generatedBillExpiresAt - Date.now());
    const timeoutId = window.setTimeout(() => {
      clearGeneratedBill();
      setOrderBill(null);
      setGeneratedBillExpiresAt(null);
      setOrders([]);
      setGroupBill(null);
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [generatedBillExpiresAt]);

  const currentOrder = orders[0] ?? null;
  const firstOrderItems = currentOrder ? getOrderItems(currentOrder) : [];
  const orderBillItems = mergeBillItems(getOrderItems(orderBill), firstOrderItems);
  const billGroupItems = getBillGroupItems(groupBill);
  const displayedItems = billGroupItems.length ? billGroupItems : orderBillItems.length ? orderBillItems : firstOrderItems;
  const subtotal = displayedItems.reduce(
    (sum, item) => sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 1))),
    0,
  );
  const taxableAmount = subtotal / (1 + GST_RATE);
  const gstAmount = subtotal - taxableAmount;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount - cgstAmount;
  const billTotal = Number(orderBill?.totalAmount || 0);
  const grandTotal = groupBill ? subtotal : billTotal || subtotal;
  const itemQuantity = displayedItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const orderNumber = orderBill?.orderNumber || currentOrder?.orderNumber || currentOrder?.id || "—";
  const tableName = currentOrder?.tableNumber || currentOrder?.tableName || "—";
  const customerName = currentOrder?.customerName || "—";
  const currentOrderId = currentOrder ? currentOrder.id ?? currentOrder.orderId ?? currentOrder.orderNumber : null;
  const billGroupCode = groupBill?.group?.code || localStorage.getItem("niyaaz-bill-group-code")?.trim() || "—";
  const isBillGenerated = Boolean(generatedBillExpiresAt);
  const receiptTitle = groupBill ? "Shared Bill" : "Receipt";
  const receiptMetadataLabel = groupBill ? "Group" : "Table";
  const receiptMetadataValue = groupBill ? billGroupCode : tableName;
  const orderTimestamp = (groupBill?.group?.createdAt || currentOrder?.createdAt)
    ? new Date(groupBill?.group?.createdAt || currentOrder?.createdAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "—";

  if (isLoading) {
    return <CookingLoader />;
  }

  if (!displayedItems.length) {
    return <AwaitingOrder onBrowseMenu={() => navigate("/home")} />;
  }

  return (
    <main className="bill-page min-h-screen bg-[#f5efe7] px-4 py-6 text-[#0f2c2a] sm:px-6">
      <div className="mx-auto max-w-[430px]">
        {message && <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">{message}</p>}

        <div className="overflow-hidden rounded-[32px] border-[3px] border-[#0f2c2a] bg-[#f8f1ea] shadow-[0_12px_0_#0f2c2a]">
          <div className="bg-[#0f2c2a] px-4 pb-4 pt-3 text-[#f8efe7]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white"
                  aria-label="Go back"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f8efe7]/50 bg-[#f8efe7] text-[#0f2c2a]">
                  <FileText size={18} />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f8efe7]/70">NIYAAZ</p>
                  <p className="text-xl font-black uppercase tracking-tight">{receiptTitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadOrders}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white"
                aria-label="Refresh bill"
              >
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="bg-[#f8f1ea] px-4 pb-4 pt-4">
            <div className="rounded-[22px] border border-[#0f2c2a]/15 bg-white p-4 shadow-[0_8px_18px_rgba(15,44,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0f2c2a]/55">{receiptMetadataLabel}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight">{receiptMetadataValue}</p>
                  <p className="mt-1 text-xs font-semibold text-[#0f2c2a]/65">Customer: {customerName}</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0f2c2a]/55">{groupBill ? "Total" : "Order"}</p>
                  <p className="mt-1 text-xl font-black">{groupBill ? formatCurrency(grandTotal) : `#${orderNumber}`}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#0f2c2a]/30 pt-3 text-[11px] font-semibold text-[#0f2c2a]/65">
                <span>{orderTimestamp}</span>
                <span className="rounded-full bg-[#e6f4ed] px-2 py-1 font-black text-[#0f2c2a]">Open</span>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#0f2c2a]/15 bg-white p-4 shadow-[0_8px_18px_rgba(15,44,42,0.04)]">
              <div className="mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-[#0f2c2a]/60">
                <span>Item</span>
                <span className="mr-4">Qty</span>
                <span>Amount</span>
              </div>

              <div className="space-y-3">
                {displayedItems.map((item, index) => {
                  const qty = Number(item.quantity || 1);
                  const amount = Number(item.total ?? (Number(item.price || 0) * qty));

                  return (
                    <div key={`${item.name || item.menuItemName || item.menuItemId || "item"}-${index}`} className="flex items-start justify-between gap-3 text-[#0f2c2a]">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black leading-tight">{item.name || item.menuItemName || "Menu item"}</p>
                        <p className="text-xs text-[#0f2c2a]/55">{formatCurrency(Number(item.price || 0))} each</p>
                      </div>

                      <div className="w-8 text-center text-sm font-bold text-[#0f2c2a]/80">{qty}</div>
                      <div className="min-w-[72px] text-right text-base font-black">{formatCurrency(amount)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bill-summary mt-4 rounded-[22px] border border-[#0f2c2a]/15 bg-[#f2f7f4] p-4 shadow-[inset_0_0_0_1px_rgba(15,44,42,0.02)]">
              <div className="space-y-2 text-sm text-[#0f2c2a]">
                <div className="flex items-center justify-between">
                  <span className="text-[#0f2c2a]/70">Taxable value</span>
                  <span className="font-semibold">{formatCurrency(taxableAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#0f2c2a]/70">CGST (9%)</span>
                  <span className="font-semibold">{formatCurrency(cgstAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#0f2c2a]/70">SGST (9%)</span>
                  <span className="font-semibold">{formatCurrency(sgstAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-[#0f2c2a]/20 pt-2">
                  <span className="font-semibold text-[#0f2c2a]/70">Item total (GST included)</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <div className="mt-4 border-t border-dashed border-[#0f2c2a]/30 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f2c2a]/60">Total</p>
                    <p className="mt-1 text-3xl font-black tracking-tight">{formatCurrency(grandTotal)}</p>
                  </div>

                  <div className="rounded-full bg-[#0f2c2a] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#f8efe7]">
                    {itemQuantity} items
                  </div>
                </div>

                {isBillGenerated ? (
                  <div className="mt-4 w-full rounded-2xl bg-[#dcefe5] px-4 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-[#0f2c2a]">
                    Bill generated
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateBill}
                    disabled={isGeneratingBill || !currentOrderId || groupBill}
                    className="mt-4 w-full rounded-2xl bg-[#0f2c2a] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#f8efe7] transition hover:bg-[#123734] disabled:cursor-not-allowed disabled:bg-[#0f2c2a]/50"
                  >
                    {isGeneratingBill ? "Generating..." : "Generate Bill"}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}