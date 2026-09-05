import { useEffect, useState } from "react";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { myOrdersApi } from "../../lib/api/orderApi";

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

function readLocalHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("niyaaz-order-history") || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function getOrderItems(order) {
  const items = order?.items || order?.orderItems || order?.data?.items || [];

  if (Array.isArray(items)) {
    return items;
  }

  if (items && typeof items === "object") {
    return Object.entries(items).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  }

  return [];
}

export default function Bill() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(readLocalHistory);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadOrders = async () => {
    setIsLoading(true);
    const localOrders = readLocalHistory();
    try {
      const response = await myOrdersApi();
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
      setOrders(localOrders);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-[#fff7ed] px-4 py-8 text-[#06483e] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-[#06483e]/15 pb-5">
          <button type="button" onClick={() => navigate("/home")} className="flex items-center gap-2 text-sm font-semibold hover:text-[#f45b0c]"><ArrowLeft size={18} /> Home</button>
          <button type="button" onClick={loadOrders} disabled={isLoading} aria-label="Refresh bill history" className="rounded-full border border-[#06483e]/15 p-2 hover:border-[#f45b0c] disabled:opacity-50"><RefreshCw size={17} /></button>
        </div>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f45b0c]">Final step</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Your bill</h1><p className="mt-3 text-sm text-[#06483e]/65">Review everything ordered at your table.</p></div>
          <FileText className="hidden text-[#f45b0c] sm:block" size={44} />
        </div>
        {message && <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">{message}</p>}
        {isLoading ? <p className="rounded-2xl bg-white p-6 text-sm text-[#06483e]/65">Loading order history...</p> : orders.length === 0 ? (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-bold">No confirmed orders yet</h2><p className="mt-2 text-sm text-[#06483e]/60">Add dishes to your cart, confirm the order, and your bill will appear here.</p><button type="button" onClick={() => navigate("/home")} className="mt-6 rounded-full bg-[#f45b0c] px-6 py-3 text-sm font-bold text-white">Browse menu</button></section>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const items = getOrderItems(order);
              const total = order.total ?? order.grandTotal ?? order.amount;
              const customerName = order.customerName || order.customer?.name || order.user?.name;
              return <section key={order.id || order.orderId || `${order.createdAt}-${index}`} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#06483e]/10 pb-4"><div><p className="font-bold">Order {order.orderNumber || order.orderId || order.id || `#${orders.length - index}`}</p><p className="mt-1 text-xs text-[#06483e]/55">{customerName ? `Name: ${customerName} · ` : ""}Table {order.tableNumber || "-"} {order.createdAt ? `· ${new Date(order.createdAt).toLocaleString("en-IN")}` : ""}</p></div><p className="text-lg font-black text-[#f45b0c]">{formatCurrency(total)}</p></div>
                <div className="mt-4 space-y-2 text-sm">{items.length ? items.map((item, itemIndex) => <div key={item.id || item.menuItemId || itemIndex} className="flex justify-between gap-4"><span>{item.quantity || item.qty || 1}x {item.name || item.menuItemName || `Item ${item.menuItemId || item.itemId || ""}`}</span><span className="font-semibold">{formatCurrency(item.total ?? item.price)}</span></div>) : <p className="text-[#06483e]/55">Items are available in the order details.</p>}</div>
              </section>;
            })}
          </div>
        )}
      </div>
    </main>
  );
}
