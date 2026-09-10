import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Percent, Utensils } from "lucide-react";
import { ScreenHeader } from "../UI";
import { CATEGORY_LIST } from "../../data/products";

export default function CategoriesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#faf7f2] pb-8">
      <ScreenHeader title="Menu Categories" onBack={() => navigate("/home")} />

      {/* Hero banner */}
      <div className="niyaaz-section-enter relative mx-4 mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#06483e] via-[#0a5c4e] to-[#0e7059] p-6 shadow-[0_14px_30px_rgba(6,72,62,0.25)] sm:mx-5">
        {/* decorative rings */}
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border-[10px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -right-2 h-28 w-28 rounded-full border-[10px] border-white/10" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff7a00]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffb27a]">
              <Percent size={11} /> Fresh daily
            </span>
            <p className="mt-3 max-w-[190px] text-xl font-black leading-tight text-white sm:text-2xl">
              Delicious food, made fresh for you
            </p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ff7a00] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-[0_6px_16px_rgba(255,122,0,0.35)] transition hover:bg-[#e86e00] active:scale-95"
            >
              Order Now
              <ArrowRight size={14} strokeWidth={2.75} />
            </button>
          </div>

          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm sm:h-24 sm:w-24">
              <Utensils size={40} className="text-white/90" strokeWidth={1.75} />
            </div>
            <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#06483e] bg-[#ff7a00] text-white shadow-md">
              <Percent size={12} strokeWidth={3} />
            </span>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="mb-4 flex items-center justify-between px-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Browse by category</h2>
        <span className="text-xs font-semibold text-gray-300">{CATEGORY_LIST.length} categories</span>
      </div>

      <div className="px-4 sm:px-5">
        {/* All Menu — full width featured row */}
        <button
          type="button"
          onClick={() => navigate("/home?category=all")}
          className="niyaaz-card-enter mb-3 flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white shadow-inner">
            🍽️
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-emerald-900">All Menu</p>
            <p className="text-xs text-emerald-700/70">Browse every dish available</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
            <ChevronRight size={18} />
          </span>
        </button>

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_LIST.map((cat, index) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => navigate(`/home?category=${encodeURIComponent(cat.name)}`)}
              className="niyaaz-card-enter group flex flex-col items-start gap-2.5 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-[0_2px_10px_rgba(15,44,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_14px_26px_rgba(15,44,42,0.1)] active:scale-[0.98]"
              style={{ animationDelay: `${160 + Math.min(index, 7) * 65}ms` }}
            >
              <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-105 ${cat.bg}`}>
                {cat.emoji}
              </div>

              <div className="w-full min-w-0">
                <p className="truncate text-[13.5px] font-bold leading-tight text-gray-900">{cat.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-400">{cat.desc}</p>
              </div>

              <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                View items
                <ChevronRight size={13} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}