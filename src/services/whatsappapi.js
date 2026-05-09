/**
 * Comprehensive API Service - WhatsApp Business Platform
 * Provides complete integration with all backend endpoints
 */
import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import { registerUnauthorizedAxiosInterceptor } from "./serviceAuth";

const API_BASE_URL = resolveApiBaseUrl();
const ADMIN_API_BASE_URL =
  String(import.meta.env.VITE_API_ADMIN_URL || '').trim().replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 30000);
const LONG_TIMEOUT_MS = Number(import.meta.env.VITE_API_LONG_TIMEOUT_MS || 300000);

const getStoredAuthToken = () => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
  const sessionTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(tokenKey) : null;
  const sessionAuthToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('authToken') : null;
  const sessionLegacyToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  const storedUser = (() => {
    try {
      const sessionUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
      return JSON.parse(localStorage.getItem('user') || sessionUser || 'null');
    } catch {
      return null;
    }
  })();
  return (
    localStorage.getItem(tokenKey) ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    sessionTokenKey ||
    sessionAuthToken ||
    sessionLegacyToken ||
    String(storedUser?.token || storedUser?.accessToken || '').trim() ||
    ''
  );
};

const buildAuthHeaders = (includeJsonContentType = true) => {
  const headers = {};
  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const isBlobLike = (value) =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true // This is important for sending cookies if you're using them
});

// Request interceptor for authentication and logging
api.interceptors.request.use(
  (config) => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    const sessionTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(tokenKey) : null;
    const sessionAuthToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("authToken") : null;
    const sessionLegacyToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("token") : null;
    const storedUser = (() => {
      try {
        const sessionUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
        return JSON.parse(localStorage.getItem('user') || sessionUser || 'null');
      } catch {
        return null;
      }
    })();
    const token =
      localStorage.getItem(tokenKey) ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      sessionTokenKey ||
      sessionAuthToken ||
      sessionLegacyToken ||
      String(storedUser?.token || storedUser?.accessToken || '').trim();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", error.response?.data || error.message);
    
    // Handle common error scenarios
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          console.error('Unauthorized - Please check your authentication');
          // Optionally redirect to login
          break;
        case 403:
          console.error('Forbidden - Insufficient permissions');
          break;
        case 404:
          console.error('Not Found - Resource does not exist');
          break;
        case 429:
          console.error('Rate Limit Exceeded - Please try again later');
          break;
        case 500:
          console.error('Server Error - Please try again later');
          break;
        default:
          console.error(`API Error: ${status} - ${data?.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      console.error('Network Error - No response received');
    } else {
      console.error('Request Setup Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

registerUnauthorizedAxiosInterceptor(api);

// WhatsApp Business Platform API Methods
export const apiClient = {
  // ============ CONVERSATIONS ============
  
  /**
   * Get all conversations with optional filtering
   * @param {Object} params - Query parameters (status, assignedTo, search)
   */
  getConversations: (params = {}) => api.get('/conversations', { params, timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Get single conversation by ID
   * @param {string} id - Conversation ID
   */
  getConversation: (id) => api.get(`/conversations/${id}`, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Create new conversation
   * @param {Object} data - Conversation data
   */
  createConversation: (data) => api.post('/conversations', data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Update conversation
   * @param {string} id - Conversation ID
   * @param {Object} data - Update data
   */
  updateConversation: (id, data) => api.put(`/conversations/${id}`, data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Mark conversation as read
   * @param {string} id - Conversation ID
   */
  markConversationAsRead: (id) => api.put(`/conversations/${id}/read`, undefined, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   */
  getMessages: (conversationId) => api.get(`/conversations/${conversationId}/messages`, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Send message
   * @param {Object} data - Message data (to, text, conversationId, mediaUrl, mediaType)
   */
  sendMessage: (data) => api.post('/messages/send', data, { timeout: LONG_TIMEOUT_MS }),

  uploadBroadcastTemplateMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const uploadApi = axios.create({
      baseURL: `${String(API_BASE_URL || '').trim().replace(/\/+$/, '')}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: false
    });

    uploadApi.interceptors.request.use((config) => {
      const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
      const sessionTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(tokenKey) : null;
      const sessionAuthToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('authToken') : null;
      const sessionLegacyToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
      const storedUser = (() => {
        try {
          const sessionUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
          return JSON.parse(localStorage.getItem('user') || sessionUser || 'null');
        } catch {
          return null;
        }
      })();
      const token =
        localStorage.getItem(tokenKey) ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        sessionTokenKey ||
        sessionAuthToken ||
        sessionLegacyToken ||
        String(storedUser?.token || storedUser?.accessToken || '').trim();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    try {
    const response = await uploadApi.post('/messages/template-header-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        const notFound = new Error(
          'Template header upload endpoint is not available on the running broadcast backend. Restart the backend so it loads /api/messages/template-header-media.'
        );
        notFound.status = 404;
        throw notFound;
      }
      throw error;
    }
  },

  // ============ CONTACTS ============
  
  /**
   * Get all contacts with optional filtering
   * @param {Object} params - Query parameters (search, tags)
   */
  getContacts: (params = {}) => api.get('/contacts', { params, timeout: LONG_TIMEOUT_MS }),

  /**
   * Lookup CRM contacts by phone numbers
   * @param {Array<string>} phones - Phone numbers to resolve
   */
  lookupContactsByPhones: (phones = []) =>
    api.post('/contacts/lookup', { phones }, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Create new contact
   * @param {Object} data - Contact data
   */
  createContact: (data) => api.post('/contacts', data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Import multiple contacts
   * @param {Array} contacts - Array of contact objects
   */
  importContacts: (contacts) => api.post('/contacts/import', { contacts }, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Update contact
   * @param {string} id - Contact ID
   * @param {Object} data - Update data
   */
  updateContact: (id, data) => api.put(`/contacts/${id}`, data, { timeout: LONG_TIMEOUT_MS }),

  markContactWhatsAppOptIn: (id, data = {}) => api.post(`/contacts/${id}/whatsapp-opt-in`, data, { timeout: LONG_TIMEOUT_MS }),

  markContactWhatsAppOptOut: (id, data = {}) => api.post(`/contacts/${id}/whatsapp-opt-out`, data, { timeout: LONG_TIMEOUT_MS }),

  getContactWhatsAppStatus: (id) => api.get(`/contacts/${id}/whatsapp-status`, { timeout: LONG_TIMEOUT_MS }),

  getContactWhatsAppConsentAudit: (id) => api.get(`/contacts/${id}/whatsapp-consent-audit`, { timeout: LONG_TIMEOUT_MS }),

  getAudienceSegments: (params = {}) => api.get('/audience-segments', { params, timeout: LONG_TIMEOUT_MS }),
  createAudienceSegment: (data) => api.post('/audience-segments', data, { timeout: LONG_TIMEOUT_MS }),
  deleteAudienceSegment: (id) => api.delete(`/audience-segments/${id}`, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Delete contact
   * @param {string} id - Contact ID
   */
  deleteContact: (id) => api.delete(`/contacts/${id}`, { timeout: LONG_TIMEOUT_MS }),

  // ============ MISSED CALLS ============
  getMissedCalls: (params = {}) => api.get('/missedcalls', { params, timeout: LONG_TIMEOUT_MS }),
  resolveMissedCall: (id, payload = {}) => api.put(`/missedcalls/${id}/resolve`, payload, { timeout: LONG_TIMEOUT_MS }),
  runMissedCallNow: (id) => api.post(`/missedcalls/${id}/run-now`, undefined, { timeout: LONG_TIMEOUT_MS }),
  getMissedCallSettings: () => api.get('/missedcalls/settings', { timeout: LONG_TIMEOUT_MS }),
  updateMissedCallSettings: (data) => api.put('/missedcalls/settings', data, { timeout: LONG_TIMEOUT_MS }),

  // ============ TEMPLATES ============
  
  /**
   * Get all templates, preferring Meta but falling back to local templates when Meta is unavailable.
   * @param {Object} params - Query parameters (status, category, language)
   */
  getTemplates: async (params = {}) => {
    try {
      return await api.get('/templates/meta', { params, timeout: LONG_TIMEOUT_MS });
    } catch (error) {
      console.warn('Meta template fetch failed, falling back to local templates:', error?.response?.status || error?.message);
      return api.get('/templates', { params, timeout: LONG_TIMEOUT_MS });
    }
  },
  
  /**
   * Sync templates from Meta WhatsApp Business API
   */
  syncTemplates: () => api.post('/templates/meta/sync', undefined, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Get single template by ID
   * @param {string} id - Template ID
   */
  getTemplate: (id) => api.get(`/templates/${id}`, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Create new template
   * @param {Object} data - Template data
   */
  createTemplate: (data) => api.post('/templates', data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Update template
   * @param {string} id - Template ID
   * @param {Object} data - Update data
   */
  updateTemplate: (id, data) => api.put(`/templates/${id}`, data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Delete template
   * @param {string} id - Template ID
   */
  deleteTemplate: (id) => api.delete(`/templates/${id}`, { timeout: LONG_TIMEOUT_MS }),
  
  // ============ BULK MESSAGING ============
  
  /**
   * Upload CSV file for bulk messaging
   * @param {Object} data - CSV data object with csvData field
   */
  uploadCSV: (data, options = {}) => {
    if (isBlobLike(data)) {
      const formData = new FormData();
      formData.append('csv_file', data);

      return axios
        .post(`${API_BASE_URL}/api/bulk/imports`, formData, {
        timeout: LONG_TIMEOUT_MS,
        withCredentials: true,
        headers: buildAuthHeaders(false),
        onUploadProgress: options.onUploadProgress
        })
        .then((response) => response.data);
    }

    return api.post('/bulk/upload', data, { timeout: LONG_TIMEOUT_MS });
  },

  getCsvImportJob: (id) => api.get(`/bulk/imports/${id}`, { timeout: LONG_TIMEOUT_MS }),

  getCsvImportJobs: (params = {}) => api.get('/bulk/imports', { params, timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Send bulk messages
   * @param {Object} data - Bulk message data
   */
  sendBulkMessages: (data) => api.post('/bulk/send', data, { timeout: LONG_TIMEOUT_MS }),

  validateBroadcastAudience: (data) => api.post('/bulk/validate-audience', data, { timeout: LONG_TIMEOUT_MS }),

  syncMetaLeadConsentBatch: (data) => api.post('/meta-ads/leads/sync-consent/batch', data, { timeout: LONG_TIMEOUT_MS }),

  // ============ CONVERSATIONS & CONTACTS ============
  
  /**
   * Get unique contacts from conversations (for broadcast)
   * This endpoint doesn't exist yet - using regular contacts instead
   * @param {Object} params - Query parameters
   */
  getConversationContacts: (params = {}) => api.get('/conversations/contacts/unique', { params, timeout: LONG_TIMEOUT_MS }),

  // ============ BROADCASTS ============
  
  /**
   * Get all broadcasts with optional filtering
   * @param {Object} params - Query parameters
   */
  getBroadcasts: (params = {}) => api.get('/broadcasts', { params, timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Get single broadcast by ID
   * @param {string} id - Broadcast ID
   */
  getBroadcast: (id) => api.get(`/broadcasts/${id}`, { timeout: LONG_TIMEOUT_MS }),

  getBroadcastReliabilitySummary: (params = {}) =>
    api.get('/broadcasts/analytics/reliability', { params, timeout: LONG_TIMEOUT_MS }),

  retryFailedBroadcastRecipients: (id) => api.post(`/broadcasts/${id}/retry-failed`, undefined, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Create new broadcast campaign
   * @param {Object} data - Broadcast data
   */
  createBroadcast: (data) => api.post('/broadcasts', data, { timeout: LONG_TIMEOUT_MS }),
  
  /**
   * Send broadcast campaign
   * @param {string} id - Broadcast ID
   */
  sendBroadcast: (id) => api.post(`/broadcasts/${id}/send`, undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Cancel scheduled broadcast campaign
   * @param {string} id - Broadcast ID
   */
  cancelBroadcast: (id) => api.post(`/broadcasts/${id}/cancel`, undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Pause scheduled broadcast campaign
   * @param {string} id - Broadcast ID
   */
  pauseBroadcast: (id) => api.post(`/broadcasts/${id}/pause`, undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Resume paused broadcast campaign
   * @param {string} id - Broadcast ID
   */
  resumeBroadcast: (id) => api.post(`/broadcasts/${id}/resume`, undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Check scheduled broadcasts
   */
  checkScheduledBroadcasts: () => api.post('/broadcasts/check-scheduled', undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Sync broadcast stats from team inbox messages
   */
  syncBroadcastStats: (id) => api.post(`/broadcasts/${id}/sync-stats`, undefined, { timeout: LONG_TIMEOUT_MS }),

  /**
   * Delete broadcast campaign
   * @param {string} id - Broadcast ID
   */
  deleteBroadcast: (id) => api.delete(`/broadcasts/${id}`, { timeout: LONG_TIMEOUT_MS }),

  // ============ ANALYTICS ============
  
  /**
   * Get platform analytics
   * @param {Object} params - Query parameters
   */
  getAnalytics: (params = {}) => api.get('/analytics', { params, timeout: LONG_TIMEOUT_MS }),

  // ============ HEALTH & SYSTEM ============
  
  /**
   * Check API health status
   */
  healthCheck: () => api.get('/version'),

  // ============ UTILITY METHODS ============
  
  /**
   * Set authentication token
   * @param {string} token - Authentication token
   */
  setAuthToken: (token) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  
  /**
   * Remove authentication token
   */
  removeAuthToken: () => {
    delete api.defaults.headers.common['Authorization'];
  },
  
  /**
   * Set default headers
   * @param {Object} headers - Headers to set
   */
  setHeaders: (headers) => {
    Object.assign(api.defaults.headers, headers);
  }
};

// Legacy export for backward compatibility
export const apiService = {
  getConversations: apiClient.getConversations,
  getConversation: apiClient.getConversation,
  createConversation: apiClient.createConversation,
  updateConversation: apiClient.updateConversation,
  markConversationAsRead: apiClient.markConversationAsRead,
  getMessages: apiClient.getMessages,
  sendMessage: apiClient.sendMessage,
  getContacts: apiClient.getContacts,
  lookupContactsByPhones: apiClient.lookupContactsByPhones,
  createContact: apiClient.createContact,
  importContacts: apiClient.importContacts,
  updateContact: apiClient.updateContact,
  deleteContact: apiClient.deleteContact,
  getMissedCalls: apiClient.getMissedCalls,
  resolveMissedCall: apiClient.resolveMissedCall,
  runMissedCallNow: apiClient.runMissedCallNow,
  getMissedCallSettings: apiClient.getMissedCallSettings,
  updateMissedCallSettings: apiClient.updateMissedCallSettings,
  getTemplates: apiClient.getTemplates,
  getTemplate: apiClient.getTemplate,
  createTemplate: apiClient.createTemplate,
  updateTemplate: apiClient.updateTemplate,
  deleteTemplate: apiClient.deleteTemplate,
  syncTemplates: apiClient.syncTemplates,
  getAudienceSegments: apiClient.getAudienceSegments,
  createAudienceSegment: apiClient.createAudienceSegment,
  deleteAudienceSegment: apiClient.deleteAudienceSegment,
  uploadCSV: apiClient.uploadCSV,
  getCsvImportJob: apiClient.getCsvImportJob,
  sendBulkMessages: apiClient.sendBulkMessages,
  getConversationContacts: apiClient.getConversationContacts,
  getBroadcasts: apiClient.getBroadcasts,
  getBroadcast: apiClient.getBroadcast,
  createBroadcast: apiClient.createBroadcast,
  sendBroadcast: apiClient.sendBroadcast,
  cancelBroadcast: apiClient.cancelBroadcast,
  pauseBroadcast: apiClient.pauseBroadcast,
  resumeBroadcast: apiClient.resumeBroadcast,
  checkScheduledBroadcasts: apiClient.checkScheduledBroadcasts,
  syncBroadcastStats: apiClient.syncBroadcastStats,
  deleteBroadcast: apiClient.deleteBroadcast,
  getAnalytics: apiClient.getAnalytics,
  checkBackendHealth: apiClient.healthCheck,
};

// Export the axios instance for advanced usage
export { api };

// Export default API object
export default apiClient;

