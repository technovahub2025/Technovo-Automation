import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const toCleanString = (value) => String(value || "").trim().replace(/\/+$/, "");

const resolveEmailDashboardBaseUrl = () => {
  const explicit = toCleanString(import.meta.env.VITE_EMAIL_DASHBOARD_API_URL);
  if (explicit) return explicit;

  const adminApiUrl = toCleanString(import.meta.env.VITE_API_ADMIN_URL);
  if (adminApiUrl) return adminApiUrl;

  return resolveApiBaseUrl();
};

const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";

const emailDashboardApi = axios.create({
  baseURL: `${resolveEmailDashboardBaseUrl()}/api`,
  timeout: Number(import.meta.env.VITE_EMAIL_DASHBOARD_TIMEOUT_MS || 15000)
});

emailDashboardApi.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const token =
    window.localStorage.getItem(tokenKey) ||
    window.localStorage.getItem("authToken") ||
    window.localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fetchEmailDashboardOverview = async () => {
  const { data } = await emailDashboardApi.get("/email-dashboard/overview");
  return data;
};

export const fetchEmailDashboardHistory = async (limit = 20) => {
  const { data } = await emailDashboardApi.get("/email-dashboard/history", {
    params: { limit }
  });
  return data;
};

export const createEmailHistoryEntry = async (payload) => {
  const { data } = await emailDashboardApi.post("/email-dashboard/history", payload);
  return data;
};

export default emailDashboardApi;
