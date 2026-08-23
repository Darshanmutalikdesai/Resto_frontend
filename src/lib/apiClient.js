import axios from "axios";
import { getAccessToken } from "./tokenStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function unwrapApiResponse(response) {
  const payload = response?.data;

  if (!payload) {
    return {};
  }

  if (typeof payload.success === "boolean") {
    if (!payload.success) {
      const message = payload.message || "API request failed";
      throw new Error(message);
    }

    // Some endpoints (like OAuth login) return tokens as a sibling of
    // `data`, not nested inside it. Merge them back in so callers don't
    // lose accessToken/refreshToken when we unwrap down to just `data`.
    if (payload.tokens) {
      return { ...(payload.data ?? {}), tokens: payload.tokens };
    }

    return payload.data ?? payload;
  }

  return payload;
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
  const data = error?.response?.data;
  const message =
    data?.message ||
    data?.error ||
    (data?.errors && JSON.stringify(data.errors)) ||
    error?.message;

  if (message) {
    return message;
  }

  if (error?.response?.status) {
    return `Request failed with status ${error.response.status}`;
  }

  return fallback;
}