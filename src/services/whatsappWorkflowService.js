import apiService from "./api";
import { toAppPath } from "../utils/appRouteBase";

const STORAGE_LIBRARY_KEY = "nexion_whatsapp_workflow_library";
const STORAGE_ACTIVE_KEY = "nexion_whatsapp_workflow_active";

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function toAbsoluteAppPath(path) {
  if (isAbsoluteUrl(path)) {
    return String(path);
  }
  return toAppPath(path);
}

const RAW_ENDPOINT_CANDIDATES = [
  import.meta.env.VITE_WHATSAPP_WORKFLOW_ENDPOINT || "/api/whatsapp/workflows",
  "/api/workflows/whatsapp",
  "/api/workflows",
];

const HAS_EXPLICIT_API_BASE = Boolean(
  String(import.meta.env.VITE_API_URL || "").trim() ||
    String(import.meta.env.VITE_API_BASE_URL || "").trim()
);

const ENDPOINT_CANDIDATES = Array.from(
  new Set(
    RAW_ENDPOINT_CANDIDATES.flatMap((endpoint) => {
      const value = String(endpoint || "").trim();
      if (!value) return [];
      if (isAbsoluteUrl(value)) return [value];
      const normalizedValue = value.startsWith("/") ? value : `/${value}`;
      return HAS_EXPLICIT_API_BASE
        ? [normalizedValue, toAbsoluteAppPath(normalizedValue)]
        : [toAbsoluteAppPath(normalizedValue), normalizedValue];
    })
  )
);

const RUN_SUFFIX = "/run";
const TEST_NODE_SUFFIX = "/test-node";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractCollection(payload) {
  if (Array.isArray(payload?.workflows)) return payload.workflows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortByUpdatedAtDescending(items) {
  return [...items].sort((left, right) => {
    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
}

function normalizeWorkflow(raw, index = 0) {
  const source = raw?.workflow || raw || {};
  const safeId = source.id || source.workflowId || `workflow_local_${Date.now()}_${index}`;
  return {
    id: String(safeId),
    name: source.name || source.workflowName || `WhatsApp Workflow ${index + 1}`,
    nodes: toArray(source.nodes),
    edges: toArray(source.edges),
    updatedAt: source.updatedAt || source.updated_at || new Date().toISOString(),
  };
}

function readLocal() {
  if (typeof window === "undefined") {
    return { library: [], activeId: null };
  }

  try {
    const rawLibrary = localStorage.getItem(STORAGE_LIBRARY_KEY);
    const rawActive = localStorage.getItem(STORAGE_ACTIVE_KEY);
    const library = rawLibrary
      ? sortByUpdatedAtDescending(toArray(JSON.parse(rawLibrary)).map(normalizeWorkflow))
      : [];

    return {
      library,
      activeId: library.some((item) => item.id === rawActive) ? rawActive : library[0]?.id || null,
    };
  } catch {
    return { library: [], activeId: null };
  }
}

function writeLocal(library, activeId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(sortByUpdatedAtDescending(library)));
    if (activeId) {
      localStorage.setItem(STORAGE_ACTIVE_KEY, String(activeId));
    }
  } catch {
    // Intentionally ignored: local cache should not block workflow actions.
  }
}

async function requestFirstSuccess(requestFactory) {
  let lastError = null;
  for (const endpoint of ENDPOINT_CANDIDATES) {
    try {
      const response = await requestFactory(endpoint);
      return { response, endpoint };
    } catch (error) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      if (status && status < 500 && status !== 404 && status !== 405) {
        break;
      }
    }
  }
  throw lastError || new Error("No WhatsApp workflow endpoint available");
}

function upsertWorkflow(library, workflow, previousId = null) {
  const normalized = normalizeWorkflow(workflow);
  const withoutCurrent = library.filter(
    (item) => item.id !== normalized.id && (!previousId || item.id !== previousId)
  );
  return sortByUpdatedAtDescending([normalized, ...withoutCurrent]);
}

const QUIET_REQUEST_CONFIG = {
  suppressErrorLog: true,
  skipAuthRedirect: true,
};

function shouldUseLocalOnlyMode() {
  const explicitWorkflowEndpoint = String(
    import.meta.env.VITE_WHATSAPP_WORKFLOW_ENDPOINT || ""
  ).trim();
  const explicitApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
  const explicitApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  const hasRemoteConfig = Boolean(
    explicitWorkflowEndpoint || explicitApiUrl || explicitApiBaseUrl
  );
  return import.meta.env.DEV && !hasRemoteConfig;
}

const whatsappWorkflowService = {
  async listWorkflows() {
    const localSnapshot = readLocal();
    if (shouldUseLocalOnlyMode()) {
      return { source: "local", ...localSnapshot };
    }
    try {
      const { response } = await requestFirstSuccess((endpoint) =>
        apiService.get(endpoint, QUIET_REQUEST_CONFIG)
      );
      const rows = extractCollection(response?.data);
      const remoteLibrary = sortByUpdatedAtDescending(rows.map(normalizeWorkflow));

      if (remoteLibrary.length) {
        const activeId =
          remoteLibrary.find((item) => item.id === localSnapshot.activeId)?.id ||
          remoteLibrary[0].id;
        writeLocal(remoteLibrary, activeId);
        return { source: "remote", library: remoteLibrary, activeId };
      }
    } catch {
      // Fallback to local snapshot when backend is unavailable.
    }

    return { source: "local", ...localSnapshot };
  },

  async saveWorkflow(workflow) {
    const localSnapshot = readLocal();
    const normalizedInput = normalizeWorkflow({
      ...workflow,
      updatedAt: new Date().toISOString(),
    });

    if (shouldUseLocalOnlyMode()) {
      const localSaved = {
        ...normalizedInput,
        updatedAt: new Date().toISOString(),
      };
      const library = upsertWorkflow(localSnapshot.library, localSaved, workflow?.id);
      writeLocal(library, localSaved.id);
      return { source: "local", workflow: localSaved, library, activeId: localSaved.id };
    }

    try {
      const { response } = await requestFirstSuccess((endpoint) => {
        return apiService.put(
          `${endpoint}/${encodeURIComponent(normalizedInput.id)}`,
          normalizedInput,
          QUIET_REQUEST_CONFIG
        );
      });
      const saved = normalizeWorkflow(response?.data?.workflow || response?.data?.data || response?.data);
      const library = upsertWorkflow(localSnapshot.library, saved, normalizedInput.id);
      writeLocal(library, saved.id);
      return { source: "remote", workflow: saved, library, activeId: saved.id };
    } catch {
      try {
        const { response } = await requestFirstSuccess((endpoint) =>
          apiService.post(endpoint, normalizedInput, QUIET_REQUEST_CONFIG)
        );
        const saved = normalizeWorkflow(
          response?.data?.workflow || response?.data?.data || response?.data
        );
        const library = upsertWorkflow(localSnapshot.library, saved, normalizedInput.id);
        writeLocal(library, saved.id);
        return { source: "remote", workflow: saved, library, activeId: saved.id };
      } catch {
        const localSaved = {
          ...normalizedInput,
          updatedAt: new Date().toISOString(),
        };
        const library = upsertWorkflow(localSnapshot.library, localSaved, workflow?.id);
        writeLocal(library, localSaved.id);
        return { source: "local", workflow: localSaved, library, activeId: localSaved.id };
      }
    }
  },

  async runWorkflow(workflow, runtimeContext = {}) {
    if (shouldUseLocalOnlyMode()) {
      throw new Error("WhatsApp workflow remote execution disabled in local-only mode");
    }
    const payload = {
      workflowId: workflow?.id,
      workflow: clone(workflow),
      runtimeContext,
    };
    const { response } = await requestFirstSuccess((endpoint) =>
      apiService.post(`${endpoint}${RUN_SUFFIX}`, payload, {
        ...QUIET_REQUEST_CONFIG,
        timeout: 60000,
      })
    );
    return {
      source: "remote",
      endpoint: response?.config?.url,
      data: response?.data,
    };
  },

  async testNode(workflow, node, runtimeContext = {}) {
    if (shouldUseLocalOnlyMode()) {
      throw new Error("WhatsApp workflow remote node test disabled in local-only mode");
    }
    const payload = {
      workflowId: workflow?.id,
      workflow: clone(workflow),
      nodeId: node?.id,
      node: clone(node),
      runtimeContext,
    };
    const { response } = await requestFirstSuccess((endpoint) =>
      apiService.post(`${endpoint}${TEST_NODE_SUFFIX}`, payload, {
        ...QUIET_REQUEST_CONFIG,
        timeout: 30000,
      })
    );
    return {
      source: "remote",
      endpoint: response?.config?.url,
      data: response?.data,
    };
  },
};

export default whatsappWorkflowService;
