import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Camera, Clock3, Phone, Split, UserRound, UtensilsCrossed } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import niyaazLogo from "../assets/image.png";

const TABLE_NUMBER_TTL_MS = 60 * 60 * 1000;

function normalizeTableInput(value = "") {
  const digits = String(value).replace(/\D/g, "");

  if (!digits) {
    return "T";
  }

  const tableNumber = Number(digits);
  return tableNumber >= 1 && tableNumber <= 10 ? `T${tableNumber}` : "T";
}

export default function NiyaazLandingPage() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("T");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setIsLoaded(true);

    try {
      const savedCustomer = JSON.parse(localStorage.getItem("niyaaz-customer") || "{}");
      const savedTableNumber = savedCustomer.tableNumber || "";
      const tableExpiresAt = Number(savedCustomer.tableNumberExpiresAt || 0);

      if (savedTableNumber && tableExpiresAt && Date.now() > tableExpiresAt) {
        const refreshedCustomer = {
          ...savedCustomer,
          tableNumber: "",
          tableNumberExpiresAt: "",
        };
        localStorage.setItem("niyaaz-customer", JSON.stringify(refreshedCustomer));
      }

      setCustomerName(savedCustomer.name || "");
      setCustomerPhone(savedCustomer.phone || "");
      setTableNumber(savedTableNumber || "T");
    } catch {
      localStorage.removeItem("niyaaz-customer");
    }
  }, []);

  const handleGetStarted = () => {
    const name = customerName.trim();
    const phone = customerPhone.replace(/\D/g, "");
    const table = normalizeTableInput(tableNumber);

    if (!/^[A-Za-z][A-Za-z '\u002D]*$/.test(name)) {
      setFormError("Enter a valid name using letters only.");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setFormError("Enter a valid 10-digit phone number.");
      return;
    }

    if (!/^T(?:[1-9]|10)$/.test(table)) {
      setFormError("Enter a valid table number from T1 to T10.");
      return;
    }

    localStorage.setItem(
      "niyaaz-customer",
      JSON.stringify({
        name,
        phone,
        tableNumber: table,
        tableNumberExpiresAt: Date.now() + TABLE_NUMBER_TTL_MS,
      }),
    );
    navigate("/home");
  };

  const handleQrScan = (results) => {
    const value = results?.[0]?.rawValue?.trim();
    if (!value) return;

    try {
      const url = new URL(value);
      const scannedTable = url.searchParams.get("table") || url.searchParams.get("tableNumber");
      setTableNumber(normalizeTableInput(scannedTable || value));
    } catch {
      setTableNumber(normalizeTableInput(value));
    }
    setIsScannerOpen(false);
    setFormError("");
  };

  return (
    <main className="landing-page relative flex min-h-screen items-center overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="landing-pattern pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(120deg,transparent_0%,transparent_48%,#f7c66a_49%,transparent_50%),linear-gradient(30deg,transparent_0%,transparent_48%,#f45b0c_49%,transparent_50%)] [background-size:120px_120px]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <section className={`w-full transition-all duration-700 ${isLoaded ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}>
          <div className="landing-badge mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] shadow-sm">
            <UtensilsCrossed size={15} />
          </div>
          <div className="landing-logo-card flex min-h-28 items-center justify-start rounded-2xl px-5 py-4 shadow-2xl sm:min-h-36 sm:px-8">
            <img src={niyaazLogo} alt="Niyaaz - The Original Belgaum Biryani" className="h-auto w-[min(100%,420px)] object-contain" />
          </div>
          <h1 className="mt-9 max-w-xl text-5xl font-black leading-[0.98] tracking-tight text-[#06483e] sm:text-7xl">
             <span className="text-[#f7c66a]"></span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#06483e]/70 sm:text-lg">
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
            <span className="landing-utility-pill flex items-center gap-2 rounded-full border px-4 py-2 shadow-sm"><Clock3 size={16} className="text-[#f45b0c]" /> Open daily</span>
            <span className="landing-utility-pill flex items-center gap-2 rounded-full border px-4 py-2 shadow-sm"><UtensilsCrossed size={16} className="text-[#f45b0c]" /> Freshly cooked</span>
          </div>
        </section>

        <section className={`landing-form-card w-full rounded-[28px] p-5 shadow-2xl transition-all delay-150 duration-700 sm:p-8 ${isLoaded ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f45b0c]">Start your order</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl"></h2>
          <p className="mt-3 text-sm leading-6 text-[#06483e]/60"></p>

          <div className="mt-7 space-y-4">
            <label className="landing-label block text-sm font-bold">
              Your name
              <span className="relative mt-2 block">
                <UserRound size={18} className="landing-field-icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="text" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setFormError(""); }} placeholder="Enter your name" className="landing-input w-full rounded-2xl border py-3.5 pl-11 pr-4 text-sm font-medium outline-none transition" />
              </span>
            </label>
            <label className="landing-label block text-sm font-bold">
              Phone number
              <span className="relative mt-2 block">
                <Phone size={18} className="landing-field-icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={customerPhone} onChange={(event) => { setCustomerPhone(event.target.value.replace(/\D/g, "")); setFormError(""); }} placeholder="Enter 10-digit phone number" className="landing-input w-full rounded-2xl border py-3.5 pl-11 pr-4 text-sm font-medium outline-none transition" />
              </span>
            </label>
            <label className="landing-label block text-sm font-bold">
              Table number
              <span className="relative mt-2 block">
                <UtensilsCrossed size={18} className="landing-field-icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="text" value={tableNumber} onChange={(event) => { setTableNumber(normalizeTableInput(event.target.value)); setFormError(""); }} placeholder="T1" pattern="T(?:[1-9]|10)" className="landing-input w-full rounded-2xl border py-3.5 pl-11 pr-14 text-sm font-medium uppercase outline-none transition" />
                <button type="button" onClick={() => setIsScannerOpen((open) => !open)} aria-label="Scan table QR code" className="landing-scan-button absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl transition">
                  <Camera size={18} />
                </button>
              </span>
            </label>
          </div>
          {isScannerOpen && (
            <div className="landing-scanner-panel mt-4 overflow-hidden rounded-2xl border p-3">
              <p className="landing-scanner-text mb-2 text-xs font-semibold">Point your camera at the table QR code</p>
              <Scanner onScan={handleQrScan} paused={!isScannerOpen} scanDelay={300} />
              <button type="button" onClick={() => setIsScannerOpen(false)} className="landing-scanner-close mt-3 w-full rounded-xl border py-2 text-xs font-semibold">Close scanner</button>
            </div>
          )}
          {formError && <p className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-center text-xs font-semibold text-red-700">{formError}</p>}
          <button type="button" onClick={handleGetStarted} className="landing-submit-button mt-6 flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-black shadow-lg transition hover:shadow-xl active:scale-[0.99]">
            Get Started <ArrowRight size={19} />
          </button>
          <button type="button" onClick={() => navigate("/split-bill")} className="landing-group-button mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3.5 text-sm font-bold transition">
            <Split size={18} /> Join group / Create group
          </button>
          <p className="landing-note mt-4 text-center text-xs">Your details stay private and are used for this order.</p>
        </section>
      </div>
    </main>
  );
}
