/**
 * API Service - Connect to Backend
 */
import axios from "axios";

 const VITE_API_URL_ROUTE='/api/message/bulknode'


const API_BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiService = {
  getActiveCalls: () => api.get("/voice/calls/active"),
  getCallDetails: (callSid) => api.get(`/voice/call/${callSid}`),
  makeOutboundCall: (to, from) =>
    api.post("/voice/call/outbound", { to, from }),
  endCall: (callSid) => api.post(`/voice/call/${callSid}/end`),

  getUsers: () => api.get("/api/users"),
  getUserDetails: (userId) => api.get(`/api/users/${userId}`),

  getCallHistory: (params) =>
    api.get("/api/calls/history", { params }),
  getCallStats: () => api.get("/voice/stats"),

  checkBackendHealth: () => api.get("/"),
  checkAIHealth: () => api.get("/ai/health"),
};

export default api;
