/**
 * Comprehensive API Service - WhatsApp Business Platform
 * Provides complete integration with all backend endpoints
 */
import apiService from "./api";

// Use the centralized apiService
const api = apiService;

// WhatsApp Business Platform API Methods
export const apiClient = {
  // ============ CONVERSATIONS ============

  /**
   * Get all conversations with optional filtering
   * @param {Object} params - Query parameters (status, assignedTo, search)
   */
  getConversations: (params = {}) => api.get('/conversations', { params }),

  /**
   * Get single conversation by ID
   * @param {string} id - Conversation ID
   */
  getConversation: (id) => api.get(`/conversations/${id}`),

  /**
   * Create new conversation
   * @param {Object} data - Conversation data
   */
  createConversation: (data) => api.post('/conversations', data),

  /**
   * Update conversation
   * @param {string} id - Conversation ID
   * @param {Object} data - Update data
   */
  updateConversation: (id, data) => api.put(`/conversations/${id}`, data),

  /**
   * Mark conversation as read
   * @param {string} id - Conversation ID
   */
  markConversationAsRead: (id) => api.put(`/conversations/${id}/read`),

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   */
  getMessages: (conversationId) => api.get(`/conversations/${conversationId}/messages`),

  /**
   * Send message
   * @param {Object} data - Message data (to, text, conversationId, mediaUrl, mediaType)
   */
  sendMessage: (data) => api.post('/messages/send', data),

  // ============ CONTACTS ============

  /**
   * Get all contacts with optional filtering
   * @param {Object} params - Query parameters (search, tags)
   */
  getContacts: (params = {}) => api.get('/contacts', { params }),

  /**
   * Create new contact
   * @param {Object} data - Contact data
   */
  createContact: (data) => api.post('/contacts', data),

  /**
   * Update contact
   * @param {string} id - Contact ID
   * @param {Object} data - Update data
   */
  updateContact: (id, data) => api.put(`/contacts/${id}`, data),

  /**
   * Delete contact
   * @param {string} id - Contact ID
   */
  deleteContact: (id) => api.delete(`/contacts/${id}`),

  // ============ TEMPLATES ============

  /**
   * Get all templates with optional filtering
   * @param {Object} params - Query parameters (status, category, language)
   */
  getTemplates: (params = {}) => api.get('/templates', { params }),

  /**
   * Get single template by ID
   * @param {string} id - Template ID
   */
  getTemplate: (id) => api.get(`/templates/${id}`),

  /**
   * Create new template
   * @param {Object} data - Template data
   */
  createTemplate: (data) => api.post('/templates', data),

  /**
   * Update template
   * @param {string} id - Template ID
   * @param {Object} data - Update data
   */
  updateTemplate: (id, data) => api.put(`/templates/${id}`, data),

  /**
   * Delete template
   * @param {string} id - Template ID
   */
  deleteTemplate: (id) => api.delete(`/templates/${id}`),

  /**
   * Sync templates from WhatsApp Business
   */
  syncTemplates: () => api.get('/templates/sync'),

  // ============ BULK MESSAGING ============

  /**
   * Upload CSV file for bulk messaging
   * @param {Object} data - CSV data object with csvData field
   */
  uploadCSV: (data) => api.post('/bulk/upload', data),

  /**
   * Send bulk messages
   * @param {Object} data - Bulk message data
   */
  sendBulkMessages: (data) => api.post('/bulk/send', data),

  // ============ CONVERSATIONS & CONTACTS ============

  /**
   * Get unique contacts from conversations (for broadcast)
   * This endpoint doesn't exist yet - using regular contacts instead
   * @param {Object} params - Query parameters
   */
  getConversationContacts: (params = {}) => api.get('/contacts', { params }),

  // ============ BROADCASTS ============

  /**
   * Get all broadcasts with optional filtering
   * @param {Object} params - Query parameters
   */
  getBroadcasts: (params = {}) => api.get('/broadcasts', { params }),

  /**
   * Get single broadcast by ID
   * @param {string} id - Broadcast ID
   */
  getBroadcast: (id) => api.get(`/broadcasts/${id}`),

  /**
   * Create new broadcast campaign
   * @param {Object} data - Broadcast data
   */
  createBroadcast: (data) => api.post('/broadcasts', data),

  /**
   * Send broadcast campaign
   * @param {string} id - Broadcast ID
   */
  sendBroadcast: (id) => api.post(`/broadcasts/${id}/send`),

  /**
   * Check scheduled broadcasts
   */
  checkScheduledBroadcasts: () => api.post('/broadcasts/check-scheduled'),

  /**
   * Sync broadcast stats from team inbox messages
   */
  syncBroadcastStats: (id) => api.post(`/broadcasts/${id}/sync-stats`),

  /**
   * Delete broadcast campaign
   * @param {string} id - Broadcast ID
   */
  deleteBroadcast: (id) => api.delete(`/broadcasts/${id}`),

  // ============ ANALYTICS ============

  /**
   * Get platform analytics
   * @param {Object} params - Query parameters
   */
  getAnalytics: (params = {}) => api.get('/analytics', { params }),

  // ============ HEALTH & SYSTEM ============

  /**
   * Check API health status
   */
  healthCheck: () => api.get('/health'),

  // ============ UTILITY METHODS ============

  /**
   * Set authentication token
   * @param {string} token - Authentication token
   */
  setAuthToken: (token) => {
    // Rely on localStorage and interceptor, but keep this for compat if needed
    // You could also update localStorage here
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.setItem(tokenKey, token);
  },

  /**
   * Remove authentication token
   */
  removeAuthToken: () => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.removeItem(tokenKey);
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
export const whatsappApiService = {
  getConversations: apiClient.getConversations,
  getConversation: apiClient.getConversation,
  createConversation: apiClient.createConversation,
  updateConversation: apiClient.updateConversation,
  markConversationAsRead: apiClient.markConversationAsRead,
  getMessages: apiClient.getMessages,
  sendMessage: apiClient.sendMessage,
  getContacts: apiClient.getContacts,
  createContact: apiClient.createContact,
  updateContact: apiClient.updateContact,
  deleteContact: apiClient.deleteContact,
  getTemplates: apiClient.getTemplates,
  getTemplate: apiClient.getTemplate,
  createTemplate: apiClient.createTemplate,
  updateTemplate: apiClient.updateTemplate,
  deleteTemplate: apiClient.deleteTemplate,
  syncTemplates: apiClient.syncTemplates,
  uploadCSV: apiClient.uploadCSV,
  sendBulkMessages: apiClient.sendBulkMessages,
  getConversationContacts: apiClient.getConversationContacts,
  getBroadcasts: apiClient.getBroadcasts,
  getBroadcast: apiClient.getBroadcast,
  createBroadcast: apiClient.createBroadcast,
  sendBroadcast: apiClient.sendBroadcast,
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
