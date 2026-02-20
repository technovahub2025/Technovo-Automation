// WhatsApp API Service
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const getAuthHeaders = (includeJson = true) => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};



export const whatsappService = {

  // Health check

  async healthCheck() {

    try {

      const response = await axios.get(`${API_BASE_URL}/health`, {
        headers: getAuthHeaders(false)
      });
      return response.data;

    } catch (error) {
      console.error('Health check failed:', error);

      return { status: 'unhealthy' };

    }

  },



  // ============ MESSAGING ENDPOINTS ============

  

  // Send text message

  async sendMessage(to, text, conversationId) {

    try {

      const response = await axios.post(
        `${API_BASE_URL}/api/messages/send`,
        { to, text, conversationId },
        { headers: getAuthHeaders() }
      );
      return response.data;

    } catch (error) {

      console.error('Failed to send message:', error);

      return { success: false, error: error.message };

    }

  },



  // Send media message

  async sendMediaMessage(to, mediaType, mediaUrl, text, conversationId) {

    try {

      const response = await axios.post(
        `${API_BASE_URL}/api/messages/send`,
        { to, mediaType, mediaUrl, text, conversationId },
        { headers: getAuthHeaders() }
      );
      return response.data;

    } catch (error) {

      console.error('Failed to send media message:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ CONVERSATION ENDPOINTS ============

  

  // Get all conversations

  async getConversations(filters = {}) {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        headers: getAuthHeaders(false),
        params: filters
      });
      const data = response.data;
      const result = data?.data || data;
      return Array.isArray(result) ? result : [];

    } catch (error) {

      console.error('Failed to fetch conversations:', error);

      return [];

    }

  },



  // Get single conversation

  async getConversation(conversationId) {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;

    } catch (error) {

      console.error('Failed to fetch conversation:', error);

      return null;

    }

  },



  // Create new conversation

  async createConversation(conversationData) {

    try {

      const response = await axios.post(`${API_BASE_URL}/api/conversations`, conversationData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to create conversation:', error);

      return { success: false, error: error.message };

    }

  },



  // Update conversation

  async updateConversation(conversationId, updateData) {

    try {

      const response = await axios.put(`${API_BASE_URL}/api/conversations/${conversationId}`, updateData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to update conversation:', error);

      return { success: false, error: error.message };

    }

  },



  // Mark conversation as read

  async markConversationAsRead(conversationId) {

    try {

      const response = await axios.put(
        `${API_BASE_URL}/api/conversations/${conversationId}/read`,
        {},
        { headers: getAuthHeaders(false) }
      );
      return response.data;

    } catch (error) {

      console.error('Failed to mark conversation as read:', error);

      return { success: false, error: error.message };

    }

  },
  // Delete single conversation
  async deleteConversation(conversationId) {

    try {

      const response = await axios.delete(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;

    } catch (error) {

      console.error('Failed to delete conversation:', error);

      return { success: false, error: error.message };

    }

  },

  // Delete selected conversations
  async deleteSelectedConversations(conversationIds = []) {

    try {

      const response = await axios.delete(`${API_BASE_URL}/api/conversations/delete-selected`, {
        headers: getAuthHeaders(),
        data: { conversationIds }
      });
      return response.data;

    } catch (error) {

      console.error('Failed to delete selected conversations:', error);

      return { success: false, error: error.message };

    }

  },

  // Get messages for conversation

  async getMessages(conversationId) {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        headers: getAuthHeaders(false)
      });
      const data = response.data;
      const result = data?.data || data;
      return Array.isArray(result) ? result : [];

    } catch (error) {

      console.error('Failed to fetch messages:', error);

      return [];

    }

  },
  // Delete selected messages
  async deleteSelectedMessages(messageIds = []) {

    try {

      const response = await axios.delete(`${API_BASE_URL}/api/messages/delete-selected`, {
        headers: getAuthHeaders(),
        data: { messageIds }
      });
      return response.data;

    } catch (error) {

      console.error('Failed to delete selected messages:', error);

      return { success: false, error: error.message };

    }

  },

  // ============ CONTACT ENDPOINTS ============

  

  // Get all contacts

  async getContacts(filters = {}) {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/contacts`, {
        headers: getAuthHeaders(false),
        params: filters
      });
      const data = response.data;
      const result = data?.data || data;
      return Array.isArray(result) ? result : [];

    } catch (error) {

      console.error('Failed to fetch contacts:', error);

      return [];

    }

  },



  // Create new contact

  async createContact(contactData) {

    try {

      const response = await axios.post(`${API_BASE_URL}/api/contacts`, contactData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to create contact:', error);

      return { success: false, error: error.message };

    }

  },



  // Update contact

  async updateContact(contactId, updateData) {

    try {

      const response = await axios.put(`${API_BASE_URL}/api/contacts/${contactId}`, updateData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to update contact:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ BULK MESSAGING ENDPOINTS ============

  

  // Upload and process CSV for bulk messaging

  async uploadCSV(file) {

    try {

      const formData = new FormData();

      formData.append('csv_file', file);



      const response = await axios.post(`${API_BASE_URL}/api/bulk/upload`, formData, {
        headers: getAuthHeaders(false)
      });
      return response.data;

    } catch (error) {

      console.error('Failed to upload CSV:', error);

      return { success: false, error: error.message };

    }

  },



  // Send bulk messages

  async sendBulkMessages(bulkData) {

    try {

      const response = await axios.post(`${API_BASE_URL}/api/bulk/send`, bulkData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to send bulk messages:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ TEMPLATE ENDPOINTS ============

  

  // Get all templates from Meta WhatsApp Business API
  async getTemplates() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/templates/meta`, {
        headers: getAuthHeaders(false)
      });
      const data = response.data;
      
      // Return the templates array from Meta API response
      return data.data || data || [];
    } catch (error) {
      console.error('Failed to fetch templates from Meta:', error);
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch templates";
      throw new Error(backendMessage);
    }
  },



  // Sync templates from Meta WhatsApp Business API
  async syncTemplates() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/templates/meta/sync`,
        {},
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to sync templates from Meta:', error);
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to sync templates";
      throw new Error(backendMessage);
    }
  },

  // Create template via Meta-backed backend endpoint
  async createTemplate(templateData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/templates`, templateData, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create template:', error);
      return {
        success: false,
        error:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to create template"
      };
    }
  },



  // ============ BROADCAST ENDPOINTS ============

  

  // Get all broadcasts

  async getBroadcasts() {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/broadcasts`, {
        headers: getAuthHeaders(false)
      });
      const data = response.data;
      const result = data?.data || data;
      return Array.isArray(result) ? result : [];

    } catch (error) {

      console.error('Failed to fetch broadcasts:', error);

      return [];

    }

  },



  // Create broadcast campaign

  async createBroadcast(broadcastData) {

    try {

      const response = await axios.post(`${API_BASE_URL}/api/broadcasts`, broadcastData, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to create broadcast:', error);

      return { success: false, error: error.message };

    }

  },



  // Send broadcast campaign

  async sendBroadcast(broadcastId) {

    try {

      const response = await axios.post(
        `${API_BASE_URL}/api/broadcasts/${broadcastId}/send`,
        {},
        { headers: getAuthHeaders(false) }
      );
      return response.data;

    } catch (error) {

      console.error('Failed to send broadcast:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ ANALYTICS ENDPOINTS ============

  

  // Get analytics data

  async getAnalytics() {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/analytics`, {
        headers: getAuthHeaders(false)
      });
      const data = response.data;

      return data.data || data || {};

    } catch (error) {

      console.error('Failed to fetch analytics:', error);

      return {};

    }

  },



  // ============ LEGACY METHODS FOR BACKWARD COMPATIBILITY ============

  

  // Legacy template save method

  async saveTemplate(name, message, type = 'custom') {

    try {

      const payload = {
        name,
        content: { body: message },
        type
      };
      const response = await axios.post(`${API_BASE_URL}/api/templates`, payload, {
        headers: getAuthHeaders()
      });
      return response.data;

    } catch (error) {

      console.error('Failed to save template:', error);

      return { success: false, error: error.message };

    }

  },



  // Legacy template delete method

  async deleteTemplate(templateId) {

    try {

      const response = await axios.delete(`${API_BASE_URL}/api/templates/${templateId}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;

    } catch (error) {

      console.error('Failed to delete template:', error);

      return { success: false, error: error.message };

    }

  },

  async deleteTemplateFromMeta(templateName) {
    try {
      const encodedName = encodeURIComponent(String(templateName || '').trim());
      const response = await axios.delete(`${API_BASE_URL}/api/templates/meta/${encodedName}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;
    } catch (error) {
      console.error('Failed to delete template from Meta:', error);
      return {
        success: false,
        error:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to delete template"
      };
    }
  }

};


