import axios from "axios";

const APP_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const META_API_BASE_URL = import.meta.env.VITE_META_API_BASE_URL || "";
const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalFrontend = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
const API_BASE_URL =
  isLocalFrontend || !META_API_BASE_URL ? APP_API_BASE_URL : META_API_BASE_URL;

const metaApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

metaApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getMetaOverview = async () => {
  const response = await metaApi.get("/api/meta-ads/overview");
  return response.data;
};

export const getMetaDiagnostics = async () => {
  const response = await metaApi.get("/api/meta-ads/diagnostics");
  return response.data;
};

export const getMetaAuthUrl = async (origin) => {
  const response = await metaApi.post("/api/meta-ads/connect/auth-url", { origin });
  return response.data;
};

export const saveMetaSelections = async (payload) => {
  const response = await metaApi.post("/api/meta-ads/settings/selection", payload);
  return response.data;
};

export default {
  getMetaOverview,
  getMetaDiagnostics,
  getMetaAuthUrl,
  saveMetaSelections,
};
