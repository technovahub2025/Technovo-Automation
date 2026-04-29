import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  GripVertical,
  Layers3,
  LayoutGrid,
  List,
  RefreshCw,
  Settings,
  Save,
  Search,
  Star,
  Trash2,
  UserRound
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

const VIEW_MODE_OPTIONS = [
  { key: "board", label: "Board", icon: LayoutGrid },
  { key: "list", label: "List", icon: List }
];

const STAGE_HELPER_TEXT = {
  new: "New inquiries that need first contact.",
  contacted: "Reached out and waiting for a reply.",
  nurturing: "Active follow-up and relationship building.",
  qualified: "Matches the target profile and buying intent.",
  proposal: "Proposal or quote has been shared.",
  won: "Converted leads that closed successfully.",
  lost: "Closed leads that did not convert."
};

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

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const normalizeContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  email: String(contact?.email || "").trim(),
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
  dealValue:
    Number.isFinite(Number(contact?.dealValue)) && Number(contact?.dealValue) >= 0
      ? Number(contact.dealValue)
      : 0,
  notes: String(contact?.notes || "").trim()
});

const normalizePipelineViewFilters = (filters = {}) => ({
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
  viewMode: String(filters?.viewMode || "").trim().toLowerCase() === "list" ? "list" : "board"
});

const normalizePipelineView = (view = {}) => ({
  id: String(view?.id || view?._id || "").trim(),
  label: String(view?.label || "").trim(),
  filters: normalizePipelineViewFilters(view?.filters || {}),
  isDefault: Boolean(view?.isDefault),
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

const makeUniquePipelineViewLabel = (baseLabel, pipelineViews = [], activeViewId = "") => {
  const normalizedBaseLabel = String(baseLabel || "").trim() || "Lead Pipeline View";
  const activeId = String(activeViewId || "").trim();
  const occupiedLabels = new Set(
    pipelineViews
      .filter((view) => String(view?.id || "").trim() !== activeId)
      .map((view) => String(view?.label || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const isUnique = (label) => !occupiedLabels.has(String(label || "").trim().toLowerCase());
  if (isUnique(normalizedBaseLabel)) return normalizedBaseLabel;

  const copyCandidates = [
    `${normalizedBaseLabel} Copy`,
    `${normalizedBaseLabel} Copy 2`
  ];

  for (const candidate of copyCandidates) {
    if (isUnique(candidate)) return candidate;
  }

  let copyIndex = 3;
  while (copyIndex < 1000) {
    const candidate = `${normalizedBaseLabel} Copy ${copyIndex}`;
    if (isUnique(candidate)) return candidate;
    copyIndex += 1;
  }

  return `${normalizedBaseLabel} Copy`;
};

const toPipelineViewPayload = ({
  label,
  search,
  queue,
  status,
  owner,
  viewMode,
  isDefault
}) => ({
  label: String(label || "").trim() || "Lead Pipeline View",
  filters: {
    search: String(search || "").trim(),
    queue: String(queue || "all").trim(),
    status: String(status || "all").trim(),
    owner:
      String(owner || "all").trim().toLowerCase() === "unassigned"
        ? "all"
        : String(owner || "all").trim(),
    viewMode: String(viewMode || "board").trim().toLowerCase() === "list" ? "list" : "board"
  },
  isDefault: Boolean(isDefault)
});

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

const getStageColumnClass = (stageKey) => `crm-stage-column crm-stage-column--${stageKey}`;

const getStageColumnStyle = (stage) => {
  const accent = String(stage?.color || "").trim() || DEFAULT_STAGE_COLORS[String(stage?.key || "").trim().toLowerCase()] || "#5f8fc3";
  return {
    "--stage-accent": accent,
    "--stage-tint": `color-mix(in srgb, ${accent} 14%, white)`,
    "--stage-glow": `color-mix(in srgb, ${accent} 18%, transparent)`
  };
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

const STAGE_BADGE_LABELS = {
  new: "NEW",
  contacted: "CONTACTED",
  nurturing: "NURTURE",
  qualified: "QUALIFIED",
  proposal: "PROPOSAL",
  won: "WON",
  lost: "LOST"
};

const CrmPipeline = () => {
  const [pipelineViews, setPipelineViews] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [activeViewId, setActiveViewId] = useState("");
  const [viewLabel, setViewLabel] = useState("Lead Pipeline View");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [viewMode, setViewMode] = useState("board");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [pipelineViewsAvailable, setPipelineViewsAvailable] = useState(true);
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
  const [draggingContactId, setDraggingContactId] = useState("");
  const [dropTargetContactStageId, setDropTargetContactStageId] = useState("");
  const currentUserId = resolveCacheUserId();
  const hasInitializedFiltersRef = useRef(false);
  const pipelineViewsEnabled = pipelineViewsAvailable;
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

  const activeView = useMemo(
    () => pipelineViews.find((view) => view.id === activeViewId) || null,
    [activeViewId, pipelineViews]
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

  const loadWorkspace = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError("");

        const [viewsResult, metricsResult, stagesResult] = await Promise.all([
          crmService.getPipelineViews(),
          crmService.getMetrics(),
          crmService.getPipelineStages()
        ]);

        if (viewsResult?.success === false) {
          throw new Error(viewsResult?.error || "Failed to load pipeline views");
        }
        if (metricsResult?.success === false) {
          throw new Error(metricsResult?.error || "Failed to load CRM metrics");
        }
        if (stagesResult?.success === false) {
          throw new Error(stagesResult?.error || "Failed to load pipeline stages");
        }

        const nextViews = Array.isArray(viewsResult?.data?.views)
          ? viewsResult.data.views.map(normalizePipelineView)
          : [];
        const nextDefaultViewId = String(viewsResult?.data?.defaultViewId || "").trim();
        const nextPipelineViewsAvailable = viewsResult?.data?.apiAvailable !== false;
        const nextPipelineStagesAvailable = stagesResult?.data?.apiAvailable !== false;
        const nextMetrics = metricsResult?.data || null;
        const nextStages = Array.isArray(stagesResult?.data?.stages) && stagesResult.data.stages.length
          ? stagesResult.data.stages.map(normalizePipelineStage)
          : DEFAULT_LEAD_STAGE_ORDER.map((stage, index) => normalizePipelineStage(stage, index));
        const activeViewExists = activeViewId
          ? nextViews.some((view) => view.id === activeViewId)
          : false;
        const fallbackView = activeViewExists
          ? null
          : nextViews.find((view) => view.id === nextDefaultViewId) || nextViews[0] || null;
        const effectiveFilters = activeViewExists
          ? {
              search: String(searchQuery || "").trim(),
              queue: String(queueFilter || "all").trim(),
              status: String(statusFilter || "all").trim(),
              owner: String(ownerFilter || "all").trim(),
              viewMode: String(viewMode || "board").trim().toLowerCase() === "list" ? "list" : "board"
            }
          : fallbackView
            ? fallbackView.filters
            : {
                search: String(searchQuery || "").trim(),
                queue: String(queueFilter || "all").trim(),
                status: String(statusFilter || "all").trim(),
                owner: String(ownerFilter || "all").trim(),
                viewMode: String(viewMode || "board").trim().toLowerCase() === "list" ? "list" : "board"
              };

        const contactsResult = await crmService.getContacts({
          limit: 300,
          search: effectiveFilters.search || undefined,
          queue: effectiveFilters.queue !== "all" ? effectiveFilters.queue : undefined,
          status: effectiveFilters.status !== "all" ? effectiveFilters.status : undefined,
          ownerId: effectiveFilters.owner !== "all" ? effectiveFilters.owner : undefined
        });

        if (contactsResult?.success === false) {
          throw new Error(contactsResult?.error || "Failed to load pipeline contacts");
        }

        const nextContacts = Array.isArray(contactsResult?.data)
          ? contactsResult.data.map(normalizeContact)
          : [];

        setPipelineViews(nextViews);
        setPipelineViewsAvailable(nextPipelineViewsAvailable);
        setPipelineStagesAvailable(nextPipelineStagesAvailable);
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
        setContacts(nextContacts);

        if (!activeViewExists && fallbackView) {
          setActiveViewId(fallbackView.id);
          setViewLabel(fallbackView.label || "Lead Pipeline View");
          setSaveAsDefault(Boolean(fallbackView.isDefault));
          setSearchQuery(fallbackView.filters.search || "");
          setQueueFilter(fallbackView.filters.queue || "all");
          setStatusFilter(fallbackView.filters.status || "all");
          setOwnerFilter(fallbackView.filters.owner || "all");
          setViewMode(fallbackView.filters.viewMode || "board");
        }
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM pipeline");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeViewId, ownerFilter, queueFilter, searchQuery, statusFilter, viewMode]
  );

  useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: () => loadWorkspace({ silent: true })
  });

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!activeView) return;
    setViewLabel(activeView.label || "Lead Pipeline View");
    setSaveAsDefault(Boolean(activeView.isDefault));
  }, [activeView]);

  useEffect(() => {
    if (!pipelineViews.length) return;
    const selectedView = pipelineViews.find((view) => view.id === activeViewId);
    if (selectedView) return;

    const fallbackView =
      pipelineViews.find((view) => view.isDefault) || pipelineViews[0] || null;
    if (!fallbackView) return;

    setActiveViewId(fallbackView.id);
    setViewLabel(fallbackView.label || "Lead Pipeline View");
    setSaveAsDefault(Boolean(fallbackView.isDefault));
    setSearchQuery(fallbackView.filters.search || "");
    setQueueFilter(fallbackView.filters.queue || "all");
    setStatusFilter(fallbackView.filters.status || "all");
    setOwnerFilter(fallbackView.filters.owner || "all");
    setViewMode(fallbackView.filters.viewMode || "board");
  }, [activeViewId, pipelineViews]);

  useEffect(() => {
    if (!hasInitializedFiltersRef.current) {
      hasInitializedFiltersRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      loadWorkspace({ silent: true });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [loadWorkspace, ownerFilter, queueFilter, searchQuery, statusFilter, viewMode]);

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

  const contactsByStage = useMemo(() => {
    const grouped = stageOptions.reduce((accumulator, stage) => {
      accumulator[stage.key] = [];
      return accumulator;
    }, {});

    visibleContacts.forEach((contact) => {
      const stageKey = normalizeLeadStage(contact?.stage);
      grouped[stageKey].push(contact);
    });

    return grouped;
  }, [stageOptions, visibleContacts, normalizeLeadStage]);

  const visibleLeadValue = useMemo(
    () => visibleContacts.reduce((sum, contact) => sum + (Number(contact?.dealValue) || 0), 0),
    [visibleContacts]
  );

  const activeViewFilters = useMemo(
    () => normalizePipelineViewFilters(activeView?.filters || {}),
    [activeView]
  );

  const hasUnsavedChanges = useMemo(() => {
    const currentFilters = normalizePipelineViewFilters({
      search: searchQuery,
      queue: queueFilter,
      status: statusFilter,
      owner: ownerFilter,
      viewMode
    });

    if (!activeView) {
      return (
        currentFilters.search !== "" ||
        currentFilters.queue !== "all" ||
        currentFilters.status !== "all" ||
        currentFilters.owner !== "all" ||
        currentFilters.viewMode !== "board"
      );
    }

    return (
      currentFilters.search !== activeViewFilters.search ||
      currentFilters.queue !== activeViewFilters.queue ||
      currentFilters.status !== activeViewFilters.status ||
      currentFilters.owner !== activeViewFilters.owner ||
      currentFilters.viewMode !== activeViewFilters.viewMode ||
      String(viewLabel || "").trim() !== String(activeView.label || "").trim() ||
      Boolean(saveAsDefault) !== Boolean(activeView.isDefault)
    );
  }, [
    activeView,
    activeViewFilters.search,
    activeViewFilters.queue,
    activeViewFilters.status,
    activeViewFilters.owner,
    activeViewFilters.viewMode,
    ownerFilter,
    queueFilter,
    saveAsDefault,
    searchQuery,
    statusFilter,
    viewLabel,
    viewMode
  ]);

  const applyPipelineView = useCallback((view) => {
    if (!view) return;
    setActiveViewId(view.id);
    setViewLabel(view.label || "Pipeline View");
    setSaveAsDefault(Boolean(view.isDefault));
    setSearchQuery(view.filters.search || "");
    setQueueFilter(view.filters.queue || "all");
    setStatusFilter(view.filters.status || "all");
    setOwnerFilter(view.filters.owner || "all");
    setViewMode(view.filters.viewMode || "board");
  }, []);

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

  const moveContactToStage = useCallback(
    async (contact, nextStage) => {
      const targetStage = normalizeLeadStage(nextStage);
      if (targetStage === normalizeLeadStage(contact?.stage)) return;
      await persistContactStage(contact, targetStage);
    },
    [persistContactStage, normalizeLeadStage]
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
        throw new Error(result?.error || "Failed to create pipeline stage");
      }

      setToast({ type: "success", message: `Pipeline stage "${label}" created.` });
      setNewStageLabel("");
      setNewStageColor("#5f8fc3");
      await loadWorkspace({ silent: true });
    } catch (stageError) {
      setToast({
        type: "error",
        message: stageError?.message || "Failed to create pipeline stage"
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
          throw new Error(result?.error || "Failed to update pipeline stage");
        }

        setToast({ type: "success", message: `Pipeline stage "${nextLabel}" updated.` });
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        setToast({
          type: "error",
          message: stageError?.message || "Failed to update pipeline stage"
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
          throw new Error(result?.error || "Failed to reorder pipeline stages");
        }

        setToast({
          type: "success",
          message: "Pipeline stages reordered."
        });
        await loadWorkspace({ silent: true });
      } catch (stageError) {
        setToast({
          type: "error",
          message: stageError?.message || "Failed to reorder pipeline stages"
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

  const handleLeadDragStart = useCallback((event, contactId, stageKey) => {
    const normalizedContactId = String(contactId || "").trim();
    const normalizedStageKey = String(stageKey || "").trim().toLowerCase();
    if (!normalizedContactId) return;
    setDraggingContactId(normalizedContactId);
    setDropTargetContactStageId(normalizedStageKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", normalizedContactId);
    event.dataTransfer.setData("application/x-crm-contact-id", normalizedContactId);
  }, []);

  const handleLeadDragOver = useCallback((event, stageKey) => {
    if (!draggingContactId || !pipelineStagesEnabled || savingStage) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetContactStageId(String(stageKey || "").trim().toLowerCase());
  }, [draggingContactId, pipelineStagesEnabled, savingStage]);

  const handleLeadDrop = useCallback(async (event, stageKey) => {
    event.preventDefault();
    if (!draggingContactId || !pipelineStagesEnabled || savingStage) return;

    const contactId = String(
      event.dataTransfer.getData("application/x-crm-contact-id") ||
        event.dataTransfer.getData("text/plain") ||
        draggingContactId
    ).trim();
    const nextStage = normalizeLeadStage(stageKey);

    setDraggingContactId("");
    setDropTargetContactStageId("");

    if (!contactId || !nextStage) return;

    const contact = visibleContacts.find((item) => getEntityId(item) === contactId);
    if (!contact || normalizeLeadStage(contact?.stage) === nextStage) return;

    await persistContactStage(contact, nextStage);
  }, [draggingContactId, persistContactStage, pipelineStagesEnabled, savingStage, normalizeLeadStage, visibleContacts]);

  const handleLeadDragEnd = useCallback(() => {
    setDraggingContactId("");
    setDropTargetContactStageId("");
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
          throw new Error(result?.error || "Failed to delete pipeline stage");
        }

        const movedCount = Number(result?.data?.movedContactCount || 0);
        setToast({
          type: "success",
          message:
            movedCount > 0
              ? `Pipeline stage deleted and ${movedCount} lead${movedCount === 1 ? "" : "s"} moved.`
              : "Pipeline stage deleted."
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
          message: stageError?.message || "Failed to delete pipeline stage"
        });
      } finally {
        setSavingStage(false);
      }
    },
    [loadWorkspace]
  );

  const handleSaveView = useCallback(
    async ({ asNew = false } = {}) => {
      const shouldCreateNewView = asNew || !activeViewId;
      const nextLabel = shouldCreateNewView
        ? makeUniquePipelineViewLabel(viewLabel, pipelineViews, activeViewId)
        : String(viewLabel || "").trim() || "Lead Pipeline View";
      const payload = toPipelineViewPayload({
        label: nextLabel,
        search: searchQuery,
        queue: queueFilter,
        status: statusFilter,
        owner: ownerFilter,
        viewMode,
        isDefault: saveAsDefault
      });

      try {
        setSavingView(true);
        setError("");

        const result = activeViewId && !asNew
          ? await crmService.updatePipelineView(activeViewId, payload)
          : await crmService.createPipelineView(payload);

        if (result?.success === false) {
          throw new Error(result?.error || "Failed to save pipeline view");
        }

        const savedView = normalizePipelineView(result?.data || {});
        setPipelineViews((previous) => {
          const remaining = previous.filter((view) => view.id !== savedView.id);
          return [savedView, ...remaining].sort((left, right) => {
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
            return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
          });
        });
        setActiveViewId(savedView.id);
        setViewLabel(savedView.label || "Lead Pipeline View");
        setSaveAsDefault(Boolean(savedView.isDefault));
        setToast({
          type: "success",
          message: shouldCreateNewView
            ? "Lead pipeline view saved as a new view."
            : "Lead pipeline view saved."
        });
      } catch (saveError) {
        const errorMessage = String(saveError?.message || "");
        setToast({
          type: "error",
          message:
            errorMessage.includes("already exists")
              ? "A lead pipeline view with that name already exists. Please rename it and try again."
              : errorMessage || "Failed to save lead pipeline view"
        });
      } finally {
        setSavingView(false);
      }
    },
    [
      activeViewId,
      pipelineViews,
      ownerFilter,
      queueFilter,
      saveAsDefault,
      searchQuery,
      statusFilter,
      viewLabel,
      viewMode
    ]
  );

  const handleDeleteView = useCallback(async () => {
    if (!activeViewId) return;
    const activeName = String(activeView?.label || "this lead pipeline view").trim();
    const confirmed = window.confirm(`Delete ${activeName}?`);
    if (!confirmed) return;

    try {
      setSavingView(true);
      setError("");
      const result = await crmService.deletePipelineView(activeViewId);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to delete lead pipeline view");
      }

      const nextViews = pipelineViews.filter((view) => view.id !== activeViewId);
      setPipelineViews(nextViews);
      const fallbackView = nextViews.find((view) => view.isDefault) || nextViews[0] || null;
      if (fallbackView) {
        applyPipelineView(fallbackView);
      } else {
        setActiveViewId("");
        setViewLabel("Lead Pipeline View");
        setSaveAsDefault(false);
      }

      setToast({ type: "success", message: "Lead pipeline view deleted." });
    } catch (deleteError) {
      setToast({
        type: "error",
        message: deleteError?.message || "Failed to delete lead pipeline view"
      });
    } finally {
      setSavingView(false);
    }
  }, [activeView, activeViewId, applyPipelineView, pipelineViews]);

  const handleContactUpdated = useCallback((updatedContact) => {
    const normalizedContact = normalizeContact(updatedContact);
    setSelectedContact(normalizedContact);
    setContacts((previous) =>
      previous.map((contact) =>
        getEntityId(contact) === getEntityId(normalizedContact) ? { ...contact, ...normalizedContact } : contact
      )
    );
  }, []);

  const totalContacts = visibleContacts.length;
  const qualifiedCount = Number(metrics?.contacts?.qualified || 0);
  const averageLeadScore = Number(metrics?.contacts?.averageLeadScore || 0);
  const openTaskCount = Number(metrics?.tasks?.open || 0);
  const dueTodayCount = Number(metrics?.tasks?.dueToday || 0);

  return (
    <>
      <div className="crm-workspace crm-workspace--pipeline-static">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Pipeline"
          subtitle="Manage lead flow, lead queues, and saved pipeline views for board or list workflows."
          actions={
            <div className="crm-page-header__action-group">
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={openPipelineSettings}
              >
                <Settings size={16} />
                Pipeline Settings
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => loadWorkspace({ silent: true })}
                disabled={refreshing}
              >
                <RefreshCw size={16} className={refreshing ? "spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          }
        />

        <div className="crm-metric-grid">
          <CrmMetricCard icon={UserRound} value={totalContacts} label="Leads in Pipeline" />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(visibleLeadValue)}
            label="Pipeline Value"
          />
          <CrmMetricCard icon={BadgeDollarSign} value={qualifiedCount} label="Qualified Leads" />
          <CrmMetricCard icon={BadgeDollarSign} value={averageLeadScore} label="Lead Score Avg" />
          <CrmMetricCard icon={BadgeDollarSign} value={openTaskCount} label="Follow-ups Open" />
          <CrmMetricCard icon={BadgeDollarSign} value={dueTodayCount} label="Due Today" />
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
              aria-label="Pipeline Settings"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="crm-pipeline-settings-modal__header">
                <div>
                  <h2 id="crm-pipeline-settings-title">Pipeline Settings</h2>
                  <p>Manage saved lead pipeline views and the lead stage manager from one place.</p>
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
                    Stage management is unavailable in this backend build. The board will use the built-in lead stages.
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
                          ? "Create a new lead pipeline stage"
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
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search leads by name, phone, email, source, owner, or stage..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <select
            className="crm-select"
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
          >
            {CONTACT_QUEUE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="crm-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {CONTACT_STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="crm-select"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
          >
            {ownerOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </CrmFilterBar>

        <div className="crm-pipeline-toolbar">
          <div className="crm-view-toggle">
            {VIEW_MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`crm-view-toggle__btn ${viewMode === option.key ? "active" : ""}`}
                  onClick={() => setViewMode(option.key)}
                >
                  <Icon size={15} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="crm-results-summary">
            <strong>{totalContacts} leads</strong>
            <span>
              {activeView?.label || "Lead pipeline"} {hasUnsavedChanges ? "(unsaved)" : ""}
            </span>
          </div>
        </div>

        {viewMode === "board" ? (
          <>
            <div className="crm-pipeline-section-label crm-pipeline-section-label--sticky crm-pipeline-section-label--board">
              <strong>Lead Pipeline Stages</strong>
              <span>Move leads across the funnel, or open a lead to update its profile and follow-up plan.</span>
            </div>

            <div className="crm-pipeline-board-shell">

            {error ? <div className="crm-alert crm-alert-error">{error}</div> : null}
            {loading ? <CrmPageSkeleton variant="board" /> : null}

            {!loading && visibleContacts.length === 0 ? (
              <CrmEmptyState
                title="No leads match this pipeline view."
                description="Try changing the lead queue, status, owner, or search filters."
              />
            ) : null}

            {!loading && visibleContacts.length > 0 ? (
              <div className="crm-pipeline-board">
                {stageOptions.map((stage) => (
                  <section
                    key={stage.key}
                    className={`${getStageColumnClass(stage.key)} ${
                      dropTargetContactStageId === stage.key && draggingContactId ? "crm-stage-column--drop-active" : ""
                    }`}
                    style={getStageColumnStyle(stage)}
                    onDragOver={(event) => handleLeadDragOver(event, stage.key)}
                    onDrop={(event) => handleLeadDrop(event, stage.key)}
                  >
                    <header className="crm-stage-header">
                      <div>
                        <div className="crm-stage-header__topline">
                          <span className="crm-stage-header__badge">
                            {STAGE_BADGE_LABELS[stage.key] || String(stage.label || stage.key || "Stage")
                              .slice(0, 10)
                              .toUpperCase()}
                          </span>
                          <h3>{stage.label}</h3>
                        </div>
                        <p className="crm-stage-header__helper">{STAGE_HELPER_TEXT[stage.key] || "Pipeline activity in this step."}</p>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#5a7590" }}>
                          Lead value {formatCurrency(
                            (contactsByStage[stage.key] || []).reduce(
                              (sum, contact) => sum + (Number(contact?.dealValue) || 0),
                              0
                            )
                          )}
                        </p>
                      </div>
                      <span>{(contactsByStage[stage.key] || []).length}</span>
                    </header>

                    <div className="crm-stage-list">
                      {(contactsByStage[stage.key] || []).map((contact) => {
                        const contactId = getEntityId(contact);
                        const currentStage = normalizeLeadStage(contact?.stage);
                        const isLeadDragging = draggingContactId === contactId;
                        const isLeadDropTarget = dropTargetContactStageId === stage.key && draggingContactId && !isLeadDragging;

                        return (
                          <article
                            key={contactId}
                            className={`crm-contact-card ${isLeadDragging ? "crm-contact-card--dragging" : ""} ${
                              isLeadDropTarget ? "crm-contact-card--drop-target" : ""
                            }`}
                            draggable={pipelineStagesEnabled}
                            onDragStart={(event) => handleLeadDragStart(event, contactId, stage.key)}
                            onDragEnd={handleLeadDragEnd}
                            onDragOver={(event) => handleLeadDragOver(event, stage.key)}
                            onDrop={(event) => handleLeadDrop(event, stage.key)}
                          >
                            <div className="crm-contact-card__stage-move">
                              <span className="crm-contact-card__move-badge crm-move-badge">
                                <GripVertical size={12} />
                                Drag to move
                              </span>
                              <select
                                className="crm-select crm-select--inline crm-contact-card__stage-select"
                                value={currentStage}
                                onChange={(event) => moveContactToStage(contact, event.target.value)}
                                aria-label={`Move ${contact?.name || "lead"} to stage`}
                              >
                                {stageOptions.map((stageOption) => (
                                  <option key={stageOption.key} value={stageOption.key}>
                                    {stageOption.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="crm-contact-head">
                              <strong>{contact?.name || "Untitled Lead"}</strong>
                              <span className={`crm-status-badge ${getStatusBadgeClass(contact?.status)}`}>
                                {formatLeadStatusLabel(contact?.status)}
                              </span>
                            </div>

                            <div className="crm-contact-meta">
                              <span>Phone: {contact?.phone || "-"}</span>
                              <span>
                                <BadgeDollarSign size={13} />
                                Lead value {formatCurrency(contact?.dealValue)}
                              </span>
                              <span>
                                <UserRound size={13} />
                                Lead score {Number(contact?.leadScore || 0)}
                              </span>
                              <span>Lead owner: {contact?.ownerId || "Unassigned"}</span>
                              <span>Next follow-up touch: {formatDate(contact?.nextFollowUpAt)}</span>
                              <span>Lead source: {contact?.source || "-"}</span>
                            </div>

                            <button
                              type="button"
                              className="crm-link-btn"
                              onClick={() => {
                                setSelectedContact(contact);
                                setSelectedContactId(contactId);
                              }}
                            >
                              Open Lead Profile
                            </button>
                          </article>
                        );
                      })}
                      {(contactsByStage[stage.key] || []).length === 0 && (
                        <div className="crm-empty-column">This stage has no leads yet.</div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
            </div>
          </>
        ) : null}

        {!loading && visibleContacts.length > 0 && viewMode === "list" ? (
          <div className="crm-pipeline-section-label crm-pipeline-section-label--list">
            <strong>Lead Flow List</strong>
            <span>Use this compact lead-flow list when you want to scan follow-up flow and stage changes quickly.</span>
          </div>
        ) : null}

        {!loading && visibleContacts.length > 0 && viewMode === "list" ? (
          <div className="crm-pipeline-list-view">
            <div className="crm-pipeline-list-head">
              <span>Lead</span>
              <span>Lead Stage</span>
              <span>Lead Signals</span>
              <span>Actions</span>
            </div>
            <div className="crm-pipeline-list-body">
              {visibleContacts.map((contact) => {
                const contactId = getEntityId(contact);
                const currentStageIndex = stageOptions.findIndex(
                  (item) => item.key === normalizeLeadStage(contact?.stage)
                );
                const canMoveLeft = currentStageIndex > 0;
                const canMoveRight = currentStageIndex < stageOptions.length - 1;
                return (
                  <div key={contactId} className="crm-pipeline-row">
                    <div className="crm-pipeline-row__primary">
                      <div className="crm-pipeline-row__title">
                        <strong>{contact?.name || "Untitled Lead"}</strong>
                        <span className={`crm-status-badge ${getStatusBadgeClass(contact?.status)}`}>
                          {formatLeadStatusLabel(contact?.status)}
                        </span>
                      </div>
                      <div className="crm-pipeline-row__meta">
                        <span>{contact?.phone ? `Phone: ${contact.phone}` : "Phone: -"}</span>
                        <span>{contact?.email ? `Email: ${contact.email}` : "Email: -"}</span>
                      </div>
                    </div>

                    <div className="crm-pipeline-row__stage">
                      <span className="crm-pipeline-row__stage-label">Lead stage</span>
                      <strong>{stageOptions[currentStageIndex]?.label || "New"}</strong>
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
                      <button
                        type="button"
                        className="crm-inline-action-btn"
                        onClick={() => moveContactStage(contact, -1)}
                        disabled={!canMoveLeft}
                        title="Move to previous stage"
                      >
                        <ArrowLeftRight size={14} style={{ transform: "rotate(180deg)" }} />
                      </button>
                      <button
                        type="button"
                        className="crm-inline-action-btn"
                        onClick={() => moveContactStage(contact, 1)}
                        disabled={!canMoveRight}
                        title="Move to next stage"
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                      <button
                        type="button"
                        className="crm-contact-action-btn"
                        onClick={() => {
                          setSelectedContact(contact);
                          setSelectedContactId(contactId);
                        }}
                      >
                        Open Lead Profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
