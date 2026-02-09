// WhatsApp API Service

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';



export const whatsappService = {

  // Health check

  async healthCheck() {

    try {

      const response = await fetch(`${API_BASE_URL}/health`);

      return await response.json();

    } catch (error) {

      // WhatsApp Business Platform Service - Enhanced API Integration

      // This service now uses the comprehensive API service for all backend operations

      const api = require('./api');



      // Export the enhanced API service methods for backward compatibility

      module.exports = api;

      console.error('Health check failed:', error);

      return { status: 'unhealthy' };

    }

  },



  // ============ MESSAGING ENDPOINTS ============

  

  // Send text message

  async sendMessage(to, text, conversationId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/messages/send`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({ to, text, conversationId })

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to send message:', error);

      return { success: false, error: error.message };

    }

  },



  // Send media message

  async sendMediaMessage(to, mediaType, mediaUrl, text, conversationId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/messages/send`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({ to, mediaType, mediaUrl, text, conversationId })

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to send media message:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ CONVERSATION ENDPOINTS ============

  

  // Get all conversations

  async getConversations(filters = {}) {

    try {

      const queryParams = new URLSearchParams(filters).toString();

      const response = await fetch(`${API_BASE_URL}/api/conversations${queryParams ? '?' + queryParams : ''}`);

      const data = await response.json();

      return data.data || data || [];

    } catch (error) {

      console.error('Failed to fetch conversations:', error);

      return [];

    }

  },



  // Get single conversation

  async getConversation(conversationId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);

      return await response.json();

    } catch (error) {

      console.error('Failed to fetch conversation:', error);

      return null;

    }

  },



  // Create new conversation

  async createConversation(conversationData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/conversations`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(conversationData)

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to create conversation:', error);

      return { success: false, error: error.message };

    }

  },



  // Update conversation

  async updateConversation(conversationId, updateData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {

        method: 'PUT',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(updateData)

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to update conversation:', error);

      return { success: false, error: error.message };

    }

  },



  // Mark conversation as read

  async markConversationAsRead(conversationId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/read`, {

        method: 'PUT'

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to mark conversation as read:', error);

      return { success: false, error: error.message };

    }

  },



  // Get messages for conversation

  async getMessages(conversationId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`);

      const data = await response.json();

      return data.data || data || [];

    } catch (error) {

      console.error('Failed to fetch messages:', error);

      return [];

    }

  },



  // ============ CONTACT ENDPOINTS ============

  

  // Get all contacts

  async getContacts(filters = {}) {

    try {

      const queryParams = new URLSearchParams(filters).toString();

      const response = await fetch(`${API_BASE_URL}/api/contacts${queryParams ? '?' + queryParams : ''}`);

      const data = await response.json();

      return data.data || data || [];

    } catch (error) {

      console.error('Failed to fetch contacts:', error);

      return [];

    }

  },



  // Create new contact

  async createContact(contactData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/contacts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(contactData)

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to create contact:', error);

      return { success: false, error: error.message };

    }

  },



  // Update contact

  async updateContact(contactId, updateData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {

        method: 'PUT',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(updateData)

      });

      return await response.json();

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



      const response = await fetch(`${API_BASE_URL}/api/bulk/upload`, {

        method: 'POST',

        body: formData

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to upload CSV:', error);

      return { success: false, error: error.message };

    }

  },



  // Send bulk messages

  async sendBulkMessages(bulkData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/bulk/send`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(bulkData)

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to send bulk messages:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ TEMPLATE ENDPOINTS ============

  

  // Get all templates from Meta WhatsApp Business API
  async getTemplates() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/meta`);
      const data = await response.json();
      
      // Return the templates array from Meta API response
      return data.data || data || [];
    } catch (error) {
      console.error('Failed to fetch templates from Meta:', error);
      return [];
    }
  },



  // Sync templates from Meta WhatsApp Business API
  async syncTemplates() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/meta/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to sync templates from Meta:', error);
      return { success: false, error: error.message };
    }
  },



  // ============ BROADCAST ENDPOINTS ============

  

  // Get all broadcasts

  async getBroadcasts() {

    try {

      const response = await fetch(`${API_BASE_URL}/api/broadcasts`);

      const data = await response.json();

      return data.data || data || [];

    } catch (error) {

      console.error('Failed to fetch broadcasts:', error);

      return [];

    }

  },



  // Create broadcast campaign

  async createBroadcast(broadcastData) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/broadcasts`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(broadcastData)

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to create broadcast:', error);

      return { success: false, error: error.message };

    }

  },



  // Send broadcast campaign

  async sendBroadcast(broadcastId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/broadcasts/${broadcastId}/send`, {

        method: 'POST'

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to send broadcast:', error);

      return { success: false, error: error.message };

    }

  },



  // ============ ANALYTICS ENDPOINTS ============

  

  // Get analytics data

  async getAnalytics() {

    try {

      const response = await fetch(`${API_BASE_URL}/api/analytics`);

      const data = await response.json();

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

      const response = await fetch(`${API_BASE_URL}/api/templates`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({ 

          name, 

          content: {

            body: message

          },

          type

        })

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to save template:', error);

      return { success: false, error: error.message };

    }

  },



  // Legacy template delete method

  async deleteTemplate(templateId) {

    try {

      const response = await fetch(`${API_BASE_URL}/api/templates/${templateId}`, {

        method: 'DELETE'

      });

      return await response.json();

    } catch (error) {

      console.error('Failed to delete template:', error);

      return { success: false, error: error.message };

    }

  }

};

