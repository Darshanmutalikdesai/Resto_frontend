import { Clock3, Instagram, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import niyaazLogo from "../../assets/image.png";

const footerLinks = [
  { label: "Home", to: "/home" },
  { label: "Menu", to: "/categories" },
  { label: "Cart", to: "/cart" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#06483e]/15 bg-[#06483e] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:px-12">
        <div>
          <Link to="/" className="inline-flex items-center rounded-lg bg-white px-3 py-2" aria-label="Niyaaz home">
            <img src={niyaazLogo} alt="Niyaaz" className="h-20 w-64 object-contain" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
            Authentic Belgaum biryani and fresh, comforting meals made with care.
          </p>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="Niyaaz on Instagram"
            className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/75 transition hover:border-[#f45b0c] hover:bg-[#f45b0c] hover:text-white"
          >
            <Instagram size={18} />
          </a>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#f7c66a]">Explore</h2>
          <nav aria-label="Footer navigation" className="mt-4 flex flex-col items-start gap-3 text-sm text-white/70">
            {footerLinks.map((link) => (
              <Link key={link.to} to={link.to} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#f7c66a]">Visit Us</h2>
          <div className="mt-4 space-y-4 text-sm text-white/70">
            <p className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-[#f45b0c]" />
              <span>Belgaum, Karnataka, India</span>
            </p>
            <p className="flex items-center gap-3">
              <Phone size={17} className="shrink-0 text-[#f45b0c]" />
              <a href="tel:+918000000000" className="transition hover:text-white">+91 80000 00000</a>
            </p>
            <p className="flex items-center gap-3">
              <Clock3 size={17} className="shrink-0 text-[#f45b0c]" />
              <span>Open daily, 11:00 AM - 11:00 PM</span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Niyaaz. Made for memorable meals.
      </div>
    </footer>
  );
}