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
import CategoriesPage from "./components/layout/Categoriespage";
import Footer from "./components/layout/Footer";
import { BottomNav } from "./components/UI";

const queryClient = new QueryClient();

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const shouldReduceMotion = useReducedMotion();
  const showBottomNav = location.pathname !== "/";
  const showFooter = location.pathname !== "/";
  const active = location.pathname === "/cart"
    ? "cart"
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
            <Route path="/home" element={<HomePage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/categories" element={<CategoriesPage />} />
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
