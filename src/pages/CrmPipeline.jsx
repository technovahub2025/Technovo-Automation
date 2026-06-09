import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  BadgeDollarSign,
  BadgeCheck,
  Check,
  CalendarClock,
  Download,
  GripVertical,
  Flame,
  MoreVertical,
  RotateCcw,
  Settings,
  Save,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  Upload,
  UserRound,
  Target,
  X
} from "lucide-react";
import { crmService } from "../services/crmService";
import { resolveCacheUserId } from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmMetricCard from "../components/crm/CrmMetricCard";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import CrmEmptyState from "../components/crm/CrmEmptyState";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import useCrmDebouncedValue from "../hooks/useCrmDebouncedValue";
import { crmLeadPageCache } from "../utils/crm/lruCache";
import {
  DEFAULT_PIPELINE_STAGE_OPTIONS,
  normalizePipelineStageOption,
  getPipelineStageLabel
} from "../utils/crmPipelineStages";
import "./CrmWorkspace.css";

const DEFAULT_LEAD_STAGE_ORDER = DEFAULT_PIPELINE_STAGE_OPTIONS.map((stage) => ({
  key: stage.key,
  label: String(stage.label || "").trim() || "New Lead",
  color: stage.color,
  order: stage.order
}));

const CONTACT_STATUS_OPTIONS = [
  { key: "all", label: "All Lead Statuses" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "nurturing", label: "Nurturing" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const CONTACT_QUEUE_OPTIONS = [
  { key: "all", label: "All Lead Queues" },
  { key: "my_leads", label: "My Lead Queue" },
  { key: "unassigned", label: "Unassigned Leads" },
  { key: "overdue_followups", label: "Overdue Follow-up Queue" },
  { key: "due_today", label: "Due Today" },
  { key: "today_calls", label: "Today's Calls" },
  { key: "high_score", label: "High-Priority Leads" },
  { key: "needs_reply", label: "Awaiting Reply" },
  { key: "opted_in", label: "Consent Opted-In" }
];

const LEADS_SCROLL_PAGE_SIZE = 50;

const LEAD_SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" }
];

const LEAD_ARCHIVE_OPTIONS = [
  { key: "active", label: "Active leads" },
  { key: "archived", label: "Archived leads" },
  { key: "all", label: "All leads" }
];

const DEFAULT_STAGE_COLORS = {
  new: "#5f8fc3",
  contacted: "#4a8bbd",
  nurturing: "#6f7bd0",
  qualified: "#4f9d6c",
  proposal: "#d18a3a",
  won: "#1d9b5e",
  lost: "#c45a5a"
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildExcelBlob = ({ title, subtitle, headers = [], rows = [] } = {}) => {
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}
        </tr>
      `
    )
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #0f2440; }
        .meta { margin-bottom: 14px; }
        .meta h1 { font-size: 18px; margin: 0 0 6px; }
        .meta p { margin: 0; color: #48617d; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="meta">
        <h1>${escapeHtml(title || "CRM Leads Export")}</h1>
        <p>${escapeHtml(subtitle || "")}</p>
      </div>
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `;

  return new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const normalizeSortOrder = (value) =>
  LEAD_SORT_OPTIONS.some((option) => option.key === String(value || "").trim().toLowerCase())
    ? String(value || "").trim().toLowerCase()
    : "newest";

const normalizeArchiveFilter = (value) =>
  LEAD_ARCHIVE_OPTIONS.some((option) => option.key === String(value || "").trim().toLowerCase())
    ? String(value || "").trim().toLowerCase()
    : "active";

const normalizeContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  email: String(contact?.email || "").trim(),
  tags: Array.isArray(contact?.tags) ? contact.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [],
  stage: String(contact?.stage || "").trim().toLowerCase() || "new",
  status: String(contact?.status || "").trim().toLowerCase() || "new",
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  ownerId: String(contact?.ownerId || "").trim(),
  source: String(contact?.source || "").trim(),
  temperature: String(contact?.temperature || "").trim(),
  nextFollowUpAt: String(contact?.nextFollowUpAt || "").trim(),
  lastContact: String(contact?.lastContact || "").trim(),
  archivedAt: String(contact?.archivedAt || "").trim(),
  archivedBy: String(contact?.archivedBy || "").trim(),
  dealValue:
    Number.isFinite(Number(contact?.dealValue)) && Number(contact?.dealValue) >= 0
      ? Number(contact.dealValue)
      : 0,
  notes: String(contact?.notes || "").trim()
});

const normalizeLeadPresetFilters = (filters = {}) => ({
  search: String(filters?.search || "").trim(),
  queue: CONTACT_QUEUE_OPTIONS.some((option) => option.key === String(filters?.queue || "").trim())
    ? String(filters.queue).trim()
    : "all",
  status: CONTACT_STATUS_OPTIONS.some((option) => option.key === String(filters?.status || "").trim())
    ? String(filters.status).trim()
    : "all",
  owner:
    String(filters?.owner || "").trim().toLowerCase() === "unassigned"
      ? "all"
      : String(filters?.owner || "").trim() || "all",
  sortOrder: normalizeSortOrder(filters?.sortOrder),
  archive: normalizeArchiveFilter(filters?.archive)
});

const normalizeLeadFilterPreset = (view = {}) => ({
  id: String(view?.id || view?._id || "").trim(),
  label: String(view?.label || "").trim(),
  filters: normalizeLeadPresetFilters(view?.filters || {}),
  createdAt: view?.createdAt || null,
  updatedAt: view?.updatedAt || null
});

const normalizePipelineStage = (stage = {}, index = 0) => {
  const normalized = normalizePipelineStageOption(stage, index);
  return {
    id: String(stage?.id || stage?._id || "").trim(),
    ...normalized,
    color:
      String(stage?.color || "").trim() ||
      normalized.color ||
      DEFAULT_STAGE_COLORS[normalized.key] ||
      "#5f8fc3",
    createdAt: stage?.createdAt || null,
    updatedAt: stage?.updatedAt || null
  };
};

const getStatusBadgeClass = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "won") return "status-won";
  if (normalized === "lost" || normalized === "unqualified") return "status-lost";
  if (normalized === "qualified") return "status-qualified";
  return "status-open";
};

const formatLeadStatusLabel = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  const matchedStage = DEFAULT_LEAD_STAGE_ORDER.find((item) => item.key === normalized);
  if (matchedStage) return matchedStage.label;
  return getPipelineStageLabel(normalized, DEFAULT_LEAD_STAGE_ORDER);
};

const moveArrayItem = (items = [], fromIndex = -1, toIndex = -1) => {
  if (!Array.isArray(items)) return [];
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return [...items];
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (!movedItem) return nextItems;

  const boundedIndex = Math.max(0, Math.min(toIndex, nextItems.length));
  nextItems.splice(boundedIndex, 0, movedItem);
  return nextItems;
};

const reorderStagesByDrop = (items = [], sourceId = "", targetId = "") => {
  const sourceIndex = items.findIndex((stage) => stage.id === sourceId);
  const targetIndex = items.findIndex((stage) => stage.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return Array.isArray(items) ? [...items] : [];
  }

  const nextItems = moveArrayItem(items, sourceIndex, sourceIndex < targetIndex ? targetIndex - 1 : targetIndex);
  return nextItems.map((stage, index) => ({ ...stage, order: index }));
};

const reorderStagesByIndex = (items = [], sourceId = "", targetIndex = -1) => {
  const sourceIndex = items.findIndex((stage) => stage.id === sourceId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return Array.isArray(items) ? [...items] : [];
  }

  const nextItems = moveArrayItem(items, sourceIndex, targetIndex);
  return nextItems.map((stage, index) => ({ ...stage, order: index }));
};

const CrmPipeline = () => {
  const [contacts, setContacts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingStage, setSavingStage] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [totalContacts, setTotalContacts] = useState(0);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMoreLeads, setHasMoreLeads] = useState(false);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [filterPresets, setFilterPresets] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDraft, setFilterDraft] = useState({
    queue: "all",
    status: "all",
    owner: "all",
    sortOrder: "newest",
    archive: "active"
  });
  const [openActionMenuId, setOpenActionMenuId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [leadStages, setLeadStages] = useState(DEFAULT_LEAD_STAGE_ORDER);
  const [pipelineStagesAvailable, setPipelineStagesAvailable] = useState(true);
  const [newStageLabel, setNewStageLabel] = useState("");
  const [newStageColor, setNewStageColor] = useState("#5f8fc3");
  const [stageDrafts, setStageDrafts] = useState({});
  const [stageDeleteTarget, setStageDeleteTarget] = useState(null);
  const [draggingStageId, setDraggingStageId] = useState("");
  const [dropTargetStageId, setDropTargetStageId] = useState("");
  const [stageDropIndex, setStageDropIndex] = useState(null);
  const currentUserId = resolveCacheUserId();
  const debouncedSearchQuery = useCrmDebouncedValue(searchQuery, 300);
  const hasInitializedFiltersRef = useRef(false);
  const workspaceLoadRequestIdRef = useRef(0);
  const searchInputRef = useRef(null);
  const pipelineStagesEnabled = pipelineStagesAvailable;

  const stageOptions = useMemo(
    () =>
      (Array.isArray(leadStages) && leadStages.length ? leadStages : DEFAULT_LEAD_STAGE_ORDER).map(
        (stage, index) => normalizePipelineStage(stage, index)
      ),
    [leadStages]
  );
  const stageKeySet = useMemo(() => new Set(stageOptions.map((stage) => stage.key)), [stageOptions]);
  const normalizeLeadStage = useCallback(
    (stage) => {
      const normalized = String(stage || "").trim().toLowerCase();
      return stageKeySet.has(normalized) ? normalized : stageOptions[0]?.key || "new";
    },
    [stageKeySet, stageOptions]
  );

  const openPipelineSettings = useCallback(() => {
    setShowPipelineSettings(true);
  }, []);

  const closePipelineSettings = useCallback(() => {
    setShowPipelineSettings(false);
    setStageDeleteTarget(null);
    setDraggingStageId("");
    setDropTargetStageId("");
    setStageDropIndex(null);
  }, []);

  const searchForRequest = debouncedSearchQuery;

  const loadWorkspace = useCallback(
    async ({ silent = false, append = false, cursor = "" } = {}) => {
      const requestId = ++workspaceLoadRequestIdRef.current;
      try {
        if (append) setLoadingMoreLeads(true);
        else if (!silent) setLoading(true);
        setError("");
        if (!append) {
          setSelectedLeadIds([]);
          setSelectionMode(false);
        }

        const [metricsResult, stagesResult, presetsResult] = await Promise.all([
          crmService.getMetrics(),
          crmService.getPipelineStages(),
          crmService.getFilterPresets()
        ]);
        if (requestId !== workspaceLoadRequestIdRef.current) return;

        if (metricsResult?.success === false) {
          throw new Error(metricsResult?.error || "Failed to load CRM metrics");
        }
        if (stagesResult?.success === false) {
          throw new Error(stagesResult?.error || "Failed to load lead stages");
        }
        if (presetsResult?.success === false) {
          throw new Error(presetsResult?.error || "Failed to load filter presets");
        }

        const nextPipelineStagesAvailable = stagesResult?.data?.apiAvailable !== false;
        const nextFilterPresets = Array.isArray(presetsResult?.data)
          ? presetsResult.data.map(normalizeLeadFilterPreset)
          : [];
        const nextMetrics = metricsResult?.data || null;
        const nextStages = Array.isArray(stagesResult?.data?.stages) && stagesResult.data.stages.length
          ? stagesResult.data.stages.map(normalizePipelineStage)
          : DEFAULT_LEAD_STAGE_ORDER.map((stage, index) => normalizePipelineStage(stage, index));
        const effectiveFilters = {
          search: String(searchForRequest || "").trim(),
          queue: String(queueFilter || "all").trim(),
          status: String(statusFilter || "all").trim(),
          owner: String(ownerFilter || "all").trim(),
          archive: normalizeArchiveFilter(archiveFilter)
        };

        const contactParams = {
          limit: LEADS_SCROLL_PAGE_SIZE,
          sortOrder,
          cursorMode: "true",
          cursor: cursor || undefined,
          fields: "list",
          search: effectiveFilters.search || undefined,
          queue: effectiveFilters.queue !== "all" ? effectiveFilters.queue : undefined,
          status: effectiveFilters.status !== "all" ? effectiveFilters.status : undefined,
          ownerId: effectiveFilters.owner !== "all" ? effectiveFilters.owner : undefined,
          archive: effectiveFilters.archive !== "active" ? effectiveFilters.archive : undefined
        };
        const cacheKey = JSON.stringify(contactParams);
        const cachedContactsResult = !append && !silent ? crmLeadPageCache.get(cacheKey) : null;
        const contactsResult = cachedContactsResult || await crmService.getContacts(contactParams);
        if (requestId !== workspaceLoadRequestIdRef.current) return;
        if (!append && !silent && contactsResult?.success !== false) {
          crmLeadPageCache.set(cacheKey, contactsResult);
        }

        if (contactsResult?.success === false) {
          throw new Error(contactsResult?.error || "Failed to load leads");
        }

        const nextContacts = Array.isArray(contactsResult?.data)
          ? contactsResult.data.map(normalizeContact)
          : [];

        setPipelineStagesAvailable(nextPipelineStagesAvailable);
        setFilterPresets(nextFilterPresets);
        setLeadStages(nextStages);
        setStageDrafts((previous) => {
          const nextDrafts = {};
          nextStages.forEach((stage) => {
            nextDrafts[stage.id || stage.key] = {
              label: stage.label,
              color: stage.color || DEFAULT_STAGE_COLORS[stage.key] || "#5f8fc3"
            };
          });
          return nextDrafts;
        });
        setMetrics(nextMetrics);
        setContacts((previous) => {
          if (!append) return nextContacts;
          const existingIds = new Set(previous.map(getEntityId));
          const merged = [...previous];
          nextContacts.forEach((contact) => {
            const contactId = getEntityId(contact);
            if (!contactId || existingIds.has(contactId)) return;
            existingIds.add(contactId);
            merged.push(contact);
          });
          return merged;
        });
        const nextPagination = contactsResult?.pagination || {};
        const nextTotal = Number(nextPagination.total || contactsResult?.total || nextContacts.length || 0);
        if (requestId !== workspaceLoadRequestIdRef.current) return;
        setTotalContacts(nextTotal);
        setNextCursor(String(contactsResult?.nextCursor || ""));
        setHasMoreLeads(Boolean(contactsResult?.hasMore));
      } catch (loadError) {
        if (requestId !== workspaceLoadRequestIdRef.current) return;
        setError(loadError?.message || "Failed to load CRM leads");
      } finally {
        if (requestId !== workspaceLoadRequestIdRef.current) return;
        setLoading(false);
        setLoadingMoreLeads(false);
      }
    },
    [
      ownerFilter,
      archiveFilter,
      queueFilter,
      searchForRequest,
      sortOrder,
      statusFilter
    ]
  );

  const crmRealtime = useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: () => loadWorkspace({ silent: true })
  });

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!hasInitializedFiltersRef.current) {
      hasInitializedFiltersRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      loadWorkspace({ silent: true });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [loadWorkspace, archiveFilter, ownerFilter, queueFilter, searchQuery, sortOrder, statusFilter]);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showPipelineSettings) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closePipelineSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePipelineSettings, showPipelineSettings]);

  useEffect(() => {
    if (!showFilters && !openActionMenuId) return undefined;

    const handlePointerDown = (event) => {
      if (openActionMenuId && !event.target.closest(".crm-row-menu")) {
        setOpenActionMenuId("");
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowFilters(false);
        setOpenActionMenuId("");
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tagName = String(document.activeElement?.tagName || "").toLowerCase();
        if (!["input", "textarea", "select"].includes(tagName)) {
          event.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionMenuId, showFilters]);

  const visibleContacts = useMemo(() => {
    return contacts;
  }, [contacts]);

  const ownerOptions = useMemo(() => {
    const options = new Map();
    options.set("all", "All Owners");

    visibleContacts.forEach((contact) => {
      const ownerId = String(contact?.ownerId || "").trim();
      if (ownerId) {
        options.set(ownerId, ownerId);
      }
    });

    if (ownerFilter !== "all" && !options.has(ownerFilter)) {
      options.set(ownerFilter, ownerFilter);
    }

    return Array.from(options.entries()).map(([key, label]) => ({ key, label }));
  }, [ownerFilter, visibleContacts]);

  const activeFilterCount = useMemo(
    () =>
      [
        queueFilter !== "all",
        statusFilter !== "all",
        ownerFilter !== "all",
        sortOrder !== "newest",
        archiveFilter !== "active"
      ].filter(Boolean).length,
    [archiveFilter, ownerFilter, queueFilter, sortOrder, statusFilter]
  );

  const openFilters = useCallback(() => {
    setFilterDraft({
      queue: queueFilter,
      status: statusFilter,
      owner: ownerFilter,
      sortOrder,
      archive: archiveFilter
    });
    setShowFilters((previous) => !previous);
  }, [archiveFilter, ownerFilter, queueFilter, sortOrder, statusFilter]);

  const applyFilters = useCallback(() => {
    const nextFilters = {
      queue: filterDraft.queue || "all",
      status: filterDraft.status || "all",
      owner: filterDraft.owner || "all",
      sortOrder: normalizeSortOrder(filterDraft.sortOrder),
      archive: normalizeArchiveFilter(filterDraft.archive)
    };
    setFilterDraft(nextFilters);
    setQueueFilter(nextFilters.queue);
    setStatusFilter(nextFilters.status);
    setOwnerFilter(nextFilters.owner);
    setSortOrder(nextFilters.sortOrder);
    setArchiveFilter(nextFilters.archive);
    setContacts([]);
    setNextCursor("");
    setSelectedLeadIds([]);
    setSelectionMode(false);
    setShowFilters(false);
  }, [filterDraft]);

  const applyFilterChange = useCallback(
    (patch) => {
      const nextFilters = {
        queue: patch.queue ?? filterDraft.queue ?? "all",
        status: patch.status ?? filterDraft.status ?? "all",
        owner: patch.owner ?? filterDraft.owner ?? "all",
        sortOrder: normalizeSortOrder(patch.sortOrder ?? filterDraft.sortOrder),
        archive: normalizeArchiveFilter(patch.archive ?? filterDraft.archive)
      };
      setFilterDraft(nextFilters);
      setQueueFilter(nextFilters.queue);
      setStatusFilter(nextFilters.status);
      setOwnerFilter(nextFilters.owner);
      setSortOrder(nextFilters.sortOrder);
      setArchiveFilter(nextFilters.archive);
      setContacts([]);
      setNextCursor("");
      setSelectedLeadIds([]);
      setSelectionMode(false);
    },
    [filterDraft]
  );

  const clearFilters = useCallback(() => {
    const nextDraft = {
      queue: "all",
      status: "all",
      owner: "all",
      sortOrder: "newest",
      archive: "active"
    };
    setFilterDraft(nextDraft);
    setQueueFilter(nextDraft.queue);
    setStatusFilter(nextDraft.status);
    setOwnerFilter(nextDraft.owner);
    setSortOrder(nextDraft.sortOrder);
    setArchiveFilter(nextDraft.archive);
    setContacts([]);
    setNextCursor("");
    setSelectedLeadIds([]);
    setSelectionMode(false);
    setShowFilters(false);
  }, []);

  const loadMoreLeads = useCallback(() => {
    if (loadingMoreLeads || !hasMoreLeads || !nextCursor) return;
    loadWorkspace({ silent: true, append: true, cursor: nextCursor });
  }, [hasMoreLeads, loadWorkspace, loadingMoreLeads, nextCursor]);

  const clearLeadSelection = useCallback(() => {
    setSelectedLeadIds([]);
    setSelectionMode(false);
  }, []);

  const selectedLeadIdSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const selectedLeads = useMemo(
    () => visibleContacts.filter((contact) => selectedLeadIdSet.has(getEntityId(contact))),
    [selectedLeadIdSet, visibleContacts]
  );
  const selectedLeadTags = useMemo(() => {
    const tagSet = new Set();
    selectedLeads.forEach((contact) => {
      (Array.isArray(contact?.tags) ? contact.tags : []).forEach((tag) => {
        const normalizedTag = String(tag || "").trim();
        if (normalizedTag) tagSet.add(normalizedTag);
      });
    });
    return Array.from(tagSet);
  }, [selectedLeads]);
  const bulkArchiveAction = archiveFilter === "archived" ? "unarchive" : "archive";
  const bulkArchiveLabel = bulkArchiveAction === "unarchive" ? "Unarchive" : "Archive";
  const allLoadedLeadsSelected =
    visibleContacts.length > 0 && visibleContacts.every((contact) => selectedLeadIdSet.has(getEntityId(contact)));
  const showLeadSelection = selectionMode || selectedLeadIds.length > 0;

  const toggleLeadSelection = useCallback((contactId) => {
    const normalizedId = String(contactId || "").trim();
    if (!normalizedId) return;
    setSelectedLeadIds((previous) => {
      const next = previous.includes(normalizedId)
        ? previous.filter((item) => item !== normalizedId)
        : [...previous, normalizedId];
      setSelectionMode(next.length > 0);
      return next;
    });
  }, []);

  const selectAllLoadedLeads = useCallback(() => {
    const visibleIds = visibleContacts.map(getEntityId).filter(Boolean);
    if (!visibleIds.length) return;
    setSelectionMode(true);
    setSelectedLeadIds((previous) => {
      const previousSet = new Set(previous);
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => previousSet.has(id));
      if (everySelected) {
        const next = previous.filter((id) => !visibleIds.includes(id));
        if (!next.length) setSelectionMode(false);
        return next;
      }
      visibleIds.forEach((id) => previousSet.add(id));
      return Array.from(previousSet);
    });
  }, [visibleContacts]);

  const runBulkContactAction = useCallback(
    async (action, payload = {}) => {
      if (!selectedLeadIds.length) return;
      if (action === "delete") {
        const confirmed = window.confirm(`Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? "" : "s"} permanently?`);
        if (!confirmed) return;
      }
      setBulkBusy(true);
      const previousContacts = contacts;
      try {
        if (action === "assign") {
          const nextOwner = String(payload.ownerId || "").trim();
          setContacts((items) =>
            items.map((contact) =>
              selectedLeadIdSet.has(getEntityId(contact)) ? { ...contact, ownerId: nextOwner } : contact
            )
          );
        } else if (action === "archive" || action === "delete") {
          setContacts((items) => items.filter((contact) => !selectedLeadIdSet.has(getEntityId(contact))));
        } else if (action === "unarchive") {
          setContacts((items) =>
            archiveFilter === "archived"
              ? items.filter((contact) => !selectedLeadIdSet.has(getEntityId(contact)))
              : items.map((contact) =>
                  selectedLeadIdSet.has(getEntityId(contact)) ? { ...contact, archivedAt: "", archivedBy: "" } : contact
                )
          );
        }

        const result = await crmService.bulkUpdateContacts({
          action,
          contactIds: selectedLeadIds,
          ...payload
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Bulk action failed");
        }
        if (action === "export") {
          const rows = Array.isArray(result?.data?.contacts) ? result.data.contacts : selectedLeads;
          const header = ["Name", "Phone", "Email", "Stage", "Status", "Owner", "Lead Score"];
          const csvRows = [
            header,
            ...rows.map((contact) => [
              contact?.name || "",
              contact?.phone || "",
              contact?.email || "",
              contact?.stage || "",
              contact?.status || "",
              contact?.ownerId || "",
              contact?.leadScore || 0
            ])
          ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
          const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "crm-leads-export.csv";
          link.click();
          URL.revokeObjectURL(url);
        }
        setSelectedLeadIds([]);
        setSelectionMode(false);
        setBulkTagDraft("");
        setBulkOwnerId("");
        const actionCount = result?.data?.count || selectedLeadIds.length;
        const toastMessage =
          action === "delete"
            ? `Deleted ${actionCount} lead(s).`
            : action === "archive"
              ? `Archived ${actionCount} lead(s).`
              : action === "unarchive"
                ? `Unarchived ${actionCount} lead(s).`
                : action === "add_tags"
                  ? `Added tag to ${actionCount} lead(s).`
                  : action === "remove_tags"
                    ? `Removed tag from ${actionCount} lead(s).`
                    : `Updated ${actionCount} lead(s).`;
        setToast({ type: "success", message: toastMessage });
        loadWorkspace({ silent: true });
      } catch (bulkError) {
        setContacts(previousContacts);
        setToast({ type: "error", message: bulkError?.message || "Bulk action failed" });
      } finally {
        setBulkBusy(false);
      }
    },
    [archiveFilter, contacts, loadWorkspace, selectedLeadIdSet, selectedLeadIds, selectedLeads]
  );

  const updateLeadArchiveFromRow = useCallback(
    async (contact, action) => {
      const contactId = getEntityId(contact);
      if (!contactId || !["archive", "unarchive"].includes(action)) return;
      const previousContacts = contacts;
      setOpenActionMenuId("");
      setContacts((items) => {
        if (action === "archive") {
          return items.filter((item) => getEntityId(item) !== contactId);
        }
        if (archiveFilter === "archived") {
          return items.filter((item) => getEntityId(item) !== contactId);
        }
        return items.map((item) =>
          getEntityId(item) === contactId ? { ...item, archivedAt: "", archivedBy: "" } : item
        );
      });
      try {
        const result = await crmService.bulkUpdateContacts({
          action,
          contactIds: [contactId]
        });
        if (result?.success === false) {
          throw new Error(result?.error || `Failed to ${action} lead`);
        }
        setToast({ type: "success", message: action === "archive" ? "Lead archived." : "Lead unarchived." });
        loadWorkspace({ silent: true });
      } catch (archiveError) {
        setContacts(previousContacts);
        setToast({ type: "error", message: archiveError?.message || `Failed to ${action} lead` });
      }
    },
    [archiveFilter, contacts, loadWorkspace]
  );

  const deleteLeadFromRow = useCallback(
    async (contact) => {
      const contactId = getEntityId(contact);
      if (!contactId) return;
      const confirmed = window.confirm(`Delete ${contact?.name || "this lead"} permanently?`);
      if (!confirmed) return;
      const previousContacts = contacts;
      setOpenActionMenuId("");
      setContacts((items) => items.filter((item) => getEntityId(item) !== contactId));
      setSelectedLeadIds((previous) => {
        const next = previous.filter((id) => id !== contactId);
        if (!next.length) setSelectionMode(false);
        return next;
      });
      try {
        const result = await crmService.bulkUpdateContacts({
          action: "delete",
          contactIds: [contactId]
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete lead");
        }
        setToast({ type: "success", message: "Lead deleted." });
        loadWorkspace({ silent: true });
      } catch (deleteError) {
        setContacts(previousContacts);
        setToast({ type: "error", message: deleteError?.message || "Failed to delete lead" });
      }
    },
    [contacts, loadWorkspace]
  );

  const visibleLeadValue = useMemo(
    () => visibleContacts.reduce((sum, contact) => sum + (Number(contact?.dealValue) || 0), 0),
    [visibleContacts]
  );

  const activeViewLabel = useMemo(() => {
    const activePreset = filterPresets.find((preset) => {
      const filters = normalizeLeadPresetFilters(preset?.filters || {});
      return (
        filters.search === String(searchQuery || "").trim() &&
        filters.queue === queueFilter &&
        filters.status === statusFilter &&
        filters.owner === ownerFilter &&
        filters.sortOrder === sortOrder &&
        filters.archive === archiveFilter
      );
    });
    return activePreset?.label || "Lead view";
  }, [archiveFilter, filterPresets, ownerFilter, queueFilter, searchQuery, sortOrder, statusFilter]);

  const handleExportExcel = useCallback(async () => {
    if (exportBusy) return;

    setExportBusy(true);
    try {
      const exportFilters = {
        limit: LEADS_SCROLL_PAGE_SIZE,
        sortOrder,
        cursorMode: "true",
        search: String(searchQuery || "").trim() || undefined,
        queue: queueFilter !== "all" ? queueFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        ownerId: ownerFilter !== "all" ? ownerFilter : undefined,
        archive: archiveFilter !== "active" ? archiveFilter : undefined
      };

      const exportedContacts = [];
      let cursor = "";
      let hasMore = true;

      while (hasMore) {
        const response = await crmService.getContacts({
          ...exportFilters,
          cursor: cursor || undefined
        });

        if (response?.success === false) {
          throw new Error(response?.error || "Failed to export CRM leads");
        }

        const batch = Array.isArray(response?.data) ? response.data.map(normalizeContact) : [];
        exportedContacts.push(...batch);
        hasMore = Boolean(response?.hasMore);
        cursor = String(response?.nextCursor || "").trim();
        if (!cursor) break;
      }

      const rowsSource = exportedContacts.length ? exportedContacts : visibleContacts;
      const exportRows = rowsSource.map((contact, index) => [
        index + 1,
        contact?.name || "Untitled Lead",
        contact?.phone || "-",
        contact?.email || "-",
        formatLeadStatusLabel(contact?.status || contact?.stage || "new"),
        getPipelineStageLabel(normalizeLeadStage(contact?.stage), stageOptions),
        Number.isFinite(Number(contact?.leadScore)) ? Number(contact.leadScore) : 0,
        formatCurrency(contact?.dealValue),
        contact?.ownerId || "Unassigned",
        contact?.source || "-",
        formatDateTime(contact?.nextFollowUpAt),
        formatDateTime(contact?.lastContact),
        Array.isArray(contact?.tags) && contact.tags.length ? contact.tags.join(", ") : "-",
        contact?.notes || "-"
      ]);

      const blob = buildExcelBlob({
        title: "CRM Leads Export",
        subtitle: `Filters: ${[
          `Search=${String(searchQuery || "").trim() || "All"}`,
          `Queue=${queueFilter}`,
          `Status=${statusFilter}`,
          `Owner=${ownerFilter}`,
          `Archive=${archiveFilter}`,
          `Sort=${sortOrder}`
        ].join(" | ")}`,
        headers: [
          "Sl No",
          "Name",
          "Phone",
          "Email",
          "Status",
          "Stage",
          "Lead Score",
          "Lead Value",
          "Owner",
          "Source",
          "Next Follow-up",
          "Last Contact",
          "Tags",
          "Notes"
        ],
        rows: exportRows
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const datePart = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `crm_leads_export_${datePart}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast({ type: "success", message: `Exported ${exportRows.length} lead(s) to Excel.` });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "Failed to export CRM leads" });
    } finally {
      setExportBusy(false);
    }
  }, [
    archiveFilter,
    exportBusy,
    ownerFilter,
    queueFilter,
    searchQuery,
    sortOrder,
    stageOptions,
    statusFilter,
    visibleContacts,
    normalizeLeadStage
  ]);

  const persistContactStage = useCallback(
    async (contact, nextStage) => {
      const contactId = getEntityId(contact);
      if (!contactId) return;

      const stageIndex = stageOptions.findIndex((item) => item.key === normalizeLeadStage(nextStage));
      if (stageIndex < 0) return;

      try {
        setError("");
        const result = await crmService.updateContactStage(contactId, stageOptions[stageIndex].key);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update lead stage");
        }
        setToast({
          type: "success",
          message: `${contact?.name || "Lead"} moved to ${stageOptions[stageIndex].label}.`
        });
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        setToast({
          type: "error",
          message: stageError?.message || "Failed to update lead stage"
        });
      }
    },
    [loadWorkspace, normalizeLeadStage, stageOptions]
  );

  const moveContactStage = useCallback(
    async (contact, direction) => {
      const currentStage = normalizeLeadStage(contact?.stage);
      const currentIndex = stageOptions.findIndex((item) => item.key === currentStage);
      if (currentIndex < 0) return;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= stageOptions.length) return;

      await persistContactStage(contact, stageOptions[nextIndex].key);
    },
    [persistContactStage, normalizeLeadStage, stageOptions]
  );

  const handleCreateStage = useCallback(async () => {
    const label = String(newStageLabel || "").trim();
    if (!label) {
      setToast({ type: "error", message: "Please enter a stage name first." });
      return;
    }

    try {
      setSavingStage(true);
      setError("");
      const result = await crmService.createPipelineStage({
        label,
        color: String(newStageColor || "").trim() || "#5f8fc3"
      });
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to create lead stage");
      }

      setToast({ type: "success", message: `Lead stage "${label}" created.` });
      setNewStageLabel("");
      setNewStageColor("#5f8fc3");
      await loadWorkspace({ silent: true });
    } catch (stageError) {
      setToast({
        type: "error",
        message: stageError?.message || "Failed to create lead stage"
      });
    } finally {
      setSavingStage(false);
    }
  }, [loadWorkspace, newStageColor, newStageLabel]);

  const handleSaveStage = useCallback(
    async (stage) => {
      const stageId = String(stage?.id || "").trim();
      if (!stageId) return;
      const draft = stageDrafts[stageId] || {};
      const nextLabel = String(draft.label || stage.label || "").trim();
      const nextColor = String(draft.color || stage.color || "").trim() || "#5f8fc3";

      if (!nextLabel) {
        setToast({ type: "error", message: "Stage name is required." });
        return;
      }

      try {
        setSavingStage(true);
        setError("");
        const result = await crmService.updatePipelineStage(stageId, {
          label: nextLabel,
          color: nextColor
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update lead stage");
        }

        setToast({ type: "success", message: `Lead stage "${nextLabel}" updated.` });
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        setToast({
          type: "error",
          message: stageError?.message || "Failed to update lead stage"
        });
      } finally {
        setSavingStage(false);
      }
    },
    [loadWorkspace, stageDrafts]
  );

  const persistStageOrder = useCallback(
    async (orderedStages) => {
      const stageIds = Array.isArray(orderedStages)
        ? orderedStages.map((stage) => String(stage?.id || "").trim()).filter(Boolean)
        : [];

      if (stageIds.length <= 1) return;

      try {
        setSavingStage(true);
        setError("");
        const result = await crmService.reorderPipelineStages(stageIds);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to reorder lead stages");
        }

        setToast({
          type: "success",
          message: "Lead stages reordered."
        });
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        setToast({
          type: "error",
          message: stageError?.message || "Failed to reorder lead stages"
        });
      } finally {
        setSavingStage(false);
      }
    },
    [loadWorkspace]
  );

  const moveStageByOffset = useCallback(
    async (stageId, offset) => {
      const currentIndex = stageOptions.findIndex((stage) => stage.id === stageId);
      if (currentIndex < 0) return;
      const targetIndex = currentIndex + offset;
      if (targetIndex < 0 || targetIndex >= stageOptions.length) return;

      const nextStages = moveArrayItem(stageOptions, currentIndex, targetIndex).map((stage, index) => ({
        ...stage,
        order: index
      }));
      await persistStageOrder(nextStages);
    },
    [persistStageOrder, stageOptions]
  );

  const handleStageDragStart = useCallback((event, stageId) => {
    if (!stageId) return;
    setDraggingStageId(stageId);
    setDropTargetStageId(stageId);
    setStageDropIndex(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stageId);
    event.dataTransfer.setData("application/x-crm-stage-id", stageId);
  }, []);

  const handleStageDragOver = useCallback(
    (event, stageId, stageIndex) => {
      if (!pipelineStagesEnabled || savingStage || !draggingStageId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetStageId(stageId);
      setStageDropIndex(Number.isFinite(Number(stageIndex)) ? Number(stageIndex) : null);
    },
    [draggingStageId, pipelineStagesEnabled, savingStage]
  );

  const handleStageDrop = useCallback(
    async (event, targetStageId, targetIndex) => {
      event.preventDefault();
      if (!pipelineStagesEnabled || savingStage) return;

      const sourceStageId = String(
        event.dataTransfer.getData("application/x-crm-stage-id") ||
          event.dataTransfer.getData("text/plain") ||
          draggingStageId
      ).trim();

      setDraggingStageId("");
      setDropTargetStageId("");
      setStageDropIndex(null);

      if (!sourceStageId || !targetStageId || sourceStageId === targetStageId) {
        return;
      }

      const nextStages = Number.isFinite(Number(targetIndex))
        ? reorderStagesByIndex(stageOptions, sourceStageId, Number(targetIndex))
        : reorderStagesByDrop(stageOptions, sourceStageId, targetStageId);
      await persistStageOrder(nextStages);
    },
    [draggingStageId, persistStageOrder, pipelineStagesEnabled, savingStage, stageOptions]
  );

  const handleStageDragEnd = useCallback(() => {
    setDraggingStageId("");
    setDropTargetStageId("");
    setStageDropIndex(null);
  }, []);

  const handleDeleteStage = useCallback(
    async (stage, fallbackStageId = "", fallbackStageKey = "") => {
      const stageId = String(stage?.id || "").trim();
      if (!stageId) return;

      try {
        setSavingStage(true);
        setError("");
        const result = await crmService.deletePipelineStage(stageId, {
          fallbackStageId,
          fallbackStageKey
        });

        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete lead stage");
        }

        const movedCount = Number(result?.data?.movedContactCount || 0);
        setToast({
          type: "success",
          message:
            movedCount > 0
              ? `Lead stage deleted and ${movedCount} lead${movedCount === 1 ? "" : "s"} moved.`
              : "Lead stage deleted."
        });
        setStageDeleteTarget(null);
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        if (Number(stageError?.response?.status || 0) === 409) {
          const message = stageError?.response?.data?.error || "This stage still has leads.";
          setToast({
            type: "error",
            message
          });
          return;
        }
        setToast({
          type: "error",
          message: stageError?.message || "Failed to delete lead stage"
        });
      } finally {
        setSavingStage(false);
      }
    },
    [loadWorkspace]
  );

  const handleContactUpdated = useCallback((updatedContact) => {
    const normalizedContact = normalizeContact(updatedContact);
    setSelectedContact(normalizedContact);
    setContacts((previous) =>
      previous.map((contact) =>
        getEntityId(contact) === getEntityId(normalizedContact) ? { ...contact, ...normalizedContact } : contact
      )
    );
  }, []);

  const qualifiedCount = Number(metrics?.contacts?.qualified || 0);
  const averageLeadScore = Number(metrics?.contacts?.averageLeadScore || 0);
  const openTaskCount = Number(metrics?.tasks?.open || 0);
  const dueTodayCount = Number(metrics?.tasks?.dueToday || 0);
  const renderLeadRow = useCallback(
    (contact) => {
      const contactId = getEntityId(contact);
      const currentStageIndex = stageOptions.findIndex(
        (item) => item.key === normalizeLeadStage(contact?.stage)
      );
      const currentStage = stageOptions[currentStageIndex] || stageOptions[0] || {};
      const isSelected = selectedLeadIdSet.has(contactId);
      const isArchived = Boolean(contact?.archivedAt);
      const archiveAction = isArchived ? "unarchive" : "archive";

      return (
        <div
          key={contactId}
          className={`crm-pipeline-row ${isSelected ? "crm-pipeline-row--selected" : ""} ${isArchived ? "crm-pipeline-row--archived" : ""}`}
          style={{ "--lead-stage-color": currentStage.color || DEFAULT_STAGE_COLORS[currentStage.key] || "#5f8fc3" }}
        >
          {showLeadSelection ? (
            <label className="crm-lead-select" aria-label={`Select ${contact?.name || "lead"}`}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleLeadSelection(contactId)}
              />
            </label>
          ) : null}
          <div className="crm-pipeline-row__primary">
            <div className="crm-pipeline-row__title">
              <strong>{contact?.name || "Untitled Lead"}</strong>
              <span className={`crm-status-badge ${getStatusBadgeClass(contact?.status)}`}>
                {formatLeadStatusLabel(contact?.status)}
              </span>
              {isArchived ? <span className="crm-archive-badge">Archived</span> : null}
            </div>
            <div className="crm-pipeline-row__meta">
              <span>{contact?.phone ? `Phone: ${contact.phone}` : "Phone: -"}</span>
              <span>{contact?.email ? `Email: ${contact.email}` : "Email: -"}</span>
            </div>
          </div>

          <div className="crm-pipeline-row__stage">
            <span className="crm-pipeline-row__stage-label">Lead stage</span>
            <span className="crm-stage-chip">{currentStage.label || "New"}</span>
            <div className="crm-pipeline-row__meta">
              <span>Next follow-up touch: {formatDate(contact?.nextFollowUpAt)}</span>
            </div>
          </div>

          <div className="crm-pipeline-row__signals">
            <span>Lead score {Number(contact?.leadScore || 0)}</span>
            <span>Lead value {formatCurrency(contact?.dealValue)}</span>
            <span>Lead owner {contact?.ownerId || "Unassigned"}</span>
          </div>

          <div className="crm-pipeline-row__actions">
            <div className="crm-row-menu">
              <button
                type="button"
                className="crm-row-menu__trigger"
                onClick={() =>
                  setOpenActionMenuId((previous) => (previous === contactId ? "" : contactId))
                }
                aria-label={`Open actions for ${contact?.name || "lead"}`}
                aria-expanded={openActionMenuId === contactId}
              >
                <MoreVertical size={17} />
              </button>

              {openActionMenuId === contactId ? (
                <div className="crm-row-menu__panel">
                  <button
                    type="button"
                    className="crm-row-menu__item crm-row-menu__item--primary"
                    onClick={() => {
                      setOpenActionMenuId("");
                      setSelectedContact(contact);
                      setSelectedContactId(contactId);
                    }}
                  >
                    <UserRound size={14} />
                    Open Lead Profile
                  </button>
                  <button
                    type="button"
                    className="crm-row-menu__item"
                    onClick={() => updateLeadArchiveFromRow(contact, archiveAction)}
                  >
                    <Archive size={14} />
                    {isArchived ? "Unarchive Lead" : "Archive Lead"}
                  </button>
                  <button
                    type="button"
                    className="crm-row-menu__item crm-row-menu__item--danger"
                    onClick={() => {
                      deleteLeadFromRow(contact);
                    }}
                    title="Delete this lead permanently"
                    aria-label={`Delete ${contact?.name || "lead"}`}
                  >
                    <Trash2 size={14} />
                    Delete Lead
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    },
    [
      deleteLeadFromRow,
      normalizeLeadStage,
      openActionMenuId,
      selectedLeadIdSet,
      showLeadSelection,
      stageOptions,
      toggleLeadSelection,
      updateLeadArchiveFromRow
    ]
  );

  return (
    <>
      <div className="crm-workspace crm-workspace--pipeline-static">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Leads"
          subtitle="Manage lead flow, lead queues, and saved lead views."
          actions={
            <div className="crm-page-header__action-group">
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => void handleExportExcel()}
                disabled={loading || exportBusy || (!visibleContacts.length && !contacts.length)}
                title="Export the current CRM lead view to Excel"
              >
                <Download size={16} />
                {exportBusy ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={openPipelineSettings}
              >
                <Settings size={16} />
                Leads Settings
              </button>
              <CrmRealtimeStatus status={crmRealtime?.connectionStatus} />
            </div>
          }
        />

        <div className="crm-metric-grid">
          <CrmMetricCard icon={UserRound} value={totalContacts} label="Leads" />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(visibleLeadValue)}
            label="Lead Value"
          />
          <CrmMetricCard icon={BadgeCheck} value={qualifiedCount} label="Qualified Leads" />
          <CrmMetricCard icon={Target} value={averageLeadScore} label="Lead Score Avg" />
          <CrmMetricCard icon={CalendarClock} value={openTaskCount} label="Follow-ups Open" />
          <CrmMetricCard icon={Flame} value={dueTodayCount} label="Due Today" />
        </div>

        {showPipelineSettings ? (
          <div
            className="crm-pipeline-settings-overlay"
            role="presentation"
            onClick={closePipelineSettings}
          >
              <div
              className="crm-pipeline-settings-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Leads Settings"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="crm-pipeline-settings-modal__header">
                <div>
                  <h2 id="crm-pipeline-settings-title">Leads Settings</h2>
                  <p>Manage saved lead views and the lead stage manager from one place.</p>
                </div>
                <button
                  type="button"
                  className="crm-pipeline-settings-modal__close"
                  onClick={closePipelineSettings}
                  aria-label="Close pipeline settings"
                >
                  ×
                </button>
              </div>

              <section className="crm-create-task crm-pipeline-stage-panel" style={{ marginBottom: 0 }}>
                <div className="crm-pipeline-stage-panel__header">
                  <div>
                    <strong>Lead Stage Manager</strong>
                    <span>
                      Create, rename, color-code, reorder, or remove stages. Deleted stages move their leads to a fallback stage.
                    </span>
                  </div>
                  <div className="crm-pipeline-stage-panel__summary">{stageOptions.length} stages</div>
                </div>

                {!pipelineStagesEnabled ? (
                  <div className="crm-alert crm-alert-warning" style={{ marginBottom: 12 }}>
                    Stage management is unavailable in this backend build. Leads will use the built-in stages.
                  </div>
                ) : null}

                <div className="crm-create-task-grid crm-create-task-grid--wide">
                  <input
                    type="text"
                    className="crm-input"
                    placeholder="New stage name"
                    value={newStageLabel}
                    onChange={(event) => setNewStageLabel(event.target.value)}
                    disabled={!pipelineStagesEnabled || savingStage}
                  />
                  <label className="crm-inline-field crm-pipeline-stage-color-field">
                    <span>Color</span>
                    <input
                      type="color"
                      value={newStageColor}
                      onChange={(event) => setNewStageColor(event.target.value)}
                      disabled={!pipelineStagesEnabled || savingStage}
                    />
                  </label>
                  <div className="crm-inline-actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="crm-contact-action-btn"
                      onClick={handleCreateStage}
                      disabled={!pipelineStagesEnabled || savingStage}
                      title={
                        pipelineStagesEnabled
                          ? "Create a new lead stage"
                          : "Stage management is unavailable in this backend build"
                      }
                    >
                      <Save size={14} />
                      {savingStage ? "Adding..." : "Add Stage"}
                    </button>
                  </div>
                </div>

                <p className="crm-stage-manager-hint">
                  Drag the handle to reorder stages. The dashed slots show exactly where a stage will land.
                </p>

                <div className="crm-stage-manager-list">
                  {stageOptions.map((stage, index) => {
                    const draft = stageDrafts[stage.id] || { label: stage.label, color: stage.color };
                    const deleteTarget = stageDeleteTarget && stageDeleteTarget.id === stage.id ? stageDeleteTarget : null;
                    const deleteOptions = stageOptions.filter((option) => option.id !== stage.id);
                    const fallbackStageId = String(deleteTarget?.fallbackStageId || "").trim();
                    const selectedFallbackStage = deleteOptions.find((option) => option.id === fallbackStageId) || null;
                    const stageIndex = stageOptions.findIndex((option) => option.id === stage.id);
                    const isDragging = draggingStageId === stage.id;
                    const showDropSlotBefore = draggingStageId && stageDropIndex === index && draggingStageId !== stage.id;

                    return (
                      <React.Fragment key={stage.id || stage.key}>
                        {showDropSlotBefore ? (
                          <div
                            className="crm-stage-manager-drop-slot crm-stage-manager-drop-slot--active"
                            onDragOver={(event) => handleStageDragOver(event, `slot-${stage.id}`, index)}
                            onDrop={(event) => handleStageDrop(event, stage.id, index)}
                          >
                            <span>Drop here</span>
                          </div>
                        ) : null}

                        <article
                          className={`crm-stage-manager-item ${isDragging ? "crm-stage-manager-item--dragging" : ""} ${
                            dropTargetStageId === stage.id && draggingStageId && draggingStageId !== stage.id
                              ? "crm-stage-manager-item--drop-target"
                              : ""
                          }`}
                          onDragOver={(event) => handleStageDragOver(event, stage.id, index)}
                          onDrop={(event) => handleStageDrop(event, stage.id, index)}
                        >
                          <div className="crm-stage-manager-item__meta">
                            <button
                              type="button"
                              className="crm-stage-manager-drag-handle crm-move-badge crm-move-badge--button"
                              draggable={pipelineStagesEnabled && !savingStage}
                              onDragStart={(event) => handleStageDragStart(event, stage.id)}
                              onDragEnd={handleStageDragEnd}
                              disabled={!pipelineStagesEnabled || savingStage}
                              title="Reorder this stage by dragging"
                              aria-label={`Reorder ${stage.label} by dragging`}
                            >
                              <GripVertical size={15} />
                              <span>Reorder</span>
                            </button>
                            <span
                              className="crm-stage-manager-color"
                              style={{ backgroundColor: stage.color || DEFAULT_STAGE_COLORS[stage.key] || "#5f8fc3" }}
                            />
                            <div>
                              <strong>{stage.label}</strong>
                              <span>{stage.key}</span>
                            </div>
                            <span>{Number(stage.contactCount || 0)} leads</span>
                            <div className="crm-stage-manager-reorder-actions">
                              <button
                                type="button"
                                className="crm-inline-action-btn"
                                onClick={() => moveStageByOffset(stage.id, -1)}
                                disabled={!pipelineStagesEnabled || savingStage || stageIndex <= 0}
                                title="Move stage earlier"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                className="crm-inline-action-btn"
                                onClick={() => moveStageByOffset(stage.id, 1)}
                                disabled={!pipelineStagesEnabled || savingStage || stageIndex >= stageOptions.length - 1}
                                title="Move stage later"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="crm-stage-manager-item__controls">
                            <input
                              type="text"
                              className="crm-input crm-stage-manager-input"
                              value={draft.label}
                              onChange={(event) =>
                                setStageDrafts((previous) => ({
                                  ...previous,
                                  [stage.id || stage.key]: {
                                    ...(previous[stage.id || stage.key] || {}),
                                    label: event.target.value,
                                    color: draft.color || stage.color
                                  }
                                }))
                              }
                              disabled={!pipelineStagesEnabled || savingStage}
                            />
                            <label className="crm-stage-manager-color-input">
                              <span>Color</span>
                              <input
                                type="color"
                                value={draft.color || stage.color || DEFAULT_STAGE_COLORS[stage.key] || "#5f8fc3"}
                                onChange={(event) =>
                                  setStageDrafts((previous) => ({
                                    ...previous,
                                    [stage.id || stage.key]: {
                                      ...(previous[stage.id || stage.key] || {}),
                                      label: draft.label || stage.label,
                                      color: event.target.value
                                    }
                                  }))
                                }
                                disabled={!pipelineStagesEnabled || savingStage}
                              />
                            </label>
                            <button
                              type="button"
                              className="crm-contact-action-btn"
                              onClick={() => handleSaveStage(stage)}
                              disabled={!pipelineStagesEnabled || savingStage}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="crm-contact-action-btn crm-contact-action-btn--danger"
                              onClick={() =>
                                setStageDeleteTarget({
                                  ...stage,
                                  fallbackStageId: deleteTarget?.fallbackStageId || ""
                                })
                              }
                              disabled={!pipelineStagesEnabled || stageOptions.length <= 1 || savingStage}
                            >
                              Delete
                            </button>
                          </div>

                          {deleteTarget ? (
                            <div className="crm-stage-manager-delete">
                              <div className="crm-stage-manager-delete__copy">
                                <strong>Delete "{stage.label}"?</strong>
                                <span>
                                  {Number(stage.contactCount || 0) > 0
                                    ? `Move ${Number(stage.contactCount || 0)} lead${
                                        Number(stage.contactCount || 0) === 1 ? "" : "s"
                                      } before removing this stage.`
                                    : "This stage has no leads, so it can be removed immediately."}
                                </span>
                              </div>
                              <div className="crm-stage-manager-delete__controls">
                                <select
                                  className="crm-select crm-stage-manager-delete__select"
                                  value={fallbackStageId}
                                  onChange={(event) =>
                                    setStageDeleteTarget((previous) =>
                                      previous?.id === stage.id
                                        ? { ...previous, fallbackStageId: event.target.value }
                                        : previous
                                    )
                                  }
                                  disabled={!pipelineStagesEnabled || savingStage || deleteOptions.length === 0}
                                >
                                  <option value="">Choose fallback stage</option>
                                  {deleteOptions.map((option) => (
                                    <option key={option.id || option.key} value={option.id || option.key}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="crm-contact-action-btn crm-contact-action-btn--danger"
                                  onClick={() =>
                                    handleDeleteStage(
                                      stage,
                                      selectedFallbackStage?.id || "",
                                      selectedFallbackStage?.key || ""
                                    )
                                  }
                                  disabled={
                                    savingStage ||
                                    (Number(stage.contactCount || 0) > 0 && !selectedFallbackStage) ||
                                    !pipelineStagesEnabled
                                  }
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  className="crm-contact-action-btn"
                                  onClick={() => setStageDeleteTarget(null)}
                                  disabled={savingStage}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      </React.Fragment>
                    );
                  })}
                  {draggingStageId && stageDropIndex === stageOptions.length ? (
                    <div
                      className="crm-stage-manager-drop-slot crm-stage-manager-drop-slot--end crm-stage-manager-drop-slot--active"
                      onDragOver={(event) => handleStageDragOver(event, "slot-end", stageOptions.length)}
                      onDrop={(event) => handleStageDrop(event, stageOptions[stageOptions.length - 1]?.id || "", stageOptions.length)}
                    >
                      <span>Drop here to move to the end</span>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        <CrmFilterBar>
          <label className="crm-search-input-wrap">
            <Search size={15} />
            <input
              ref={searchInputRef}
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search leads...  /"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setContacts([]);
                setNextCursor("");
                setSelectedLeadIds([]);
                setSelectionMode(false);
              }}
            />
          </label>

          <div className="crm-lead-filter-menu">
            <button
              type="button"
              className={`crm-btn crm-btn-secondary crm-lead-filter-trigger ${showFilters ? "active" : ""}`}
              onClick={openFilters}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={15} />
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>

          {showFilters ? (
            <div className="crm-lead-filter-panel">
              <label className="crm-lead-filter-field">
                <span>Lead queue</span>
                  <select
                    className="crm-select"
                    value={filterDraft.queue}
                    onChange={(event) => applyFilterChange({ queue: event.target.value })}
                  >
                  {CONTACT_QUEUE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-lead-filter-field">
                <span>Lead status</span>
                  <select
                    className="crm-select"
                    value={filterDraft.status}
                    onChange={(event) => applyFilterChange({ status: event.target.value })}
                  >
                  {CONTACT_STATUS_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-lead-filter-field">
                <span>Owner</span>
                  <select
                    className="crm-select"
                    value={filterDraft.owner}
                    onChange={(event) => applyFilterChange({ owner: event.target.value })}
                  >
                  {ownerOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-lead-filter-field">
                <span>Sort order</span>
                  <select
                    className="crm-select"
                    value={filterDraft.sortOrder}
                    onChange={(event) => applyFilterChange({ sortOrder: event.target.value })}
                  >
                  {LEAD_SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-lead-filter-field">
                <span>Archive</span>
                  <select
                    className="crm-select"
                    value={filterDraft.archive}
                    onChange={(event) => applyFilterChange({ archive: event.target.value })}
                  >
                  {LEAD_ARCHIVE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="crm-lead-filter-actions">
                <button
                  type="button"
                  className="crm-contact-action-btn"
                  onClick={selectAllLoadedLeads}
                  disabled={!visibleContacts.length}
                  title={allLoadedLeadsSelected ? "Clear loaded lead selection" : "Select all loaded leads"}
                  aria-label={allLoadedLeadsSelected ? "Clear loaded lead selection" : "Select all loaded leads"}
                >
                  {allLoadedLeadsSelected ? "Clear loaded" : "Select all"}
                </button>
                <select
                  className="crm-select"
                  value=""
                  onChange={(event) => {
                    const preset = filterPresets.find((item) => item.id === event.target.value);
                    if (!preset) return;
                    const nextFilters = {
                      queue: preset.filters.queue || "all",
                      status: preset.filters.status || "all",
                      owner: preset.filters.owner || "all",
                      sortOrder: preset.filters.sortOrder || "newest",
                      archive: preset.filters.archive || "active"
                    };
                    setFilterDraft(nextFilters);
                    setSearchQuery(preset.filters.search || "");
                    setQueueFilter(nextFilters.queue);
                    setStatusFilter(nextFilters.status);
                    setOwnerFilter(nextFilters.owner);
                    setSortOrder(normalizeSortOrder(nextFilters.sortOrder));
                    setArchiveFilter(normalizeArchiveFilter(nextFilters.archive));
                    setContacts([]);
                    setNextCursor("");
                    setSelectedLeadIds([]);
                    setSelectionMode(false);
                    setShowFilters(false);
                  }}
                >
                  <option value="">Saved presets</option>
                  {filterPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="crm-icon-action-btn"
                  title="Save filter preset"
                  aria-label="Save filter preset"
                  onClick={async () => {
                    const label = window.prompt("Preset name", activeViewLabel || "Lead filter");
                    if (!label) return;
                    const result = await crmService.createFilterPreset({
                      label,
                      filters: {
                        search: searchQuery,
                        queue: filterDraft.queue,
                        status: filterDraft.status,
                        owner: filterDraft.owner,
                        sortOrder: filterDraft.sortOrder,
                        archive: filterDraft.archive
                      }
                    });
                    if (result?.success === false) {
                      setToast({ type: "error", message: result.error || "Failed to save preset" });
                      return;
                    }
                    setFilterPresets((previous) => [normalizeLeadFilterPreset(result.data), ...previous]);
                    setToast({ type: "success", message: "Filter preset saved." });
                  }}
                >
                  <Save size={17} />
                </button>
                <button
                  type="button"
                  className="crm-icon-action-btn crm-icon-action-btn--danger"
                  onClick={() => runBulkContactAction("delete")}
                  disabled={bulkBusy || !selectedLeadIds.length}
                  title={selectedLeadIds.length ? "Delete selected leads" : "Select leads to delete"}
                  aria-label={selectedLeadIds.length ? "Delete selected leads" : "Select leads to delete"}
                >
                  <Trash2 size={17} />
                </button>
                <button
                  type="button"
                  className="crm-icon-action-btn"
                  onClick={clearFilters}
                  title="Clear filters"
                  aria-label="Clear filters"
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  type="button"
                  className="crm-icon-action-btn crm-icon-action-btn--primary"
                  onClick={applyFilters}
                  title="Apply filters"
                  aria-label="Apply filters"
                >
                  <Check size={17} />
                </button>
              </div>
            </div>
          ) : null}
        </CrmFilterBar>

        <div className="crm-pipeline-toolbar">
          <div className="crm-results-summary">
            <strong>{totalContacts} leads</strong>
            <span>Scan lead follow-ups, stage position, and next actions in one list.</span>
          </div>
        </div>

        {selectedLeadIds.length > 0 ? (
          <div className="crm-bulk-toolbar">
            <div className="crm-bulk-toolbar__summary">
              <strong>{selectedLeadIds.length} selected</strong>
              <button
                type="button"
                className="crm-icon-action-btn crm-icon-action-btn--ghost"
                onClick={clearLeadSelection}
                title="Clear selection"
                aria-label="Clear selection"
              >
                <X size={16} />
              </button>
            </div>
            <div className="crm-bulk-toolbar__controls">
              <select
                className="crm-select crm-select--compact"
                value={bulkOwnerId}
                onChange={(event) => setBulkOwnerId(event.target.value)}
              >
                <option value="">Choose owner</option>
                {ownerOptions
                  .filter((option) => option.key !== "all")
                  .map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
              </select>
              <div className="crm-bulk-toolbar__tag-field">
                <input
                  className="crm-input crm-input--small"
                  value={bulkTagDraft}
                  onChange={(event) => setBulkTagDraft(event.target.value)}
                  placeholder="Tag"
                  aria-label="Tag to add or remove"
                />
                <span className="crm-bulk-toolbar__tag-help">Use a tag chip below to remove an existing tag.</span>
              </div>
            </div>
            <div className="crm-bulk-toolbar__tags" aria-label="Selected lead tags">
              {selectedLeadTags.length > 0 ? (
                selectedLeadTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="crm-tag-chip crm-tag-chip--action"
                    onClick={() => runBulkContactAction("remove_tags", { tags: [tag] })}
                    disabled={bulkBusy}
                    title={`Remove tag "${tag}" from selected leads`}
                    aria-label={`Remove tag ${tag} from selected leads`}
                  >
                    <span>{tag}</span>
                    <X size={12} />
                  </button>
                ))
              ) : (
                <span className="crm-bulk-toolbar__tag-empty">No tags on selected leads.</span>
              )}
            </div>
            <div className="crm-bulk-toolbar__actions">
              <button
                type="button"
                className="crm-contact-action-btn"
                disabled={bulkBusy || !bulkOwnerId}
                onClick={() => runBulkContactAction("assign", { ownerId: bulkOwnerId })}
                title={bulkOwnerId ? "Assign selected leads" : "Choose an owner to assign"}
                aria-label={bulkOwnerId ? "Assign selected leads" : "Choose an owner to assign"}
              >
                Assign
              </button>
              <button
                type="button"
                className="crm-contact-action-btn"
                disabled={bulkBusy || !bulkTagDraft.trim()}
                onClick={() => runBulkContactAction("add_tags", { tags: [bulkTagDraft.trim()] })}
                title={bulkTagDraft.trim() ? "Add tag to selected leads" : "Enter a tag to add"}
                aria-label={bulkTagDraft.trim() ? "Add tag to selected leads" : "Enter a tag to add"}
              >
                <Tags size={17} />
                Add tag
              </button>
              <button
                type="button"
                className="crm-contact-action-btn"
                disabled={bulkBusy || !bulkTagDraft.trim()}
                onClick={() => runBulkContactAction("remove_tags", { tags: [bulkTagDraft.trim()] })}
                title={bulkTagDraft.trim() ? "Remove tag from selected leads" : "Enter a tag to remove"}
                aria-label={bulkTagDraft.trim() ? "Remove tag from selected leads" : "Enter a tag to remove"}
              >
                Remove tag
              </button>
              <button
                type="button"
                className="crm-contact-action-btn"
                disabled={bulkBusy}
                onClick={() => runBulkContactAction(bulkArchiveAction)}
                title={`${bulkArchiveLabel} selected leads`}
                aria-label={`${bulkArchiveLabel} selected leads`}
              >
                <Archive size={17} />
                {bulkArchiveLabel}
              </button>
              <button
                type="button"
                className="crm-contact-action-btn"
                disabled={bulkBusy}
                onClick={() => runBulkContactAction("export")}
                title="Export selected leads"
                aria-label="Export selected leads"
              >
                <Upload size={17} />
                Export
              </button>
            </div>
          </div>
        ) : null}

        {error ? <div className="crm-alert crm-alert-error">{error}</div> : null}
        {loading ? <CrmPageSkeleton variant="list" /> : null}

        {!loading && visibleContacts.length === 0 ? (
          <CrmEmptyState
            title="No leads match this view."
            description="Try changing the lead queue, status, owner, or search filters."
          />
        ) : null}

        {!loading && visibleContacts.length > 0 ? (
          <div className={`crm-pipeline-list-view ${showLeadSelection ? "crm-pipeline-list-view--selecting" : ""}`}>
            <div className="crm-pipeline-list-head">
              {showLeadSelection ? <span className="crm-lead-select-spacer" aria-hidden="true" /> : null}
              <span>Lead</span>
              <span>Lead Stage</span>
              <span>Lead Signals</span>
              <span>Actions</span>
            </div>
            <Virtuoso
              className="crm-pipeline-list-body crm-pipeline-list-body--virtual"
              data={visibleContacts}
              style={{ height: "clamp(340px, calc(100vh - 520px), 520px)" }}
              increaseViewportBy={260}
              endReached={loadMoreLeads}
              itemContent={(_, contact) => renderLeadRow(contact)}
              components={{
                Item: ({ children, ...props }) => (
                  <div {...props} className="crm-virtual-row-shell">
                    {children}
                  </div>
                ),
                Footer: () =>
                  loadingMoreLeads ? (
                    <div className="crm-virtual-list-footer">Loading more leads...</div>
                  ) : hasMoreLeads ? (
                    <div className="crm-virtual-list-footer crm-virtual-list-footer--more">
                      <span>Scroll to load more</span>
                      <button type="button" className="crm-pagination__btn" onClick={loadMoreLeads}>
                        Load more leads
                      </button>
                    </div>
                  ) : (
                    <div className="crm-virtual-list-footer">End of lead list</div>
                  )
              }}
            />
          </div>
        ) : null}
      </div>

      <CrmContactDrawer
        open={Boolean(selectedContactId)}
        contactId={selectedContactId}
        initialContact={selectedContact}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedContact(null);
          setSelectedContactId("");
        }}
        onContactUpdated={handleContactUpdated}
      />
    </>
  );
};

export default CrmPipeline;
