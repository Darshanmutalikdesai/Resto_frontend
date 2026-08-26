import { apiClient, unwrapApiResponse } from "../apiClient";

export async function createBillGroupApi(payload) {
  const response = await apiClient.post("/api/bill-groups/create", payload);
  return unwrapApiResponse(response);
}

export async function joinBillGroupApi(payload) {
  const response = await apiClient.post("/api/bill-groups/join", payload);
  return unwrapApiResponse(response);
}

export async function getCombinedBillApi(billCode) {
  const response = await apiClient.get(`/api/bill-groups/${encodeURIComponent(billCode)}/bill`);
  return unwrapApiResponse(response);
}

export async function checkoutBillGroupApi(billCode) {
  const response = await apiClient.post(`/api/bill-groups/${encodeURIComponent(billCode)}/checkout`);
  return unwrapApiResponse(response);
}
