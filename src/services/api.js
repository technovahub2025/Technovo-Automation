/**
 * Comprehensive API Service - WhatsApp Business Platform
 * Provides complete integration with all backend endpoints
 */
import axios from "axios";

const VITE_API_URL_ROUTE = '/api/message/bulknode'


const API_BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for authentication and logging
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
apiClient.interceptors.response.use(
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

// WhatsApp Business Platform API Methods
export const api = {
  // ============ CONVERSATIONS ============
  
  /**
   * Get all conversations with optional filtering
   * @param {Object} params - Query parameters (status, assignedTo, search)
   */
  getConversations: (params = {}) => apiClient.get('/conversations', { params }),
  
  /**
   * Get single conversation by ID
   * @param {string} id - Conversation ID
   */
  getConversation: (id) => apiClient.get(`/conversations/${id}`),
  
  /**
   * Create new conversation
   * @param {Object} data - Conversation data
   */
  createConversation: (data) => apiClient.post('/conversations', data),
  
  /**
   * Update conversation
   * @param {string} id - Conversation ID
   * @param {Object} data - Update data
   */
  updateConversation: (id, data) => apiClient.put(`/conversations/${id}`, data),
  
  /**
   * Mark conversation as read
   * @param {string} id - Conversation ID
   */
  markConversationAsRead: (id) => apiClient.put(`/conversations/${id}/read`),
  
  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   */
  getMessages: (conversationId) => apiClient.get(`/conversations/${conversationId}/messages`),
  
  /**
   * Send message
   * @param {Object} data - Message data (to, text, conversationId, mediaUrl, mediaType)
   */
  sendMessage: (data) => apiClient.post('/messages/send', data),

  // ============ CONTACTS ============
  
  /**
   * Get all contacts with optional filtering
   * @param {Object} params - Query parameters (search, tags)
   */
  getContacts: (params = {}) => apiClient.get('/contacts', { params }),
  
  /**
   * Create new contact
   * @param {Object} data - Contact data
   */
  createContact: (data) => apiClient.post('/contacts', data),
  
  /**
   * Update contact
   * @param {string} id - Contact ID
   * @param {Object} data - Update data
   */
  updateContact: (id, data) => apiClient.put(`/conversations/contacts/${id}`, data),
  
  /**
   * Delete contact
   * @param {string} id - Contact ID
   */
  deleteContact: (id) => apiClient.delete(`/conversations/contacts/${id}`),

  // ============ TEMPLATES ============
  
  /**
   * Get all templates with optional filtering
   * @param {Object} params - Query parameters (status, category, language)
   */
  getTemplates: (params = {}) => apiClient.get('/templates', { params }),
  
  /**
   * Get single template by ID
   * @param {string} id - Template ID
   */
  getTemplate: (id) => apiClient.get(`/templates/${id}`),
  
  /**
   * Create new template
   * @param {Object} data - Template data
   */
  createTemplate: (data) => apiClient.post('/templates', data),
  
  /**
   * Update template
   * @param {string} id - Template ID
   * @param {Object} data - Update data
   */
  updateTemplate: (id, data) => apiClient.put(`/templates/${id}`, data),
  
  /**
   * Delete template
   * @param {string} id - Template ID
   */
  deleteTemplate: (id) => apiClient.delete(`/templates/${id}`),
  
  /**
   * Sync templates from WhatsApp Business
   */
  syncTemplates: () => apiClient.post('/templates/sync'),

  // ============ BULK MESSAGING ============
  
  /**
   * Upload CSV file for bulk messaging
   * @param {Object} data - CSV data object with csvData field
   */
  uploadCSV: (data) => apiClient.post('/bulk/upload', data),
  
  /**
   * Send bulk messages
   * @param {Object} data - Bulk message data
   */
  sendBulkMessages: (data) => apiClient.post('/bulk/send', data),

  // ============ CONVERSATIONS & CONTACTS ============
  
  /**
   * Get all conversations with optional filtering
   * @param {Object} params - Query parameters
   */
  getConversations: (params = {}) => apiClient.get('/conversations', { params }),
  
  /**
   * Get all contacts with optional filtering
   * @param {Object} params - Query parameters
   */
  getContacts: (params = {}) => apiClient.get('/conversations/contacts', { params }),
  
  /**
   * Get unique contacts from conversations (for broadcast)
   * @param {Object} params - Query parameters
   */
  getConversationContacts: (params = {}) => apiClient.get('/conversations/contacts/unique', { params }),
  
  /**
   * Create a new contact
   * @param {Object} data - Contact data
   */
  createContact: (data) => apiClient.post('/conversations/contacts', data),

  // ============ BROADCASTS ============
  
  /**
   * Get all broadcasts with optional filtering
   * @param {Object} params - Query parameters
   */
  getBroadcasts: (params = {}) => apiClient.get('/broadcasts', { params }),
  
  /**
   * Get single broadcast by ID
   * @param {string} id - Broadcast ID
   */
  getBroadcast: (id) => apiClient.get(`/broadcasts/${id}`),
  
  /**
   * Create new broadcast campaign
   * @param {Object} data - Broadcast data
   */
  createBroadcast: (data) => apiClient.post('/broadcasts', data),
  
  /**
   * Send broadcast campaign
   * @param {string} id - Broadcast ID
   */
  sendBroadcast: (id) => apiClient.post(`/broadcasts/${id}/send`),

  /**
   * Check scheduled broadcasts
   */
  checkScheduledBroadcasts: () => apiClient.post('/broadcasts/check-scheduled'),

  /**
   * Sync broadcast stats from team inbox messages
   */
  syncBroadcastStats: (id) => apiClient.post(`/broadcasts/${id}/sync-stats`),

  /**
   * Delete broadcast campaign
   * @param {string} id - Broadcast ID
   */
  deleteBroadcast: (id) => apiClient.delete(`/broadcasts/${id}`),

  // ============ ANALYTICS ============
  
  /**
   * Get platform analytics
   * @param {Object} params - Query parameters
   */
  getAnalytics: (params = {}) => apiClient.get('/analytics', { params }),

  // ============ HEALTH & SYSTEM ============
  
  /**
   * Check API health status
   */
  healthCheck: () => apiClient.get('/health'),

  // ============ LEGACY VOICE API (for backward compatibility) ============
  
  getActiveCalls: () => apiClient.get("/voice/calls/active"),
  getCallDetails: (callSid) => apiClient.get(`/voice/call/${callSid}`),
  makeOutboundCall: (to, from) => apiClient.post("/voice/call/outbound", { to, from }),
  endCall: (callSid) => apiClient.post(`/voice/call/${callSid}/end`),
  getUsers: () => apiClient.get("/api/users"),
  getUserDetails: (userId) => apiClient.get(`/api/users/${userId}`),
  getCallHistory: (params) => apiClient.get("/api/calls/history", { params }),
  getCallStats: () => apiClient.get("/voice/stats"),
  checkAIHealth: () => apiClient.get("/ai/health"),

  // ============ UTILITY METHODS ============
  
  /**
   * Set authentication token
   * @param {string} token - Authentication token
   */
  setAuthToken: (token) => {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  
  /**
   * Remove authentication token
   */
  removeAuthToken: () => {
    delete apiClient.defaults.headers.common['Authorization'];
  },
  
  /**
   * Set default headers
   * @param {Object} headers - Headers to set
   */
  setHeaders: (headers) => {
    Object.assign(apiClient.defaults.headers, headers);
  }
};

// Legacy export for backward compatibility
export const apiService = {
  getActiveCalls: api.getActiveCalls,
  getCallDetails: api.getCallDetails,
  makeOutboundCall: api.makeOutboundCall,
  endCall: api.endCall,
  getUsers: api.getUsers,
  getUserDetails: api.getUserDetails,
  getCallHistory: api.getCallHistory,
  getCallStats: api.getCallStats,
  checkBackendHealth: api.healthCheck,
  checkAIHealth: api.checkAIHealth,
};

// Export the axios instance for advanced usage
export { apiClient };

// Export default API object
export default api;
