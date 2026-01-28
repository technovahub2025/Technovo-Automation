/**
 * Broadcast API Service
 */
import axios from "axios";




const API_BASE_URL = import.meta.env.VITE_API_URL


const api = axios.create({
  baseURL: `${API_BASE_URL}/broadcast`,
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
    
    // Only handle 401 as authentication failure
    if (error.response?.status === 401) {
      console.warn('401 Unauthorized - Authentication failed');
      
      // Clear invalid token
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const broadcastAPI = {
  startBroadcast: (data) => api.post("/start", data),

  getBroadcastStatus: (broadcastId) =>
    api.get(`/status/${broadcastId}`),

  cancelBroadcast: (broadcastId) =>
    api.post(`/${broadcastId}/cancel`),

  getBroadcastCalls: (broadcastId, params = {}) =>
    api.get(`/${broadcastId}/calls`, { params }),

  listBroadcasts: (params = {}) =>
    api.get("/list", { params }),

  deleteBroadcast: (broadcastId) =>
    api.delete(`/${broadcastId}`),
};

export default broadcastAPI;