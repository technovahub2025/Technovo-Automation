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
const USE_CREDENTIALS = String(import.meta.env.VITE_API_WITH_CREDENTIALS || "false").toLowerCase() === "true";

// Create Axios instance
const apiService = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increase default timeout to 30 seconds
  withCredentials: USE_CREDENTIALS,
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

    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      console.warn("401 Unauthorized - Logging out user");
      const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
      socketService.disconnect();
      localStorage.removeItem(tokenKey);
      localStorage.removeItem("authToken"); // Remove fallback key too
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.setItem("auth_expired_notice", "Your session expired. Please login again.");
      const baseUrl = import.meta.env.BASE_URL || "/";
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const loginPath = `${normalizedBase}/login`;
      const registerPath = `${normalizedBase}/register`;

      // Prevent infinite redirect loops if already on login
      if (window.location.pathname !== loginPath && !window.location.pathname.includes(registerPath)) {
        window.location.href = loginPath;
      }
    }

    return Promise.reject(error);
  }
);

// ------------------------
// HELPER METHODS (flattened)
// ------------------------

// Voice Call APIs
apiService.getActiveCalls = () =>
  apiService.get("/voice/calls/active");
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
apiService.quickOutboundCall = (payload) =>
  apiService.post("/api/voice/outbound-local", payload, {
    timeout: Number(import.meta.env.VITE_OUTBOUND_QUICKCALL_TIMEOUT_MS || 90000)
  });
apiService.outboundLocalQuickCall = apiService.quickOutboundCall;
apiService.outboundVoiceQuickCall = apiService.quickOutboundCall;
apiService.getOutboundOverview = () =>
  apiService.get("/api/voice/outbound-local/overview");
apiService.getOutboundCampaigns = (params = {}) =>
  apiService.get("/api/voice/outbound-local/campaigns", { params });
apiService.bulkDeleteCallLogs = (callSids = []) =>
  apiService.post("/api/call-logs/bulk-delete", { callSids });
apiService.bulkDeleteOutboundCampaigns = (campaignIds = []) =>
  apiService.post("/api/voice/outbound-local/campaigns/bulk-delete", { campaignIds });
apiService.getOutboundLocalOverview = apiService.getOutboundOverview;
apiService.getOutboundVoiceOverview = apiService.getOutboundOverview;
apiService.getOutboundTemplates = () =>
  apiService.get("/api/voice/outbound-local/templates");
apiService.getOutboundLocalTemplates = apiService.getOutboundTemplates;
apiService.getOutboundVoiceTemplates = apiService.getOutboundTemplates;
apiService.createOutboundTemplate = (payload) =>
  apiService.post("/api/voice/outbound-local/templates", payload);
apiService.createOutboundLocalTemplate = apiService.createOutboundTemplate;
apiService.createOutboundVoiceTemplate = apiService.createOutboundTemplate;
apiService.updateOutboundTemplate = (templateId, payload) =>
  apiService.put(`/api/voice/outbound-local/templates/${templateId}`, payload);
apiService.updateOutboundLocalTemplate = apiService.updateOutboundTemplate;
apiService.updateOutboundVoiceTemplate = apiService.updateOutboundTemplate;
apiService.deleteOutboundTemplate = (templateId) =>
  apiService.delete(`/api/voice/outbound-local/templates/${templateId}`);
apiService.deleteOutboundLocalTemplate = apiService.deleteOutboundTemplate;
apiService.deleteOutboundVoiceTemplate = apiService.deleteOutboundTemplate;
apiService.launchOutboundBulkCampaign = (payload) =>
  apiService.post("/api/voice/outbound-local/bulk", payload);
apiService.outboundLocalBulkCampaign = apiService.launchOutboundBulkCampaign;
apiService.outboundVoiceBulkCampaign = apiService.launchOutboundBulkCampaign;
apiService.scheduleOutboundCampaign = (payload) =>
  apiService.post("/api/outbound-local/schedule", payload);
apiService.outboundLocalScheduleCampaign = apiService.scheduleOutboundCampaign;
apiService.outboundVoiceScheduleCampaign = apiService.scheduleOutboundCampaign;
apiService.getOutboundSchedules = (params = {}) =>
  apiService.get("/api/outbound-local/schedule", { params });
apiService.getOutboundLocalSchedules = apiService.getOutboundSchedules;
apiService.getOutboundVoiceSchedules = apiService.getOutboundSchedules;
apiService.retryOutboundCampaign = (payload = {}) =>
  apiService.post("/api/outbound-local/retry", payload);
apiService.outboundLocalRetryCampaign = apiService.retryOutboundCampaign;
apiService.outboundVoiceRetryCampaign = apiService.retryOutboundCampaign;
apiService.createOutboundABTest = (payload) =>
  apiService.post("/api/outbound-local/abtest", payload);
apiService.outboundLocalABTest = apiService.createOutboundABTest;
apiService.outboundVoiceABTest = apiService.createOutboundABTest;
apiService.getOutboundRotationStats = () =>
  apiService.get("/api/outbound-local/numbers/rotate");
apiService.outboundLocalRotateNumbers = apiService.getOutboundRotationStats;
apiService.outboundVoiceRotateNumbers = apiService.getOutboundRotationStats;
apiService.pauseOutboundSchedule = (scheduleId) =>
  apiService.post(`/api/outbound-local/schedule/${scheduleId}/pause`);
apiService.outboundLocalPauseSchedule = apiService.pauseOutboundSchedule;
apiService.outboundVoicePauseSchedule = apiService.pauseOutboundSchedule;
apiService.resumeOutboundSchedule = (scheduleId) =>
  apiService.post(`/api/outbound-local/schedule/${scheduleId}/resume`);
apiService.outboundLocalResumeSchedule = apiService.resumeOutboundSchedule;
apiService.outboundVoiceResumeSchedule = apiService.resumeOutboundSchedule;
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
apiService.getCallStats = () =>
  apiService.get("/voice/stats");
apiService.getCallTemplates = () => apiService.get("/api/outbound-config/templates");
apiService.getCallSettings = () => Promise.resolve({ data: {} });
apiService.updateCallSettings = (settings) =>
  Promise.resolve({ data: { success: true, settings } });
apiService.getScheduledCalls = () =>
  Promise.resolve({ data: [] });

// Health Checks
apiService.checkBackendHealth = () =>
  apiService.get("/", { skipAuthRedirect: true });
apiService.checkAIHealth = () =>
  apiService.get("/ai/health", { skipAuthRedirect: true });

// Inbound and IVR methods
const fetchInboundAnalyticsHttp = (period = 'today', params = {}) => {
  const queryParams = new URLSearchParams({ period, ...params }).toString();
  return apiService.get(`/api/analytics/inbound?${queryParams}`);
};
apiService.getInboundAnalytics = async (period = 'today', params = {}) => {
  const socket = socketService.connect();
  const socketTimeoutMs = Number(import.meta.env.VITE_ANALYTICS_SOCKET_TIMEOUT_MS || 7000);
  const payload = {
    period,
    callType: params?.callType || 'all',
    status: params?.status || 'all',
    reason: 'apiService.getInboundAnalytics'
  };

  if (!socket) {
    return fetchInboundAnalyticsHttp(period, params);
  }

  // Socket-first analytics fetch. Falls back to HTTP if socket is unavailable/slow.
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off('call_analytics_update', handleAnalyticsUpdate);
      socket.off('analytics_error', handleAnalyticsError);
    };

    const settleResolve = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAnalyticsUpdate = (eventPayload = {}) => {
      const matchesPeriod = String(eventPayload.period || 'today') === String(payload.period);
      const matchesType = String(eventPayload.callType || 'all') === String(payload.callType);
      const matchesStatus = String(eventPayload.status || 'all') === String(payload.status);
      if (!matchesPeriod || !matchesType || !matchesStatus) return;

      settleResolve({ data: { data: eventPayload.analytics || null } });
    };

    const handleAnalyticsError = async (eventPayload = {}) => {
      try {
        const fallback = await fetchInboundAnalyticsHttp(period, params);
        settleResolve(fallback);
      } catch (fallbackError) {
        settleReject(fallbackError || new Error(eventPayload?.error || 'Socket analytics error'));
      }
    };

    const timeoutId = setTimeout(async () => {
      try {
        const fallback = await fetchInboundAnalyticsHttp(period, params);
        settleResolve(fallback);
      } catch (fallbackError) {
        settleReject(fallbackError);
      }
    }, socketTimeoutMs);

    socket.on('call_analytics_update', handleAnalyticsUpdate);
    socket.on('analytics_error', handleAnalyticsError);
    socket.emit('request_call_analytics', payload);
  });
};
apiService.getVoiceTodayStats = () =>
  apiService.get('/api/analytics/voice/today');


// IVR Audio Management (using existing /ivr routes)
apiService.getIVRPrompts = () => apiService.get('/ivr/prompts');
apiService.getIVRPrompt = (promptKey) => apiService.get(`/ivr/prompts/${promptKey}`);
apiService.generateIVRAudio = (promptKey, text, language, forceRegenerate = false) =>
  apiService.post('/ivr/generate-audio', { promptKey, text, language, forceRegenerate });
apiService.deleteIVRAudio = (promptKey, language) => apiService.delete(`/ivr/audio/${promptKey}/${language}`);
apiService.deleteCustomAudio = (publicId) => apiService.delete(`/ivr/audio/${encodeURIComponent(publicId)}`);
apiService.deleteCustomAudioByPublicId = (publicId) => apiService.delete('/ivr/audio/delete', { data: { publicId } });

// IVR Menu Management
apiService.createIVRConfig = (menuName, config) => apiService.post('/inbound/ivr/configs', { menuName, config });
apiService.getIVRConfigs = () => apiService.get('/inbound/ivr/configs');
apiService.deleteIVRConfig = (menuId) => apiService.delete(`/inbound/ivr/configs/${menuId}`);
apiService.getIVRMenus = (params = {}) => apiService.get('/ivr/menus', { params });
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
apiService.getAdminUsers = (config = {}) =>
  apiService.get(`${ADMIN_API_BASE_URL}/api/admin/users`, {
    timeout: Number(import.meta.env.VITE_ADMIN_USERS_TIMEOUT_MS || 90000),
    ...config
  });
apiService.saveCustomPackageDraft = (userId, payload) =>
  apiService.post(`${ADMIN_API_BASE_URL}/api/admin/users/${userId}/custom-package/draft`, payload);
apiService.generateCustomPackagePaymentLink = (userId) =>
  apiService.post(`${ADMIN_API_BASE_URL}/api/admin/users/${userId}/custom-package/payment-link`);
apiService.verifyCustomPackagePayment = (payload) =>
  apiService.post(`${ADMIN_API_BASE_URL}/api/admin/custom-package/payments/verify`, payload);
apiService.resetCustomPackage = (userId) =>
  apiService.post(`${ADMIN_API_BASE_URL}/api/admin/users/${userId}/custom-package/reset`);
apiService.uploadAdminMetaDocumentForUser = (userId, formData) =>
  apiService.post(`${ADMIN_API_BASE_URL}/api/admin/users/${userId}/meta-documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
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

