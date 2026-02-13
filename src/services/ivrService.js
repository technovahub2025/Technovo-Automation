import apiService from './api';

export const ivrService = {
  /**
   * Get all IVR prompts
   */
  async getPrompts() {
    try {
      const response = await apiService.get('/ivr/prompts');
      return response.data;
    } catch (error) {
      console.error('Failed to get prompts:', error);
      throw error;
    }
  },

  /**
   * Get specific prompt by key
   */
  async getPrompt(promptKey) {
    try {
      const response = await apiService.get(`/ivr/prompts/${promptKey}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get prompt:', error);
      throw error;
    }
  },

  /**
   * Generate audio for a specific prompt and language
   */
  async generateAudio(promptKey, text, language, forceRegenerate = false) {
    try {
      const response = await apiService.post('/ivr/generate-audio', {
        promptKey,
        text,
        language,
        forceRegenerate
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate audio:', error);
      throw error;
    }
  },

  /**
   * Generate audio for all supported languages
   */
  async generateAllLanguages(promptKey, text, forceRegenerate = false) {
    try {
      const response = await apiService.post('/ivr/generate-all-languages', {
        promptKey,
        text,
        forceRegenerate
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate audio for all languages:', error);
      throw error;
    }
  },

  /**
   * Delete audio for specific prompt and language
   */
  async deleteAudio(promptKey, language) {
    try {
      const response = await apiService.delete(`/ivr/audio/${promptKey}/${language}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete audio:', error);
      throw error;
    }
  },

  /**
   * Get supported languages
   */
  async getLanguages() {
    try {
      const response = await apiService.get('/ivr/languages');
      return response.data;
    } catch (error) {
      console.error('Failed to get languages:', error);
      throw error;
    }
  },

  /**
   * Create a new menu-type IVR prompt
   */
  async createMenuPrompt(promptData) {
    try {
      const response = await apiService.post('/ivr/create-menu-prompt', promptData);
      return response.data;
    } catch (error) {
      console.error('Failed to create menu prompt:', error);
      throw error;
    }
  },

  /**
   * Update existing prompt
   */
  async updatePrompt(promptKey, updateData) {
    try {
      const response = await apiService.put(`/ivr/prompts/${promptKey}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Failed to update prompt:', error);
      throw error;
    }
  },

  /**
   * Get IVR usage statistics
   */
  async getStats() {
    try {
      const response = await apiService.get('/ivr/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  },

  /**
   * Batch generate audio for multiple prompts
   */
  async batchGenerate(prompts, forceRegenerate = false) {
    try {
      const response = await apiService.post('/ivr/batch-generate', {
        prompts,
        forceRegenerate
      });
      return response.data;
    } catch (error) {
      console.error('Failed to batch generate:', error);
      throw error;
    }
  },

  /**
   * Test IVR flow (simulate call)
   */
  async testIVRFlow(promptKey, language = 'en-GB') {
    try {
      const response = await apiService.post(`/ivr/menus/${promptKey}/test`, { language });
      return response.data;
    } catch (error) {
      console.error('Failed to test IVR flow:', error);
      throw error;
    }
  },

  /**
   * Get call logs for IVR
   */
  async getCallLogs(filters = {}) {
    console.log('[Frontend] Helper getCallLogs filters:', filters);
    try {
      const response = await apiService.get('/call-logs', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to get call logs:', error);
      throw error;
    }
  },

  /**
   * Export IVR configuration
   */
  async exportConfiguration() {
    try {
      const response = await apiService.get('/ivr/export', {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw error;
    }
  },

  /**
   * Update workflow status (active/inactive)
   */
  async updateWorkflowStatus(workflowId, status) {
    try {
      const response = await apiService.put(`/workflow/${workflowId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Failed to update workflow status:', error);
      throw error;
    }
  },

  /**
   * Get workflow by ID with nodes and edges
   */
  async getWorkflow(workflowId) {
    try {
      const response = await apiService.get(`/workflow/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get workflow:', error);
      throw error;
    }
  },

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId) {
    try {
      const response = await apiService.get(`/workflow/${workflowId}/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      throw error;
    }
  },

  /**
   * Import IVR configuration
   */
  async importConfiguration(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.post('/ivr/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  },

  /**
   * Generate IVR audio for workflow nodes
   */
  async generateIVRAudio(workflowId, forceRegenerate = false) {
    try {
      const response = await apiService.post('/workflow/generate-audio', {
        workflowId,
        forceRegenerate
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate IVR audio:', error);
      throw error;
    }
  }
};

export default ivrService;

// Export ivrAudioService as alias for ivrService
export const ivrAudioService = ivrService;
