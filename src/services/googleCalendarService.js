import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const API_BASE_URL = resolveApiBaseUrl();

const getAuthHeaders = (includeJson = true) => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
  const headers = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const toServiceError = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export const googleCalendarService = {
  async getConnectAuthUrl(origin = window.location.origin) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/google-calendar/connect/auth-url`,
        { origin },
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to create Google auth URL") };
    }
  },

  async getAuthStatus() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/google-calendar/auth-status`,
        { headers: getAuthHeaders(false) }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to load Google auth status") };
    }
  },

  async disconnect() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/google-calendar/disconnect`,
        {},
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to disconnect Google Calendar") };
    }
  },

  async createMeetLink(payload = {}) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/google-calendar/meet-link`,
        payload,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to create Google Meet link") };
    }
  }
};

export default googleCalendarService;
