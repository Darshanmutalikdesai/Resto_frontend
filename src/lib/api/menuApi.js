import { apiClient, unwrapApiResponse } from "../apiClient";
import { normalizeApiMenuItems } from "./menuApiHelpers";

export async function createMenuItemApi(payload = {}) {
  const response = await apiClient.post("/api/menu-items/create", payload);
  return unwrapApiResponse(response);
}

export async function getMenuCatalogApi(payload = {}) {
  try {
    const requestPayload = {
      page: 1,
      limit: 100,
      ...payload,
    };

    const response = await apiClient.get("/api/menu-items/public");
    const apiPayload = unwrapApiResponse(response);
    const normalized = normalizeApiMenuItems(apiPayload);

    if (normalized.length > 0) {
      return normalized;
    }

    return [];
  } catch {
    return [];
  }
}
