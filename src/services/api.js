/**
 * Production-ready API Service
 * Axios instance + helper methods
 * Allows direct calls like:
 *   apiService.get('/path')   // raw axios
 *   apiService.getActiveCalls() // helper
 */
import axios from "axios";

// Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Create Axios instance
const apiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ------------------------
// REQUEST INTERCEPTOR
// ------------------------
apiService.interceptors.request.use(
  (config) => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    // Check both potential keys to be safe
    const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------------
// RESPONSE INTERCEPTOR
// ------------------------
apiService.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.warn("401 Unauthorized - Logging out user");
      const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
      localStorage.removeItem(tokenKey);
      localStorage.removeItem("authToken"); // Remove fallback key too
      localStorage.removeItem("user");

      // Prevent infinite redirect loops if already on login
      if (window.location.pathname !== "/login" && !window.location.pathname.includes("/register")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// ------------------------
// HELPER METHODS (flattened)
// ------------------------

// Voice Call APIs
apiService.getActiveCalls = () => apiService.get("/voice/calls/active");
apiService.getCallDetails = (callSid) =>
  apiService.get(`/voice/call/${callSid}`);
apiService.makeOutboundCall = (to, from) =>
  apiService.post("/voice/call/outbound", { to, from });
apiService.scheduleOutboundCall = (data) =>
  apiService.post("/voice/call/schedule", data);
apiService.bulkOutboundCall = (data) =>
  apiService.post("/voice/call/bulk", data);
apiService.cancelScheduledCall = (callId) =>
  apiService.delete(`/voice/call/schedule/${callId}`);
apiService.endCall = (callSid) => apiService.post(`/voice/call/${callSid}/end`);

// User & Contact APIs
apiService.getUsers = () => apiService.get("/api/users");
apiService.getUserDetails = (userId) => apiService.get(`/api/users/${userId}`);
apiService.getContacts = () => apiService.get("/api/contacts");

// Call History & Stats
apiService.getCallHistory = (params) =>
  apiService.get("/api/calls/history", { params });
apiService.getCallStats = () => apiService.get("/voice/stats");
apiService.getCallTemplates = () => apiService.get("/voice/templates");
apiService.getCallSettings = () => apiService.get("/voice/settings");
apiService.updateCallSettings = (settings) =>
  apiService.post("/voice/settings", settings);
apiService.getScheduledCalls = () =>
  apiService.get("/voice/call/scheduled");

// Health Checks
apiService.checkBackendHealth = () => apiService.get("/");
apiService.checkAIHealth = () => apiService.get("/ai/health");

// Inbound and IVR methods
apiService.getInboundAnalytics = (period = 'today') => apiService.get(`/inbound/analytics?period=${period}`);

// IVR Configuration Management
apiService.getIVRConfigs = () => apiService.get('/inbound/ivr/configs');
apiService.updateIVRConfig = (menuName, config) => apiService.post('/inbound/ivr/configs', { menuName, config });
apiService.deleteIVRConfig = (menuName) => apiService.delete(`/inbound/ivr/configs/${encodeURIComponent(menuName)}`);

// IVR Audio Management (using existing /ivr routes)
apiService.getIVRPrompts = () => apiService.get('/ivr/prompts');
apiService.getIVRPrompt = (promptKey) => apiService.get(`/ivr/prompts/${promptKey}`);
apiService.generateIVRAudio = (promptKey, text, language, forceRegenerate = false) => 
  apiService.post('/ivr/generate-audio', { promptKey, text, language, forceRegenerate });
apiService.deleteIVRAudio = (promptKey, language) => apiService.delete(`/ivr/audio/${promptKey}/${language}`);

// Queue and Routing
apiService.getQueueStatus = (queueName) =>
  apiService.get(queueName ? `/inbound/queues/${queueName}` : "/inbound/queues");
apiService.getRoutingRules = () => apiService.get("/inbound/routing/rules");
apiService.updateRoutingRule = (rule) =>
  apiService.post("/inbound/routing/rules", rule);
apiService.deleteRoutingRule = (ruleId) =>
  apiService.delete(`/inbound/routing/rules/${ruleId}`);
apiService.toggleRoutingRule = (ruleId) =>
  apiService.patch(`/inbound/routing/rules/${ruleId}/toggle`);
apiService.exportAnalytics = (period, format) =>
  apiService.get(
    `/inbound/analytics/export?period=${period}&format=${format}`,
    { responseType: "blob" }
  );

// ------------------------
// EXPORT
// ------------------------
export default apiService;
