import { ChefHat, Flame, Sparkles } from "lucide-react";

export default function CookingLoader() {
  return (
    <main className="cooking-loader" aria-label="Preparing the Niyaaz kitchen" aria-live="polite">
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

        <p className="cooking-loader__eyebrow">The kitchen is warming up</p>
        <h1>Something delicious<br /><em>is cooking.</em></h1>
        <div className="cooking-loader__progress" role="progressbar" aria-label="Loading menu">
          <span />
        </div>
        <p className="cooking-loader__note">Fresh flavours are on their way</p>
      </div>
    </main>
  );
}