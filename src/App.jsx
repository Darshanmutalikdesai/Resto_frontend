import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoonStar, SunMedium } from "lucide-react";
import "./App.css";

import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Pages / Landing
import Footer from "./components/layout/Footer";
import { BottomNav } from "./components/UI";
import CookingLoader from "./components/CookingLoader";

const NiyaazLandingPage = lazy(() => import("./components/NiyaazLandingPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MenuImageManager = lazy(() => import("./pages/MenuImageManager"));
const MenuSerialImageManager = lazy(() => import("./pages/MenuSerialImageManager"));
const Cart = lazy(() => import("./components/pages/Cart"));
const Bill = lazy(() => import("./components/pages/Bill"));
const SplitBill = lazy(() => import("./components/pages/SplitBill"));
const CategoriesPage = lazy(() => import("./components/layout/Categoriespage"));

const queryClient = new QueryClient();

function hasCustomerDetails() {
  try {
    const customer = JSON.parse(localStorage.getItem("niyaaz-customer") || "{}");
    const tableNumber = customer.tableNumber?.trim();
    const tableExpiresAt = Number(customer.tableNumberExpiresAt || 0);

    if (tableNumber && tableExpiresAt && Date.now() > tableExpiresAt) {
      return false;
    }

    return Boolean(customer.name?.trim() && customer.phone?.trim() && tableNumber);
  } catch {
    return false;
  }
}

function RequireCustomerDetails({ children }) {
  return hasCustomerDetails() ? children : <Navigate to="/" replace />;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunMedium size={17} /> : <MoonStar size={17} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function AppShell({ theme, setTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const shouldReduceMotion = useReducedMotion();
  const showBottomNav = location.pathname !== "/";
  const showFooter = location.pathname !== "/";
  const active = location.pathname === "/cart"
    ? "cart"
    : location.pathname === "/bill"
      ? "bill"
    : location.pathname === "/categories"
      ? "menu"
      : "home";

  return (
    <div className={`app-shell min-h-screen ${showBottomNav ? "pb-24" : ""}`}>
      <div className="theme-toggle-wrap">
        <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
      </div>
      <Suspense fallback={<CookingLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${location.pathname}${location.search}`}
            className="niyaaz-route-motion"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 24, scale: 0.985 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<NiyaazLandingPage />} />
              <Route path="/home" element={<RequireCustomerDetails><HomePage /></RequireCustomerDetails>} />
              <Route path="/menu-images" element={<RequireCustomerDetails><MenuImageManager /></RequireCustomerDetails>} />
              <Route path="/menu-serial-images" element={<RequireCustomerDetails><MenuSerialImageManager /></RequireCustomerDetails>} />
              <Route path="/cart" element={<RequireCustomerDetails><Cart /></RequireCustomerDetails>} />
              <Route path="/bill" element={<RequireCustomerDetails><Bill /></RequireCustomerDetails>} />
              <Route path="/split-bill" element={<RequireCustomerDetails><SplitBill /></RequireCustomerDetails>} />
              <Route path="/categories" element={<RequireCustomerDetails><CategoriesPage /></RequireCustomerDetails>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      {showFooter && <Footer />}
      {showBottomNav && <BottomNav active={active} cartCount={cartCount} onNavigate={navigate} />}
    </div>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = window.localStorage.getItem("niyaaz-theme");
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("niyaaz-theme", theme);
  }, [theme]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <CookingLoader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <AppShell theme={theme} setTheme={setTheme} />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
