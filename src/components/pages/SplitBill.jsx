import { useState } from "react";
import { ArrowLeft, Split, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createBillGroupApi, getCombinedBillApi, joinBillGroupApi } from "../../lib/api/billGroupApi";

export default function SplitBill() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [combinedBill, setCombinedBill] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const customerName = (() => {
    try {
      return JSON.parse(localStorage.getItem("niyaaz-customer") || "{}").name || "";
    } catch {
      return "";
    }
  })();

  const runAction = async (action, successMessage) => {
    setIsLoading(true);
    setMessage("");
    try {
      const result = await action();
      if (result?.code || result?.billCode || result?.data?.code) {
        setCode(result.code || result.billCode || result.data.code);
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(error?.message || "Unable to update the bill group.");
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = () => runAction(
    () => createBillGroupApi({ name: customerName || null }),
    "Bill group created. Share the code with your table."
  );

  const joinGroup = () => {
    if (!code.trim()) {
      setMessage("Enter a bill group code first.");
      return;
    }
    return runAction(() => joinBillGroupApi({ code: code.trim() }), "You joined the bill group.");
  };

  const loadBill = () => {
    if (!code.trim()) {
      setMessage("Enter a bill group code first.");
      return;
    }
    return runAction(async () => {
      const bill = await getCombinedBillApi(code.trim());
      setCombinedBill(bill);
      return bill;
    }, "Combined bill loaded.");
  };

  return (
    <main className="min-h-screen bg-[#e8f0eb] px-4 py-8 text-[#06483e] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => navigate("/home")} className="mb-8 flex items-center gap-2 text-sm font-semibold hover:text-[#f45b0c]"><ArrowLeft size={18} /> Home</button>
        <section className="rounded-[28px] bg-[#06483e] p-6 text-white shadow-xl sm:p-9">
          <div className="flex items-center gap-3"><Split className="text-[#ff7a00]" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Shared dining</p></div>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Split the bill</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">Create a group for this table, or join one using a code from a friend.</p>
          <button type="button" onClick={createGroup} disabled={isLoading} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 font-semibold transition hover:border-[#ff7a00] hover:text-[#ffb36b] disabled:opacity-60"><Users size={18} /> Create bill group</button>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter group code" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#ff7a00]" />
            <button type="button" onClick={joinGroup} disabled={isLoading} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#06483e] hover:bg-[#ffb36b] disabled:opacity-60">Join group</button>
          </div>
          <button type="button" onClick={loadBill} disabled={isLoading} className="mt-3 w-full rounded-xl bg-[#ff7a00] px-4 py-3 font-bold text-white hover:bg-[#e86100] disabled:opacity-60">View combined bill</button>
          {message && <p className="mt-4 text-sm text-[#ffcf9f]">{message}</p>}
          {combinedBill && <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-black/15 p-4 text-xs text-white/80">{JSON.stringify(combinedBill, null, 2)}</pre>}
        </section>
      </div>
    </main>
  );
}
