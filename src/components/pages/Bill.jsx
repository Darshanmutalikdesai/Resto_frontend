import { useEffect, useState } from "react";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { myOrdersApi } from "../../lib/api/orderApi";
import { readLocalHistory } from "../../lib/orderHistory";

const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));

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

  const demoItems = [
    { name: "Korean Chicken Bao", quantity: 1, price: 401, total: 401 },
    { name: "Mushroom Corn Pizza", quantity: 1, price: 516, total: 516 },
    { name: "Drums Of Heaven", quantity: 1, price: 399, total: 399 },
  ];

  const firstOrderItems = orders[0] ? getOrderItems(orders[0]) : demoItems;
  const tabTotal = orders[0]?.total ?? 1520;
  const runningTabTotal = 2459;
  const thisRoundTotal = 939;

  return (
    <main className="min-h-screen bg-[#f4efe7] px-4 py-5 text-[#0f2c2a] sm:px-6">
      <div className="mx-auto max-w-[420px]">
        {message && <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">{message}</p>}

        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-dashed border-[#06483e]/25 bg-white/70 text-sm font-semibold text-[#06483e]/65">
            Loading bill...
          </div>
        ) : (
          <>
            <div className="rounded-[30px] border-[3px] border-[#1c1c1c] bg-[#f5d52d] p-4 shadow-[0_10px_0_#1c1c1c]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-sm border-2 border-[#1c1c1c] bg-white/80" />
                  <h1 className="text-2xl font-black uppercase tracking-tight">YOUR TAB</h1>
                </div>
                <div className="text-3xl font-black text-[#1c1c1c]">{formatCurrency(tabTotal)}</div>
              </div>

              <div className="mb-4 border-b-2 border-dashed border-[#1c1c1c]/70 pb-4" />

              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full border-2 border-[#1c1c1c] bg-[#f5d52d] shadow-[inset_0_0_0_4px_#1c1c1c]" />
                  <div>
                    <p className="text-2xl font-black">Round 1</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-[#1c1c1c]/40 bg-[#e8efe5] px-2.5 py-1.5 shadow-inner"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#1c1c1c]/40 bg-[#f5d52d]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1c1c1c]" />
                  </span>
                  <span className="text-base font-semibold">Ordered</span>
                </button>
              </div>

              <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-[#1c1c1c]/80">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/60 text-xs">◔</span>
                <span>At your table</span>
              </div>

              <div className="space-y-3 pb-2 text-lg font-bold text-[#1c1c1c]">
                {firstOrderItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
                    <span className="font-extrabold">
                      {item.quantity || 1}x {item.name}
                    </span>
                    <span className="font-black">{formatCurrency(item.total ?? item.price)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-[#1c1c1c]/60 pt-4 text-[15px] font-semibold italic text-[#1c1c1c]/80">
                <span className="font-serif italic">Inclusive of all taxes (SC + GST)</span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/bill")}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-[22px] border-[3px] border-[#1c1c1c] bg-[#0f1a1c] px-5 py-4 text-2xl font-black uppercase tracking-tight text-[#f4efe7] shadow-[0_8px_0_#1c1c1c]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f4efe7] text-[#0f1a1c]">📄</span>
                <span>VIEW BILL</span>
              </button>
            </div>

            <div className="mt-6 rounded-[28px] border-[3px] border-[#1c1c1c] bg-[#f4efe7] p-4 shadow-[0_8px_0_#1c1c1c]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <p className="text-2xl font-black uppercase tracking-tight">RUNNING TAB</p>
                <div className="text-right">
                  <p className="text-3xl font-black">{formatCurrency(runningTabTotal)}</p>
                  <p className="text-sm italic text-[#1c1c1c]/70">Inclusive of all taxes</p>
                </div>
              </div>

              <div className="mb-4 rounded-2xl bg-[#e8e1d4] px-4 py-3 text-xl font-black text-[#0f2c2a]">
                <div className="flex items-center justify-between gap-3">
                  <span className="uppercase text-base">+ THIS ROUND</span>
                  <span>{formatCurrency(thisRoundTotal)}</span>
                </div>
              </div>

              <div className="mb-4 text-xl font-black uppercase tracking-tight">YOUR ORDER</div>

              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#1c1c1c]/20 bg-[#f5f2ee] p-3">
                <div>
                  <p className="text-[17px] font-black">Bull Frog (Glass)</p>
                  <p className="text-sm text-[#1c1c1c]/60">₹850 each</p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ef7b7b] bg-[#f7dada] text-xl font-black text-[#d94e4e]">
                    −
                  </button>
                  <span className="min-w-[20px] text-center text-lg font-black">1</span>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#66b88a] bg-[#d9f0df] text-xl font-black text-[#267a46]">
                    +
                  </button>
                </div>

                <div className="text-2xl font-black">₹850</div>
              </div>

              <div className="mt-5">
                <label className="block text-xl font-black uppercase tracking-tight text-[#0f2c2a]">
                  NOTE FOR KITCHEN / BAR (OPTIONAL)
                </label>
                <textarea
                  className="mt-3 w-full min-h-[74px] rounded-[20px] border-[3px] border-[#1c1c1c] bg-[#f7f5f1] px-4 py-3 text-base text-[#1c1c1c] placeholder:text-[#1c1c1c]/45 focus:border-[#1c1c1c] focus:outline-none"
                  placeholder="e.g. extra spicy, no ice, less sugar..."
                />
              </div>

              <button
                type="button"
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-[22px] border-[3px] border-[#1c1c1c] bg-gradient-to-r from-[#f6c0d8] via-[#edc0d5] to-[#f1d5a9] px-5 py-4 text-2xl font-black uppercase tracking-tight text-[#0f1a1c] shadow-[0_8px_0_#1c1c1c]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f1f6] text-lg">📱</span>
                <span>PLACE ORDER</span>
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
