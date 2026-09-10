import { apiClient, unwrapApiResponse } from "../apiClient";
import { normalizeApiMenuItems, normalizeSerialMenuItems } from "./menuApiHelpers";

export async function getMenuSerialMapApi() {
  const response = await apiClient.get("/api/menu-items/serial-map");
  return normalizeSerialMenuItems(unwrapApiResponse(response));
}

export async function createMenuItemApi(payload = {}) {
  const response = await apiClient.post("/api/menu-items/create", payload);
  return unwrapApiResponse(response);
}

export async function updateMenuItemImageApi(menuItemId, imageUrl) {
  const response = await apiClient.patch(`/api/menu-items/${menuItemId}`, { imageUrl });
  return unwrapApiResponse(response);
}

export async function getMenuCatalogApi(payload = {}) {
  try {
    const requestPayload = {
      page: 1,
      limit: 1000,
      ...payload,
    };

    const catalogResponse = await apiClient.get("/api/menu-items/public", { params: requestPayload });
    const normalized = normalizeApiMenuItems(unwrapApiResponse(catalogResponse));

    return normalized;
  } catch {
    return [];
  }
}
