import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const API_BASE_URL = resolveApiBaseUrl();

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

export const crmService = {
  async getContacts(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts`, {
        headers: getAuthHeaders(false),
        params: filters
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM contacts") };
    }
  },

  async getContact(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}`, {
        headers: getAuthHeaders(false)
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
        { headers: getAuthHeaders() }
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
        { headers: getAuthHeaders() }
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
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to save contact notes") };
    }
  },

  async listContactDocuments(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}/documents`, {
        headers: getAuthHeaders(false)
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
        { headers }
      );
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to upload contact document") };
    }
  },

  async getContactDocumentAccess(documentId, mode = 'view') {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/documents/${documentId}/access`, {
        headers: getAuthHeaders(false),
        params: { mode }
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to access contact document") };
    }
  },

  async deleteContactDocument(documentId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/documents/${documentId}`, {
        headers: getAuthHeaders(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to delete contact document") };
    }
  },

  async getTasks(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/tasks`, {
        headers: getAuthHeaders(false),
        params: filters
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM tasks") };
    }
  },

  async createTask(payload) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/tasks`, payload, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to create CRM task") };
    }
  },

  async updateTask(taskId, payload) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/crm/tasks/${taskId}`, payload, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to update CRM task") };
    }
  },

  async getActivities(contactId, limit = 100) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/activities/${contactId}`, {
        headers: getAuthHeaders(false),
        params: { limit }
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM activities") };
    }
  },

  async getMetrics() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/metrics`, {
        headers: getAuthHeaders(false)
      });
      return response.data;
    } catch (error) {
      return { success: false, error: toServiceError(error, "Failed to fetch CRM metrics") };
    }
  }
};

export default crmService;
