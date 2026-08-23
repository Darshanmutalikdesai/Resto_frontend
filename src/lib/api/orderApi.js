import { apiClient, unwrapApiResponse } from "../apiClient";

export async function createOrderApi(payload) {
  const response = await apiClient.post("/api/orders/create", payload);
  return unwrapApiResponse(response);
}

export async function myOrdersApi() {
  const response = await apiClient.post("/api/orders/mine");
  return unwrapApiResponse(response);
}
