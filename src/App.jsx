import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./App.css";

import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Pages / Landing
import NiyaazLandingPage from "./components/NiyaazLandingPage";
import HomePage from "./pages/HomePage";
import Cart from "./components/pages/Cart";
import Bill from "./components/pages/Bill";
import SplitBill from "./components/pages/SplitBill";
import CategoriesPage from "./components/layout/Categoriespage";
import Footer from "./components/layout/Footer";
import { BottomNav } from "./components/UI";
import CookingLoader from "./components/CookingLoader";

const queryClient = new QueryClient();

function hasCustomerDetails() {
  try {
    const customer = JSON.parse(localStorage.getItem("niyaaz-customer") || "{}");
    return Boolean(customer.name?.trim() && customer.phone?.trim() && customer.tableNumber?.trim());
  } catch {
    return false;
  }
}

function RequireCustomerDetails({ children }) {
  return hasCustomerDetails() ? children : <Navigate to="/" replace />;
}

function AppShell() {
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
    <div className={`min-h-screen bg-[#f4efe7] text-slate-900 ${showBottomNav ? "pb-24" : ""}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${location.pathname}${location.search}`}
          className="niyaaz-route-motion"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" }}
        >
          <Routes location={location}>
            <Route path="/" element={<NiyaazLandingPage />} />
            <Route path="/home" element={<RequireCustomerDetails><HomePage /></RequireCustomerDetails>} />
            <Route path="/cart" element={<RequireCustomerDetails><Cart /></RequireCustomerDetails>} />
            <Route path="/bill" element={<RequireCustomerDetails><Bill /></RequireCustomerDetails>} />
            <Route path="/split-bill" element={<SplitBill />} />
            <Route path="/categories" element={<RequireCustomerDetails><CategoriesPage /></RequireCustomerDetails>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {showFooter && <Footer />}
      {showBottomNav && <BottomNav active={active} cartCount={cartCount} onNavigate={navigate} />}
    </div>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1800);
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
            <AppShell />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
