// WhatsApp API Service
import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import { registerUnauthorizedAxiosInterceptor } from "./serviceAuth";
import { isNotFoundError, runFallbackSequence } from "./messageFallback.js";
import { normalizeError } from "../utils/errorUtils";

const API_BASE_URL = resolveApiBaseUrl();
registerUnauthorizedAxiosInterceptor(axios);
const TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS = 15000;
const WHATSAPP_DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_WHATSAPP_REQUEST_TIMEOUT_MS || 12000);
const LEAD_SCORING_DEFAULTS = {
  isEnabled: true,
  readScore: 2,
  replyScore: 5,
  keywordRules: [],
  whatsappOptInScope: 'marketing',
  whatsappOptInKeywordRules: [],
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
  const sessionTokenKey = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(tokenKey) : null;
  const sessionAuthToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("authToken") : null;
  const sessionLegacyToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("token") : null;
  const storedUser = (() => {
    try {
      const sessionUser = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("user") : null;
      return JSON.parse(localStorage.getItem("user") || sessionUser || "null");
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

const SERVICE_ERROR_LOG_COOLDOWN_MS = 15000;
const recentServiceErrorLogs = new Map();

const describeAxiosError = (error, fallbackMessage) => {
  const status = Number(error?.response?.status || 0) || null;
  const method = String(error?.config?.method || '').toUpperCase() || null;
  const url = String(error?.config?.url || '').trim() || null;
  const code = String(error?.code || '').trim() || null;
  const responseData = error?.response?.data;
  let responseSnippet = null;

  if (typeof responseData === 'string') {
    responseSnippet = responseData.slice(0, 300);
  } else if (responseData && typeof responseData === 'object') {
    try {
      responseSnippet = JSON.stringify(responseData).slice(0, 300);
    } catch {
      responseSnippet = null;
    }
  }

  return {
    message: normalizeServiceErrorMessage(
      responseData?.error || responseData?.message || error?.message,
      fallbackMessage
    ),
    status,
    method,
    url,
    code,
    responseSnippet
  };
};

const logAxiosServiceError = (label, error, fallbackMessage) => {
  const normalizedError = normalizeError(error, fallbackMessage);
  const details = describeAxiosError(normalizedError, fallbackMessage);
  const signature = [
    label,
    details.status || 'no-status',
    details.method || 'no-method',
    details.url || 'no-url',
    details.responseSnippet || 'no-response-snippet'
  ].join('|');
  const now = Date.now();
  const lastLoggedAt = Number(recentServiceErrorLogs.get(signature) || 0);
  if (!lastLoggedAt || now - lastLoggedAt >= SERVICE_ERROR_LOG_COOLDOWN_MS) {
    recentServiceErrorLogs.set(signature, now);
    const isTimeout =
      (Number(details.status || 0) === 0 &&
        String(details.code || '').toUpperCase() === 'ECONNABORTED') ||
      String(details.message || '').toLowerCase().includes('timeout');
    const logFn = isTimeout ? console.warn : console.error;
    logFn(
      `${label}: ${details.message}${details.status ? ` (status ${details.status})` : ''}${details.code ? ` [${details.code}]` : ''}`,
      details,
    );
  }
  return details;
};

const getTemplateMergeKey = (template = {}) => {
  const metaId = String(template?.whatsappTemplateId || template?.metaTemplateId || template?.id || '').trim();
  if (metaId) return `id:${metaId}`;
  const localId = String(template?._id || '').trim();
  if (localId) return `local:${localId}`;
  const name = String(template?.name || '').trim().toLowerCase();
  const language = String(template?.language || '').trim().toLowerCase();
  return name ? `name:${name}:${language}` : '';
};

const mergeTemplateLists = (primary = [], secondary = []) => {
  const merged = [];
  const seen = new Set();

  for (const template of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]) {
    const key = getTemplateMergeKey(template);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(template);
  }

  return merged;
};

const toBase64Url = (value = '') => {
  const normalizedValue = String(value || '');
  if (typeof btoa === 'function') {
    return btoa(normalizedValue).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(normalizedValue, 'utf8').toString('base64url');
  }
  return '';
};

const encodeConversationCursor = (conversation = {}) => {
  const lastMessageTime =
    conversation?.lastMessageTime || conversation?.updatedAt || conversation?.createdAt || null;
  const id = String(conversation?._id || conversation?.id || '').trim();
  if (!lastMessageTime || !id) return '';

  try {
    return toBase64Url(
      JSON.stringify({
        lastMessageTime: new Date(lastMessageTime).toISOString(),
        id
      })
    );
  } catch {
    return '';
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

const postWith404Retry = async (url, data, config = {}, { retryOn404 = true } = {}) => {
  try {
    return await axios.post(url, data, config);
  } catch (error) {
    const is404 = Number(error?.response?.status || 0) === 404;
    if (!retryOn404 || !is404) {
      throw normalizeError(error, 'Request failed');
    }

    // If the backend has just restarted or the route table is catching up, a short retry
    // is safer than failing the composer immediately.
    try {
      await axios.get(`${API_BASE_URL}/api/version`, {
        headers: getAuthHeaders(false)
      });
    } catch {
      // ignore version probe failures and proceed with retry
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    return axios.post(url, data, config);
  }
};

const parseCsvRecipients = async (file) => {
  if (!file || typeof file.text !== 'function') {
    throw new Error('A CSV file is required');
  }

  const text = String(await file.text() || '').trim();
  if (!text) {
    return [];
  }

  const lines = text.split(/\r?\n/).map((line) => String(line || '').trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const rows = lines[0].toLowerCase().includes('phone') ? lines.slice(1) : lines;
  return rows.map((row) => {
    const parts = String(row || '')
      .split(',')
      .map((part) => String(part || '').trim());
    return {
      phone: parts[0] || '',
      variables: parts.slice(1).filter(Boolean)
    };
  }).filter((recipient) => Boolean(recipient.phone));
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

      const response = await postWith404Retry(
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

      const response = await postWith404Retry(
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
      const mediaPipelineRequestId = String(options?.mediaPipelineRequestId || '').trim();
      const conversationLastInboundMessageAt = String(
        options?.conversationLastInboundMessageAt || ''
      ).trim();
      if (replyToMessageId) {
        formData.append('replyToMessageId', replyToMessageId);
      }
      if (whatsappContextMessageId) {
        formData.append('whatsappContextMessageId', whatsappContextMessageId);
      }
      if (mediaPipelineRequestId) {
        formData.append('mediaPipelineRequestId', mediaPipelineRequestId);
      }
      if (conversationLastInboundMessageAt) {
        formData.append('conversationLastInboundMessageAt', conversationLastInboundMessageAt);
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
      const backendResponse = error?.response?.data || {};
      const backendError =
        backendResponse?.error ||
        backendResponse?.message ||
        error?.message ||
        'Failed to send attachment message';
      return {
        success: false,
        error: normalizeServiceErrorMessage(backendError, 'Failed to send attachment message'),
        errorCode: backendResponse?.code || backendResponse?.errorCode || null,
        errorDetails:
          backendResponse?.errorDetails ||
          backendResponse?.details ||
          backendResponse?.errorDetailsText ||
          null,
        policy: backendResponse?.policy || null,
        status: Number(error?.response?.status || 0) || null,
        mediaPipelineRequestId: String(backendResponse?.mediaPipelineRequestId || '').trim() || null
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

  async getUnreadConversationCount(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/conversations/unread-count`, {
        headers: getAuthHeaders(false),
        params: filters,
        timeout: 8000
      });
      const payload = response?.data?.data || response?.data || {};
      return {
        ok: true,
        data: {
          unreadConversationCount: Number(payload?.unreadConversationCount || 0)
        }
      };
    } catch (error) {
      logAxiosServiceError('Failed to fetch unread conversation count', error, 'Failed to fetch unread conversation count');
      return {
        ok: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to fetch unread conversation count'
        )
      };
    }
  },

  

  // Get all conversations

  async getConversations(filters = {}) {

    try {
      const normalizedFilters = filters && typeof filters === 'object' ? filters : {};
      const hasExplicitPaging =
        Number(normalizedFilters?.limit || 0) > 0 || String(normalizedFilters?.cursor || '').trim();

      if (hasExplicitPaging) {
        const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
          headers: getAuthHeaders(false),
          params: normalizedFilters,
          timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
        });
        const data = response.data;
        const result = data?.data || data;
        return Array.isArray(result) ? result : [];
      }

      const aggregatedConversations = [];
      const seenConversationKeys = new Set();
      let cursor = '';
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 100) {
        safetyCounter += 1;
        const page = await this.getConversationsPage({
          ...normalizedFilters,
          limit: Math.min(Number(normalizedFilters?.limit || 0) || 200, 200) || 200,
          ...(cursor ? { cursor } : {})
        });

        if (page?.ok === false) {
          break;
        }

        for (const conversation of Array.isArray(page?.data) ? page.data : []) {
          const key = String(conversation?._id || conversation?.id || '').trim();
          if (!key || seenConversationKeys.has(key)) continue;
          seenConversationKeys.add(key);
          aggregatedConversations.push(conversation);
        }

        cursor = String(page?.meta?.nextCursor || '').trim();
        hasMore = Boolean(page?.meta?.hasMore) && Boolean(cursor);
        if (!hasMore) {
          break;
        }
      }

      return aggregatedConversations;

    } catch (error) {
      logAxiosServiceError('Failed to fetch conversations', error, 'Failed to fetch conversations');

      return [];

    }

  },

  async getConversationsPage(filters = {}) {
    try {
      const requestedLimit = Number(filters?.limit || 0) || null;
      const response = await axios.get(`${API_BASE_URL}/api/conversations`, {
        headers: getAuthHeaders(false),
        params: filters,
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
      });
      const payload = response.data;
      const wrappedPayload =
        payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : null;
      const conversations = Array.isArray(payload)
        ? payload
        : Array.isArray(wrappedPayload?.data)
          ? wrappedPayload.data
          : [];
      const responseMeta =
        wrappedPayload?.meta && typeof wrappedPayload.meta === 'object' && !Array.isArray(wrappedPayload.meta)
          ? wrappedPayload.meta
          : {};
      const hasMoreFromMeta = typeof responseMeta?.hasMore === 'boolean' ? responseMeta.hasMore : null;
      const derivedHasMore =
        hasMoreFromMeta !== null
          ? hasMoreFromMeta
          : requestedLimit
            ? conversations.length >= requestedLimit
            : conversations.length > 0;
      const derivedNextCursor =
        String(responseMeta?.nextCursor || '').trim() ||
        encodeConversationCursor(conversations[conversations.length - 1]);
      if (wrappedPayload?.success === false) {
        return {
          ok: false,
          error: normalizeServiceErrorMessage(
            wrappedPayload?.error || wrappedPayload?.message,
            'Failed to fetch conversations'
          ),
          data: [],
          meta: {
            limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
            hasMore: false,
            nextCursor: null,
            exhausted: false
          }
        };
      }
      return {
        ok: true,
        data: conversations,
        meta: {
          limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
          hasMore: derivedHasMore,
          nextCursor: derivedNextCursor || null,
          exhausted: Boolean(responseMeta?.exhausted) || (!derivedHasMore && !derivedNextCursor)
        }
      };
    } catch (error) {
      logAxiosServiceError('Failed to fetch paged conversations', error, 'Failed to fetch conversations');
      return {
        ok: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to fetch conversations'
        ),
        data: [],
        meta: {
          limit: null,
          hasMore: false,
          nextCursor: null,
          exhausted: false
        }
      };
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
        ok: false,
        error: 'conversationId is required',
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
    const signal = options?.signal || undefined;
    const shouldTryCompatFallback = !cursor;
    const buildEmptyPage = () => ({
      data: [],
      meta: {
        limit,
        hasMore: false,
        nextCursor: null
      }
    });

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/conversations/${normalizedConversationId}/messages`,
        {
          headers: getAuthHeaders(false),
          timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS,
          signal,
          params: {
            limit,
            ...(String(options?.scope || '').trim() ? { scope: String(options.scope).trim() } : {}),
            ...(cursor ? { cursor } : {})
          }
        }
      );

      const payload = response.data;
      if (payload?.success === false) {
        return {
          ok: false,
          error: normalizeServiceErrorMessage(payload?.error || payload?.message, 'Failed to fetch messages'),
          data: [],
          meta: {
            limit,
            hasMore: false,
            nextCursor: null
          }
        };
      }
      if (Array.isArray(payload)) {
        return {
          ok: true,
          data: payload,
          meta: {
            limit,
            hasMore: false,
            nextCursor: null
          }
        };
      }

      const primaryPage = {
        ok: true,
        data: Array.isArray(payload?.data) ? payload.data : [],
        meta: {
          limit: Number(payload?.meta?.limit || limit) || limit,
          hasMore: Boolean(payload?.meta?.hasMore),
          nextCursor: String(payload?.meta?.nextCursor || '').trim() || null
        }
      };

      if (
        shouldTryCompatFallback &&
        Array.isArray(primaryPage.data) &&
        primaryPage.data.length === 0
      ) {
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
                      signal,
                      params: { limit }
                    }
                  )
              },
              {
                name: "paged-messages-attachments-compat",
                run: async () =>
                  axios.get(`${API_BASE_URL}/api/messages/attachments`, {
                    headers: getAuthHeaders(false),
                    timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS,
                    signal,
                    params: {
                      conversationId: normalizedConversationId,
                      limit
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
              ok: true,
              data: fallbackPayload,
              meta: {
                limit,
                hasMore: false,
                nextCursor: null
              }
            };
          }
          if (Array.isArray(fallbackPayload?.data) && fallbackPayload.data.length > 0) {
            return {
              ok: true,
              data: fallbackPayload.data,
              meta: {
                limit: Number(fallbackPayload?.meta?.limit || limit) || limit,
                hasMore: Boolean(fallbackPayload?.meta?.hasMore),
                nextCursor: String(fallbackPayload?.meta?.nextCursor || '').trim() || null
              }
            };
          }
        } catch {
          console.warn('Compatibility fallback returned no messages after empty primary page.');
        }
      }

      return primaryPage;
    } catch (error) {
      const isAbortError =
        error?.name === 'AbortError' ||
        error?.code === 'ERR_CANCELED' ||
        String(error?.message || '').toLowerCase().includes('canceled');
      if (isAbortError) {
        return {
          ...buildEmptyPage(),
          ok: false,
          canceled: true,
          error: 'canceled'
        };
      }
      if (!isNotFoundError(error)) {
        logAxiosServiceError('Failed to fetch paged messages', error, 'Failed to fetch messages');
        return {
          ...buildEmptyPage(),
          ok: false,
          error: normalizeServiceErrorMessage(
            error?.response?.data?.error || error?.message,
            'Failed to fetch messages'
          )
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
                    signal,
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
                    signal,
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
            ok: true,
            data: fallbackPayload,
            meta: {
              limit,
              hasMore: false,
              nextCursor: null
            }
          };
        }
        return {
          ok: true,
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
        ...buildEmptyPage(),
        ok: false,
        error: normalizeServiceErrorMessage(error?.response?.data?.error || error?.message, 'Failed to fetch messages')
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
      const normalizedFilters = filters && typeof filters === 'object' ? filters : {};
      const hasExplicitPaging =
        Number(normalizedFilters?.limit || 0) > 0 || String(normalizedFilters?.cursor || '').trim();

      if (hasExplicitPaging) {
        const response = await axios.get(`${API_BASE_URL}/api/contacts`, {
          headers: getAuthHeaders(false),
          params: normalizedFilters,
          timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
        });
        const data = response.data;
        const result = data?.data || data;
        return Array.isArray(result) ? result : [];
      }

      const aggregatedContacts = [];
      const seenContactKeys = new Set();
      let cursor = '';
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 100) {
        safetyCounter += 1;
        const response = await axios.get(`${API_BASE_URL}/api/contacts`, {
          headers: getAuthHeaders(false),
          params: {
            ...normalizedFilters,
            limit: Math.min(Number(normalizedFilters?.limit || 0) || 200, 200) || 200,
            ...(cursor ? { cursor } : {})
          },
          timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
        });

        const payload = response.data;
        const wrappedPayload =
          payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : null;
        const pageContacts = Array.isArray(payload)
          ? payload
          : Array.isArray(wrappedPayload?.data)
            ? wrappedPayload.data
            : [];
        const meta = wrappedPayload?.meta && typeof wrappedPayload.meta === 'object' ? wrappedPayload.meta : {};

        for (const contact of pageContacts) {
          const key = String(contact?._id || contact?.id || contact?.phone || '').trim();
          if (!key || seenContactKeys.has(key)) continue;
          seenContactKeys.add(key);
          aggregatedContacts.push(contact);
        }

        cursor = String(meta?.nextCursor || '').trim();
        hasMore = Boolean(meta?.hasMore) && Boolean(cursor);

        if (!hasMore) {
          break;
        }
      }

      return aggregatedContacts;

    } catch (error) {
      logAxiosServiceError('Failed to fetch contacts', error, 'Failed to fetch contacts');

      return [];

    }

  },

  async getContactsPage(filters = {}) {
    try {
      const requestedLimit = Number(filters?.limit || 0) || null;
      const response = await axios.get(`${API_BASE_URL}/api/contacts`, {
        headers: getAuthHeaders(false),
        params: filters,
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
      });
      const payload = response.data;
      const wrappedPayload =
        payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : null;
      const contacts = Array.isArray(payload)
        ? payload
        : Array.isArray(wrappedPayload?.data)
          ? wrappedPayload.data
          : [];
      const responseMeta =
        wrappedPayload?.meta && typeof wrappedPayload.meta === 'object' && !Array.isArray(wrappedPayload.meta)
          ? wrappedPayload.meta
          : {};
      const hasMoreFromMeta = typeof responseMeta?.hasMore === 'boolean' ? responseMeta.hasMore : null;
      const derivedHasMore =
        hasMoreFromMeta !== null
          ? hasMoreFromMeta
          : requestedLimit
            ? contacts.length >= requestedLimit
            : contacts.length > 0;
      const derivedNextCursor =
        String(responseMeta?.nextCursor || '').trim() || '';

      if (wrappedPayload?.success === false) {
        return {
          ok: false,
          error: normalizeServiceErrorMessage(
            wrappedPayload?.error || wrappedPayload?.message,
            'Failed to fetch contacts'
          ),
          data: [],
          meta: {
            limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
            hasMore: false,
            nextCursor: null,
            exhausted: false
          }
        };
      }

      return {
        ok: true,
        data: contacts,
        meta: {
          limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
          hasMore: derivedHasMore,
          nextCursor: derivedNextCursor || null,
          exhausted: Boolean(responseMeta?.exhausted) || (!derivedHasMore && !derivedNextCursor)
        }
      };
    } catch (error) {
      logAxiosServiceError('Failed to fetch paged contacts', error, 'Failed to fetch contacts');
      return {
        ok: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to fetch contacts'
        ),
        data: [],
        meta: {
          limit: null,
          hasMore: false,
          nextCursor: null,
          exhausted: false
        }
      };
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
      if (Number(error?.response?.status || 0) === 404 || !error?.response) {
        try {
          const recipients = await parseCsvRecipients(file);
          return {
            success: true,
            recipients,
            message: recipients.length
              ? 'CSV parsed locally because the backend upload endpoint is unavailable.'
              : 'CSV file did not contain any valid recipients.'
          };
        } catch (fallbackError) {
          console.error('Local CSV fallback failed:', fallbackError);
        }
      }

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

  

  // Get all templates from Meta and local DB, merged so saved drafts stay visible.
  async getTemplates() {
    const fetchMetaTemplates = async () => {
      const response = await axios.get(`${API_BASE_URL}/api/templates/meta`, {
        headers: getAuthHeaders(false),
        timeout: WHATSAPP_DEFAULT_TIMEOUT_MS
      });
      const data = response.data;
      return Array.isArray(data) ? data : data.data || [];
    };

    const fetchLocalTemplates = async () => {
      const response = await axios.get(`${API_BASE_URL}/api/templates`, {
        headers: getAuthHeaders(false),
        timeout: WHATSAPP_DEFAULT_TIMEOUT_MS
      });
      const data = response.data;
      return Array.isArray(data) ? data : data.data || [];
    };

    try {
      const [metaResult, localResult] = await Promise.allSettled([
        fetchMetaTemplates(),
        fetchLocalTemplates()
      ]);

      const metaTemplates = metaResult.status === 'fulfilled' ? metaResult.value : [];
      const localTemplates = localResult.status === 'fulfilled' ? localResult.value : [];

      if (metaTemplates.length || localTemplates.length) {
        return mergeTemplateLists(metaTemplates, localTemplates);
      }

      const failure =
        metaResult.status === 'rejected'
          ? metaResult.reason
          : localResult.status === 'rejected'
            ? localResult.reason
            : null;
      throw failure || new Error('Failed to fetch templates');
    } catch (error) {
      console.error('Failed to fetch templates from Meta/local DB:', error);
      try {
        return await fetchLocalTemplates();
      } catch (localError) {
        const backendMessage =
          localError?.response?.data?.error ||
          localError?.response?.data?.message ||
          localError?.message ||
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch templates';
        throw new Error(backendMessage);
      }
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
      const metaUserMessage =
        error?.response?.data?.details?.error?.error_user_msg ||
        error?.response?.data?.details?.error?.error_user_title ||
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to create template";
      return {
        success: false,
        error: metaUserMessage,
        details: error?.response?.data || null
      };
    }
  },

  async updateTemplate(templateId, templateData) {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/templates/${templateId}`, templateData, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update template:', error);
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update template';
      return {
        success: false,
        error: backendMessage,
        details: error?.response?.data || null
      };
    }
  },



  // ============ BROADCAST ENDPOINTS ============

  

  // Get all broadcasts

  async getBroadcasts() {

    try {
      const aggregatedBroadcasts = [];
      const seenBroadcastKeys = new Set();
      let cursor = '';
      let hasMore = true;
      let safetyCounter = 0;

      while (hasMore && safetyCounter < 100) {
        safetyCounter += 1;
        const page = await this.getBroadcastsPage({
          limit: 100,
          ...(cursor ? { cursor } : {})
        });

        if (page?.ok === false) {
          break;
        }

        for (const broadcast of Array.isArray(page?.data) ? page.data : []) {
          const key = String(broadcast?._id || broadcast?.id || '').trim();
          if (!key || seenBroadcastKeys.has(key)) continue;
          seenBroadcastKeys.add(key);
          aggregatedBroadcasts.push(broadcast);
        }

        cursor = String(page?.meta?.nextCursor || '').trim();
        hasMore = Boolean(page?.meta?.hasMore) && Boolean(cursor);
        if (!hasMore) {
          break;
        }
      }

      return aggregatedBroadcasts;

    } catch (error) {

      console.error('Failed to fetch broadcasts:', error);

      return [];

    }

  },

  async getBroadcastsPage(params = {}) {
    try {
      const requestedLimit = Number(params?.limit || 0) || null;
      const response = await axios.get(`${API_BASE_URL}/api/broadcasts`, {
        headers: getAuthHeaders(false),
        params,
        timeout: TEAM_INBOX_BOOTSTRAP_TIMEOUT_MS
      });
      const payload = response.data;
      const wrappedPayload =
        payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : null;
      const broadcasts = Array.isArray(payload)
        ? payload
        : Array.isArray(wrappedPayload?.data)
          ? wrappedPayload.data
          : [];
      const responseMeta =
        wrappedPayload?.meta && typeof wrappedPayload.meta === 'object' && !Array.isArray(wrappedPayload.meta)
          ? wrappedPayload.meta
          : {};
      const hasMoreFromMeta = typeof responseMeta?.hasMore === 'boolean' ? responseMeta.hasMore : null;
      const derivedHasMore =
        hasMoreFromMeta !== null
          ? hasMoreFromMeta
          : requestedLimit
            ? broadcasts.length >= requestedLimit
            : broadcasts.length > 0;
      const derivedNextCursor = String(responseMeta?.nextCursor || '').trim() || null;

      if (wrappedPayload?.success === false) {
        return {
          ok: false,
          error: normalizeServiceErrorMessage(
            wrappedPayload?.error || wrappedPayload?.message,
            'Failed to fetch broadcasts'
          ),
          data: [],
          meta: {
            limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
            hasMore: false,
            nextCursor: null,
            exhausted: false
          }
        };
      }

      return {
        ok: true,
        data: broadcasts,
        meta: {
          limit: Number(responseMeta?.limit || requestedLimit || 0) || null,
          hasMore: derivedHasMore,
          nextCursor: derivedNextCursor,
          exhausted: Boolean(responseMeta?.exhausted) || (!derivedHasMore && !derivedNextCursor)
        }
      };
    } catch (error) {
      logAxiosServiceError('Failed to fetch paged broadcasts', error, 'Failed to fetch broadcasts');
      return {
        ok: false,
        error: normalizeServiceErrorMessage(
          error?.response?.data?.error || error?.message,
          'Failed to fetch broadcasts'
        ),
        data: [],
        meta: {
          limit: null,
          hasMore: false,
          nextCursor: null,
          exhausted: false
        }
      };
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
      logAxiosServiceError('Failed to fetch analytics', error, 'Failed to fetch analytics');

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


