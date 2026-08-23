import { apiClient, unwrapApiResponse } from "../apiClient";

export async function callWaiterApi(sessionId) {
  const response = await apiClient.post(
    `/api/table-sessions/${encodeURIComponent(sessionId)}/call-waiter`
  );
  return unwrapApiResponse(response);
}
