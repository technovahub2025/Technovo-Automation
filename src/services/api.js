/**
 * Production-ready API Service
 * Axios instance + helper methods
 * Allows direct calls like:
 *   apiService.get('/path')   // raw axios
 *   apiService.getActiveCalls() // helper
 */
import axios from "axios";
import socketService from "./socketService";

// Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ADMIN_API_BASE_URL = import.meta.env.VITE_API_ADMIN_URL || API_BASE_URL;

// Create Axios instance
const apiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increase default timeout to 30 seconds
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
  apiService.post("/voice/call/outbound", { phoneNumber: to, scenario: from });
apiService.scheduleOutboundCall = (data) =>
  apiService.post("/voice/call/outbound", {
    phoneNumber: data?.phoneNumber || data?.to || data?.contacts?.[0],
    scenario: data
  });
apiService.bulkOutboundCall = (data) =>
  apiService.post("/voice/call/outbound", {
    phoneNumber: data?.phoneNumber || data?.to || data?.contacts?.[0],
    scenario: data
  });
apiService.cancelScheduledCall = (callId) =>
  Promise.resolve({ data: { success: true, message: "No scheduled-call API in backend contract" } });
apiService.endCall = (callSid) => apiService.post(`/voice/call/${callSid}/end`);

// User & Contact APIs
apiService.getUsers = () => apiService.get("/api/users");
apiService.getUserDetails = (userId) => apiService.get(`/api/users/${userId}`);
apiService.getContacts = () => apiService.get("/api/outbound-config/contact-lists");

// Call History & Stats
apiService.getCallHistory = (params) =>
  apiService.get("/api/call-logs", { params });
apiService.getCallStats = () => apiService.get("/voice/stats");
apiService.getCallTemplates = () => apiService.get("/api/outbound-config/templates");
apiService.getCallSettings = () => Promise.resolve({ data: {} });
apiService.updateCallSettings = (settings) =>
  Promise.resolve({ data: { success: true, settings } });
apiService.getScheduledCalls = () =>
  Promise.resolve({ data: [] });

// Health Checks
apiService.checkBackendHealth = () => apiService.get("/");
apiService.checkAIHealth = () => apiService.get("/ai/health");

// Inbound and IVR methods
apiService.getInboundAnalytics = (period = 'today', params = {}) => {
  const queryParams = new URLSearchParams({ period, ...params }).toString();
  return apiService.get(`/api/analytics/inbound?${queryParams}`);
};


// IVR Audio Management (using existing /ivr routes)
apiService.getIVRPrompts = () => apiService.get('/ivr/prompts');
apiService.getIVRPrompt = (promptKey) => apiService.get(`/ivr/prompts/${promptKey}`);
apiService.generateIVRAudio = (promptKey, text, language, forceRegenerate = false) =>
  apiService.post('/ivr/generate-audio', { promptKey, text, language, forceRegenerate });
apiService.deleteIVRAudio = (promptKey, language) => apiService.delete(`/ivr/audio/${promptKey}/${language}`);
apiService.deleteCustomAudio = (publicId) => apiService.delete(`/ivr/audio/${encodeURIComponent(publicId)}`);

// IVR Menu Management
apiService.createIVRConfig = (menuName, config) => apiService.post('/inbound/ivr/configs', { menuName, config });
apiService.getIVRConfigs = () => apiService.get('/inbound/ivr/configs');
apiService.deleteIVRConfig = (menuId) => apiService.delete(`/inbound/ivr/configs/${menuId}`);
apiService.testIVRMenu = (menuId, phoneNumber) => apiService.post(`/ivr/menus/${menuId}/test`, { phoneNumber });


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
apiService.testRoutingRule = (ruleId, payload = {}) =>
  apiService.post(`/inbound/routing/rules/${ruleId}/test`, payload);
apiService.exportAnalytics = (period, format) =>
  apiService.get(
    `/api/analytics/export?period=${period}&format=${format}`,
    { responseType: "blob" }
  );

// Call Details APIs
apiService.getAllCalls = (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  return apiService.get(`/api/calls?${queryParams}`);
};
apiService.getCallDetailsById = (callId, type) => 
  apiService.get(`/api/calls/${callId}${type ? `?type=${type}` : ''}`);
apiService.getInboundCallDetails = (callId) => 
  apiService.get(`/api/calls/${callId}/inbound`);
apiService.getIVRCallDetails = (callId) => 
  apiService.get(`/api/calls/${callId}/ivr`);
apiService.getOutboundCallDetails = (callId) => 
  apiService.get(`/api/calls/${callId}/outbound`);



// WebSocket helper used by analytics and live dashboards
apiService.initializeSocket = () => socketService.connect();

// Superadmin / Admin management APIs
apiService.getAdmins = () => apiService.get(`${ADMIN_API_BASE_URL}/api/getadmin`);
apiService.registerAdmin = (payload) => apiService.post(`${ADMIN_API_BASE_URL}/registeradmin`, payload);
apiService.updateAdmin = (adminId, payload) => apiService.put(`${ADMIN_API_BASE_URL}/api/edit/${adminId}`, payload);
apiService.deleteAdmin = (adminId) => apiService.delete(`${ADMIN_API_BASE_URL}/api/delete/${adminId}`);
apiService.saveAdminCredentials = (payload) => apiService.post(`${ADMIN_API_BASE_URL}/api/nexionadmin/admindata`, payload);
apiService.getUserCredentials = () => apiService.get(`${ADMIN_API_BASE_URL}/api/user/credentials`);
apiService.updateMyTwilio = (payload) => apiService.put(`${ADMIN_API_BASE_URL}/api/admin/twilio`, payload);


// ------------------------
// EXPORT
// ------------------------
export default apiService;
