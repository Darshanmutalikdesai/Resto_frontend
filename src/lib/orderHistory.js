export const BILL_HISTORY_KEY = "niyaaz-order-history";
export const BILL_HISTORY_TTL_MS = 40 * 60 * 1000;

export function readLocalHistory() {
  try {
    const rawHistory = JSON.parse(localStorage.getItem(BILL_HISTORY_KEY) || "[]");
    const history = Array.isArray(rawHistory) ? rawHistory : [];
    const now = Date.now();

    const freshHistory = history.filter((order) => {
      const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : null;

      if (!createdAt || !Number.isFinite(createdAt)) {
        return true;
      }

      return now - createdAt <= BILL_HISTORY_TTL_MS;
    });

    if (freshHistory.length !== history.length) {
      localStorage.setItem(BILL_HISTORY_KEY, JSON.stringify(freshHistory));
    }

    return freshHistory;
  } catch {
    localStorage.removeItem(BILL_HISTORY_KEY);
    return [];
  }
}

export function saveLocalHistory(history) {
  localStorage.setItem(BILL_HISTORY_KEY, JSON.stringify(history));
}
