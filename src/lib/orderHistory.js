export const BILL_HISTORY_KEY = "niyaaz-order-history";
export const BILL_HISTORY_TTL_MS = 40 * 60 * 1000;
export const GENERATED_BILL_KEY = "niyaaz-generated-bill";
export const GENERATED_BILL_TTL_MS = 15 * 60 * 1000;

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

export function readGeneratedBill() {
  try {
    const saved = JSON.parse(localStorage.getItem(GENERATED_BILL_KEY) || "null");

    if (!saved?.bill || Number(saved.expiresAt) <= Date.now()) {
      localStorage.removeItem(GENERATED_BILL_KEY);
      return null;
    }

    return saved;
  } catch {
    localStorage.removeItem(GENERATED_BILL_KEY);
    return null;
  }
}

export function saveGeneratedBill(bill) {
  const expiresAt = Date.now() + GENERATED_BILL_TTL_MS;
  localStorage.setItem(GENERATED_BILL_KEY, JSON.stringify({ bill, expiresAt }));
  return expiresAt;
}

export function clearGeneratedBill() {
  localStorage.removeItem(GENERATED_BILL_KEY);
}
