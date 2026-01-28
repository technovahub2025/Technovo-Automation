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
    
    // Don't treat 404, 500, etc. as auth failures
    return Promise.reject(error);
  }
);

export const apiService = {
  getActiveCalls: () => api.get("/voice/calls/active"),
  getCallDetails: (callSid) => api.get(`/voice/call/${callSid}`),
  makeOutboundCall: (to, from) =>
    api.post("/voice/call/outbound", { to, from }),
  scheduleOutboundCall: (data) =>
    api.post("/voice/call/schedule", data),
  bulkOutboundCall: (data) =>
    api.post("/voice/call/bulk", data),
  cancelScheduledCall: (callId) =>
    api.delete(`/voice/call/schedule/${callId}`),
  endCall: (callSid) => api.post(`/voice/call/${callSid}/end`),

  getUsers: () => api.get("/api/users"),
  getUserDetails: (userId) => api.get(`/api/users/${userId}`),
  getContacts: () => api.get("/api/contacts"),

  getCallHistory: (params) =>
    api.get("/api/calls/history", { params }),
  getCallStats: () => api.get("/voice/stats"),
  getCallTemplates: () => api.get("/voice/templates"),
  getCallSettings: () => api.get("/voice/settings"),
  updateCallSettings: (settings) => api.post("/voice/settings", settings),

  checkBackendHealth: () => api.get("/"),
  checkAIHealth: () => api.get("/ai/health"),

  // Inbound Call Management APIs
  getInboundAnalytics: (period = 'today') => 
    api.get(`/inbound/analytics?period=${period}`),
  getQueueStatus: (queueName) => 
    api.get(queueName ? `/inbound/queues/${queueName}` : "/inbound/queues"),
  getIVRConfigs: () => 
    api.get("/inbound/ivr/configs"),
  updateIVRConfig: (menuName, config) => 
    api.post("/inbound/ivr/configs", { menuName, config }),
  deleteIVRConfig: (menuName) => 
    api.delete(`/inbound/ivr/configs/${menuName}`),
  testIVRMenu: (menuName) => 
    api.post(`/inbound/ivr/test/${menuName}`),
  getRoutingRules: () => 
    api.get("/inbound/routing/rules"),
  updateRoutingRule: (rule) => 
    api.post("/inbound/routing/rules", rule),
  deleteRoutingRule: (ruleId) => 
    api.delete(`/inbound/routing/rules/${ruleId}`),
  toggleRoutingRule: (ruleId) => 
    api.patch(`/inbound/routing/rules/${ruleId}/toggle`),
  exportAnalytics: (period, format) => 
    api.get(`/inbound/analytics/export?period=${period}&format=${format}`, { responseType: 'blob' }),
};

export default api;