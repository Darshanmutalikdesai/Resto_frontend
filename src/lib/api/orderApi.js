import { apiClient, unwrapApiResponse } from "../apiClient";
import { getAccessToken } from "../tokenStorage";

export async function createOrderApi(payload) {
  const response = await apiClient.post("/api/orders/create", payload);
  return unwrapApiResponse(response);
}

export async function myOrdersApi() {
  const response = await apiClient.post("/api/orders/mine");
  return unwrapApiResponse(response);
}

export async function generateOrderBillApi(orderId) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/bill`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to generate bill");
  }

  return result.data ?? result;
}
