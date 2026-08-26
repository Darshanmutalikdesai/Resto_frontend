import { apiClient, unwrapApiResponse } from "../apiClient";

export async function callWaiterApi(payload) {
  const response = await apiClient.post("/api/table-sessions/call-waiter", payload);
  return unwrapApiResponse(response);
}
