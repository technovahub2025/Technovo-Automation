import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TableVirtuoso } from "react-virtuoso";
import {
  BadgeDollarSign,
  CalendarClock,
  Edit3,
  ExternalLink,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Save,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import apiService from "../services/api";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmDealDrawer from "../components/crm/CrmDealDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmMetricCard from "../components/crm/CrmMetricCard";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import CrmEmptyState from "../components/crm/CrmEmptyState";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import "./CrmWorkspace.css";

const CRM_DEALS_LOADING_TIMEOUT_MS = 8000;
const CRM_DEALS_CACHE_TTL_MS = 10 * 60 * 1000;
const CRM_DEALS_CACHE_NAMESPACE = "crm-deals-page";
const CRM_DEAL_CONTACT_PAGE_SIZE = 25;
const CRM_DEAL_CONTACT_SEARCH_DEBOUNCE_MS = 250;
const CRM_DEALS_PAGE_SIZE = 50;

const DEAL_STAGE_ORDER = [
  { key: "discovery", label: "Discovery" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const DEAL_STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const DEAL_STAGE_FILTER_OPTIONS = [
  { key: "all", label: "All Stages" },
  ...DEAL_STAGE_ORDER
];

const DEAL_QUICK_FILTERS = [
  { key: "my_deals", label: "My Deals" },
  { key: "recently_updated", label: "Recently Updated" },
  { key: "high_value", label: "High Value Deals" },
  { key: "closing_this_week", label: "Closing This Week" }
];

const DEAL_PRESET_KEYS = [
  "search",
  "dealStatus",
  "dealStage",
  "dealOwnerId",
  "dealCreatedFrom",
  "dealCreatedTo",
  "dealUpdatedFrom",
  "dealUpdatedTo",
  "dealExpectedCloseFrom",
  "dealExpectedCloseTo",
  "dealValueMin",
  "dealValueMax",
  "dealQuickFilter"
];

const DEAL_DEFAULT_METRICS = {
  total: 0,
  open: 0,
  won: 0,
  lost: 0,
  pipelineValue: 0,
  weightedValue: 0,
  wonValue: 0,
  byStage: {}
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

const sanitizeContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  ownerId: String(contact?.ownerId || "").trim()
});

const sanitizeDeal = (deal = {}) => ({
  _id: String(deal?._id || "").trim(),
  id: String(deal?.id || "").trim(),
  title: String(deal?.title || "").trim(),
  stage: String(deal?.stage || "").trim(),
  status: String(deal?.status || "").trim(),
  value:
    Number.isFinite(Number(deal?.value)) && Number(deal?.value) >= 0 ? Number(deal.value) : 0,
  probability:
    Number.isFinite(Number(deal?.probability)) && Number(deal?.probability) >= 0
      ? Number(deal.probability)
      : 0,
  expectedCloseAt: String(deal?.expectedCloseAt || "").trim(),
  ownerId: String(deal?.ownerId || "").trim(),
  productName: String(deal?.productName || "").trim(),
  source: String(deal?.source || "").trim(),
  notes: String(deal?.notes || "").trim(),
  lostReason: String(deal?.lostReason || "").trim(),
  contactId: sanitizeContact(deal?.contactId)
});

const normalizeDealStage = (stage) => {
  const normalized = String(stage || "").trim().toLowerCase();
  return DEAL_STAGE_ORDER.some((item) => item.key === normalized) ? normalized : "discovery";
};

const getStageLabel = (stage) =>
  DEAL_STAGE_ORDER.find((item) => item.key === normalizeDealStage(stage))?.label || "Discovery";

const getUserDisplayLabel = (user = {}, currentUserId = "") => {
  const name = String(user?.name || user?.displayName || user?.fullName || "").trim();
  const email = String(user?.email || "").trim();
  const id = String(user?._id || user?.id || user?.userId || "").trim();
  const label = name || email || id || "Unknown user";
  return currentUserId && id === currentUserId ? `${label} (Me)` : label;
};

const normalizePagination = (pagination = {}, fallback = {}) => {
  const page = Math.max(Number(pagination?.page || fallback?.page || 1) || 1, 1);
  const limit = Math.max(Number(pagination?.limit || fallback?.limit || CRM_DEALS_PAGE_SIZE) || CRM_DEALS_PAGE_SIZE, 1);
  const total = Math.max(Number(pagination?.total || 0) || 0, 0);
  const totalPages = Math.max(Number(pagination?.totalPages || Math.ceil(total / limit) || 1) || 1, 1);
  return { page: Math.min(page, totalPages), limit, total, totalPages };
};

const formatRelativeTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(Math.abs(diff) / 60000);
  if (minutes < 1) return diff >= 0 ? "just now" : "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return parsed.toLocaleDateString();
};

const normalizeDealListItem = (deal = {}) => ({
  ...sanitizeDeal(deal),
  currency: String(deal?.currency || "INR").trim() || "INR",
  createdAt: String(deal?.createdAt || "").trim(),
  updatedAt: String(deal?.updatedAt || "").trim(),
  wonAt: String(deal?.wonAt || "").trim(),
  lostAt: String(deal?.lostAt || "").trim()
});

const mergeUniqueDeals = (previousDeals = [], nextDeals = []) => {
  const merged = Array.isArray(previousDeals) ? [...previousDeals] : [];
  const seen = new Set(merged.map((deal) => getEntityId(deal)).filter(Boolean));
  (Array.isArray(nextDeals) ? nextDeals : []).forEach((deal) => {
    const dealId = getEntityId(deal);
    if (!dealId || seen.has(dealId)) return;
    seen.add(dealId);
    merged.push(deal);
  });
  return merged;
};

const normalizeDealMetrics = (metrics = {}) => ({
  ...DEAL_DEFAULT_METRICS,
  ...metrics,
  byStage:
    metrics?.byStage && typeof metrics.byStage === "object"
      ? metrics.byStage
      : DEAL_DEFAULT_METRICS.byStage
});

const normalizeDealFilterPreset = (preset = {}) => ({
  id: String(preset?.id || preset?._id || "").trim(),
  label: String(preset?.label || "").trim(),
  filters: {
    search: String(preset?.filters?.search || "").trim(),
    dealStatus: String(preset?.filters?.dealStatus || "all").trim().toLowerCase() || "all",
    dealStage: String(preset?.filters?.dealStage || "all").trim().toLowerCase() || "all",
    dealOwnerId: String(preset?.filters?.dealOwnerId || "all").trim() || "all",
    dealCreatedFrom: String(preset?.filters?.dealCreatedFrom || "").trim(),
    dealCreatedTo: String(preset?.filters?.dealCreatedTo || "").trim(),
    dealUpdatedFrom: String(preset?.filters?.dealUpdatedFrom || "").trim(),
    dealUpdatedTo: String(preset?.filters?.dealUpdatedTo || "").trim(),
    dealExpectedCloseFrom: String(preset?.filters?.dealExpectedCloseFrom || "").trim(),
    dealExpectedCloseTo: String(preset?.filters?.dealExpectedCloseTo || "").trim(),
    dealValueMin: String(preset?.filters?.dealValueMin || "").trim(),
    dealValueMax: String(preset?.filters?.dealValueMax || "").trim(),
    dealQuickFilter: String(preset?.filters?.dealQuickFilter || "all").trim().toLowerCase() || "all"
  }
});

const DEAL_HIGH_VALUE_THRESHOLD = 500000;

const getDealDateRangeForQuickFilter = (quickFilter = "", currentUserId = "") => {
  const normalized = String(quickFilter || "").trim().toLowerCase();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (normalized === "recently_updated") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return {
      updatedFrom: sevenDaysAgo.toISOString(),
      updatedTo: ""
    };
  }

  if (normalized === "high_value") {
    return {
      valueMin: String(DEAL_HIGH_VALUE_THRESHOLD),
      valueMax: ""
    };
  }

  if (normalized === "closing_this_week") {
    const day = startOfDay.getDay();
    const monday = new Date(startOfDay);
    monday.setDate(startOfDay.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      expectedCloseFrom: monday.toISOString(),
      expectedCloseTo: sunday.toISOString()
    };
  }

  if (normalized === "my_deals" && currentUserId) {
    return {
      ownerId: currentUserId
    };
  }

  return {};
};

const normalizeUserList = (response) => {
  const rawList =
    response?.data ||
    response?.users ||
    response?.results ||
    response?.items ||
    response ||
    [];
  return Array.isArray(rawList) ? rawList : [];
};

const getFilterDateLabel = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
};

const getInitialDealForm = () => ({
  contactId: "",
  title: "",
  stage: "discovery",
  value: "",
  probability: "25",
  expectedCloseAt: "",
  productName: "",
  ownerId: "",
  source: ""
});

const CrmDealsVirtuosoTable = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <table
    {...props}
    ref={ref}
    className={`crm-deals-table ${className}`.trim()}
    style={{
      ...style,
      width: "100%",
      tableLayout: "fixed"
    }}
  />
));
CrmDealsVirtuosoTable.displayName = "CrmDealsVirtuosoTable";

const CrmDealsVirtuosoTableHead = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <thead {...props} ref={ref} className={className} style={{ ...style }} />
));
CrmDealsVirtuosoTableHead.displayName = "CrmDealsVirtuosoTableHead";

const CrmDealsVirtuosoTableBody = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <tbody {...props} ref={ref} className={className} style={{ ...style }} />
));
CrmDealsVirtuosoTableBody.displayName = "CrmDealsVirtuosoTableBody";

const CrmDeals = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filterPresets, setFilterPresets] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [expectedCloseFrom, setExpectedCloseFrom] = useState("");
  const [expectedCloseTo, setExpectedCloseTo] = useState("");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState("");
  const [activeActionMenuDealId, setActiveActionMenuDealId] = useState("");
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const [selectedDealIds, setSelectedDealIds] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [dealContactSearch, setDealContactSearch] = useState("");
  const [dealContactLoading, setDealContactLoading] = useState(false);
  const [dealContactSearchResults, setDealContactSearchResults] = useState([]);
  const [dealContactSearchError, setDealContactSearchError] = useState("");
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(() => getInitialDealForm());
  const hasInitializedFilterEffectRef = useRef(false);
  const dealsLoadRequestIdRef = useRef(0);
  const dealsRef = useRef([]);
  const metricsRef = useRef(DEAL_DEFAULT_METRICS);
  const loadDealsRef = useRef(null);
  const nextCursorRef = useRef("");
  const dealContactSearchSeqRef = useRef(0);
  const dealContactSearchInputRef = useRef(null);
  const currentUserId = resolveCacheUserId();
  const requestedSearchQuery = String(searchParams.get("q") || "").trim();
  const requestedStatusFilter = String(searchParams.get("status") || "all").trim().toLowerCase();
  const requestedStageFilter = String(searchParams.get("stage") || "all").trim().toLowerCase();
  const requestedOwnerFilter = String(searchParams.get("ownerId") || "all").trim() || "all";
  const requestedCreatedFrom = String(searchParams.get("createdFrom") || "").trim();
  const requestedCreatedTo = String(searchParams.get("createdTo") || "").trim();
  const requestedUpdatedFrom = String(searchParams.get("updatedFrom") || "").trim();
  const requestedUpdatedTo = String(searchParams.get("updatedTo") || "").trim();
  const requestedExpectedCloseFrom = String(searchParams.get("expectedCloseFrom") || "").trim();
  const requestedExpectedCloseTo = String(searchParams.get("expectedCloseTo") || "").trim();
  const requestedValueMin = String(searchParams.get("valueMin") || "").trim();
  const requestedValueMax = String(searchParams.get("valueMax") || "").trim();
  const requestedQuickFilter = String(searchParams.get("quickFilter") || "all").trim().toLowerCase();
  const isDefaultView =
    !searchQuery.trim() &&
    statusFilter === "all" &&
    stageFilter === "all" &&
    ownerFilter === "all" &&
    !createdFrom &&
    !createdTo &&
    !updatedFrom &&
    !updatedTo &&
    !expectedCloseFrom &&
    !expectedCloseTo &&
    !valueMin &&
    !valueMax &&
    activeQuickFilter === "all";

  const dealFilterState = useMemo(
    () => ({
      search: String(searchQuery || "").trim(),
      status: String(statusFilter || "all").trim().toLowerCase(),
      stage: String(stageFilter || "all").trim().toLowerCase(),
      ownerId: String(ownerFilter || "all").trim() || "all",
      createdFrom: String(createdFrom || "").trim(),
      createdTo: String(createdTo || "").trim(),
      updatedFrom: String(updatedFrom || "").trim(),
      updatedTo: String(updatedTo || "").trim(),
      expectedCloseFrom: String(expectedCloseFrom || "").trim(),
      expectedCloseTo: String(expectedCloseTo || "").trim(),
      valueMin: String(valueMin || "").trim(),
      valueMax: String(valueMax || "").trim(),
      quickFilter: String(activeQuickFilter || "all").trim().toLowerCase()
    }),
    [
      activeQuickFilter,
      createdFrom,
      createdTo,
      expectedCloseFrom,
      expectedCloseTo,
      ownerFilter,
      searchQuery,
      stageFilter,
      statusFilter,
      updatedFrom,
      updatedTo,
      valueMax,
      valueMin
    ]
  );

  const dealFilterSignature = useMemo(() => JSON.stringify(dealFilterState), [dealFilterState]);

  useEffect(() => {
    dealsRef.current = Array.isArray(deals) ? deals : [];
  }, [deals]);

  useEffect(() => {
    metricsRef.current = metrics || DEAL_DEFAULT_METRICS;
  }, [metrics]);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resetDealForm = useCallback(() => {
    setForm(getInitialDealForm());
  }, []);

  const closeCreateDealModal = useCallback(() => {
    setCreateDealOpen(false);
    resetDealForm();
    dealContactSearchSeqRef.current += 1;
    setDealContactSearch("");
    setDealContactSearchResults([]);
    setDealContactLoading(false);
    setDealContactSearchError("");
  }, [resetDealForm]);

  const openCreateDealModal = useCallback(() => {
    resetDealForm();
    dealContactSearchSeqRef.current += 1;
    setDealContactSearch("");
    setDealContactSearchResults([]);
    setDealContactLoading(false);
    setDealContactSearchError("");
    setCreateDealOpen(true);
  }, [resetDealForm]);

  useEffect(() => {
    if (!createDealOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeCreateDealModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      dealContactSearchInputRef.current?.focus?.();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCreateDealModal, createDealOpen]);

  useEffect(() => {
    setSearchQuery((previous) => (previous === requestedSearchQuery ? previous : requestedSearchQuery));

    const isValidStatus =
      requestedStatusFilter === "all" ||
      DEAL_STATUS_OPTIONS.some((option) => option.key === requestedStatusFilter);
    if (isValidStatus) {
      setStatusFilter((previous) =>
        previous === requestedStatusFilter ? previous : requestedStatusFilter
      );
    }

    const isValidStage =
      requestedStageFilter === "all" ||
      DEAL_STAGE_FILTER_OPTIONS.some((option) => option.key === requestedStageFilter);
    if (isValidStage) {
      setStageFilter((previous) => (previous === requestedStageFilter ? previous : requestedStageFilter));
    }

    setOwnerFilter((previous) =>
      previous === requestedOwnerFilter ? previous : requestedOwnerFilter
    );
    setCreatedFrom((previous) => (previous === requestedCreatedFrom ? previous : requestedCreatedFrom));
    setCreatedTo((previous) => (previous === requestedCreatedTo ? previous : requestedCreatedTo));
    setUpdatedFrom((previous) => (previous === requestedUpdatedFrom ? previous : requestedUpdatedFrom));
    setUpdatedTo((previous) => (previous === requestedUpdatedTo ? previous : requestedUpdatedTo));
    setExpectedCloseFrom((previous) =>
      previous === requestedExpectedCloseFrom ? previous : requestedExpectedCloseFrom
    );
    setExpectedCloseTo((previous) =>
      previous === requestedExpectedCloseTo ? previous : requestedExpectedCloseTo
    );
    setValueMin((previous) => (previous === requestedValueMin ? previous : requestedValueMin));
    setValueMax((previous) => (previous === requestedValueMax ? previous : requestedValueMax));
    setActiveQuickFilter((previous) =>
      previous === requestedQuickFilter ? previous : requestedQuickFilter
    );
  }, [
    requestedCreatedFrom,
    requestedCreatedTo,
    requestedExpectedCloseFrom,
    requestedExpectedCloseTo,
    requestedOwnerFilter,
    requestedQuickFilter,
    requestedSearchQuery,
    requestedStageFilter,
    requestedStatusFilter,
    requestedUpdatedFrom,
    requestedUpdatedTo,
    requestedValueMax,
    requestedValueMin
  ]);

  useEffect(() => {
    const desiredSearch = String(searchQuery || "").trim();
    const desiredStatus = String(statusFilter || "all").trim().toLowerCase();
    const desiredStage = String(stageFilter || "all").trim().toLowerCase();
    const desiredOwner = String(ownerFilter || "all").trim() || "all";
    const desiredCreatedFrom = String(createdFrom || "").trim();
    const desiredCreatedTo = String(createdTo || "").trim();
    const desiredUpdatedFrom = String(updatedFrom || "").trim();
    const desiredUpdatedTo = String(updatedTo || "").trim();
    const desiredExpectedCloseFrom = String(expectedCloseFrom || "").trim();
    const desiredExpectedCloseTo = String(expectedCloseTo || "").trim();
    const desiredValueMin = String(valueMin || "").trim();
    const desiredValueMax = String(valueMax || "").trim();
    const desiredQuickFilter = String(activeQuickFilter || "all").trim().toLowerCase();

    const currentSearch = String(searchParams.get("q") || "").trim();
    const currentStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
    const currentStage = String(searchParams.get("stage") || "all").trim().toLowerCase();
    const currentOwner = String(searchParams.get("ownerId") || "all").trim() || "all";
    const currentCreatedFrom = String(searchParams.get("createdFrom") || "").trim();
    const currentCreatedTo = String(searchParams.get("createdTo") || "").trim();
    const currentUpdatedFrom = String(searchParams.get("updatedFrom") || "").trim();
    const currentUpdatedTo = String(searchParams.get("updatedTo") || "").trim();
    const currentExpectedCloseFrom = String(searchParams.get("expectedCloseFrom") || "").trim();
    const currentExpectedCloseTo = String(searchParams.get("expectedCloseTo") || "").trim();
    const currentValueMin = String(searchParams.get("valueMin") || "").trim();
    const currentValueMax = String(searchParams.get("valueMax") || "").trim();
    const currentQuickFilter = String(searchParams.get("quickFilter") || "all").trim().toLowerCase();
    if (
      desiredSearch === currentSearch &&
      desiredStatus === currentStatus &&
      desiredStage === currentStage &&
      desiredOwner === currentOwner &&
      desiredCreatedFrom === currentCreatedFrom &&
      desiredCreatedTo === currentCreatedTo &&
      desiredUpdatedFrom === currentUpdatedFrom &&
      desiredUpdatedTo === currentUpdatedTo &&
      desiredExpectedCloseFrom === currentExpectedCloseFrom &&
      desiredExpectedCloseTo === currentExpectedCloseTo &&
      desiredValueMin === currentValueMin &&
      desiredValueMax === currentValueMax &&
      desiredQuickFilter === currentQuickFilter
    ) return;

    const nextParams = new URLSearchParams(searchParams);
    if (!desiredSearch) nextParams.delete("q");
    else nextParams.set("q", desiredSearch);

    if (desiredStatus === "all") nextParams.delete("status");
    else nextParams.set("status", desiredStatus);

    if (desiredStage === "all") nextParams.delete("stage");
    else nextParams.set("stage", desiredStage);

    if (desiredOwner === "all") nextParams.delete("ownerId");
    else nextParams.set("ownerId", desiredOwner);

    if (!desiredCreatedFrom) nextParams.delete("createdFrom");
    else nextParams.set("createdFrom", desiredCreatedFrom);

    if (!desiredCreatedTo) nextParams.delete("createdTo");
    else nextParams.set("createdTo", desiredCreatedTo);

    if (!desiredUpdatedFrom) nextParams.delete("updatedFrom");
    else nextParams.set("updatedFrom", desiredUpdatedFrom);

    if (!desiredUpdatedTo) nextParams.delete("updatedTo");
    else nextParams.set("updatedTo", desiredUpdatedTo);

    if (!desiredExpectedCloseFrom) nextParams.delete("expectedCloseFrom");
    else nextParams.set("expectedCloseFrom", desiredExpectedCloseFrom);

    if (!desiredExpectedCloseTo) nextParams.delete("expectedCloseTo");
    else nextParams.set("expectedCloseTo", desiredExpectedCloseTo);

    if (!desiredValueMin) nextParams.delete("valueMin");
    else nextParams.set("valueMin", desiredValueMin);

    if (!desiredValueMax) nextParams.delete("valueMax");
    else nextParams.set("valueMax", desiredValueMax);

    if (desiredQuickFilter === "all") nextParams.delete("quickFilter");
    else nextParams.set("quickFilter", desiredQuickFilter);

    nextParams.delete("page");
    nextParams.delete("limit");
    nextParams.delete("cursor");

    setSearchParams(nextParams, { replace: true });
  }, [
    activeQuickFilter,
    createdFrom,
    createdTo,
    expectedCloseFrom,
    expectedCloseTo,
    ownerFilter,
    searchParams,
    searchQuery,
    setSearchParams,
    stageFilter,
    statusFilter,
    updatedFrom,
    updatedTo,
    valueMax,
    valueMin
  ]);

  const persistCache = useCallback(
    (nextDeals, nextMetrics, nextCursorValue = "", nextHasMore = false) => {
      if (!isDefaultView) return;

      writeSidebarPageCache(
        CRM_DEALS_CACHE_NAMESPACE,
        {
          signature: dealFilterSignature,
          deals: (Array.isArray(nextDeals) ? nextDeals : [])
            .map(normalizeDealListItem)
            .filter((deal) => deal._id || deal.id || deal.title),
          metrics: normalizeDealMetrics(nextMetrics || null),
          nextCursor: String(nextCursorValue || ""),
          hasMore: Boolean(nextHasMore)
        },
        {
          currentUserId,
          ttlMs: CRM_DEALS_CACHE_TTL_MS
        }
      );
    },
    [currentUserId, dealFilterSignature, isDefaultView]
  );

  const buildDealRequestParams = useCallback(
    (cursorValue = "") => {
      const params = { limit: CRM_DEALS_PAGE_SIZE, cursorMode: "true" };
      if (cursorValue) params.cursor = cursorValue;
      if (dealFilterState.search) params.search = dealFilterState.search;
      if (dealFilterState.status !== "all") params.status = dealFilterState.status;
      if (dealFilterState.stage !== "all") params.stage = dealFilterState.stage;
      if (dealFilterState.ownerId !== "all") params.ownerId = dealFilterState.ownerId;
      if (dealFilterState.createdFrom) params.createdFrom = dealFilterState.createdFrom;
      if (dealFilterState.createdTo) params.createdTo = dealFilterState.createdTo;
      if (dealFilterState.updatedFrom) params.updatedFrom = dealFilterState.updatedFrom;
      if (dealFilterState.updatedTo) params.updatedTo = dealFilterState.updatedTo;
      if (dealFilterState.expectedCloseFrom) params.expectedCloseFrom = dealFilterState.expectedCloseFrom;
      if (dealFilterState.expectedCloseTo) params.expectedCloseTo = dealFilterState.expectedCloseTo;
      if (dealFilterState.valueMin) params.valueMin = dealFilterState.valueMin;
      if (dealFilterState.valueMax) params.valueMax = dealFilterState.valueMax;
      return params;
    },
    [dealFilterState]
  );

  const buildDealMetricsParams = useCallback(() => {
    const params = {};
    if (dealFilterState.search) params.search = dealFilterState.search;
    if (dealFilterState.status !== "all") params.status = dealFilterState.status;
    if (dealFilterState.stage !== "all") params.stage = dealFilterState.stage;
    if (dealFilterState.ownerId !== "all") params.ownerId = dealFilterState.ownerId;
    if (dealFilterState.createdFrom) params.createdFrom = dealFilterState.createdFrom;
    if (dealFilterState.createdTo) params.createdTo = dealFilterState.createdTo;
    if (dealFilterState.updatedFrom) params.updatedFrom = dealFilterState.updatedFrom;
    if (dealFilterState.updatedTo) params.updatedTo = dealFilterState.updatedTo;
    if (dealFilterState.expectedCloseFrom) params.expectedCloseFrom = dealFilterState.expectedCloseFrom;
    if (dealFilterState.expectedCloseTo) params.expectedCloseTo = dealFilterState.expectedCloseTo;
    if (dealFilterState.valueMin) params.valueMin = dealFilterState.valueMin;
    if (dealFilterState.valueMax) params.valueMax = dealFilterState.valueMax;
    return params;
  }, [dealFilterState]);

  const loadDeals = useCallback(
    async ({ append = false, silent = false, cursorValue = "" } = {}) => {
      const requestId = ++dealsLoadRequestIdRef.current;
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (!silent) setLoading(false);
          setLoadingMore(false);
        },
        CRM_DEALS_LOADING_TIMEOUT_MS
      );
      const nextCursorToUse = append ? cursorValue || nextCursorRef.current : "";
      try {
        if (append) {
          setLoadingMore(true);
        } else if (!silent) {
          setLoading(true);
        }
        setError("");

        const [dealsResult, metricsResult] = await Promise.all([
          crmService.getDeals(buildDealRequestParams(nextCursorToUse)),
          append ? Promise.resolve(null) : crmService.getDealMetrics(buildDealMetricsParams())
        ]);

        if (requestId !== dealsLoadRequestIdRef.current) return;

        if (dealsResult?.success === false) {
          throw new Error(dealsResult?.error || "Failed to load deals");
        }
        if (metricsResult?.success === false) {
          throw new Error(metricsResult?.error || "Failed to load deal metrics");
        }

        const nextDeals = Array.isArray(dealsResult?.data)
          ? dealsResult.data.map(normalizeDealListItem)
          : [];
        const nextMetrics = metricsResult ? normalizeDealMetrics(metricsResult?.data || null) : metricsRef.current;
        const nextCursorValue =
          String(dealsResult?.nextCursor || dealsResult?.pagination?.nextCursor || "").trim();
        const nextHasMore = Boolean(
          dealsResult?.hasMore ?? dealsResult?.pagination?.hasMore ?? nextCursorValue
        );

        const mergedDeals = append ? mergeUniqueDeals(dealsRef.current, nextDeals) : nextDeals;
        setDeals(mergedDeals);
        setMetrics(nextMetrics || DEAL_DEFAULT_METRICS);
        setNextCursor(nextCursorValue);
        nextCursorRef.current = nextCursorValue;
        setHasMore(nextHasMore);
        persistCache(mergedDeals, nextMetrics || DEAL_DEFAULT_METRICS, nextCursorValue, nextHasMore);
      } catch (loadError) {
        if (requestId !== dealsLoadRequestIdRef.current) return;
        setError(loadError?.message || "Failed to load CRM deals");
      } finally {
        releaseLoadingGuard();
        if (requestId === dealsLoadRequestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [buildDealMetricsParams, buildDealRequestParams, persistCache]
  );

  useEffect(() => {
    loadDealsRef.current = loadDeals;
  }, [loadDeals]);

  const handleRealtimeRefresh = useCallback(() => {
    nextCursorRef.current = "";
    loadDeals({ silent: true, append: false });
  }, [loadDeals]);

  const crmRealtime = useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    const cachedDeals = readSidebarPageCache(CRM_DEALS_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (Array.isArray(cachedDeals?.data?.deals) && cachedDeals?.data?.signature === dealFilterSignature) {
      setDeals(cachedDeals.data.deals.map(normalizeDealListItem));
      setMetrics(cachedDeals?.data?.metrics || DEAL_DEFAULT_METRICS);
      setHasMore(Boolean(cachedDeals?.data?.hasMore));
      setNextCursor(String(cachedDeals?.data?.nextCursor || ""));
      nextCursorRef.current = String(cachedDeals?.data?.nextCursor || "");
      setLoading(false);
      loadDealsRef.current?.({ silent: true, append: false });
      return;
    }

    loadDeals({ silent: false, append: false });
  }, [currentUserId, dealFilterSignature, loadDeals]);

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }

    const timer = setTimeout(() => {
      nextCursorRef.current = "";
      setNextCursor("");
      setHasMore(true);
      loadDeals({ silent: true, append: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [dealFilterSignature, loadDeals]);

  const normalizedDealContactSearch = String(dealContactSearch || "").trim();

  useEffect(() => {
    if (!createDealOpen) {
      setDealContactLoading(false);
      return undefined;
    }

    let mounted = true;
    const requestSeq = dealContactSearchSeqRef.current + 1;
    dealContactSearchSeqRef.current = requestSeq;

    const loadContacts = async () => {
      try {
        setDealContactLoading(true);
        setDealContactSearchError("");
        const result = await crmService.getContacts({
          search: normalizedDealContactSearch,
          limit: CRM_DEAL_CONTACT_PAGE_SIZE,
          page: 1,
          fields: "list"
        });
        if (!mounted || dealContactSearchSeqRef.current !== requestSeq) return;
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load contacts");
        }
        const nextContacts = Array.isArray(result?.data) ? result.data : [];
        setDealContactSearchResults(nextContacts.map(sanitizeContact));
      } catch (contactError) {
        if (!mounted || dealContactSearchSeqRef.current !== requestSeq) return;
        setDealContactSearchResults([]);
        setDealContactSearchError(contactError?.message || "Failed to load contacts");
      } finally {
        if (mounted && dealContactSearchSeqRef.current === requestSeq) {
          setDealContactLoading(false);
        }
      }
    };

    const timer = window.setTimeout(loadContacts, CRM_DEAL_CONTACT_SEARCH_DEBOUNCE_MS);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [createDealOpen, normalizedDealContactSearch]);

  const contactOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    const append = (contact) => {
      const id = getEntityId(contact);
      if (!id || seen.has(id)) return;
      seen.add(id);
      options.push({
        id,
        label: `${contact?.name || "Unknown"} (${contact?.phone || "-"})`
      });
    };

    dealContactSearchResults.forEach(append);
    return options;
  }, [dealContactSearchResults]);

  const ownerOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    const addOption = (user, fallbackId = "") => {
      const userId = String(user?._id || user?.id || user?.userId || fallbackId || "").trim();
      if (!userId || seen.has(userId)) return;
      seen.add(userId);
      options.push({
        id: userId,
        label: getUserDisplayLabel(user, currentUserId)
      });
    };

    users.forEach((user) => addOption(user));
    if (currentUserId) {
      addOption({ _id: currentUserId, name: currentUserId }, currentUserId);
    }
    if (ownerFilter && ownerFilter !== "all") {
      addOption({ _id: ownerFilter, name: ownerFilter }, ownerFilter);
    }
    if (form.ownerId) {
      addOption({ _id: form.ownerId, name: form.ownerId }, form.ownerId);
    }
    return options;
  }, [currentUserId, form.ownerId, ownerFilter, users]);

  const ownerLabelMap = useMemo(
    () => new Map(ownerOptions.map((owner) => [owner.id, owner.label])),
    [ownerOptions]
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (dealFilterState.search) chips.push({ key: "search", label: `Search: ${dealFilterState.search}` });
    if (dealFilterState.status !== "all") chips.push({ key: "status", label: `Status: ${dealFilterState.status}` });
    if (dealFilterState.stage !== "all") chips.push({ key: "stage", label: `Stage: ${getStageLabel(dealFilterState.stage)}` });
    if (dealFilterState.ownerId !== "all") {
      chips.push({
        key: "ownerId",
        label: `Owner: ${ownerLabelMap.get(dealFilterState.ownerId) || (dealFilterState.ownerId === currentUserId ? "Me" : dealFilterState.ownerId)}`
      });
    }
    if (dealFilterState.createdFrom || dealFilterState.createdTo) {
      chips.push({
        key: "created",
        label: `Created: ${getFilterDateLabel(dealFilterState.createdFrom) || "Any"} - ${getFilterDateLabel(dealFilterState.createdTo) || "Any"}`
      });
    }
    if (dealFilterState.updatedFrom || dealFilterState.updatedTo) {
      chips.push({
        key: "updated",
        label: `Updated: ${getFilterDateLabel(dealFilterState.updatedFrom) || "Any"} - ${getFilterDateLabel(dealFilterState.updatedTo) || "Any"}`
      });
    }
    if (dealFilterState.expectedCloseFrom || dealFilterState.expectedCloseTo) {
      chips.push({
        key: "close",
        label: `Close: ${getFilterDateLabel(dealFilterState.expectedCloseFrom) || "Any"} - ${getFilterDateLabel(dealFilterState.expectedCloseTo) || "Any"}`
      });
    }
    if (dealFilterState.valueMin || dealFilterState.valueMax) {
      chips.push({
        key: "value",
        label: `Value: ${dealFilterState.valueMin || "Any"} - ${dealFilterState.valueMax || "Any"}`
      });
    }
    if (dealFilterState.quickFilter !== "all") {
      const quickLabel =
        DEAL_QUICK_FILTERS.find((item) => item.key === dealFilterState.quickFilter)?.label ||
        dealFilterState.quickFilter;
      chips.push({ key: "quickFilter", label: `Quick: ${quickLabel}` });
    }
    return chips;
  }, [currentUserId, dealFilterState, ownerLabelMap]);

  const selectedDealIdSet = useMemo(() => new Set(selectedDealIds), [selectedDealIds]);
  const selectionMode = selectedDealIds.length > 0;
  const visibleDealIds = useMemo(
    () => deals.map((deal) => getEntityId(deal)).filter(Boolean),
    [deals]
  );
  const allVisibleSelected =
    visibleDealIds.length > 0 && visibleDealIds.every((dealId) => selectedDealIdSet.has(dealId));

  useEffect(() => {
    if (!selectedDealIds.length) return;
    const visibleSet = new Set(visibleDealIds);
    setSelectedDealIds((previous) => previous.filter((dealId) => visibleSet.has(dealId)));
  }, [selectedDealIds.length, visibleDealIds]);

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const result = await apiService.getUsers();
        if (!mounted) return;
        setUsers(normalizeUserList(result?.data));
      } catch (userError) {
        if (!mounted) return;
        setUsers([]);
      } finally {
        if (mounted) setUsersLoading(false);
      }
    };

    const loadPresets = async () => {
      try {
        const result = await crmService.getFilterPresets();
        if (!mounted) return;
        const nextPresets = Array.isArray(result?.data) ? result.data.map(normalizeDealFilterPreset) : [];
        setFilterPresets(nextPresets.filter((preset) => preset.id && preset.label));
      } catch (presetError) {
        if (!mounted) return;
        setFilterPresets([]);
      }
    };

    loadUsers();
    loadPresets();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeActionMenuDealId) return undefined;

    const closeActionMenu = () => {
      setActiveActionMenuDealId("");
      setActionMenuPosition(null);
    };

    window.addEventListener("click", closeActionMenu);
    window.addEventListener("scroll", closeActionMenu, true);
    window.addEventListener("resize", closeActionMenu);
    return () => {
      window.removeEventListener("click", closeActionMenu);
      window.removeEventListener("scroll", closeActionMenu, true);
      window.removeEventListener("resize", closeActionMenu);
    };
  }, [activeActionMenuDealId]);

  const updateSearchQuery = useCallback((value) => {
    setSearchQuery(value);
  }, []);

  const updateStatusFilter = useCallback((value) => {
    setStatusFilter(value);
  }, []);

  const updateStageFilter = useCallback((value) => {
    setStageFilter(value);
  }, []);

  const clearDealFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setStageFilter("all");
    setOwnerFilter("all");
    setCreatedFrom("");
    setCreatedTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setExpectedCloseFrom("");
    setExpectedCloseTo("");
    setValueMin("");
    setValueMax("");
    setActiveQuickFilter("all");
  }, []);

  const applyDealQuickFilter = useCallback(
    (quickFilterKey) => {
      const normalizedQuickFilter = String(quickFilterKey || "all").trim().toLowerCase();
      const dateRange = getDealDateRangeForQuickFilter(normalizedQuickFilter, currentUserId);
      setActiveQuickFilter(normalizedQuickFilter);
      if (normalizedQuickFilter === "my_deals" && currentUserId) {
        setOwnerFilter(currentUserId);
      } else if (normalizedQuickFilter !== "my_deals") {
        setOwnerFilter((previous) => (previous === currentUserId ? "all" : previous));
      }
      setUpdatedFrom(dateRange.updatedFrom || "");
      setUpdatedTo(dateRange.updatedTo || "");
      setExpectedCloseFrom(dateRange.expectedCloseFrom || "");
      setExpectedCloseTo(dateRange.expectedCloseTo || "");
      setValueMin(dateRange.valueMin || "");
      setValueMax(dateRange.valueMax || "");
    },
    [currentUserId]
  );

  const handleSelectAllVisibleDeals = useCallback(() => {
    if (!visibleDealIds.length) return;
    setSelectedDealIds((previous) => {
      const previousSet = new Set(previous);
      if (allVisibleSelected) return [];
      const next = [...previous];
      visibleDealIds.forEach((dealId) => {
        if (!previousSet.has(dealId)) next.push(dealId);
      });
      return next;
    });
  }, [allVisibleSelected, visibleDealIds]);

  const clearSelectedDeals = useCallback(() => {
    setSelectedDealIds([]);
  }, []);

  const handleToggleSelectedDeal = useCallback((dealId, checked) => {
    const normalizedDealId = String(dealId || "").trim();
    if (!normalizedDealId) return;
    setSelectedDealIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(normalizedDealId);
      else next.delete(normalizedDealId);
      return Array.from(next);
    });
  }, []);

  const handleBulkDeleteSelectedDeals = useCallback(async () => {
    if (!selectedDealIds.length) return;
    const count = selectedDealIds.length;
    if (!window.confirm(`Delete ${count} selected deal${count === 1 ? "" : "s"}?`)) return;

    try {
      setError("");
      setBulkBusy(true);
      const results = await Promise.allSettled(selectedDealIds.map((dealId) => crmService.deleteDeal(dealId)));
      const failures = results.filter((result) => result.status === "rejected" || result.value?.success === false);
      if (failures.length) {
        const failureMessage =
          failures[0]?.reason?.message ||
          failures[0]?.value?.error ||
          "Failed to delete one or more selected deals";
        throw new Error(failureMessage);
      }

      clearSelectedDeals();
      if (getEntityId(selectedDeal)) {
        const selectedDealId = getEntityId(selectedDeal);
        if (selectedDealIds.includes(selectedDealId)) {
          setSelectedDeal(null);
        }
      }
      await loadDeals({ silent: true });
      setToast({ type: "success", message: `Deleted ${count} deal${count === 1 ? "" : "s"}.` });
    } catch (bulkDeleteError) {
      setToast({
        type: "error",
        message: bulkDeleteError?.message || "Failed to delete selected deals"
      });
      setError(bulkDeleteError?.message || "Failed to delete selected deals");
    } finally {
      setBulkBusy(false);
    }
  }, [clearSelectedDeals, loadDeals, selectedDeal, selectedDealIds]);

  const clearDealFilterByKey = useCallback((key) => {
    if (key === "search") setSearchQuery("");
    if (key === "status") setStatusFilter("all");
    if (key === "stage") setStageFilter("all");
    if (key === "ownerId") setOwnerFilter("all");
    if (key === "created") {
      setCreatedFrom("");
      setCreatedTo("");
    }
    if (key === "updated") {
      setUpdatedFrom("");
      setUpdatedTo("");
    }
    if (key === "close") {
      setExpectedCloseFrom("");
      setExpectedCloseTo("");
    }
    if (key === "value") {
      setValueMin("");
      setValueMax("");
    }
    if (key === "quickFilter") setActiveQuickFilter("all");
  }, []);

  const handleSaveFilterPreset = useCallback(async () => {
    const label = String(window.prompt("Save deal filter preset as:", "") || "").trim();
    if (!label) return;
    try {
      const result = await crmService.createFilterPreset({
        label,
        filters: {
          dealSearch: dealFilterState.search,
          dealStatus: dealFilterState.status,
          dealStage: dealFilterState.stage,
          dealOwnerId: dealFilterState.ownerId,
          dealCreatedFrom: dealFilterState.createdFrom,
          dealCreatedTo: dealFilterState.createdTo,
          dealUpdatedFrom: dealFilterState.updatedFrom,
          dealUpdatedTo: dealFilterState.updatedTo,
          dealExpectedCloseFrom: dealFilterState.expectedCloseFrom,
          dealExpectedCloseTo: dealFilterState.expectedCloseTo,
          dealValueMin: dealFilterState.valueMin,
          dealValueMax: dealFilterState.valueMax,
          dealQuickFilter: dealFilterState.quickFilter
        }
      });
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to save filter preset");
      }
      const nextPreset = normalizeDealFilterPreset(result?.data || {});
      setFilterPresets((previous) => [nextPreset, ...previous.filter((preset) => preset.id !== nextPreset.id)]);
      setToast({ type: "success", message: "Filter preset saved." });
    } catch (presetError) {
      setToast({ type: "error", message: presetError?.message || "Failed to save filter preset" });
    }
  }, [dealFilterState]);

  const applyDealFilterPreset = useCallback((presetId) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const filters = preset.filters || {};
    setSearchQuery(String(filters.search || "").trim());
    setStatusFilter(String(filters.dealStatus || "all").trim().toLowerCase() || "all");
    setStageFilter(String(filters.dealStage || "all").trim().toLowerCase() || "all");
    setOwnerFilter(String(filters.dealOwnerId || "all").trim() || "all");
    setCreatedFrom(String(filters.dealCreatedFrom || "").trim());
    setCreatedTo(String(filters.dealCreatedTo || "").trim());
    setUpdatedFrom(String(filters.dealUpdatedFrom || "").trim());
    setUpdatedTo(String(filters.dealUpdatedTo || "").trim());
    setExpectedCloseFrom(String(filters.dealExpectedCloseFrom || "").trim());
    setExpectedCloseTo(String(filters.dealExpectedCloseTo || "").trim());
    setValueMin(String(filters.dealValueMin || "").trim());
    setValueMax(String(filters.dealValueMax || "").trim());
    setActiveQuickFilter(String(filters.dealQuickFilter || "all").trim().toLowerCase() || "all");
  }, [filterPresets]);

  const loadMoreDeals = useCallback(() => {
    if (loadingMore || !hasMore) return;
    loadDeals({ append: true, silent: true, cursorValue: nextCursorRef.current });
  }, [hasMore, loadDeals, loadingMore]);

  const toggleDealActionMenu = useCallback(
    (event, dealId) => {
      event.stopPropagation();
      const normalizedDealId = String(dealId || "").trim();
      if (!normalizedDealId) return;

      if (activeActionMenuDealId === normalizedDealId) {
        setActiveActionMenuDealId("");
        setActionMenuPosition(null);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = 170;
      const menuHeight = 148;
      const viewportPadding = 12;
      const nextLeft = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );
      const nextTop = window.innerHeight - rect.bottom < menuHeight + viewportPadding
        ? Math.max(viewportPadding, rect.top - menuHeight - 8)
        : rect.bottom + 8;

      setActionMenuPosition({ top: nextTop, left: nextLeft });
      setActiveActionMenuDealId(normalizedDealId);
    },
    [activeActionMenuDealId]
  );

  const closeDealActionMenu = useCallback(() => {
    setActiveActionMenuDealId("");
    setActionMenuPosition(null);
  }, []);

  const handleDeleteDeal = useCallback(
    async (deal) => {
      const dealId = getEntityId(deal);
      if (!dealId) return;
      if (!window.confirm(`Delete ${deal?.title || "this deal"}?`)) return;

      try {
        setError("");
        closeDealActionMenu();
        const result = await crmService.deleteDeal(dealId);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete deal");
        }

        if (getEntityId(selectedDeal) === dealId) {
          setSelectedDeal(null);
        }
        setSelectedDealIds((previous) => previous.filter((selectedId) => selectedId !== dealId));
        await loadDeals({ silent: true });
        setToast({ type: "success", message: "Deal deleted." });
      } catch (deleteError) {
        setToast({ type: "error", message: deleteError?.message || "Failed to delete deal" });
        setError(deleteError?.message || "Failed to delete deal");
      }
    },
    [closeDealActionMenu, loadDeals, selectedDeal]
  );

  const handleCreateDeal = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        setSubmitting(true);
        setError("");

        if (!form.contactId) throw new Error("Select a contact");
        if (!String(form.title || "").trim()) throw new Error("Deal title is required");

        const payload = {
          contactId: form.contactId,
          title: String(form.title || "").trim(),
          stage: form.stage || "discovery",
          status: ["won", "lost"].includes(form.stage) ? form.stage : "open",
          value: form.value ? Number(form.value) : 0,
          probability: form.probability ? Number(form.probability) : 0,
          productName: String(form.productName || "").trim(),
          ownerId: String(form.ownerId || "").trim() || null,
          source: String(form.source || "").trim()
        };
        if (form.expectedCloseAt) {
          const parsed = new Date(form.expectedCloseAt);
          if (!Number.isNaN(parsed.getTime())) {
            payload.expectedCloseAt = parsed.toISOString();
          }
        }

        const result = await crmService.createDeal(payload);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to create deal");
        }

        setForm({
          ...getInitialDealForm()
        });
        await loadDeals({ silent: true });
        setToast({ type: "success", message: "Deal created successfully." });
        closeCreateDealModal();
      } catch (submitError) {
        setError(submitError?.message || "Failed to create deal");
        setToast({
          type: "error",
          message: submitError?.message || "Failed to create deal"
        });
    } finally {
      setSubmitting(false);
    }
  },
    [closeCreateDealModal, form, loadDeals]
  );

  const handleDealSaved = useCallback(
    async () => {
      await loadDeals({ silent: true });
      setToast({ type: "success", message: "Deal updated successfully." });
    },
    [loadDeals]
  );

  const handleDealDeleted = useCallback(
    async () => {
      setSelectedDeal(null);
      setSelectedDealIds([]);
      await loadDeals({ silent: true });
      setToast({ type: "success", message: "Deal deleted." });
    },
    [loadDeals]
  );

  const openContactDrawer = useCallback((contact) => {
    const normalizedId = getEntityId(contact);
    if (!normalizedId) return;
    setSelectedContact(contact);
    setSelectedContactId(normalizedId);
  }, []);

  return (
    <>
      <div className="crm-workspace crm-workspace--deals">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Deals"
          subtitle="Track opportunities by stage, expected revenue, and closing probability."
          actions={
            <div className="crm-page-header__action-group">
              <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
              <button
                type="button"
                className="crm-btn crm-btn-primary crm-btn--compact crm-create-task-trigger"
                onClick={openCreateDealModal}
              >
                <Plus size={16} />
                Create Deal
              </button>
            </div>
          }
        />

        <div className="crm-summary-grid">
          <CrmMetricCard icon={BadgeDollarSign} value={metrics?.open ?? 0} label="Open Deals" />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.pipelineValue)}
            label="Pipeline Value"
          />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.weightedValue)}
            label="Weighted Value"
          />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.wonValue)}
            label="Won Revenue"
          />
          <CrmMetricCard icon={CalendarClock} value={metrics?.won ?? 0} label="Won Deals" />
        </div>

        {createDealOpen && (
          <div className="crm-create-task-overlay" role="presentation">
            <button
              type="button"
              className="crm-create-task-backdrop"
              aria-label="Close create deal"
              onClick={closeCreateDealModal}
            />
            <section
              className="crm-create-task-shell crm-create-task-shell--overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Create Deal"
            >
              <form className="crm-create-task" onSubmit={handleCreateDeal}>
                <div className="crm-create-task__header">
                  <div className="crm-create-task__heading">
                    <span className="crm-create-task__icon" aria-hidden="true">
                      <Plus size={16} />
                    </span>
                    <div className="crm-create-task__heading-copy">
                      <h3>Create Deal</h3>
                      <p>Capture a new opportunity and place it into the pipeline.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="crm-create-task__close"
                    onClick={closeCreateDealModal}
                    aria-label="Close create deal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="crm-create-task__body">
                  <div className="crm-create-task-grid crm-create-task-grid--primary">
                    <label className="crm-field">
                      <span>Contact</span>
                      <input
                        type="text"
                        className="crm-input"
                        placeholder="Search contacts by name or phone"
                        ref={dealContactSearchInputRef}
                        value={dealContactSearch}
                        onChange={(event) => {
                          setDealContactSearch(event.target.value);
                          setForm((previous) => ({ ...previous, contactId: "" }));
                        }}
                      />
                      <select
                        className="crm-select"
                        value={form.contactId}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, contactId: event.target.value }))
                        }
                        disabled={dealContactLoading && contactOptions.length === 0}
                      >
                        <option value="">
                          {dealContactLoading && contactOptions.length === 0
                            ? "Searching contacts..."
                            : "Select Contact"}
                        </option>
                        {contactOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="crm-field__help">
                        {dealContactSearchError
                          ? dealContactSearchError
                          : dealContactLoading
                            ? "Loading matching contacts..."
                            : "Search to narrow the contact list before selecting a deal contact."}
                      </span>
                    </label>
                    <label className="crm-field">
                      <span>Deal Title</span>
                      <input
                        type="text"
                        className="crm-input"
                        placeholder="Deal title"
                        value={form.title}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, title: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="crm-create-task-grid crm-create-task-grid--compact">
                    <label className="crm-field">
                      <span>Stage</span>
                      <select
                        className="crm-select"
                        value={form.stage}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, stage: event.target.value }))
                        }
                      >
                        {DEAL_STAGE_ORDER.map((stage) => (
                          <option key={stage.key} value={stage.key}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span>Deal Value</span>
                      <input
                        type="number"
                        min="0"
                        className="crm-input"
                        placeholder="Deal value"
                        value={form.value}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, value: event.target.value }))
                        }
                      />
                    </label>
                    <label className="crm-field">
                      <span>Probability %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="crm-input"
                        placeholder="Probability %"
                        value={form.probability}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, probability: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="crm-create-task-grid crm-create-task-grid--compact crm-create-task-grid--schedule">
                    <label className="crm-field">
                      <span>Expected Close</span>
                      <input
                        type="datetime-local"
                        className="crm-input"
                        value={form.expectedCloseAt}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, expectedCloseAt: event.target.value }))
                        }
                      />
                    </label>
                    <label className="crm-field">
                      <span>Product / Service</span>
                      <input
                        type="text"
                        className="crm-input"
                        placeholder="Product / Service"
                        value={form.productName}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, productName: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="crm-create-task-grid crm-create-task-grid--schedule">
                    <label className="crm-field">
                      <span>Owner ID (optional)</span>
                      <input
                        type="text"
                        className="crm-input"
                        list="crm-deal-owner-options"
                        placeholder="Owner ID or select a user"
                        value={form.ownerId}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, ownerId: event.target.value }))
                        }
                      />
                    </label>
                    <label className="crm-field">
                      <span>Source</span>
                      <input
                        type="text"
                        className="crm-input"
                        placeholder="Source"
                        value={form.source}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, source: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="crm-create-task__footer">
                  <button type="submit" className="crm-btn crm-btn-primary crm-create-task__submit" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Deal"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <datalist id="crm-deal-owner-options">
          {ownerOptions.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.label}
            </option>
          ))}
        </datalist>

        <CrmFilterBar>
          <label className="crm-search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search deals by title, product, source..."
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
            />
          </label>
          <select
            className="crm-select"
            value={statusFilter}
            onChange={(event) => updateStatusFilter(event.target.value)}
          >
            {DEAL_STATUS_OPTIONS.map((option) => (
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
            <option value="all">All Owners</option>
            {currentUserId && <option value={currentUserId}>My Deals</option>}
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`crm-deals-filter-toggle ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters((previous) => !previous)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={15} />
            Filter
          </button>
          <button
            type="button"
            className="crm-deals-filter-toggle"
            onClick={handleSaveFilterPreset}
            title="Save current filters"
            disabled={bulkBusy}
          >
            <Save size={15} />
            Save
          </button>
          <button
            type="button"
            className="crm-deals-filter-toggle"
            onClick={handleSelectAllVisibleDeals}
            disabled={!deals.length || bulkBusy}
            title={allVisibleSelected ? "Clear all visible deals" : "Select all visible deals"}
          >
            {allVisibleSelected ? <X size={15} /> : <Trash2 size={15} style={{ opacity: 0.5 }} />}
            {allVisibleSelected ? "Clear All" : "Select All"}
          </button>
        </CrmFilterBar>

        {showFilters && (
          <div className="crm-deals-filters-panel">
            <div className="crm-deals-filters-panel__grid">
              <label className="crm-deals-filter-field">
                <span>Stage</span>
                <select
                  className="crm-select"
                  value={stageFilter}
                  onChange={(event) => updateStageFilter(event.target.value)}
                >
                  {DEAL_STAGE_FILTER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-deals-filter-field">
                <span>Created From</span>
                <input
                  type="date"
                  className="crm-input"
                  value={createdFrom}
                  onChange={(event) => setCreatedFrom(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Created To</span>
                <input
                  type="date"
                  className="crm-input"
                  value={createdTo}
                  onChange={(event) => setCreatedTo(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Updated From</span>
                <input
                  type="date"
                  className="crm-input"
                  value={updatedFrom}
                  onChange={(event) => setUpdatedFrom(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Updated To</span>
                <input
                  type="date"
                  className="crm-input"
                  value={updatedTo}
                  onChange={(event) => setUpdatedTo(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Expected Close From</span>
                <input
                  type="date"
                  className="crm-input"
                  value={expectedCloseFrom}
                  onChange={(event) => setExpectedCloseFrom(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Expected Close To</span>
                <input
                  type="date"
                  className="crm-input"
                  value={expectedCloseTo}
                  onChange={(event) => setExpectedCloseTo(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Value Min</span>
                <input
                  type="number"
                  min="0"
                  className="crm-input"
                  value={valueMin}
                  onChange={(event) => setValueMin(event.target.value)}
                />
              </label>

              <label className="crm-deals-filter-field">
                <span>Value Max</span>
                <input
                  type="number"
                  min="0"
                  className="crm-input"
                  value={valueMax}
                  onChange={(event) => setValueMax(event.target.value)}
                />
              </label>

              <div className="crm-deals-filter-field crm-deals-filter-field--preset">
                <span>Saved Presets</span>
                <select
                  className="crm-select"
                  value=""
                  onChange={(event) => applyDealFilterPreset(event.target.value)}
                  disabled={!filterPresets.length}
                >
                  <option value="">{filterPresets.length ? "Load saved preset" : "No presets saved"}</option>
                  {filterPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="crm-deals-filters-panel__footer">
              <div className="crm-deals-quick-filters">
                {DEAL_QUICK_FILTERS.map((quickFilter) => (
                  <button
                    key={quickFilter.key}
                    type="button"
                    className={`crm-deals-quick-filter ${activeQuickFilter === quickFilter.key ? "active" : ""}`}
                    onClick={() => applyDealQuickFilter(quickFilter.key)}
                  >
                    {quickFilter.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="crm-deals-clear-filters"
                onClick={clearDealFilters}
              >
                <RotateCcw size={14} />
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {activeFilterChips.length > 0 && (
          <div className="crm-deals-chip-row">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="crm-deals-chip"
                onClick={() => clearDealFilterByKey(chip.key)}
              >
                <span>{chip.label}</span>
                <X size={12} />
              </button>
            ))}
            <button type="button" className="crm-deals-chip crm-deals-chip--clear" onClick={clearDealFilters}>
              Clear All
            </button>
          </div>
        )}

        {selectionMode && (
          <div className="crm-bulk-bar crm-deals-bulk-bar">
            <strong>{selectedDealIds.length} deal(s) selected</strong>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn--compact"
              onClick={handleSelectAllVisibleDeals}
              disabled={bulkBusy}
            >
              {allVisibleSelected ? "Clear All Visible" : "Select All Visible"}
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn--compact"
              onClick={clearSelectedDeals}
              disabled={bulkBusy}
            >
              Clear All
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-danger crm-btn--compact crm-btn-icon-only"
              onClick={handleBulkDeleteSelectedDeals}
              disabled={bulkBusy}
              aria-label="Delete selected deals"
              title="Delete selected deals"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {loading && <CrmPageSkeleton variant="table" />}

        {!loading && deals.length === 0 && (
          <CrmEmptyState
            title="No deals match this view."
            description="Create a new opportunity above or clear the current search/status filters."
          />
        )}

        {!loading && deals.length > 0 && (
          <div className="crm-deals-table-shell">
            <TableVirtuoso
              style={{ height: "clamp(360px, 64vh, 760px)" }}
              data={deals}
              increaseViewportBy={320}
              endReached={loadMoreDeals}
              components={{
                Table: CrmDealsVirtuosoTable,
                TableHead: CrmDealsVirtuosoTableHead,
                TableBody: CrmDealsVirtuosoTableBody,
                Footer: () =>
                  loadingMore ? (
                    <div className="crm-virtual-list-footer">Loading more deals...</div>
                  ) : hasMore ? (
                    <div className="crm-virtual-list-footer crm-virtual-list-footer--more">
                      <span>Scroll to load more deals</span>
                      <button type="button" className="crm-pagination__btn" onClick={loadMoreDeals}>
                        Load more
                      </button>
                    </div>
                  ) : (
                    <div className="crm-virtual-list-footer">End of deal list</div>
                  )
              }}
              fixedHeaderContent={() => (
                <tr>
                  {selectionMode && (
                    <th className="crm-deals-col-select">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleSelectAllVisibleDeals}
                        aria-label="Select all visible deals"
                      />
                    </th>
                  )}
                  <th className="crm-deals-col-deal">Deal</th>
                  <th className="crm-deals-col-contact">Contact</th>
                  <th className="crm-deals-col-status">Status</th>
                  <th className="crm-deals-col-stage">Stage</th>
                  <th className="crm-deals-col-value">Value</th>
                  <th className="crm-deals-col-probability">Probability</th>
                  <th className="crm-deals-col-close">Expected Close</th>
                  <th className="crm-deals-col-owner">Owner</th>
                  <th className="crm-deals-col-actions">Actions</th>
                </tr>
              )}
              itemContent={(_, deal) => {
                const dealId = getEntityId(deal);
                const contact = deal?.contactId || {};
                const contactId = getEntityId(contact);
                const isActionMenuOpen = activeActionMenuDealId === dealId;

                return [
                  selectionMode ? (
                    <td
                      key={`${dealId}-select`}
                      className="crm-deals-col-select"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDealIdSet.has(dealId)}
                        onChange={(event) => handleToggleSelectedDeal(dealId, event.target.checked)}
                        aria-label={`Select deal ${deal?.title || dealId}`}
                      />
                    </td>
                  ) : null,
                  <td key={`${dealId}-deal`} className="crm-deals-col-deal">
                    <button
                      type="button"
                      className="crm-deals-title-btn"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      {deal?.title || "Untitled Deal"}
                    </button>
                    <span title={deal?.productName || deal?.source || ""}>
                      {deal?.productName || deal?.source || "No product set"}
                    </span>
                  </td>,
                  <td key={`${dealId}-contact`} className="crm-deals-col-contact">
                    <button
                      type="button"
                      className="crm-link-btn crm-deals-contact-btn"
                      onClick={() => openContactDrawer(contact)}
                      disabled={!contactId}
                    >
                      <UserRound size={14} />
                      {contact?.name || "Unknown contact"}
                    </button>
                    <span>{contact?.phone || "-"}</span>
                  </td>,
                  <td key={`${dealId}-status`} className="crm-deals-col-status">
                    <span className={`crm-status-badge status-${String(deal?.status || "open").toLowerCase()}`}>
                      {String(deal?.status || "open")}
                    </span>
                  </td>,
                  <td key={`${dealId}-stage`} className="crm-deals-col-stage">
                    {getStageLabel(deal?.stage)}
                  </td>,
                  <td key={`${dealId}-value`} className="crm-deals-col-value">
                    {formatCurrency(deal?.value)}
                  </td>,
                  <td key={`${dealId}-probability`} className="crm-deals-col-probability">
                    {Number(deal?.probability || 0)}%
                  </td>,
                  <td key={`${dealId}-close`} className="crm-deals-col-close">
                    {formatDate(deal?.expectedCloseAt)}
                  </td>,
                  <td key={`${dealId}-owner`} className="crm-deals-col-owner">
                    <span title={deal?.ownerId || ""}>{deal?.ownerId || "Unassigned"}</span>
                  </td>,
                  <td key={`${dealId}-actions`} className="crm-deals-col-actions">
                    <div className="crm-deals-row-actions">
                      <button
                        type="button"
                        className={`crm-deals-kebab ${isActionMenuOpen ? "active" : ""}`}
                        onClick={(event) => toggleDealActionMenu(event, dealId)}
                        aria-label="Open deal actions"
                        aria-expanded={isActionMenuOpen}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {isActionMenuOpen && (
                        <div
                          className="crm-deals-row-actions-menu"
                          style={actionMenuPosition || undefined}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="crm-deals-menu-item"
                            onClick={() => {
                              closeDealActionMenu();
                              setSelectedDeal(deal);
                            }}
                          >
                            <Edit3 size={15} />
                            <span>Open/Edit</span>
                          </button>
                          <button
                            type="button"
                            className="crm-deals-menu-item"
                            onClick={() => {
                              closeDealActionMenu();
                              openContactDrawer(contact);
                            }}
                            disabled={!contactId}
                          >
                            <ExternalLink size={15} />
                            <span>Open Contact</span>
                          </button>
                          <button
                            type="button"
                            className="crm-deals-menu-item crm-deals-menu-item--danger"
                            onClick={() => handleDeleteDeal(deal)}
                          >
                            <Trash2 size={15} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                ];
              }}
            />
          </div>
        )}
      </div>

      <CrmDealDrawer
        open={Boolean(selectedDeal)}
        deal={selectedDeal}
        currentUserId={currentUserId}
        onClose={() => setSelectedDeal(null)}
        onSaved={handleDealSaved}
        onDeleted={handleDealDeleted}
        onOpenContact={(contact) => {
          const normalizedId = getEntityId(contact);
          if (!normalizedId) return;
          setSelectedDeal(null);
          setSelectedContact(contact);
          setSelectedContactId(normalizedId);
        }}
      />

      <CrmContactDrawer
        open={Boolean(selectedContactId)}
        contactId={selectedContactId}
        initialContact={selectedContact}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedContact(null);
          setSelectedContactId("");
        }}
        onContactUpdated={(updatedContact) => {
          setSelectedContact(updatedContact);
          setDeals((previous) =>
            previous.map((deal) =>
              getEntityId(deal?.contactId) === getEntityId(updatedContact)
                ? { ...deal, contactId: { ...(deal?.contactId || {}), ...updatedContact } }
                : deal
            )
          );
        }}
        onTaskMutation={() => loadDeals({ silent: true })}
        onDealMutation={() => loadDeals({ silent: true })}
      />
    </>
  );
};

export default CrmDeals;
