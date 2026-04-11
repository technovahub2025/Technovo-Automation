import axios from "axios";
import { normalizeApiBaseUrl, resolveApiBaseUrl } from "./apiBaseUrl";

const APP_API_BASE_URL = resolveApiBaseUrl();
const META_API_BASE_URL = import.meta.env.VITE_META_API_BASE_URL || "";
const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
const normalizedMetaBaseUrl = normalizeApiBaseUrl(META_API_BASE_URL);
const META_API_RUNTIME_BASE_KEY = "meta_api_runtime_base_url";
const allowRemoteMetaApiInLocalDev = String(import.meta.env.VITE_META_API_ALLOW_REMOTE_LOCAL_DEV || "").trim().toLowerCase() === "true";

const getWindowHostname = () => {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").trim().toLowerCase();
};

const isLocalFrontend = () => /^(localhost|127\.0\.0\.1)$/i.test(getWindowHostname());

const shouldForceLocalMetaApiBase = () => isLocalFrontend() && !allowRemoteMetaApiInLocalDev;

const getRuntimeMetaBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return normalizeApiBaseUrl(window.localStorage.getItem(META_API_RUNTIME_BASE_KEY) || "");
};

const resolveMetaApiBaseUrl = () => {
  if (shouldForceLocalMetaApiBase()) {
    return APP_API_BASE_URL;
  }

  return getRuntimeMetaBaseUrl() || normalizedMetaBaseUrl || APP_API_BASE_URL;
};

export const setMetaApiRuntimeBaseUrl = (value) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeApiBaseUrl(value);
  if (shouldForceLocalMetaApiBase()) {
    window.localStorage.removeItem(META_API_RUNTIME_BASE_KEY);
    metaApi.defaults.baseURL = APP_API_BASE_URL;
    return;
  }

  if (normalized) {
    window.localStorage.setItem(META_API_RUNTIME_BASE_KEY, normalized);
    metaApi.defaults.baseURL = normalized;
    return;
  }

  window.localStorage.removeItem(META_API_RUNTIME_BASE_KEY);
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
};

const metaApi = axios.create({
  baseURL: resolveMetaApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

metaApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem(tokenKey) ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const resolvedBase = String(config.baseURL || metaApi.defaults.baseURL || "").toLowerCase();
  const resolvedUrl = String(config.url || "").toLowerCase();
  const isNgrokRequest = resolvedBase.includes("ngrok-free.dev") || resolvedUrl.includes("ngrok-free.dev");
  if (isNgrokRequest) {
    // Required for ngrok free-tier browser tunnel responses to bypass the interstitial page.
    config.headers["ngrok-skip-browser-warning"] = "1";
  }

  return config;
});

export const getMetaOverview = async () => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.get("/api/meta-ads/overview");
  return response.data;
};

export const getMetaDiagnostics = async () => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.get("/api/meta-ads/diagnostics");
  return response.data;
};

export const getMetaAuthUrl = async (origin) => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.post("/api/meta-ads/connect/auth-url", { origin });
  const backendOrigin = normalizeApiBaseUrl(response?.data?.backendOrigin);
  if (backendOrigin) {
    setMetaApiRuntimeBaseUrl(backendOrigin);
  }
  return response.data;
};

export const saveMetaSelections = async (payload) => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.post("/api/meta-ads/settings/selection", payload);
  return response.data;
};

export const previewMetaLeadConsent = async (leadId, params = {}) => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.get(`/api/meta-ads/leads/${encodeURIComponent(leadId)}/preview`, {
    params
  });
  return response.data;
};

export const syncMetaLeadConsent = async (payload) => {
  metaApi.defaults.baseURL = resolveMetaApiBaseUrl();
  const response = await metaApi.post("/api/meta-ads/leads/sync-consent", payload);
  return response.data;
};

export default {
  getMetaOverview,
  getMetaDiagnostics,
  getMetaAuthUrl,
  saveMetaSelections,
  previewMetaLeadConsent,
  syncMetaLeadConsent,
  setMetaApiRuntimeBaseUrl,
};
