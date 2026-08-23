import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight, Flame, ChefHat } from "lucide-react";
import { GreenButton } from "../UI";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-emerald-50 via-emerald-50/80 to-orange-50 px-6 pt-8 pb-6 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-200/20 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-20 left-0 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl -z-10"></div>

      {/* Logo Section with Animation */}
      <div className={`transform transition-all duration-700 ${isLoaded ? "scale-100 opacity-100" : "scale-80 opacity-0"}`}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg flex items-center justify-center">
            <ChefHat size={20} className="text-white" />
          </div>
          <span className="text-base font-bold text-emerald-800">NIYAAZ</span>
        </div>
      </div>

      {/* Main Title with Enhanced Typography */}
      <div className={`transform transition-all duration-700 delay-100 ${isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <h1 className="text-[42px] leading-[1.15] font-bold text-emerald-900 mb-2">
          Authentic Biryani
          <br />
          <span className="bg-gradient-to-r from-emerald-700 to-orange-600 bg-clip-text text-transparent">
            At Your Doorstep
          </span>
        </h1>
        <div className="w-16 h-1.5 bg-gradient-to-r from-emerald-600 to-orange-500 rounded-full mb-4"></div>
      </div>

      {/* Description */}
      <div className={`transform transition-all duration-700 delay-200 ${isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <p className="text-gray-600 text-sm mb-6 max-w-[90%] leading-relaxed font-medium">
        </p>
      </div>

      {/* Feature Tags */}
      <div className={`flex flex-wrap gap-3 mb-8 transform transition-all duration-700 delay-300 ${isLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-emerald-200 rounded-full px-4 py-2 shadow-sm">
          <Leaf size={14} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">Vegetarian</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-orange-200 rounded-full px-4 py-2 shadow-sm">
          <Flame size={14} className="text-orange-600" />
          <span className="text-xs font-semibold text-orange-700">Non-Veg</span>
        </div>
      </div>

      {/* Enhanced Button */}
      <div className={`transform transition-all duration-700 delay-400 ${isLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        <GreenButton 
          onClick={() => navigate("/home")} 
          className="self-start px-8 py-3.5 text-sm mb-8 font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
        >
          <span>Order Now</span>
          <ArrowRight size={18} />
        </GreenButton>
      </div>

      {/* Enhanced Food Grid */}
      <div className={`flex-1 rounded-3xl bg-gradient-to-br from-white/80 via-emerald-50/40 to-orange-50/40 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden min-h-[220px] border border-white/50 transform transition-all duration-700 delay-500 ${isLoaded ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        <div className="grid grid-cols-3 gap-6 p-8 text-5xl">
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🍛</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🥘</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🍚</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🧄</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🌶️</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🍃</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🧅</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🥩</div>
          <div className="hover:scale-125 hover:-translate-y-2 transition-all duration-300 cursor-pointer">🍗</div>
        </div>
        
        {/* Decorative corners */}
        <div className="absolute top-4 left-4 w-8 h-8 border-2 border-emerald-200 rounded-lg opacity-50"></div>
        <div className="absolute bottom-4 right-4 w-8 h-8 border-2 border-orange-200 rounded-lg opacity-50"></div>
      </div>

      {/* Enhanced Trust Section */}
      <div className={`flex items-center gap-3 mt-8 transform transition-all duration-700 delay-600 ${isLoaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        <div className="flex -space-x-2.5">
          {[
            "bg-gradient-to-br from-emerald-400 to-emerald-600",
            "bg-gradient-to-br from-emerald-300 to-emerald-500",
            "bg-gradient-to-br from-orange-400 to-orange-600"
          ].map((c, i) => (
            <div 
              key={i} 
              className={`w-7 h-7 rounded-full ${c} border-2 border-white shadow-md hover:scale-110 transition-transform duration-300 flex items-center justify-center text-xs font-bold text-white`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-800">Trusted by 2M+ Happy Customers</p>
          <p className="text-xs text-gray-600">Fast delivery • Fresh ingredients</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: fadeInScale 0.6s ease-out;
        }

        .animate-slide {
          animation: slideInUp 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}