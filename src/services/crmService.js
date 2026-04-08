import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const API_BASE_URL = resolveApiBaseUrl();
const CRM_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_CRM_REQUEST_TIMEOUT_MS || 15000);

const getAuthHeaders = (includeJson = true) => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const token = localStorage.getItem(tokenKey) || localStorage.getItem("authToken");
  const headers = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const toServiceError = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const buildRequestConfig = (includeJson = true, extra = {}) => {
  const { headers: extraHeaders = {}, ...rest } = extra || {};
  return {
    timeout: CRM_REQUEST_TIMEOUT_MS,
    headers: {
      ...getAuthHeaders(includeJson),
      ...extraHeaders
    },
    ...rest
  };
};

export const crmService = {
  async getContacts(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM contacts") };
    }
  },

  async getContact(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch contact") };
    }
  },

  async updateContactStage(contactId, stage) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/stage`,
        { stage },
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to update contact stage") };
    }
  },

  async updateContactOwner(contactId, ownerId) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/owner`,
        { ownerId },
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to update contact owner") };
    }
  },

  async saveContactNotes(contactId, note, nextFollowUpAt = undefined) {
    try {
      const payload = { note };
      if (nextFollowUpAt !== undefined) payload.nextFollowUpAt = nextFollowUpAt;
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/notes`,
        payload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to save contact notes") };
    }
  },

  async listContactDocuments(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}/documents`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch contact documents") };
    }
  },

  async uploadContactDocument(contactId, payload = {}) {
    try {
      const formData = new FormData();
      if (payload.file) formData.append('file', payload.file);
      if (payload.title !== undefined) formData.append('title', payload.title);
      if (payload.description !== undefined) formData.append('description', payload.description);
      if (payload.documentType !== undefined) formData.append('documentType', payload.documentType);
      if (payload.verificationStatus !== undefined) {
        formData.append('verificationStatus', payload.verificationStatus);
      }
      if (payload.conversationId !== undefined) formData.append('conversationId', payload.conversationId);
      if (Array.isArray(payload.tags) && payload.tags.length > 0) {
        formData.append('tags', JSON.stringify(payload.tags));
      }

      const headers = getAuthHeaders(false);
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/documents`,
        formData,
        buildRequestConfig(false, { headers })
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to upload contact document") };
    }
  },

  async getContactDocumentAccess(documentId, mode = 'view') {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/documents/${documentId}/access`, {
        ...buildRequestConfig(false, { params: { mode } })
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to access contact document") };
    }
  },

  async deleteContactDocument(documentId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/documents/${documentId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to delete contact document") };
    }
  },

  async getTasks(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/tasks`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM tasks") };
    }
  },

  async createTask(payload) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/tasks`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to create CRM task") };
    }
  },

  async updateTask(taskId, payload) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/crm/tasks/${taskId}`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to update CRM task") };
    }
  },

  async getActivities(contactId, limit = 100) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/activities/${contactId}`, {
        ...buildRequestConfig(false, { params: { limit } })
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM activities") };
    }
  },

  async getMetrics() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/metrics`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM metrics") };
    }
  }
};

export default crmService;
