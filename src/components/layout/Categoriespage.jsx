import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Percent, Utensils } from "lucide-react";
import { ScreenHeader } from "../UI";
import { CATEGORY_LIST } from "../../data/products";

export default function CategoriesPage() {
  const navigate = useNavigate();

  return (
    <div className="pb-4">
      <ScreenHeader title="Menu Categories" onBack={() => navigate("/home")} />

      <div className="niyaaz-section-enter mx-5 mb-5 rounded-2xl bg-gradient-to-r from-orange-100 to-amber-50 p-4 flex items-center justify-between">
        <div>
          <p className="text-orange-900 font-bold text-[15px] leading-snug max-w-[150px]">
            Delicious food, made fresh for you
          </p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="mt-3 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full"
            >
              Order Now
          </button>
        </div>
        <div className="relative text-5xl -mr-1">
          <Utensils size={46} className="text-orange-500" />
          <span className="absolute -top-1 -right-3 bg-orange-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-bold border-2 border-white">
            <Percent size={11} />
          </span>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate("/home?category=all")}
          className="niyaaz-card-enter flex items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-2xl text-white">
            🍽️
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-emerald-800">All Menu</p>
            <p className="text-[11px] text-emerald-700/70">Browse every dish available</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-emerald-600" />
        </button>
        {CATEGORY_LIST.map((cat, index) => (
          <button
            key={cat.name}
            onClick={() => navigate(`/home?category=${encodeURIComponent(cat.name)}`)}
            className="niyaaz-card-enter flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-left active:scale-[0.99] transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${160 + Math.min(index, 7) * 65}ms` }}
          >
            <div className={`w-14 h-14 rounded-xl ${cat.bg} flex items-center justify-center text-2xl shrink-0`}>
              {cat.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
              <p className="text-[11px] text-gray-400">
                {cat.desc} · {cat.count}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}