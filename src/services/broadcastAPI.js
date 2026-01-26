/**
 * Broadcast API Service
 */
import axios from "axios";




const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';


const api = axios.create({
  baseURL: `${API_BASE_URL}/api/broadcast`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth token
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

// Error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("Broadcast API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const broadcastAPI = {
  startBroadcast: (data) => api.post("/", data),

  getBroadcastStatus: (broadcastId) =>
    api.get(`/${broadcastId}`),

  cancelBroadcast: (broadcastId) =>
    api.delete(`/${broadcastId}`),

  getBroadcastCalls: (broadcastId, params = {}) =>
    api.get(`/${broadcastId}/calls`, { params }),

  listBroadcasts: (params = {}) => api.get("/", { params }),

  deleteBroadcast: (broadcastId) => api.delete(`/${broadcastId}`),

  // Additional methods for compatibility
  createBroadcast: (data) => api.post("/", data),
  
  sendBroadcast: (broadcastId) => api.post(`/${broadcastId}/send`),
  
  checkScheduledBroadcasts: () => api.post("/check-scheduled"),
  
  syncBroadcastStats: (broadcastId) => api.post(`/${broadcastId}/sync-stats`),
};

export default broadcastAPI;
