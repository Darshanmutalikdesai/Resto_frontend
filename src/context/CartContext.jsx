import React, { createContext, useContext, useEffect, useState } from "react";
import {
  addCartItemApi,
  clearCartApi,
  getCartApi,
  removeCartItemApi,
} from "../lib/api/cartApi";

const CartContext = createContext();

function normalizeCartPayload(payload) {
  const rawItems =
    payload?.items ||
    payload?.cartItems ||
    payload?.data?.items ||
    payload?.data?.cartItems ||
    payload?.data ||
    [];

  if (Array.isArray(rawItems)) {
    return rawItems.reduce((acc, item) => {
      const entryId = item?.menuItemId ?? item?.itemId ?? item?.productId ?? item?.id;
      const qty = Number(item?.quantity ?? item?.qty ?? 0);

      if (entryId && qty > 0) {
        acc[String(entryId)] = qty;
      }

      return acc;
    }, {});
  }

  if (rawItems && typeof rawItems === "object") {
    return Object.entries(rawItems).reduce((acc, [key, value]) => {
      const qty = Number(value?.quantity ?? value?.qty ?? value ?? 0);
      if (key && qty > 0) {
        acc[String(key)] = qty;
      }
      return acc;
    }, {});
  }

  return {};
}

function readSavedCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem("niyaaz-cart") || "{}");
    return savedCart && typeof savedCart === "object" ? savedCart : {};
  } catch {
    return {};
  }
}

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(readSavedCart);
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0);

  useEffect(() => {
    localStorage.setItem("niyaaz-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let isActive = true;

    const hydrateCart = async () => {
      try {
        const response = await getCartApi();
        const normalized = normalizeCartPayload(response);

        if (isActive && Object.keys(normalized).length > 0) {
          setCart(normalized);
        }
      } catch {
        if (isActive) {
          setCart((prev) => prev || {});
        }
      }
    };

    hydrateCart();

    return () => {
      isActive = false;
    };
  }, []);

  const updateCartFromApi = async (nextCart) => {
    if (nextCart && Object.keys(nextCart).length > 0) {
      setCart(nextCart);
      return;
    }

    setCart({});
  };

  const addToCart = async (productId, quantity = 1) => {
    const id = String(productId);
    const payload = {
      menuItemId: Number(productId),
      itemId: Number(productId),
      quantity,
    };

    try {
      const response = await addCartItemApi(payload);
      const normalized = normalizeCartPayload(response);

      if (Object.keys(normalized).length > 0) {
        setCart(normalized);
        return;
      }
    } catch {
      // Fallback to optimistic local cart state when the API is unavailable.
    }

    setCart((prev) => {
      const currentQty = Number(prev[id] || 0);
      return {
        ...prev,
        [id]: currentQty + quantity,
      };
    });
  };

  const updateQty = async (productId, quantity) => {
    const id = String(productId);
    const currentQty = Number(cart[id] || 0);

    if (quantity <= 0) {
      try {
        await removeCartItemApi({
          menuItemId: Number(productId),
          itemId: Number(productId),
          quantity: currentQty,
        });
      } catch {
        // Ignore backend failures and keep a local fallback below.
      }

      setCart((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    const delta = quantity - currentQty;

    if (delta > 0) {
      try {
        const response = await addCartItemApi({
          menuItemId: Number(productId),
          itemId: Number(productId),
          quantity: delta,
        });
        const normalized = normalizeCartPayload(response);
        if (Object.keys(normalized).length > 0) {
          setCart(normalized);
          return;
        }
      } catch {
        // Ignore API failure and preserve local state fallback.
      }
    }

    setCart((prev) => ({
      ...prev,
      [id]: quantity,
    }));
  };

  const removeFromCart = async (productId) => {
    const id = String(productId);

    try {
      await removeCartItemApi({
        menuItemId: Number(productId),
        itemId: Number(productId),
      });
    } catch {
      // Local fallback below.
    }

    setCart((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearCart = async () => {
    try {
      await clearCartApi();
    } catch {
      // Keep local fallback below.
    }

    setCart({});
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        syncCartFromApi: updateCartFromApi,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
