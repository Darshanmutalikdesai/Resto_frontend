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

    const [catalogResult, serialMapResult] = await Promise.allSettled([
      apiClient.get("/api/menu-items/public", { params: requestPayload }),
      getMenuSerialMapApi(),
    ]);
    if (catalogResult.status === "rejected") {
      throw catalogResult.reason;
    }

    const normalized = normalizeApiMenuItems(unwrapApiResponse(catalogResult.value));
    const serialItems = serialMapResult.status === "fulfilled" ? serialMapResult.value : [];
    const serialByKey = new Map();

    serialItems.forEach((item) => {
      const imageUrl = item.imageUrl?.trim();
      if (!imageUrl) return;

      [item.id, item.serialNumber, item.name].forEach((key) => {
        if (key != null && String(key).trim()) {
          serialByKey.set(String(key).trim().toLowerCase(), imageUrl);
        }
      });
    });

    const itemsWithSerialImages = normalized.map((item) => {
      const imageUrl = [item.id, item.serialNumber, item.name]
        .map((key) => serialByKey.get(String(key ?? "").trim().toLowerCase()))
        .find(Boolean);

      return imageUrl
        ? { ...item, image: imageUrl, databaseImageUrl: imageUrl }
        : item;
    });

    if (itemsWithSerialImages.length > 0) {
      return itemsWithSerialImages;
    }

    return [];
  } catch {
    return [];
  }
}
