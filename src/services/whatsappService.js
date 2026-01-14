// WhatsApp API Service
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


export const whatsappService = {
  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'unhealthy' };
    }
  },

  // Get all templates
  async getTemplates() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return { success: false, templates: {} };
    }
  },

  // Save template
  async saveTemplate(name, message) {
    try {
      const formData = new FormData();
      formData.append('template_name', name);
      formData.append('template_message', message);

      const response = await fetch(`${API_BASE_URL}/save_template`, {
        method: 'POST',
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to save template:', error);
      return { success: false, message: 'Network error' };
    }
  },

  // Delete template
  async deleteTemplate(name) {
    try {
      const formData = new FormData();
      formData.append('template_name', name);

      const response = await fetch(`${API_BASE_URL}/delete_template`, {
        method: 'POST',
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to delete template:', error);
      return { success: false, message: 'Network error' };
    }
  },

  // Upload and process CSV
  async uploadCSV(file) {
    try {
      const formData = new FormData();
      formData.append('csv_file', file);

      const response = await fetch(`${API_BASE_URL}/api/upload-csv`, {
        method: 'POST',
        body: formData
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to upload CSV:', error);
      return { success: false, message: 'Network error' };
    }
  },

  // Send bulk messages
  async sendBulkMessages(messageType, config, recipients) {
    try {
      const payload = {
        message_type: messageType,
        recipients: recipients,
        ...(messageType === 'template' 
          ? { template_name: config.templateName, language: config.language }
          : { custom_message: config.customMessage }
        )
      };

      const response = await fetch(`${API_BASE_URL}/api/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send bulk messages:', error);
      return { success: false, message: 'Network error' };
    }
  }
};
