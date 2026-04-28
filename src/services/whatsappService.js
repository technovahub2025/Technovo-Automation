// WhatsApp API Service
import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import { registerUnauthorizedAxiosInterceptor } from "./serviceAuth";
import { isNotFoundError, runFallbackSequence } from "./messageFallback.js";

const API_BASE_URL = resolveApiBaseUrl();
registerUnauthorizedAxiosInterceptor(axios);
const TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS = 15000;
const WHATSAPP_DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_WHATSAPP_REQUEST_TIMEOUT_MS || 12000);
const LEAD_SCORING_DEFAULTS = {
  isEnabled: true,
  readScore: 2,
  replyScore: 5,
  keywordRules: [],
  automation: {
    isEnabled: false,
    stageThreshold: 45,
    stageOnThreshold: 'qualified',
    taskThreshold: 60,
    taskTitle: 'High intent lead follow-up',
    recommendedTemplate: '',
    ownerNotification: true
  }
};
let leadScoringEndpointState = 'unknown'; // unknown | available | missing

const getAuthHeaders = (includeJson = true) => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const normalizeServiceErrorMessage = (errorValue, fallback = 'Request failed') => {
  if (!errorValue) return fallback;
  if (typeof errorValue === 'string') return errorValue;
  try {
    return JSON.stringify(errorValue);
  } catch {
    return fallback;
  }
};

const extractBlobErrorMessage = async (errorValue) => {
  if (!(errorValue instanceof Blob)) return null;

  try {
    const rawText = await errorValue.text();
    const trimmedText = String(rawText || '').trim();
    if (!trimmedText) return null;

    try {
      const parsed = JSON.parse(trimmedText);
      return parsed?.error || parsed?.message || trimmedText;
    } catch {
      return trimmedText;
    }
  } catch {
    return null;
  }
};

const resolveLeadScoringEndpointState = async ({ force = false } = {}) => {
  if (!force && leadScoringEndpointState !== 'unknown') return leadScoringEndpointState;

  try {
    const versionResponse = await axios.get(`${API_BASE_URL}/api/version`, {
      headers: getAuthHeaders(false)
    });
    const features = versionResponse?.data?.features;
    if (Array.isArray(features)) {
      leadScoringEndpointState = features.includes('lead-scoring') ? 'available' : 'missing';
    }
  } catch {
    // If version probing fails, keep unknown and allow one direct attempt.
  }

  return leadScoringEndpointState;
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

  async sendMessage(to, text, conversationId, options = {}) {

    try {
      const payload = {
        to,
        text,
        conversationId
      };
      const replyToMessageId = String(options?.replyToMessageId || '').trim();
      const whatsappContextMessageId = String(options?.whatsappContextMessageId || '').trim();
      if (replyToMessageId) {
        payload.replyToMessageId = replyToMessageId;
      }
      if (whatsappContextMessageId) {
        payload.whatsappContextMessageId = whatsappContextMessageId;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/messages/send`,
        payload,
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

  async sendTemplateMessage(
    to,
    templateName,
    language = 'en_US',
    variables = [],
    conversationId,
    components = [],
    options = {}
  ) {
    try {
      const normalizedConversationId = String(conversationId || '').trim();
      const normalizedOptions =
        options && typeof options === 'object' && !Array.isArray(options) ? options : {};
      const payload = {
        to,
        templateName,
        language,
        variables,
        ...(normalizedConversationId ? { conversationId: normalizedConversationId } : {}),
        ...(Array.isArray(components) && components.length > 0 ? { components } : {}),
        ...(String(normalizedOptions.contactId || '').trim()
          ? { contactId: String(normalizedOptions.contactId || '').trim() }
          : {}),
        ...(String(normalizedOptions.contactName || '').trim()
          ? { contactName: String(normalizedOptions.contactName || '').trim() }
          : {})
        ,
        ...(String(normalizedOptions.templateCategory || '').trim()
          ? { templateCategory: String(normalizedOptions.templateCategory || '').trim() }
          : {})
      };
      const response = await axios.post(
        `${API_BASE_URL}/api/messages/send-template`,
        payload,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to send template message:', error);
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send template message';
      return {
        success: false,
        error: normalizeServiceErrorMessage(backendError, 'Failed to send template message')
      };
    }
  },

  async sendAttachmentMessage(to, conversationId, file, caption = '', onProgress, options = {}) {
    try {
      const formData = new FormData();
      formData.append('to', String(to || '').trim());
      formData.append('conversationId', String(conversationId || '').trim());
      if (caption) {
        formData.append('caption', String(caption || '').trim());
      }
      const replyToMessageId = String(options?.replyToMessageId || '').trim();
      const whatsappContextMessageId = String(options?.whatsappContextMessageId || '').trim();
      if (replyToMessageId) {
        formData.append('replyToMessageId', replyToMessageId);
      }
      if (whatsappContextMessageId) {
        formData.append('whatsappContextMessageId', whatsappContextMessageId);
      }
      formData.append('file', file);

      const response = await axios.post(
        `${API_BASE_URL}/api/messages/send-attachment`,
        formData,
        {
          headers: getAuthHeaders(false),
          onUploadProgress: (event) => {
            if (typeof onProgress !== 'function') return;
            const total = Number(event?.total || 0);
            const loaded = Number(event?.loaded || 0);
            if (!total || !Number.isFinite(total)) return;
            const progress = Math.min(1, Math.max(0, loaded / total));
            onProgress(progress);
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to send attachment message:', error);
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send attachment message';
      return {
        success: false,
        error: normalizeServiceErrorMessage(backendError, 'Failed to send attachment message')
      };
    }
  },

  async sendReactionMessage(
    to,
    conversationId,
    targetMessageId,
    targetWhatsAppMessageId,
    emoji = ''
  ) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/messages/react`,
        {
          to,
          conversationId,
          targetMessageId,
          targetWhatsAppMessageId,
          emoji
        },
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to send reaction message:', error);
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to send reaction';
      return {
        success: false,
        error: normalizeServiceErrorMessage(backendError, 'Failed to send reaction')
      };
    }
  },

  async listAttachmentMessages(params = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/messages/attachments`, {
        headers: getAuthHeaders(false),
        params
      });
      return response.data;
    } catch (error) {
      console.error('Failed to list attachment messages:', error);
      return {
        success: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to list attachments'
        )
      };
    }
  },

  async getAttachmentSignedUrl(messageId, mode = 'view', ttl = 300) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/messages/attachments/${messageId}/url`, {
        headers: getAuthHeaders(false),
        params: {
          mode,
          ttl
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch attachment signed URL:', error);
      return {
        success: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to load attachment URL'
        )
      };
    }
  },

  async downloadAttachmentFile(messageId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/messages/attachments/${messageId}/download`, {
        headers: getAuthHeaders(false),
        responseType: 'blob'
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to download attachment file:', error);
      const blobErrorMessage = await extractBlobErrorMessage(error?.response?.data);
      return {
        success: false,
        error: normalizeServiceErrorMessage(
          blobErrorMessage || error?.response?.data?.error || error?.message,
          'Failed to download attachment'
        )
      };
    }
  },

  async deleteAttachmentMessage(messageId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/messages/attachments/${messageId}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;
    } catch (error) {
      console.error('Failed to delete attachment message:', error);
      return {
        success: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to delete attachment'
        )
      };
    }
  },



  // ============ CONVERSATION ENDPOINTS ============

  

  // Get all conversations

  async getConversations(filters = {}) {

    try {

      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        headers: getAuthHeaders(false),
        params: filters,
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
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
      if (!isNotFoundError(error)) {
        console.error('Failed to fetch messages:', error);
        return [];
      }

      try {
        const fallbackPayload = await runFallbackSequence({
          steps: [
            {
              name: "messages-conversation-compat",
              run: async () =>
                axios.get(
                  `${API_BASE_URL}/api/messages/conversation/${encodeURIComponent(String(conversationId || '').trim())}`,
                  {
                    headers: getAuthHeaders(false),
                    params: { limit: 30 }
                  }
                )
            },
            {
              name: "messages-attachments-compat",
              run: async () =>
                axios.get(`${API_BASE_URL}/api/messages/attachments`, {
                  headers: getAuthHeaders(false),
                  params: {
                    conversationId: String(conversationId || '').trim(),
                    limit: 30
                  }
                })
            }
          ],
          isRetryable: isNotFoundError,
          onStepFailure: ({ name, retryable }) => {
            if (retryable) {
              console.warn(`${name} failed, trying next compatibility fallback.`);
            }
          }
        });
        const data = fallbackPayload?.data;
        if (Array.isArray(data)) return data;
        return Array.isArray(data?.data) ? data.data : [];
      } catch {
        console.warn('All compatibility fallbacks failed while fetching messages.');
        return [];
      }
    }

  },

  async getMessagesPage(conversationId, options = {}) {
    const normalizedConversationId = String(conversationId || '').trim();
    if (!normalizedConversationId) {
      return {
        data: [],
        meta: {
          limit: 0,
          hasMore: false,
          nextCursor: null
        }
      };
    }

    const parsedLimit = Number(options?.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 80)) : 30;
    const cursor = String(options?.cursor || '').trim();

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/conversations/${normalizedConversationId}/messages`,
        {
          headers: getAuthHeaders(false),
          timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS,
          params: {
            limit,
            ...(cursor ? { cursor } : {})
          }
        }
      );

      const payload = response.data;
      if (Array.isArray(payload)) {
        return {
          data: payload,
          meta: {
            limit,
            hasMore: false,
            nextCursor: null
          }
        };
      }

      return {
        data: Array.isArray(payload?.data) ? payload.data : [],
        meta: {
          limit: Number(payload?.meta?.limit || limit) || limit,
          hasMore: Boolean(payload?.meta?.hasMore),
          nextCursor: String(payload?.meta?.nextCursor || '').trim() || null
        }
      };
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error('Failed to fetch paged messages:', error);
        return {
          data: [],
          meta: {
            limit,
            hasMore: false,
            nextCursor: null
          }
        };
      }

      try {
        const fallbackResponse = await runFallbackSequence({
          steps: [
            {
              name: "paged-messages-conversation-compat",
              run: async () =>
                axios.get(
                  `${API_BASE_URL}/api/messages/conversation/${encodeURIComponent(normalizedConversationId)}`,
                  {
                    headers: getAuthHeaders(false),
                    timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS,
                    params: {
                      limit,
                      ...(cursor ? { cursor } : {})
                    }
                  }
                )
            },
            {
              name: "paged-messages-attachments-compat",
              run: async () =>
                axios.get(`${API_BASE_URL}/api/messages/attachments`, {
                  headers: getAuthHeaders(false),
                  timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS,
                  params: {
                    conversationId: normalizedConversationId,
                    limit,
                    ...(cursor ? { cursor } : {})
                  }
                })
            }
          ],
          isRetryable: isNotFoundError,
          onStepFailure: ({ name, retryable }) => {
            if (retryable) {
              console.warn(`${name} failed, trying next compatibility fallback.`);
            }
          }
        });
        const fallbackPayload = fallbackResponse?.data;
        if (Array.isArray(fallbackPayload)) {
          return {
            data: fallbackPayload,
            meta: {
              limit,
              hasMore: false,
              nextCursor: null
            }
          };
        }
        return {
          data: Array.isArray(fallbackPayload?.data) ? fallbackPayload.data : [],
          meta: {
            limit: Number(fallbackPayload?.meta?.limit || limit) || limit,
            hasMore: Boolean(fallbackPayload?.meta?.hasMore),
            nextCursor: String(fallbackPayload?.meta?.nextCursor || '').trim() || null
          }
        };
      } catch {
        console.warn('All compatibility fallbacks failed while fetching paged messages.');
      }

      return {
        data: [],
        meta: {
          limit,
          hasMore: false,
          nextCursor: null
        }
      };
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
        params: filters,
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
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

  async getLeadScoringSettings() {
    try {
      await resolveLeadScoringEndpointState();
      if (leadScoringEndpointState === 'missing') {
        await resolveLeadScoringEndpointState({ force: true });
      }
      if (leadScoringEndpointState === 'missing') {
        return {
          success: true,
          data: LEAD_SCORING_DEFAULTS,
          fallback: true
        };
      }

      const response = await axios.get(`${API_BASE_URL}/api/lead-scoring/settings`, {
        headers: getAuthHeaders(false)
      });
      leadScoringEndpointState = 'available';
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        leadScoringEndpointState = 'missing';
        // Backend may be on an older build; allow UI to open with defaults.
        return {
          success: true,
          data: LEAD_SCORING_DEFAULTS,
          fallback: true
        };
      }
      console.error('Failed to fetch lead scoring settings:', error);
      return { success: false, error: error.message };
    }
  },

  async updateLeadScoringSettings(payload = {}) {
    try {
      await resolveLeadScoringEndpointState();
      if (leadScoringEndpointState === 'missing') {
        await resolveLeadScoringEndpointState({ force: true });
      }
      if (leadScoringEndpointState === 'missing') {
        return {
          success: false,
          error: 'Lead scoring endpoint not found on backend. Please restart/deploy backend with latest changes.'
        };
      }

      const response = await axios.put(
        `${API_BASE_URL}/api/lead-scoring/settings`,
        payload,
        { headers: getAuthHeaders() }
      );
      leadScoringEndpointState = 'available';
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        leadScoringEndpointState = 'missing';
        return {
          success: false,
          error: 'Lead scoring endpoint not found on backend. Please restart/deploy backend with latest changes.'
        };
      }
      console.error('Failed to update lead scoring settings:', error);
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
        headers: getAuthHeaders(false),
        timeout: WHATSAPP_DEFAULT_TIMEOUT_MS
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
        {
          headers: getAuthHeaders(),
          timeout: WHATSAPP_DEFAULT_TIMEOUT_MS
        }
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
        headers: getAuthHeaders(false),
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
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
        headers: getAuthHeaders(false),
        timeout: WHATSAPP_DEFAULT_TIMEOUT_MS
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


