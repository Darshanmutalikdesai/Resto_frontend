import React from "react";
import { useNavigate } from "react-router-dom";
import { ProductTile } from "../UI";
import { useCart } from "../../context/CartContext";
import { PRODUCTS } from "../../data/products";

export default function Menu() {
  const navigate = useNavigate();
  const { cart, addToCart } = useCart();
  const items = PRODUCTS.filter(Boolean);

  return (
    <div className="pb-4 px-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Menu</h2>
          <p className="text-sm text-gray-500">Browse our fresh grocery collection.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/categories")}
          className="text-xs font-semibold text-emerald-600"
        >
          View All
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductTile
            key={product.id}
            product={product}
            qty={cart[product.id] || 0}
            onAdd={() => addToCart(product.id, 1)}
          />
        ))}
      </div>
    </div>
  );
}
