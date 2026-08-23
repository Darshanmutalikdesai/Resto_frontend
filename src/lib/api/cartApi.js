import { apiClient, unwrapApiResponse } from "../apiClient";

export async function addCartItemApi(payload) {
  const response = await apiClient.post("/api/cart/add", payload);
  return unwrapApiResponse(response);
}

export async function getCartApi() {
  const response = await apiClient.post("/api/cart");
  return unwrapApiResponse(response);
}

export async function removeCartItemApi(payload) {
  const response = await apiClient.post("/api/cart/remove", payload);
  return unwrapApiResponse(response);
}

export async function clearCartApi() {
  const response = await apiClient.post("/api/cart/clear");
  return unwrapApiResponse(response);
}

export async function checkoutCartApi(payload) {
  const response = await apiClient.post("/api/cart/checkout", payload);
  return unwrapApiResponse(response);
}
