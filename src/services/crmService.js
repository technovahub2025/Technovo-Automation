import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import { handleUnauthorizedServiceError } from "./serviceAuth";

const API_BASE_URL = resolveApiBaseUrl();
const CRM_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_CRM_REQUEST_TIMEOUT_MS || 15000);
const PIPELINE_VIEWS_AVAILABILITY_KEY = "crmPipelineViewsApiAvailable";
const PIPELINE_STAGES_AVAILABILITY_KEY = "crmPipelineStagesApiAvailable";
const DEFAULT_PIPELINE_STAGES = [
  { key: "new", label: "New Lead", color: "#5f8fc3", order: 0 },
  { key: "contacted", label: "Contacted", color: "#4a8bbd", order: 1 },
  { key: "nurturing", label: "Nurturing", color: "#6f7bd0", order: 2 },
  { key: "qualified", label: "Qualified", color: "#4f9d6c", order: 3 },
  { key: "proposal", label: "Proposal Sent", color: "#d18a3a", order: 4 },
  { key: "won", label: "Won", color: "#1d9b5e", order: 5 },
  { key: "lost", label: "Lost", color: "#c45a5a", order: 6 }
];
let pipelineViewsApiAvailable = null;
let pipelineViewsRequestPromise = null;
let pipelineStagesApiAvailable = null;
let pipelineStagesRequestPromise = null;

const readPipelineViewsAvailability = () => {
  try {
    const stored = localStorage.getItem(PIPELINE_VIEWS_AVAILABILITY_KEY);
    if (stored === "true") return true;
    if (stored === "false") {
      localStorage.removeItem(PIPELINE_VIEWS_AVAILABILITY_KEY);
    }
  } catch {
    // Ignore storage access issues and fall back to probing.
  }
  return null;
};

const writePipelineViewsAvailability = (value) => {
  pipelineViewsApiAvailable = value;
  try {
    if (value === true) {
      localStorage.setItem(PIPELINE_VIEWS_AVAILABILITY_KEY, "true");
    } else {
      localStorage.removeItem(PIPELINE_VIEWS_AVAILABILITY_KEY);
    }
  } catch {
    // Ignore storage access issues.
  }
};

const readPipelineStagesAvailability = () => {
  try {
    const stored = localStorage.getItem(PIPELINE_STAGES_AVAILABILITY_KEY);
    if (stored === "true") return true;
    if (stored === "false") {
      localStorage.removeItem(PIPELINE_STAGES_AVAILABILITY_KEY);
    }
  } catch {
    // Ignore storage access issues and fall back to probing.
  }
  return null;
};

const writePipelineStagesAvailability = (value) => {
  pipelineStagesApiAvailable = value;
  try {
    if (value === true) {
      localStorage.setItem(PIPELINE_STAGES_AVAILABILITY_KEY, "true");
    } else {
      localStorage.removeItem(PIPELINE_STAGES_AVAILABILITY_KEY);
    }
  } catch {
    // Ignore storage access issues.
  }
};

pipelineViewsApiAvailable = readPipelineViewsAvailability();
pipelineStagesApiAvailable = readPipelineStagesAvailability();

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

const withServiceError = (error, fallback) => {
  handleUnauthorizedServiceError(error);
  return { success: false, error: toServiceError(error, fallback) };
};

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
      return withServiceError(error, "Failed to fetch CRM contacts");
    }
  },

  async getPipelineViews() {
    if (pipelineViewsApiAvailable === false) {
      return {
        success: true,
        data: {
          views: [],
          defaultViewId: ""
        }
      };
    }

    if (pipelineViewsRequestPromise) {
      return pipelineViewsRequestPromise;
    }

    pipelineViewsRequestPromise = (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/crm/pipeline-views`, {
          ...buildRequestConfig(false)
        });
        writePipelineViewsAvailability(true);
        return {
          ...(response.data || {}),
          data: {
            ...((response.data && response.data.data) || {}),
            apiAvailable: true
          }
        };
      } catch (error) {
        if (error?.response?.status === 404) {
          writePipelineViewsAvailability(false);
          return {
            success: true,
            data: {
              views: [],
              defaultViewId: "",
              apiAvailable: false
            }
          };
        }
        return withServiceError(error, "Failed to fetch CRM pipeline views");
      } finally {
        pipelineViewsRequestPromise = null;
      }
    })();

    try {
      return await pipelineViewsRequestPromise;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM pipeline views");
    }
  },

  async createPipelineView(payload = {}) {
    if (pipelineViewsApiAvailable === false) {
      return {
        success: false,
        error: "Saved lead pipeline views are unavailable in this backend build."
      };
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/pipeline-views`, payload, {
        ...buildRequestConfig()
      });
      writePipelineViewsAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineViewsAvailability(false);
        return {
          success: false,
          error: "Saved lead pipeline views are unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to save CRM pipeline view");
    }
  },

  async updatePipelineView(viewId, payload = {}) {
    if (pipelineViewsApiAvailable === false) {
      return {
        success: false,
        error: "Saved lead pipeline views are unavailable in this backend build."
      };
    }

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/pipeline-views/${viewId}`,
        payload,
        buildRequestConfig()
      );
      writePipelineViewsAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineViewsAvailability(false);
        return {
          success: false,
          error: "Saved lead pipeline views are unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to update CRM pipeline view");
    }
  },

  async deletePipelineView(viewId) {
    if (pipelineViewsApiAvailable === false) {
      return {
        success: false,
        error: "Saved lead pipeline views are unavailable in this backend build."
      };
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/pipeline-views/${viewId}`, {
        ...buildRequestConfig(false)
      });
      writePipelineViewsAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineViewsAvailability(false);
        return {
          success: false,
          error: "Saved lead pipeline views are unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to delete CRM pipeline view");
    }
  },

  async getPipelineStages() {
    if (pipelineStagesApiAvailable === false) {
      return {
        success: true,
        data: {
          stages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, apiAvailable: false })),
          apiAvailable: false
        }
      };
    }

    if (pipelineStagesRequestPromise) {
      return pipelineStagesRequestPromise;
    }

    pipelineStagesRequestPromise = (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/crm/pipeline-stages`, {
          ...buildRequestConfig(false)
        });
        writePipelineStagesAvailability(true);
        return {
          ...(response.data || {}),
          data: {
            ...((response.data && response.data.data) || {}),
            apiAvailable: true
          }
        };
      } catch (error) {
        if (error?.response?.status === 404) {
          writePipelineStagesAvailability(false);
          return {
            success: true,
            data: {
              stages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, apiAvailable: false })),
              apiAvailable: false
            }
          };
        }
        return withServiceError(error, "Failed to fetch CRM pipeline stages");
      } finally {
        pipelineStagesRequestPromise = null;
      }
    })();

    try {
      return await pipelineStagesRequestPromise;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM pipeline stages");
    }
  },

  async createPipelineStage(payload = {}) {
    if (pipelineStagesApiAvailable === false) {
      return {
        success: false,
        error: "Pipeline stage management is unavailable in this backend build."
      };
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/pipeline-stages`, payload, {
        ...buildRequestConfig()
      });
      writePipelineStagesAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineStagesAvailability(false);
        return {
          success: false,
          error: "Pipeline stage management is unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to create CRM pipeline stage");
    }
  },

  async reorderPipelineStages(stageIds = []) {
    if (pipelineStagesApiAvailable === false) {
      return {
        success: false,
        error: "Pipeline stage management is unavailable in this backend build."
      };
    }

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/pipeline-stages/reorder`,
        { stageIds },
        buildRequestConfig()
      );
      writePipelineStagesAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineStagesAvailability(false);
        return {
          success: false,
          error: "Pipeline stage management is unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to reorder CRM pipeline stages");
    }
  },

  async updatePipelineStage(stageId, payload = {}) {
    if (pipelineStagesApiAvailable === false) {
      return {
        success: false,
        error: "Pipeline stage management is unavailable in this backend build."
      };
    }

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/crm/pipeline-stages/${stageId}`, payload, {
        ...buildRequestConfig()
      });
      writePipelineStagesAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineStagesAvailability(false);
        return {
          success: false,
          error: "Pipeline stage management is unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to update CRM pipeline stage");
    }
  },

  async deletePipelineStage(stageId, payload = {}) {
    if (pipelineStagesApiAvailable === false) {
      return {
        success: false,
        error: "Pipeline stage management is unavailable in this backend build."
      };
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/pipeline-stages/${stageId}`, {
        ...buildRequestConfig(false, { data: payload })
      });
      writePipelineStagesAvailability(true);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        writePipelineStagesAvailability(false);
        return {
          success: false,
          error: "Pipeline stage management is unavailable in this backend build."
        };
      }
      return withServiceError(error, "Failed to delete CRM pipeline stage");
    }
  },

  async getContact(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch contact");
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
      return withServiceError(error, "Failed to update contact stage");
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
      return withServiceError(error, "Failed to update contact owner");
    }
  },

  async updateContactProfile(contactId, payload = {}) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/profile`,
        payload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update contact profile");
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
      return withServiceError(error, "Failed to save contact notes");
    }
  },

  async listContactDocuments(contactId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}/documents`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch contact documents");
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
      return withServiceError(error, "Failed to upload contact document");
    }
  },

  async getContactDocumentAccess(documentId, mode = 'view') {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/documents/${documentId}/access`, {
        ...buildRequestConfig(false, { params: { mode } })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to access contact document");
    }
  },

  async deleteContactDocument(documentId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/documents/${documentId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to delete contact document");
    }
  },

  async getTasks(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/tasks`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM tasks");
    }
  },

  async getDeals(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/deals`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM deals");
    }
  },

  async getDealMetrics(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/deals/metrics`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM deal metrics");
    }
  },

  async createDeal(payload) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/deals`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to create CRM deal");
    }
  },

  async updateDeal(dealId, payload) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/crm/deals/${dealId}`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update CRM deal");
    }
  },

  async deleteDeal(dealId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/deals/${dealId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to delete CRM deal");
    }
  },

  async getTaskSummary(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/tasks/summary`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM task summary");
    }
  },

  async createTask(payload) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/tasks`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to create CRM task");
    }
  },

  async updateTask(taskId, payload) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/api/crm/tasks/${taskId}`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update CRM task");
    }
  },

  async addTaskComment(taskId, text) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/tasks/${taskId}/comments`,
        { text },
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to add CRM task comment");
    }
  },

  async bulkUpdateTasks(payload = {}) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/tasks/bulk`,
        payload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to run CRM bulk task action");
    }
  },

  async deleteTask(taskId) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/crm/tasks/${taskId}`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to delete CRM task");
    }
  },

  async getActivities(contactId, limit = 100) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/activities/${contactId}`, {
        ...buildRequestConfig(false, { params: { limit } })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM activities");
    }
  },

  async getMetrics() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/metrics`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM metrics");
    }
  },

  async getReportsSummary() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/reports/summary`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM reports");
    }
  },

  async getMeetings(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/meetings`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM meetings");
    }
  },

  async getOwnerNotifications(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/notifications/owner`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM owner notifications");
    }
  },

  async markOwnerNotificationRead(notificationId) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/notifications/owner/${notificationId}/read`,
        {},
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update CRM notification");
    }
  },

  async getAutomationHistory(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/ops/history`, {
        ...buildRequestConfig(false, { params: filters })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM automation history");
    }
  },

  async getOwnerDashboard() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/ops/owner-dashboard`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM owner dashboard");
    }
  },

  async runFollowUpAutomation(payload = {}) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/ops/follow-up-automation`,
        payload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to run CRM follow-up automation");
    }
  }
};

export default crmService;
