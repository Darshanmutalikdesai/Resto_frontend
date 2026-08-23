const ACCESS_TOKEN_KEY = "restaurant_access_token";
const LEGACY_ACCESS_TOKEN_KEY = "googleAuthToken";
const REFRESH_TOKEN_KEY = "restaurant_refresh_token";
const USER_KEY = "restaurant_user";
const VERIFIED_KEY = "restaurant_is_verified";

export function getAccessToken() {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)
  );
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredIsVerified() {
  const raw = localStorage.getItem(VERIFIED_KEY);

  if (raw === null) {
    return false;
  }

  return raw === "true";
}

export function setAuthStorage({ accessToken, refreshToken, user, isVerified }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  if (typeof isVerified === "boolean") {
    localStorage.setItem(VERIFIED_KEY, String(isVerified));
  }
}

export function clearAuthStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(VERIFIED_KEY);
}
