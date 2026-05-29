import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";
import { handleUnauthorizedServiceError } from "./serviceAuth";
import webSocketService from "./websocketService";
import {
  buildWorkspaceOwnershipPayload,
  buildWorkspaceQueryScope,
  getStoredWorkspaceUser,
  resolveAgentWorkspaceState
} from "../utils/agentAccess";

const API_BASE_URL = resolveApiBaseUrl();
const CRM_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_CRM_REQUEST_TIMEOUT_MS || 15000);
const CRM_USER_ROSTER_WAIT_MS = Number(import.meta.env.VITE_CRM_USER_ROSTER_WAIT_MS || 900);
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
let pipelineStagesApiAvailable = null;
let pipelineStagesRequestPromise = null;
let crmUserRosterCache = [];
let crmUserRosterSource = "";
let crmUserRosterUpdatedAt = 0;
let crmUserRosterSocketListenerBound = false;
const crmUserRosterListeners = new Set();

const getWorkspaceScope = (scopeType = "createdBy") =>
  buildWorkspaceQueryScope(getStoredWorkspaceUser(), { scopeType });

const applyWorkspaceOwnership = (payload = {}, scopeType = "createdBy") =>
  buildWorkspaceOwnershipPayload(getStoredWorkspaceUser(), payload, { scopeType });

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
  const { headers: extraHeaders = {}, workspaceScopeType, ...rest } = extra || {};
  const scopeType =
    workspaceScopeType === false
      ? ""
      : String(
          workspaceScopeType || (resolveAgentWorkspaceState(getStoredWorkspaceUser()) ? "createdBy" : "")
        ).trim();
  const nextRest = { ...rest };
  if (scopeType) {
    nextRest.params = {
      ...(nextRest.params || {}),
      ...getWorkspaceScope(scopeType)
    };
  }
  return {
    timeout: CRM_REQUEST_TIMEOUT_MS,
    headers: {
      ...getAuthHeaders(includeJson),
      ...extraHeaders
    },
    ...nextRest
  };
};

const normalizeCrmUserLabel = (user = {}, fallbackId = "") => {
  const resolvedId = String(user?._id || user?.id || user?.userId || fallbackId || "").trim();
  const name = String(user?.name || user?.displayName || user?.fullName || "").trim();
  const email = String(user?.email || "").trim();
  return name || email || resolvedId || "Unknown user";
};

const normalizeCrmUserRecord = (user = {}, fallbackId = "") => {
  const id = String(user?._id || user?.id || user?.userId || fallbackId || "").trim();
  if (!id) return null;

  return {
    _id: id,
    id,
    userId: id,
    name: String(user?.name || user?.displayName || user?.fullName || "").trim(),
    displayName: String(user?.displayName || user?.name || user?.fullName || "").trim(),
    email: String(user?.email || "").trim(),
    label: normalizeCrmUserLabel(user, id),
    source: String(user?.source || "").trim(),
    connected: user?.connected !== false,
    lastSeenAt: String(user?.lastSeenAt || "").trim()
  };
};

const normalizeCrmUserRosterList = (value = {}) => {
  const rawUsers = Array.isArray(value)
    ? value
    : Array.isArray(value?.users)
      ? value.users
      : Array.isArray(value?.data)
        ? value.data
        : Array.isArray(value?.results)
          ? value.results
          : Array.isArray(value?.owners)
            ? value.owners.map((owner) => ({
                _id: owner?.ownerId,
                id: owner?.ownerId,
                userId: owner?.ownerId,
                name: owner?.ownerName,
                displayName: owner?.ownerName,
                source: "owner-dashboard"
              }))
            : [];

  const seen = new Set();
  return rawUsers
    .map((user) => normalizeCrmUserRecord(user))
    .filter(Boolean)
    .filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
};

const emitCrmUserRoster = (users, meta = {}) => {
  crmUserRosterCache = Array.isArray(users) ? users : [];
  crmUserRosterSource = String(meta?.source || "").trim() || crmUserRosterSource || "websocket";
  crmUserRosterUpdatedAt = Date.now();

  const payload = {
    users: crmUserRosterCache,
    source: crmUserRosterSource,
    updatedAt: crmUserRosterUpdatedAt,
    fallback: Boolean(meta?.fallback)
  };

  crmUserRosterListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error("Failed to notify CRM user roster listener:", error);
    }
  });
};

const ensureCrmUserRosterSocketBinding = () => {
  if (crmUserRosterSocketListenerBound || typeof webSocketService?.on !== "function") return;

  const handleUserList = (payload = {}) => {
    if (String(payload?.type || "").trim() !== "user_list") return;
    const nextUsers = normalizeCrmUserRosterList(payload);
    if (!nextUsers.length) return;
    emitCrmUserRoster(nextUsers, { source: "websocket" });
  };

  webSocketService.on("user_list", handleUserList);
  crmUserRosterSocketListenerBound = true;
};

const fetchCrmUserRosterFallback = async () => {
  const response = await axios.get(`${API_BASE_URL}/api/crm/ops/owner-dashboard`, {
    ...buildRequestConfig(false)
  });

  const owners = Array.isArray(response?.data?.data?.owners)
    ? response.data.data.owners
    : Array.isArray(response?.data?.owners)
      ? response.data.owners
      : [];

  return owners
    .map((owner) =>
      normalizeCrmUserRecord({
        _id: owner?.ownerId,
        id: owner?.ownerId,
        userId: owner?.ownerId,
        name: owner?.ownerName,
        displayName: owner?.ownerName,
        source: "owner-dashboard"
      })
    )
    .filter(Boolean);
};

const waitForCrmUserList = (waitMs = CRM_USER_ROSTER_WAIT_MS) =>
  new Promise((resolve) => {
    if (!webSocketService?.isConnected?.()) {
      resolve([]);
      return;
    }

    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      webSocketService.off?.("user_list", handleUserList);
    };

    const settle = (users = []) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Array.isArray(users) ? users : []);
    };

    const handleUserList = (payload = {}) => {
      if (String(payload?.type || "").trim() !== "user_list") return;
      const nextUsers = normalizeCrmUserRosterList(payload);
      if (!nextUsers.length) return;
      settle(nextUsers);
    };

    webSocketService.on("user_list", handleUserList);
    timeoutId = window.setTimeout(() => settle([]), Math.max(0, Number(waitMs) || 0));
  });

export const subscribeCrmUserRoster = (listener) => {
  ensureCrmUserRosterSocketBinding();

  if (typeof listener !== "function") {
    return () => {};
  }

  crmUserRosterListeners.add(listener);
  if (Array.isArray(crmUserRosterCache) && crmUserRosterCache.length) {
    listener({
      users: crmUserRosterCache,
      source: crmUserRosterSource || "websocket",
      updatedAt: crmUserRosterUpdatedAt,
      fallback: crmUserRosterSource !== "websocket"
    });
  }

  return () => {
    crmUserRosterListeners.delete(listener);
  };
};

export const getCrmUserRoster = async ({ preferWebSocket = true, waitMs = CRM_USER_ROSTER_WAIT_MS } = {}) => {
  ensureCrmUserRosterSocketBinding();

  if (Array.isArray(crmUserRosterCache) && crmUserRosterCache.length) {
    return {
      success: true,
      data: crmUserRosterCache,
      source: crmUserRosterSource || "websocket",
      updatedAt: crmUserRosterUpdatedAt
    };
  }

  if (preferWebSocket && webSocketService?.isConnected?.()) {
    const nextUsers = await waitForCrmUserList(waitMs);
    if (nextUsers.length) {
      emitCrmUserRoster(nextUsers, { source: "websocket" });
      return {
        success: true,
        data: nextUsers,
        source: "websocket",
        updatedAt: crmUserRosterUpdatedAt
      };
    }
  }

  try {
    const fallbackUsers = await fetchCrmUserRosterFallback();
    emitCrmUserRoster(fallbackUsers, { source: "fallback", fallback: true });
    return {
      success: true,
      data: fallbackUsers,
      source: "fallback",
      fallback: true,
      updatedAt: crmUserRosterUpdatedAt
    };
  } catch (error) {
    return withServiceError(error, "Failed to fetch CRM users");
  }
};

export const crmService = {
  async getContacts(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts`, {
        ...buildRequestConfig(false, {
          params: filters,
          workspaceScopeType: false
        })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM contacts");
    }
  },

  async bulkUpdateContacts(payload = {}) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/crm/contacts/bulk`, payload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update CRM leads");
    }
  },

  async getFilterPresets() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/filter-presets`, {
        ...buildRequestConfig(false)
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM filter presets");
    }
  },

  async createFilterPreset(payload = {}) {
    try {
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(`${API_BASE_URL}/api/crm/filter-presets`, nextPayload, {
        ...buildRequestConfig()
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to save CRM filter preset");
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
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(`${API_BASE_URL}/api/crm/pipeline-stages`, nextPayload, {
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
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/contacts/${contactId}/notes`,
        nextPayload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to save contact notes");
    }
  },

  async listContactDocuments(contactId, options = {}) {
    try {
      const params = {};
      const conversationId = String(options?.conversationId || '').trim();
      if (conversationId) {
        params.conversationId = conversationId;
      }
      const response = await axios.get(`${API_BASE_URL}/api/crm/contacts/${contactId}/documents`, {
        ...buildRequestConfig(false, { params })
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
        ...buildRequestConfig(false, { params: filters, workspaceScopeType: false })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM deals");
    }
  },

  async getDealMetrics(filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/crm/deals/metrics`, {
        ...buildRequestConfig(false, { params: filters, workspaceScopeType: false })
      });
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to fetch CRM deal metrics");
    }
  },

  async createDeal(payload) {
    try {
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(`${API_BASE_URL}/api/crm/deals`, nextPayload, {
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
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(`${API_BASE_URL}/api/crm/tasks`, nextPayload, {
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
      const nextPayload = applyWorkspaceOwnership({ text }, "createdBy");
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/tasks/${taskId}/comments`,
        nextPayload,
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

  async scheduleReportExport(payload = {}) {
    try {
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/reports/schedule`,
        nextPayload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to schedule CRM report export");
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

  async updateMeeting(meetingId, payload = {}) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/crm/meetings/${meetingId}`,
        payload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to update CRM meeting");
    }
  },

  async deleteMeeting(meetingId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/crm/meetings/${meetingId}`,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to delete CRM meeting");
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
      const nextPayload = applyWorkspaceOwnership(payload, "createdBy");
      const response = await axios.post(
        `${API_BASE_URL}/api/crm/ops/follow-up-automation`,
        nextPayload,
        buildRequestConfig()
      );
      return response.data;
    } catch (error) {
      return withServiceError(error, "Failed to run CRM follow-up automation");
    }
  }
};

export default crmService;
