import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { TableVirtuoso } from "react-virtuoso";
import {
  CheckCircle2,
  AlertCircle,
  CirclePlus,
  CalendarClock,
  BadgeCheck,
  Clock3,
  Layers3,
  ListChecks,
  Percent,
  TrendingUp,
  Trash,
  Pencil,
  PencilLine,
  MessageSquarePlus,
  ExternalLink,
  MoreVertical,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import useCrmUserRoster from "../hooks/useCrmUserRoster";
import { getStoredWorkspaceUser, resolveWorkspaceManagementAccessState } from "../utils/agentAccess";
import apiService from "../services/api";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import "./CrmWorkspace.css";

const CRM_TASKS_LOADING_TIMEOUT_MS = 8000;
const CRM_TASKS_CACHE_TTL_MS = 10 * 60 * 1000;
const CRM_TASKS_CACHE_NAMESPACE = "crm-tasks-page";
const TASK_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" }
];

const TASK_PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" }
];

const TASK_TYPES = [
  { key: "follow_up", label: "Follow Up" },
  { key: "call", label: "Call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "meeting", label: "Meeting" },
  { key: "demo", label: "Demo" },
  { key: "other", label: "Other" }
];

const TASK_BUCKETS = [
  { key: "all", label: "All Tasks" },
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "due_today", label: "Due Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" }
];

const TASK_RECURRENCE_OPTIONS = [
  { key: "none", label: "No Repeat" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" }
];

const CRM_TASKS_SCROLL_CHUNK_SIZE = 50;
const CRM_TASK_CONTACT_PAGE_SIZE = 25;
const CRM_TASK_CONTACT_SEARCH_DEBOUNCE_MS = 250;
const CRM_TASK_SEARCH_DEBOUNCE_MS = 300;

const normalizeTaskApiList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.tasks)) return value.tasks;
  return [];
};

const getDisplayName = (value = "") => String(value || "").trim();

const getTaskContactLabel = (contact = {}) => {
  const name = String(contact?.name || contact?.displayName || contact?.contactName || "").trim();
  const phone = String(contact?.phone || contact?.mobile || contact?.phoneNumber || "").trim();
  if (name && phone) return `${name} (${phone})`;
  return name || phone || "Unknown contact";
};

const getUserDisplayLabel = (user = {}, currentUserId = "") => {
  const name = String(user?.name || user?.displayName || user?.fullName || "").trim();
  const email = String(user?.email || "").trim();
  const id = String(user?._id || user?.id || user?.userId || "").trim();
  const resolved = name || email || id || "Unknown user";
  if (currentUserId && id === currentUserId) return `${resolved} (Me)`;
  return resolved;
};

const CrmTasksVirtuosoTable = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <table
    {...props}
    ref={ref}
    className={`crm-task-table crm-task-table--expanded ${className}`.trim()}
    style={{
      ...style,
      width: "100%",
      tableLayout: "fixed"
    }}
  />
));
CrmTasksVirtuosoTable.displayName = "CrmTasksVirtuosoTable";

const CrmTasksVirtuosoTableHead = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <thead {...props} ref={ref} className={className} style={{ ...style }} />
));
CrmTasksVirtuosoTableHead.displayName = "CrmTasksVirtuosoTableHead";

const CrmTasksVirtuosoTableBody = React.forwardRef(({ style, className = "", ...props }, ref) => (
  <tbody {...props} ref={ref} className={className} style={{ ...style }} />
));
CrmTasksVirtuosoTableBody.displayName = "CrmTasksVirtuosoTableBody";

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const toLocalDateTimeInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const toIsoDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const sanitizeCrmTaskContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  stage: String(contact?.stage || "").trim(),
  status: String(contact?.status || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  temperature: String(contact?.temperature || "").trim(),
  ownerId: String(contact?.ownerId || "").trim(),
  nextFollowUpAt: String(contact?.nextFollowUpAt || "").trim()
});

const sanitizeTaskComment = (comment = {}) => ({
  text: String(comment?.text || "").trim(),
  createdBy: String(comment?.createdBy || "").trim(),
  createdAt: String(comment?.createdAt || "").trim()
});

const sanitizeTaskRecurrence = (recurrence = {}) => ({
  frequency: String(recurrence?.frequency || "none").trim(),
  interval:
    Number.isFinite(Number(recurrence?.interval)) && Number(recurrence?.interval) > 0
      ? Number(recurrence.interval)
      : 1
});

const sanitizeCrmTask = (task = {}) => ({
  _id: String(task?._id || "").trim(),
  id: String(task?.id || "").trim(),
  title: String(task?.title || "").trim(),
  description: String(task?.description || "").trim(),
  taskType: String(task?.taskType || "").trim(),
  dueAt: String(task?.dueAt || "").trim(),
  reminderAt: String(task?.reminderAt || "").trim(),
  priority: String(task?.priority || "").trim(),
  status: String(task?.status || "").trim(),
  assignedTo: String(task?.assignedTo || "").trim(),
  completedAt: String(task?.completedAt || "").trim(),
  completedBy: String(task?.completedBy || "").trim(),
  recurrence: sanitizeTaskRecurrence(task?.recurrence || {}),
  comments: Array.isArray(task?.comments) ? task.comments.map(sanitizeTaskComment) : [],
  contactId: sanitizeCrmTaskContact(task?.contactId)
});

const toTaskTypeLabel = (value) =>
  String(value || "follow_up")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getInitialTaskForm = (currentUserId = "") => ({
  contactId: "",
  title: "",
  description: "",
  dueAt: "",
  reminderAt: "",
  priority: "medium",
  taskType: "follow_up",
  assignedTo: String(currentUserId || "").trim(),
  recurrenceFrequency: "none",
  recurrenceInterval: "1",
  comment: ""
});

const getTaskFormFromTask = (task = {}, currentUserId = "") => ({
  contactId: getEntityId(task?.contactId),
  title: String(task?.title || ""),
  description: String(task?.description || ""),
  dueAt: toLocalDateTimeInputValue(task?.dueAt),
  reminderAt: toLocalDateTimeInputValue(task?.reminderAt),
  priority: String(task?.priority || "medium"),
  taskType: String(task?.taskType || "follow_up"),
  assignedTo: String(task?.assignedTo || "").trim() || String(currentUserId || "").trim(),
  recurrenceFrequency: String(task?.recurrence?.frequency || "none"),
  recurrenceInterval: String(task?.recurrence?.interval || "1"),
  comment: ""
});

const CrmTasks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBucketFilter = String(searchParams.get("bucket") || "all").trim().toLowerCase();
  const requestedStatusFilter = String(searchParams.get("status") || "all").trim().toLowerCase();
  const requestedPriorityFilter = String(searchParams.get("priority") || "all").trim().toLowerCase();
  const requestedTaskTypeFilter = String(searchParams.get("taskType") || "all").trim().toLowerCase();
  const requestedAssignedToFilter = String(searchParams.get("assignedTo") || "all").trim();
  const requestedSearchQuery = String(searchParams.get("q") || "").trim();
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [taskAdminAgents, setTaskAdminAgents] = useState([]);
  const [taskAdminAgentsLoading, setTaskAdminAgentsLoading] = useState(false);
  const [taskAdminAgentsError, setTaskAdminAgentsError] = useState("");
  const [taskAdminBulkAssignTarget, setTaskAdminBulkAssignTarget] = useState("");
  const [taskAdminBulkAssignBucket, setTaskAdminBulkAssignBucket] = useState("overdue");
  const [taskAdminBulkAssignBusy, setTaskAdminBulkAssignBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    TASK_STATUSES.some((status) => status.key === requestedStatusFilter)
      ? requestedStatusFilter
      : "all"
  );
  const [priorityFilter, setPriorityFilter] = useState(() =>
    TASK_PRIORITIES.some((priority) => priority.key === requestedPriorityFilter)
      ? requestedPriorityFilter
      : "all"
  );
  const [bucketFilter, setBucketFilter] = useState(() =>
    TASK_BUCKETS.some((bucket) => bucket.key === requestedBucketFilter)
      ? requestedBucketFilter
      : "all"
  );
  const [taskTypeFilter, setTaskTypeFilter] = useState(() =>
    TASK_TYPES.some((taskType) => taskType.key === requestedTaskTypeFilter)
      ? requestedTaskTypeFilter
      : "all"
  );
  const [assignedToFilter, setAssignedToFilter] = useState(() =>
    requestedAssignedToFilter ? requestedAssignedToFilter : "all"
  );
  const [searchInput, setSearchInput] = useState(requestedSearchQuery);
  const [searchQuery, setSearchQuery] = useState(requestedSearchQuery);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMoreTasks, setHasMoreTasks] = useState(true);
  const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("complete");
  const [bulkDueAt, setBulkDueAt] = useState("");
  const [bulkReminderAt, setBulkReminderAt] = useState("");
  const [bulkAssignedTo, setBulkAssignedTo] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [toast, setToast] = useState(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeActionMenuTaskId, setActiveActionMenuTaskId] = useState("");
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const [taskContactSearch, setTaskContactSearch] = useState("");
  const [taskContactLoading, setTaskContactLoading] = useState(false);
  const [taskContactSearchResults, setTaskContactSearchResults] = useState([]);
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const hasInitializedFilterEffectRef = useRef(false);
  const taskContactSearchSeqRef = useRef(0);
  const taskLoadRequestIdRef = useRef(0);
  const loadDataRef = useRef(null);
  const currentUserId = resolveCacheUserId();
  const workspaceUser = getStoredWorkspaceUser();
  const isAdminWorkspace = resolveWorkspaceManagementAccessState(workspaceUser);
  const {
    users,
    loading: usersLoading
  } = useCrmUserRoster();

  useEffect(() => {
    if (!isAdminWorkspace) {
      setTaskAdminAgents([]);
      setTaskAdminAgentsError("");
      setTaskAdminAgentsLoading(false);
      return undefined;
    }

    let active = true;
    setTaskAdminAgentsLoading(true);
    setTaskAdminAgentsError("");

    apiService
      .getMyAgents()
      .then((result) => {
        if (!active) return;
        const nextAgents = Array.isArray(result?.data?.agents)
          ? result.data.agents.filter((agent) => {
              const role = String(agent?.companyRole || agent?.role || "").trim().toLowerCase();
              return role !== "admin" && agent?.isEnabled !== false;
            })
          : [];
        setTaskAdminAgents(nextAgents);
      })
      .catch((error) => {
        if (!active) return;
        setTaskAdminAgents([]);
        setTaskAdminAgentsError(error?.message || "Failed to load workspace agents");
      })
      .finally(() => {
        if (!active) return;
        setTaskAdminAgentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdminWorkspace]);

  const [form, setForm] = useState(() => getInitialTaskForm(currentUserId));
  const isDefaultView =
    statusFilter === "all" &&
    priorityFilter === "all" &&
    bucketFilter === "all" &&
    taskTypeFilter === "all" &&
    assignedToFilter === "all" &&
    !searchQuery.trim();

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resetTaskForm = useCallback(() => {
    setEditingTaskId("");
    setForm(getInitialTaskForm(currentUserId));
  }, [currentUserId]);

  const closeTaskModal = useCallback(() => {
    setCreateTaskOpen(false);
    resetTaskForm();
    taskContactSearchSeqRef.current += 1;
    setTaskContactSearch("");
    setTaskContactSearchResults([]);
  }, [resetTaskForm]);

  const openCreateTaskModal = useCallback(() => {
    resetTaskForm();
    taskContactSearchSeqRef.current += 1;
    setTaskContactSearch("");
    setTaskContactSearchResults([]);
    setCreateTaskOpen(true);
  }, [resetTaskForm]);

  const openEditTaskModal = useCallback(
    (task) => {
      const taskId = getEntityId(task);
      if (!taskId) return;
      setEditingTaskId(taskId);
      setForm(getTaskFormFromTask(task, currentUserId));
      taskContactSearchSeqRef.current += 1;
      const normalizedContact = sanitizeCrmTaskContact(task?.contactId || {});
      setTaskContactSearch(getTaskContactLabel(normalizedContact));
      setTaskContactSearchResults(normalizedContact._id || normalizedContact.phone ? [normalizedContact] : []);
      setCreateTaskOpen(true);
    },
    [currentUserId]
  );

  useEffect(() => {
    if (!createTaskOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeTaskModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTaskModal, createTaskOpen]);

  const closeTaskActionMenu = useCallback(() => {
    setActiveActionMenuTaskId("");
    setActionMenuPosition(null);
  }, []);

  useEffect(() => {
    if (!activeActionMenuTaskId) return undefined;

    const handleWindowInteract = () => {
      closeTaskActionMenu();
    };

    window.addEventListener("click", handleWindowInteract);
    window.addEventListener("scroll", handleWindowInteract, true);
    window.addEventListener("resize", handleWindowInteract);

    return () => {
      window.removeEventListener("click", handleWindowInteract);
      window.removeEventListener("scroll", handleWindowInteract, true);
      window.removeEventListener("resize", handleWindowInteract);
    };
  }, [activeActionMenuTaskId, closeTaskActionMenu]);

  const persistTasksCache = useCallback(
    (nextTasks, nextContacts, nextSummary) => {
      if (!isDefaultView) return;

      const cachePayload = {
        tasks: (Array.isArray(nextTasks) ? nextTasks : [])
          .map(sanitizeCrmTask)
          .filter((task) => task._id || task.id || task.title),
        summary: nextSummary || null
      };

      if (Array.isArray(nextContacts)) {
        cachePayload.contacts = nextContacts
          .map(sanitizeCrmTaskContact)
          .filter((contact) => contact._id || contact.id || contact.phone);
      }

      writeSidebarPageCache(CRM_TASKS_CACHE_NAMESPACE, cachePayload, {
        currentUserId,
        ttlMs: CRM_TASKS_CACHE_TTL_MS
      });
    },
    [currentUserId, isDefaultView]
  );

  const loadData = useCallback(
    async ({ silent = false, append = false, cursor = "" } = {}) => {
      const requestId = ++taskLoadRequestIdRef.current;
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (!silent && !append) setLoading(false);
        },
        CRM_TASKS_LOADING_TIMEOUT_MS
      );
      try {
        if (append) {
          setLoadingMoreTasks(true);
        } else if (!silent) {
          setLoading(true);
          setTasks([]);
        }
        setError("");
        if (!append) {
          setHasMoreTasks(true);
          setNextCursor("");
          setSelectedTaskIds([]);
          setExpandedTaskId("");
        }

        const normalizedSearch = String(searchQuery || "").trim();
        const taskParams = {
          limit: CRM_TASKS_SCROLL_CHUNK_SIZE,
          cursorMode: "true"
        };
        if (normalizedSearch) taskParams.search = normalizedSearch;
        if (statusFilter !== "all") taskParams.status = statusFilter;
        if (priorityFilter !== "all") taskParams.priority = priorityFilter;
        if (bucketFilter !== "all") taskParams.bucket = bucketFilter;
        if (taskTypeFilter !== "all") taskParams.taskType = taskTypeFilter;
        if (assignedToFilter !== "all") taskParams.assignedTo = assignedToFilter;
        if (append && cursor) taskParams.cursor = cursor;

        const summaryParams = { ...taskParams };
        if (assignedToFilter !== "all") summaryParams.assignedTo = assignedToFilter;
        delete summaryParams.limit;
        delete summaryParams.cursor;
        delete summaryParams.cursorMode;

        const [tasksResult, summaryResult] = await Promise.all([
          crmService.getTasks(taskParams),
          crmService.getTaskSummary(summaryParams)
        ]);
        if (requestId !== taskLoadRequestIdRef.current) return;

        if (tasksResult?.success === false) {
          throw new Error(tasksResult?.error || "Failed to fetch tasks");
        }
        if (summaryResult?.success === false) {
          throw new Error(summaryResult?.error || "Failed to fetch task summary");
        }

        const nextTasks = normalizeTaskApiList(tasksResult?.data).map(sanitizeCrmTask);
        const nextSummary = summaryResult?.data || null;

        const mergedTasks = append ? [...tasks] : [];
        if (append) {
          const existingIds = new Set(mergedTasks.map(getEntityId));
          nextTasks.forEach((task) => {
            const taskId = getEntityId(task);
            if (!taskId || existingIds.has(taskId)) return;
            existingIds.add(taskId);
            mergedTasks.push(task);
          });
        } else {
          mergedTasks.push(...nextTasks);
        }
        setTasks(mergedTasks);
        setSummary(nextSummary);
        setHasMoreTasks(Boolean(tasksResult?.hasMore));
        setNextCursor(String(tasksResult?.nextCursor || ""));
        setSelectedTaskIds((previous) =>
          previous.filter((taskId) => mergedTasks.some((task) => getEntityId(task) === taskId))
        );
        if (!append) {
          persistTasksCache(mergedTasks, null, nextSummary);
        }
      } catch (loadError) {
        if (requestId !== taskLoadRequestIdRef.current) return;
        setError(loadError?.message || "Failed to load CRM tasks");
      } finally {
        releaseLoadingGuard();
        if (requestId !== taskLoadRequestIdRef.current) return;
        setLoading(false);
        setLoadingMoreTasks(false);
      }
    },
    [
      assignedToFilter,
      bucketFilter,
      persistTasksCache,
      priorityFilter,
      searchQuery,
      statusFilter,
      taskTypeFilter,
      tasks
    ]
  );

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  const handleRealtimeRefresh = useCallback(() => {
    loadData({ silent: true });
  }, [loadData]);

  const crmRealtime = useCrmRealtimeRefresh({
    currentUserId,
    entities: ["task", "contact"],
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    setForm(getInitialTaskForm(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    const desiredBucket = String(bucketFilter || "all").trim().toLowerCase();
    const desiredStatus = String(statusFilter || "all").trim().toLowerCase();
    const desiredPriority = String(priorityFilter || "all").trim().toLowerCase();
    const desiredTaskType = String(taskTypeFilter || "all").trim().toLowerCase();
    const desiredAssignedTo = String(assignedToFilter || "all").trim();
    const desiredSearch = String(searchQuery || "").trim();

    const currentBucket = String(searchParams.get("bucket") || "all").trim().toLowerCase();
    const currentStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
    const currentPriority = String(searchParams.get("priority") || "all").trim().toLowerCase();
    const currentTaskType = String(searchParams.get("taskType") || "all").trim().toLowerCase();
    const currentAssignedTo = String(searchParams.get("assignedTo") || "all").trim();
    const currentSearch = String(searchParams.get("q") || "").trim();

    const isUnchanged =
      currentBucket === desiredBucket &&
      currentStatus === desiredStatus &&
      currentPriority === desiredPriority &&
      currentTaskType === desiredTaskType &&
      currentAssignedTo === desiredAssignedTo &&
      currentSearch === desiredSearch;
    if (isUnchanged) return;

    const nextParams = new URLSearchParams(searchParams);

    if (desiredBucket === "all") nextParams.delete("bucket");
    else nextParams.set("bucket", desiredBucket);

    if (desiredStatus === "all") nextParams.delete("status");
    else nextParams.set("status", desiredStatus);

    if (desiredPriority === "all") nextParams.delete("priority");
    else nextParams.set("priority", desiredPriority);

    if (desiredTaskType === "all") nextParams.delete("taskType");
    else nextParams.set("taskType", desiredTaskType);

    if (desiredAssignedTo === "all") nextParams.delete("assignedTo");
    else nextParams.set("assignedTo", desiredAssignedTo);

    if (!desiredSearch) nextParams.delete("q");
    else nextParams.set("q", desiredSearch);

    nextParams.delete("page");
    nextParams.delete("limit");

    setSearchParams(nextParams, { replace: true });
  }, [
    assignedToFilter,
    bucketFilter,
    priorityFilter,
    searchParams,
    searchQuery,
    setSearchParams,
    statusFilter,
    taskTypeFilter
  ]);

  useEffect(() => {
    const cachedTasks = readSidebarPageCache(CRM_TASKS_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    const markInitialized = () => {
      window.setTimeout(() => {
        hasInitializedFilterEffectRef.current = true;
      }, 0);
    };

    if (Array.isArray(cachedTasks?.data?.tasks)) {
      setTasks(cachedTasks.data.tasks.map(sanitizeCrmTask));
      setSummary(cachedTasks?.data?.summary || null);
      setLoading(false);
      loadDataRef.current?.({ silent: true });
      markInitialized();
      return;
    }

    loadDataRef.current?.();
    markInitialized();
  }, [currentUserId]);

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }
    loadDataRef.current?.({ silent: true });
    setSelectedTaskIds([]);
    setExpandedTaskId("");
  }, [
    assignedToFilter,
    bucketFilter,
    priorityFilter,
    searchQuery,
    statusFilter,
    taskTypeFilter
  ]);

  useEffect(() => {
    if (searchInput === searchQuery) return undefined;
    const timer = window.setTimeout(() => {
      setSearchQuery(String(searchInput || "").trim());
      setSelectedTaskIds([]);
      setExpandedTaskId("");
    }, CRM_TASK_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    if (!createTaskOpen) {
      setTaskContactSearch("");
      setTaskContactSearchResults([]);
      setTaskContactLoading(false);
      return undefined;
    }

    const query = String(taskContactSearch || "").trim();
    const loadContacts = async () => {
      const requestSeq = taskContactSearchSeqRef.current + 1;
      taskContactSearchSeqRef.current = requestSeq;
      try {
        setTaskContactLoading(true);
        const result = await crmService.getContacts({
          search: query,
          limit: CRM_TASK_CONTACT_PAGE_SIZE,
          page: 1
        });
        if (taskContactSearchSeqRef.current !== requestSeq) return;
        const nextContacts = normalizeTaskApiList(result?.data).map(sanitizeCrmTaskContact);
        setTaskContactSearchResults(nextContacts);
      } catch (contactError) {
        if (taskContactSearchSeqRef.current !== requestSeq) return;
        setTaskContactSearchResults([]);
      } finally {
        if (taskContactSearchSeqRef.current === requestSeq) {
          setTaskContactLoading(false);
        }
      }
    };

    const timer = window.setTimeout(loadContacts, CRM_TASK_CONTACT_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [createTaskOpen, taskContactSearch]);

  const contactOptions = useMemo(
    () =>
      taskContactSearchResults.map((contact) => ({
        id: getEntityId(contact),
        label: getTaskContactLabel(contact)
      })),
    [taskContactSearchResults]
  );

  const assigneeOptions = useMemo(() => {
    const uniqueUsers = [];
    const seen = new Set();

    const addUser = (user, fallbackId = "") => {
      const userId = String(user?._id || user?.id || user?.userId || fallbackId || "").trim();
      if (!userId || seen.has(userId)) return;
      seen.add(userId);
      uniqueUsers.push({
        id: userId,
        label: getUserDisplayLabel(user, currentUserId)
      });
    };

    users.forEach((user) => addUser(user));
    if (currentUserId) {
      addUser({ _id: currentUserId, name: currentUserId }, currentUserId);
    }
    if (bulkAssignedTo) {
      addUser({ _id: bulkAssignedTo, name: bulkAssignedTo }, bulkAssignedTo);
    }
    if (form.assignedTo) {
      addUser({ _id: form.assignedTo, name: form.assignedTo }, form.assignedTo);
    }

    return uniqueUsers;
  }, [bulkAssignedTo, currentUserId, form.assignedTo, users]);

  const activeAgentOptions = useMemo(() => {
    return (Array.isArray(taskAdminAgents) ? taskAdminAgents : [])
      .map((agent) => ({
        id: String(agent?._id || agent?.id || agent?.userId || "").trim(),
        label: getUserDisplayLabel(agent, currentUserId)
      }))
      .filter((agent) => agent.id);
  }, [currentUserId, taskAdminAgents]);

  const taskAdminBulkAssignCount =
    taskAdminBulkAssignBucket === "due_today"
      ? Number(summary?.dueToday ?? 0)
      : taskAdminBulkAssignBucket === "open"
        ? Number(summary?.open ?? 0)
        : Number(summary?.overdue ?? 0);

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const selectionMode = selectedTaskIds.length > 0;
  const isEditingTask = Boolean(editingTaskId);
  const activeActionTask = useMemo(
    () => tasks.find((task) => getEntityId(task) === activeActionMenuTaskId) || null,
    [activeActionMenuTaskId, tasks]
  );

  useEffect(() => {
    setSelectedTaskIds((previous) => {
      if (!previous.length) return previous;
      const visibleTaskIds = tasks.map((task) => getEntityId(task)).filter(Boolean);
      const next = previous.filter((taskId) => visibleTaskIds.includes(taskId));
      if (next.length === previous.length && next.every((taskId, index) => taskId === previous[index])) {
        return previous;
      }
      return next;
    });
  }, [tasks]);

  const handleCreateTask = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        setSubmitting(true);
        setError("");

        if (!form.contactId) throw new Error("Select a contact");
        if (!String(form.title || "").trim()) throw new Error("Task title is required");

        const payload = {
          contactId: form.contactId,
          title: String(form.title || "").trim(),
          description: String(form.description || "").trim(),
          priority: form.priority || "medium",
          taskType: form.taskType || "follow_up",
          assignedTo: String(form.assignedTo || "").trim() || null
        };

        const dueAtIso = toIsoDateTime(form.dueAt);
        const reminderAtIso = toIsoDateTime(form.reminderAt);
        if (dueAtIso) payload.dueAt = dueAtIso;
        if (reminderAtIso) payload.reminderAt = reminderAtIso;
        if (String(form.recurrenceFrequency || "none").trim() !== "none") {
          payload.recurrence = {
            frequency: form.recurrenceFrequency,
            interval: Math.max(Number(form.recurrenceInterval) || 1, 1)
          };
        }
        const commentText = String(form.comment || "").trim();

        if (editingTaskId) {
          const result = await crmService.updateTask(editingTaskId, payload);
          if (result?.success === false) {
            throw new Error(result?.error || "Failed to update task");
          }

          if (commentText) {
            try {
              await crmService.addTaskComment(editingTaskId, commentText);
            } catch (commentError) {
              console.error(commentError);
            }
          }

          setToast({ type: "success", message: "Task updated successfully." });
        } else {
          if (commentText) {
            payload.comment = commentText;
          }
          const result = await crmService.createTask(payload);
          if (result?.success === false) {
            throw new Error(result?.error || "Failed to create task");
          }
          setToast({ type: "success", message: "Task created successfully." });
        }

        await loadData({ silent: true });
        closeTaskModal();
      } catch (submitError) {
        setError(submitError?.message || "Failed to save task");
        setToast({
          type: "error",
          message: submitError?.message || "Failed to save task"
        });
      } finally {
        setSubmitting(false);
      }
    },
    [closeTaskModal, editingTaskId, form, loadData]
  );

  const handleTaskStatusChange = useCallback(
    async (task, nextStatus) => {
      const taskId = getEntityId(task);
      if (!taskId) return;

      try {
        setBusyTaskId(taskId);
        setError("");
        const result = await crmService.updateTask(taskId, { status: nextStatus });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update task");
        }
        await loadData({ silent: true });
        setToast({
          type: "success",
          message: `Task marked as ${String(nextStatus || "updated").replace(/_/g, " ")}.`
        });
      } catch (updateError) {
        setError(updateError?.message || "Failed to update task");
        setToast({
          type: "error",
          message: updateError?.message || "Failed to update task"
        });
      } finally {
        setBusyTaskId("");
      }
    },
    [loadData]
  );

  const handleDeleteTask = useCallback(
    async (task) => {
      const taskId = getEntityId(task);
      if (!taskId) return;

      try {
        setBusyTaskId(taskId);
        setError("");
        const result = await crmService.deleteTask(taskId);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete task");
        }
        await loadData({ silent: true });
        setToast({ type: "success", message: "Task deleted." });
      } catch (deleteError) {
        setError(deleteError?.message || "Failed to delete task");
        setToast({
          type: "error",
          message: deleteError?.message || "Failed to delete task"
        });
      } finally {
        setBusyTaskId("");
      }
    },
    [loadData]
  );

  const handleAddComment = useCallback(
    async (task) => {
      const taskId = getEntityId(task);
      const draft = String(commentDrafts?.[taskId] || "").trim();
      if (!taskId || !draft) return;

      try {
        setBusyTaskId(taskId);
        setError("");
        const result = await crmService.addTaskComment(taskId, draft);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to add task comment");
        }
        setCommentDrafts((previous) => ({
          ...previous,
          [taskId]: ""
        }));
        await loadData({ silent: true });
        setToast({ type: "success", message: "Internal comment added." });
      } catch (commentError) {
        setError(commentError?.message || "Failed to add task comment");
        setToast({
          type: "error",
          message: commentError?.message || "Failed to add task comment"
        });
      } finally {
        setBusyTaskId("");
      }
    },
    [commentDrafts, loadData]
  );

  const handleBulkAction = useCallback(async () => {
    if (!selectedTaskIds.length) {
      setError("Select at least one task");
      return;
    }

    try {
      setBulkBusy(true);
      setError("");

      const payload = {
        taskIds: selectedTaskIds,
        action: bulkAction
      };

      if (bulkAction === "assign") {
        payload.assignedTo = String(bulkAssignedTo || "").trim() || null;
      }
      if (bulkAction === "reschedule") {
        const dueAtIso = toIsoDateTime(bulkDueAt);
        const reminderAtIso = toIsoDateTime(bulkReminderAt);
        if (bulkDueAt && !dueAtIso) {
          throw new Error("Provide a valid due date for reschedule");
        }
        if (bulkReminderAt && !reminderAtIso) {
          throw new Error("Provide a valid reminder date for reschedule");
        }
        payload.dueAt = dueAtIso;
        payload.reminderAt = reminderAtIso;
      }

      const result = await crmService.bulkUpdateTasks(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to run bulk task action");
      }

      setSelectedTaskIds([]);
      setBulkDueAt("");
      setBulkReminderAt("");
      setBulkAssignedTo("");
      await loadData({ silent: true });
      setToast({
        type: "success",
        message: `Bulk action "${bulkAction.replace(/_/g, " ")}" completed for ${selectedTaskIds.length} task(s).`
      });
    } catch (bulkError) {
      setError(bulkError?.message || "Failed to run bulk task action");
      setToast({
        type: "error",
        message: bulkError?.message || "Failed to run bulk task action"
      });
    } finally {
      setBulkBusy(false);
    }
  }, [bulkAction, bulkAssignedTo, bulkDueAt, bulkReminderAt, loadData, selectedTaskIds]);

  const handleBulkDeleteSelected = useCallback(async () => {
    if (!selectedTaskIds.length) {
      setError("Select at least one task");
      return;
    }

    if (!window.confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)) {
      return;
    }

    try {
      setBulkBusy(true);
      setError("");

      const result = await crmService.bulkUpdateTasks({
        taskIds: selectedTaskIds,
        action: "delete"
      });

      if (result?.success === false) {
        throw new Error(result?.error || "Failed to delete selected tasks");
      }

      setSelectedTaskIds([]);
      await loadData({ silent: true });
      setToast({
        type: "success",
        message: `Deleted ${selectedTaskIds.length} selected task(s).`
      });
    } catch (bulkError) {
      setError(bulkError?.message || "Failed to delete selected tasks");
      setToast({
        type: "error",
        message: bulkError?.message || "Failed to delete selected tasks"
      });
    } finally {
      setBulkBusy(false);
    }
  }, [loadData, selectedTaskIds]);

  const assignAllFollowupTasks = useCallback(async () => {
    if (!isAdminWorkspace) return;

    const targetAssignedTo = String(taskAdminBulkAssignTarget || "").trim();
    if (!targetAssignedTo) {
      setToast({ type: "error", message: "Choose an active agent first." });
      return;
    }

    if (!taskAdminBulkAssignCount) {
      setToast({ type: "info", message: "No matching follow-up tasks available to assign." });
      return;
    }

    const targetAgent = activeAgentOptions.find((agent) => agent.id === targetAssignedTo);
    const targetLabel = targetAgent?.label || "selected agent";
    const bucketLabel =
      taskAdminBulkAssignBucket === "due_today"
        ? "due today"
        : taskAdminBulkAssignBucket === "open"
          ? "open"
          : "overdue";
    const confirmed = window.confirm(
      `Assign all ${taskAdminBulkAssignCount} ${bucketLabel} follow-up task${
        taskAdminBulkAssignCount === 1 ? "" : "s"
      } to ${targetLabel}?`
    );
    if (!confirmed) return;

    setTaskAdminBulkAssignBusy(true);
    try {
      const result = await crmService.bulkUpdateTasks({
        action: "assign",
        matchAll: true,
        criteria: {
          bucket: taskAdminBulkAssignBucket
        },
        assignedTo: targetAssignedTo
      });

      if (result?.success === false) {
        throw new Error(result?.error || "Failed to assign overdue tasks");
      }

      const assignedCount = Number(result?.data?.updatedCount || taskAdminBulkAssignCount || 0);
      setTaskAdminBulkAssignTarget("");
      setToast({
        type: "success",
        message: `Assigned ${assignedCount} task${assignedCount === 1 ? "" : "s"} to ${targetLabel}.`
      });
      await loadData({ silent: true });
    } catch (assignError) {
      setToast({
        type: "error",
        message: assignError?.message || "Failed to assign overdue tasks"
      });
    } finally {
      setTaskAdminBulkAssignBusy(false);
    }
  }, [
    activeAgentOptions,
    isAdminWorkspace,
    loadData,
    taskAdminBulkAssignBucket,
    taskAdminBulkAssignCount,
    taskAdminBulkAssignTarget
  ]);

  const openContactDrawer = useCallback((contact) => {
    const normalizedId = getEntityId(contact);
    setSelectedContactId(normalizedId);
    setSelectedContact(contact);
  }, []);

  const handleContactUpdated = useCallback((updatedContact) => {
    const normalizedId = getEntityId(updatedContact);
    if (!normalizedId) return;

    setSelectedContact(updatedContact);
    setTaskContactSearchResults((previous) =>
      previous.map((contact) =>
        getEntityId(contact) === normalizedId ? { ...contact, ...updatedContact } : contact
      )
    );
    setTasks((previous) =>
      previous.map((task) => {
        const taskContactId = getEntityId(task?.contactId);
        if (taskContactId !== normalizedId) return task;
        return {
          ...task,
          contactId: {
            ...(task?.contactId || {}),
            ...updatedContact
          }
        };
      })
    );
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedContactId("");
    setSelectedContact(null);
  }, []);

  const resetTaskWindow = useCallback(() => {
    setSelectedTaskIds([]);
    setExpandedTaskId("");
    closeTaskActionMenu();
  }, []);

  const setBucketFilterAndReset = useCallback((value) => {
    setBucketFilter(value);
    resetTaskWindow();
  }, [resetTaskWindow]);

  const setStatusFilterAndReset = useCallback((value) => {
    setStatusFilter(value);
    resetTaskWindow();
  }, [resetTaskWindow]);

  const setPriorityFilterAndReset = useCallback((value) => {
    setPriorityFilter(value);
    resetTaskWindow();
  }, [resetTaskWindow]);

  const setTaskTypeFilterAndReset = useCallback((value) => {
    setTaskTypeFilter(value);
    resetTaskWindow();
  }, [resetTaskWindow]);

  const setAssignedToFilterAndReset = useCallback((value) => {
    setAssignedToFilter(value);
    resetTaskWindow();
  }, [resetTaskWindow]);

  const toggleSearchInput = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const toggleTaskDetails = useCallback((taskId) => {
    const normalizedTaskId = String(taskId || "").trim();
    if (!normalizedTaskId) return;
    setExpandedTaskId((previous) => (previous === normalizedTaskId ? "" : normalizedTaskId));
  }, []);

  const handleToggleTaskActions = useCallback(
    (task, event) => {
      event.stopPropagation();
      const taskId = getEntityId(task);
      if (!taskId) return;

      const isCurrentMenu = String(activeActionMenuTaskId || "") === String(taskId || "");
      if (isCurrentMenu) {
        closeTaskActionMenu();
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = 190;
      const menuHeight = 178;
      const viewportPadding = 12;
      const nextLeft = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );
      const nextTop = window.innerHeight - rect.bottom < menuHeight + viewportPadding
        ? Math.max(viewportPadding, rect.top - menuHeight - 8)
        : rect.bottom + 8;

      setActionMenuPosition({ top: nextTop, left: nextLeft });
      setActiveActionMenuTaskId(taskId);
    },
    [activeActionMenuTaskId, closeTaskActionMenu]
  );

  const toggleTaskSelection = useCallback((taskId) => {
    const normalizedTaskId = String(taskId || "").trim();
    if (!normalizedTaskId) return;
    setSelectedTaskIds((previous) =>
      previous.includes(normalizedTaskId)
        ? previous.filter((value) => value !== normalizedTaskId)
        : [...previous, normalizedTaskId]
    );
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visibleTaskIds = tasks.map((task) => getEntityId(task)).filter(Boolean);
    const allSelected = visibleTaskIds.every((taskId) => selectedTaskIdSet.has(taskId));
    setSelectedTaskIds((previous) =>
      allSelected
        ? previous.filter((taskId) => !visibleTaskIds.includes(taskId))
        : Array.from(new Set([...previous, ...visibleTaskIds]))
    );
  }, [selectedTaskIdSet, tasks]);

  const loadMoreTasks = useCallback(() => {
    if (loading || loadingMoreTasks || !hasMoreTasks || !nextCursor) return;
    loadDataRef.current?.({ silent: true, append: true, cursor: nextCursor });
  }, [hasMoreTasks, loading, loadingMoreTasks, nextCursor]);

  const summaryCards = [
    { key: "open", label: "Open", value: summary?.open ?? 0, interactive: true, icon: Layers3 },
    { key: "overdue", label: "Overdue", value: summary?.overdue ?? 0, interactive: true, icon: AlertCircle },
    { key: "due_today", label: "Due Today", value: summary?.dueToday ?? 0, interactive: true, icon: CalendarClock },
    { key: "today_calls", label: "Today Calls", value: summary?.todayCalls ?? 0, interactive: false, icon: Clock3 },
    { key: "completed", label: "Completed", value: summary?.completed ?? 0, interactive: true, icon: BadgeCheck },
    { key: "all", label: "Total", value: summary?.total ?? 0, interactive: true, icon: ListChecks },
    {
      key: "completion_rate",
      label: "Completion Rate",
      value: `${summary?.completionRate ?? 0}%`,
      interactive: false,
      icon: Percent
    },
    {
      key: "follow_up_completion",
      label: "Follow-up Rate",
      value: `${summary?.followUpCompletionRate ?? 0}%`,
      interactive: false,
      icon: TrendingUp
    }
  ];

  const allVisibleSelected =
    tasks.length > 0 &&
    tasks.every((task) => selectedTaskIdSet.has(getEntityId(task)));
  const isTasksRoute = String(location.pathname || "").includes("/crm/tasks");
  const isFollowUpsRoute = String(location.pathname || "").includes("/crm/follow-ups");

  return (
    <>
      <div className="crm-workspace">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Tasks"
          subtitle="Track follow-ups with live updates, filters, task actions, reminders, and bulk operations."
          actions={
            <div className="crm-page-header__action-group">
              <div className="crm-page-switcher" aria-label="CRM page switcher">
                <button
                  type="button"
                  className={`crm-btn crm-btn--compact ${
                    isTasksRoute ? "crm-btn-primary" : "crm-btn-secondary"
                  }`}
                  onClick={() => navigate("/crm/tasks")}
                >
                  Tasks
                </button>
                <button
                  type="button"
                  className={`crm-btn crm-btn--compact ${
                    isFollowUpsRoute ? "crm-btn-primary" : "crm-btn-secondary"
                  }`}
                  onClick={() => navigate("/crm/follow-ups")}
                >
                  Follow Ups
                </button>
              </div>
              <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
              <button
                type="button"
                className="crm-btn crm-btn-primary crm-btn--compact crm-create-task-trigger"
                onClick={openCreateTaskModal}
              >
                <CirclePlus size={16} />
                Create Task
              </button>
            </div>
          }
        />

        <div className="crm-summary-grid crm-summary-grid--tasks">
          {summaryCards.map((card) =>
            card.interactive ? (
              <button
                key={card.key}
                type="button"
                className={`crm-summary-card crm-summary-card--button ${
                  bucketFilter === card.key ? "crm-summary-card--active" : ""
                }`}
                onClick={() => setBucketFilterAndReset(card.key)}
              >
                <div className="crm-summary-card__top">
                  {card.icon ? (
                    <span className="crm-summary-card__icon" aria-hidden="true">
                      <card.icon size={15} />
                    </span>
                  ) : null}
                  <strong>{card.value}</strong>
                </div>
                <span className="crm-summary-card__label">{card.label}</span>
              </button>
            ) : (
              <div key={card.key} className="crm-summary-card">
                <div className="crm-summary-card__top">
                  {card.icon ? (
                    <span className="crm-summary-card__icon" aria-hidden="true">
                      <card.icon size={15} />
                    </span>
                  ) : null}
                  <strong>{card.value}</strong>
                </div>
                <span className="crm-summary-card__label">{card.label}</span>
              </div>
            )
          )}
        </div>

        {isAdminWorkspace ? (
          <section className="crm-admin-task-assign-card" aria-labelledby="crm-admin-task-assign-title">
            <div className="crm-admin-task-assign-card__header">
              <div>
                <span className="crm-admin-task-assign-card__eyebrow">Admin bulk action</span>
                <h2 id="crm-admin-task-assign-title">Assign follow-up tasks to an active agent</h2>
                <p>
                  Push the follow-up queue into one agent workstream. The task owner updates cleanly and stays
                  aligned with CRM ownership flows.
                </p>
              </div>
              <div className="crm-admin-task-assign-card__count">
                <strong>{taskAdminBulkAssignCount}</strong>
                <span>
                  {taskAdminBulkAssignBucket === "due_today"
                    ? "Due today"
                    : taskAdminBulkAssignBucket === "open"
                      ? "Open tasks"
                      : "Overdue"}
                </span>
              </div>
            </div>

            <div className="crm-admin-task-assign-card__body">
              <div className="crm-admin-task-assign-card__stats">
                <div className="crm-admin-task-assign-card__stat">
                  <span>Active agents</span>
                  <strong>{activeAgentOptions.length}</strong>
                </div>
                <div className="crm-admin-task-assign-card__stat">
                  <span>Assignment mode</span>
                  <strong>Workspace sync</strong>
                </div>
              </div>

              <div className="crm-admin-task-assign-card__actions">
                <label className="crm-field crm-admin-task-assign-card__select">
                  <span>Follow-up queue</span>
                  <select
                    className="crm-select"
                    value={taskAdminBulkAssignBucket}
                    onChange={(event) => setTaskAdminBulkAssignBucket(event.target.value)}
                    disabled={taskAdminBulkAssignBusy || taskAdminAgentsLoading}
                  >
                    <option value="overdue">Overdue follow-ups</option>
                    <option value="due_today">Due today</option>
                    <option value="open">Open follow-ups</option>
                  </select>
                </label>

                <label className="crm-field crm-admin-task-assign-card__select">
                  <span>Choose agent</span>
                  <select
                    className="crm-select"
                    value={taskAdminBulkAssignTarget}
                    onChange={(event) => setTaskAdminBulkAssignTarget(event.target.value)}
                    disabled={taskAdminAgentsLoading || taskAdminBulkAssignBusy || activeAgentOptions.length === 0}
                  >
                    <option value="">
                      {taskAdminAgentsLoading
                        ? "Loading active agents..."
                        : activeAgentOptions.length
                          ? "Select an active agent"
                          : "No active agents available"}
                    </option>
                    {activeAgentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="crm-btn crm-btn-primary crm-btn--compact"
                  onClick={assignAllFollowupTasks}
                  disabled={
                    taskAdminBulkAssignBusy ||
                    taskAdminAgentsLoading ||
                    !taskAdminBulkAssignTarget ||
                    taskAdminBulkAssignCount <= 0
                  }
                >
                  {taskAdminBulkAssignBusy ? "Assigning..." : "Assign follow-up tasks"}
                </button>
              </div>

              <div className="crm-admin-task-assign-card__footnote">
                {taskAdminAgentsError ? (
                  <span className="crm-admin-task-assign-card__error">{taskAdminAgentsError}</span>
                ) : (
                  <span>Selected agent will own the chosen follow-up queue and task list stays in sync.</span>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {createTaskOpen && (
          <div className="crm-create-task-overlay" role="presentation">
            <button
              type="button"
              className="crm-create-task-backdrop"
              aria-label="Close create task"
              onClick={closeTaskModal}
            />
            <section
              className="crm-create-task-shell crm-create-task-shell--overlay"
              role="dialog"
              aria-modal="true"
              aria-label={isEditingTask ? "Edit Task" : "Create Task"}
            >
              <form className="crm-create-task" onSubmit={handleCreateTask}>
                <div className="crm-create-task__header">
                  <div className="crm-create-task__heading">
                    <span className="crm-create-task__icon" aria-hidden="true">
                      {isEditingTask ? <PencilLine size={16} /> : <CalendarClock size={16} />}
                    </span>
                    <div className="crm-create-task__heading-copy">
                      <h3>{isEditingTask ? "Edit Task" : "Create Task"}</h3>
                      <p>
                        {isEditingTask
                          ? "Update the task details and save the changes without leaving the page."
                          : "Prepare the task details and save it without leaving the page."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="crm-create-task__close"
                    onClick={closeTaskModal}
                    aria-label={isEditingTask ? "Close edit task" : "Close create task"}
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
                        placeholder="Search contacts..."
                        value={taskContactSearch}
                        onChange={(event) => {
                          setTaskContactSearch(event.target.value);
                          setForm((previous) => ({ ...previous, contactId: "" }));
                        }}
                      />
                      <select
                        className="crm-select"
                        value={form.contactId}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, contactId: event.target.value }))
                        }
                      >
                        <option value="">{taskContactLoading ? "Searching..." : "Select Contact"}</option>
                        {contactOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="crm-field__help">
                        {taskContactLoading
                          ? "Loading matching contacts..."
                          : "Search to narrow the contact list before selecting a task contact."}
                      </span>
                    </label>
                    <label className="crm-field">
                      <span>Task Title</span>
                      <input
                        type="text"
                        className="crm-input"
                        placeholder="Task title"
                        value={form.title}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, title: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <div className="crm-create-task-grid crm-create-task-grid--compact">
                    <label className="crm-field">
                      <span>Task Type</span>
                      <select
                        className="crm-select"
                        value={form.taskType}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, taskType: event.target.value }))
                        }
                      >
                        {TASK_TYPES.map((taskType) => (
                          <option key={taskType.key} value={taskType.key}>
                            {taskType.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span>Priority</span>
                      <select
                        className="crm-select"
                        value={form.priority}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, priority: event.target.value }))
                        }
                      >
                        {TASK_PRIORITIES.map((priority) => (
                          <option key={priority.key} value={priority.key}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span>Assigned To</span>
                      <select
                        className="crm-select"
                        value={form.assignedTo}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, assignedTo: event.target.value }))
                        }
                        disabled={usersLoading && users.length === 0}
                      >
                        <option value="">{usersLoading && users.length === 0 ? "Loading users..." : "Unassigned"}</option>
                        {assigneeOptions.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="crm-create-task-grid crm-create-task-grid--compact crm-create-task-grid--schedule">
                    <label className="crm-field">
                      <span>Due At</span>
                      <input
                        type="datetime-local"
                        className="crm-input"
                        value={form.dueAt}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, dueAt: event.target.value }))
                        }
                      />
                    </label>
                    <label className="crm-field">
                      <span>Reminder</span>
                      <input
                        type="datetime-local"
                        className="crm-input"
                        value={form.reminderAt}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, reminderAt: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <div className="crm-create-task-grid crm-create-task-grid--compact crm-create-task-grid--recurrence">
                    <label className="crm-field">
                      <span>Repeat</span>
                      <select
                        className="crm-select"
                        value={form.recurrenceFrequency}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, recurrenceFrequency: event.target.value }))
                        }
                      >
                        {TASK_RECURRENCE_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span>Repeat Every</span>
                      <input
                        type="number"
                        min="1"
                        className="crm-input"
                        value={form.recurrenceInterval}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, recurrenceInterval: event.target.value }))
                        }
                        disabled={form.recurrenceFrequency === "none"}
                        placeholder="Repeat interval"
                      />
                    </label>
                  </div>

                  <label className="crm-field crm-field--span-full crm-create-task__full-row">
                    <span>Description</span>
                    <textarea
                      className="crm-textarea"
                      placeholder="Task description (optional)"
                      value={form.description}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, description: event.target.value }))
                      }
                      rows={3}
                    />
                  </label>

                    <label className="crm-field crm-field--span-full crm-create-task__full-row">
                      <span>Initial Comment</span>
                      <textarea
                        className="crm-textarea"
                        placeholder={isEditingTask ? "Add a follow-up note (optional)" : "Initial comment or context note (optional)"}
                        value={form.comment}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, comment: event.target.value }))
                      }
                      rows={2}
                    />
                  </label>
                </div>

                <div className="crm-create-task__footer">
                  <button
                    type="submit"
                    className="crm-btn crm-btn-primary crm-create-task__submit"
                    disabled={submitting}
                  >
                    {submitting ? (isEditingTask ? "Saving..." : "Creating...") : isEditingTask ? "Save Changes" : "Create Task"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <div className="crm-task-controls">
          <label className="crm-task-search">
            <Search size={16} className="crm-task-search__icon" />
            <input
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search tasks, assignees, or contacts..."
              value={searchInput}
              onChange={(event) => toggleSearchInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`crm-btn crm-btn-secondary crm-btn--compact crm-task-filter-toggle ${
              showFilters ? "active" : ""
            }`}
            onClick={() => setShowFilters((previous) => !previous)}
            aria-expanded={showFilters}
            aria-label="Toggle task filters"
          >
            <SlidersHorizontal size={16} />
            Filter
          </button>
        </div>

        {showFilters && (
            <div className="crm-task-filters-panel">
              <CrmFilterBar>
                <select
                  className="crm-select"
                  value={bucketFilter}
                onChange={(event) => setBucketFilterAndReset(event.target.value)}
              >
                {TASK_BUCKETS.map((bucket) => (
                  <option key={bucket.key} value={bucket.key}>
                    {bucket.label}
                  </option>
                ))}
              </select>
              <select
                className="crm-select"
                value={statusFilter}
                onChange={(event) => setStatusFilterAndReset(event.target.value)}
              >
                <option value="all">All Statuses</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                className="crm-select"
                value={priorityFilter}
                onChange={(event) => setPriorityFilterAndReset(event.target.value)}
              >
                <option value="all">All Priorities</option>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority.key} value={priority.key}>
                    {priority.label}
                  </option>
                ))}
              </select>
              <select
                className="crm-select"
                value={taskTypeFilter}
                onChange={(event) => setTaskTypeFilterAndReset(event.target.value)}
              >
                <option value="all">All Task Types</option>
                {TASK_TYPES.map((taskType) => (
                  <option key={taskType.key} value={taskType.key}>
                    {taskType.label}
                  </option>
                ))}
              </select>
                <select
                  className="crm-select"
                  value={assignedToFilter}
                  onChange={(event) => setAssignedToFilterAndReset(event.target.value)}
                >
                <option value="all">All Assignees</option>
                {currentUserId && <option value={currentUserId}>My Tasks</option>}
                {assigneeOptions.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.label}
                  </option>
                ))}
              </select>
              <div className="crm-task-filter-actions">
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary crm-btn--compact crm-task-select-all-btn"
                  onClick={toggleSelectAllVisible}
                  disabled={bulkBusy || tasks.length === 0}
                  title={selectionMode ? "Clear all visible tasks" : "Select all visible tasks"}
                >
                  {selectionMode && allVisibleSelected ? "Clear All Visible" : "Select All Visible"}
                </button>
              </div>
            </CrmFilterBar>
          </div>
        )}

        {selectedTaskIds.length > 0 && (
          <div className="crm-bulk-bar">
            <strong>{selectedTaskIds.length} task(s) selected</strong>
            <select
              className="crm-select"
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value)}
            >
              <option value="complete">Mark Complete</option>
              <option value="cancel">Cancel</option>
              <option value="reschedule">Reschedule</option>
              <option value="assign">Assign</option>
            </select>

            {bulkAction === "assign" && (
              <select
                className="crm-select"
                value={bulkAssignedTo}
                onChange={(event) => setBulkAssignedTo(event.target.value)}
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.label}
                  </option>
                ))}
              </select>
            )}

            {bulkAction === "reschedule" && (
              <>
                <input
                  type="datetime-local"
                  className="crm-input crm-input--small"
                  value={bulkDueAt}
                  onChange={(event) => setBulkDueAt(event.target.value)}
                />
                <input
                  type="datetime-local"
                  className="crm-input crm-input--small"
                  value={bulkReminderAt}
                  onChange={(event) => setBulkReminderAt(event.target.value)}
                />
              </>
            )}

            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={handleBulkAction}
              disabled={bulkBusy}
            >
              {bulkBusy ? "Running..." : "Apply"}
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={resetTaskWindow}
              disabled={bulkBusy}
            >
              Clear
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-danger crm-btn--compact crm-btn-icon-only"
              onClick={handleBulkDeleteSelected}
              disabled={bulkBusy}
              aria-label="Delete selected tasks"
              title="Delete selected tasks"
            >
              <Trash size={16} />
            </button>
          </div>
        )}

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {loading && <CrmPageSkeleton variant="table" />}

        {!loading && (
          <>
            <div className="crm-task-table-wrap">
              {tasks.length === 0 ? (
                <div className="crm-empty-row crm-empty-row--tasks">
                  No tasks match this view. Try another bucket, clear filters, or create a new follow-up above.
                </div>
              ) : (
                <TableVirtuoso
                  style={{ height: "clamp(360px, 56vh, 620px)" }}
                  data={tasks}
                  increaseViewportBy={260}
                  endReached={loadMoreTasks}
                  components={{
                    Table: CrmTasksVirtuosoTable,
                    TableHead: CrmTasksVirtuosoTableHead,
                    TableBody: CrmTasksVirtuosoTableBody,
                    Footer: () =>
                      loadingMoreTasks ? (
                        <div className="crm-virtual-list-footer">Loading more tasks...</div>
                      ) : hasMoreTasks ? (
                        <div className="crm-virtual-list-footer crm-virtual-list-footer--more">
                          <span>Scroll to load more</span>
                          <button type="button" className="crm-pagination__btn" onClick={loadMoreTasks}>
                            Load more tasks
                          </button>
                        </div>
                      ) : (
                        <div className="crm-virtual-list-footer">End of task list</div>
                      )
                  }}
                  fixedHeaderContent={() => (
                    <tr>
                      {selectionMode && (
                        <th className="crm-task-col-select">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all visible tasks"
                          />
                        </th>
                      )}
                      <th className="crm-task-col-task">Task</th>
                      <th className="crm-task-col-contact">Contact</th>
                      <th className="crm-task-col-assignee">Assignee</th>
                      <th className="crm-task-col-schedule">Schedule</th>
                      <th className="crm-task-col-status">Status</th>
                      <th className="crm-task-col-actions crm-task-actions-heading">
                        <span className="crm-task-table-heading">
                          <ListChecks size={14} />
                          Actions
                        </span>
                      </th>
                    </tr>
                  )}
                  itemContent={(_, task) => {
                    const taskId = getEntityId(task);
                    const contact = task?.contactId || {};
                    const isBusy = busyTaskId === taskId;
                    const isCompleted = String(task?.status || "").toLowerCase() === "completed";
                    const recurrence =
                      task?.recurrence?.frequency && task.recurrence.frequency !== "none"
                        ? `${toTaskTypeLabel(task.recurrence.frequency)} x${task.recurrence.interval || 1}`
                        : "";
                    const isExpanded = expandedTaskId === taskId;

                    const cells = [];
                    if (selectionMode) {
                      cells.push(
                        <td
                          key={`${taskId}-select`}
                          className="crm-task-col-select crm-task-select-cell"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTaskIdSet.has(taskId)}
                            onChange={() => toggleTaskSelection(taskId)}
                            aria-label={`Select task ${task?.title || taskId}`}
                          />
                        </td>
                      );
                    }

                    cells.push(
                      <td key={`${taskId}-task`} className="crm-task-col-task">
                        <div className="crm-task-primary">
                          <button
                            type="button"
                            className="crm-task-title-toggle"
                            onClick={() => toggleTaskDetails(taskId)}
                            title={isExpanded ? "Hide task details" : "Show task details"}
                          >
                            <strong className="crm-task-title">{task?.title || "Untitled"}</strong>
                          </button>
                          <p className="crm-task-description">{task?.description || "-"}</p>
                          <div className="crm-task-chip-row">
                            <span className="crm-task-chip">{toTaskTypeLabel(task?.taskType)}</span>
                            <span
                              className={`crm-priority-badge priority-${String(task?.priority || "medium").toLowerCase()}`}
                            >
                              {String(task?.priority || "medium")}
                            </span>
                            {recurrence && <span className="crm-task-chip">{recurrence}</span>}
                            {isExpanded && <span className="crm-task-chip crm-task-chip--active">Details open</span>}
                          </div>
                          <div className="crm-task-submeta">
                            <span>Reminder: {formatDateTime(task?.reminderAt)}</span>
                            {task?.completedAt && <span>Completed: {formatDateTime(task.completedAt)}</span>}
                            {task?.completedBy && <span>By: {task.completedBy}</span>}
                          </div>
                          {isExpanded && (
                            <div className="crm-task-details-panel">
                              {task?.comments?.length > 0 && (
                                <div className="crm-task-comment-list">
                                  {task.comments.slice(0, 3).map((comment, index) => (
                                    <div key={`${taskId}-comment-${index}`} className="crm-task-comment-item">
                                      <span>{comment.text || "Comment"}</span>
                                      <time>{formatDateTime(comment.createdAt)}</time>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="crm-task-comment-composer">
                                <input
                                  type="text"
                                  className="crm-input crm-input--inline-block"
                                  placeholder="Add internal comment..."
                                  value={commentDrafts?.[taskId] || ""}
                                  onChange={(event) =>
                                    setCommentDrafts((previous) => ({
                                      ...previous,
                                      [taskId]: event.target.value
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="crm-inline-action-btn"
                                  onClick={() => handleAddComment(task)}
                                  disabled={isBusy || !String(commentDrafts?.[taskId] || "").trim()}
                                  title="Add comment"
                                >
                                  <MessageSquarePlus size={15} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );

                    cells.push(
                      <td key={`${taskId}-contact`} className="crm-task-col-contact">
                        <button
                          type="button"
                          className="crm-link-btn crm-task-contact-name"
                          onClick={() => openContactDrawer(contact)}
                        >
                          {contact?.name || "-"}
                        </button>
                        <span className="crm-task-cell-line">{contact?.phone || "-"}</span>
                        <span className="crm-task-cell-line">Score: {Number(contact?.leadScore || 0)}</span>
                        <span className="crm-task-cell-line">Stage: {toTaskTypeLabel(contact?.stage || "new")}</span>
                      </td>
                    );

                    cells.push(
                      <td key={`${taskId}-assignee`} className="crm-task-col-assignee">
                        <strong className="crm-task-assignee-value">{task?.assignedTo || "Unassigned"}</strong>
                        <span className="crm-task-cell-line crm-task-owner-value">
                          Owner: {contact?.ownerId || "-"}
                        </span>
                      </td>
                    );

                    cells.push(
                      <td key={`${taskId}-schedule`} className="crm-task-col-schedule">
                        <span className="crm-task-cell-line">Due: {formatDateTime(task?.dueAt)}</span>
                        <span className="crm-task-cell-line">Reminder: {formatDateTime(task?.reminderAt)}</span>
                        <span className="crm-task-cell-line">
                          Follow-up: {formatDateTime(contact?.nextFollowUpAt)}
                        </span>
                      </td>
                    );

                    cells.push(
                      <td key={`${taskId}-status`} className="crm-task-col-status">
                        <div className="crm-task-status-cell">
                          <select
                            className="crm-select"
                            value={String(task?.status || "pending")}
                            onChange={(event) => handleTaskStatusChange(task, event.target.value)}
                            disabled={isBusy}
                          >
                            {TASK_STATUSES.map((status) => (
                              <option key={`${taskId}-${status.key}`} value={status.key}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                          {String(task?.status || "").toLowerCase() === "completed" && (
                            <CheckCircle2 size={16} className="crm-completed-icon" />
                          )}
                        </div>
                      </td>
                    );

                    cells.push(
                      <td key={`${taskId}-actions`} className="crm-task-col-actions crm-task-actions-cell">
                        <div className="crm-task-row-actions">
                          <button
                            type="button"
                            className={`crm-task-kebab ${activeActionMenuTaskId === taskId ? "active" : ""}`}
                            onClick={(event) => handleToggleTaskActions(task, event)}
                            title="Open task actions"
                            aria-label="Open task actions"
                            aria-expanded={activeActionMenuTaskId === taskId}
                          >
                            <MoreVertical size={18} />
                          </button>
                          {activeActionMenuTaskId === taskId && activeActionTask && (
                            <div
                              className="crm-task-row-actions-menu"
                              style={actionMenuPosition || undefined}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="crm-task-row-menu-item open"
                                onClick={() => {
                                  closeTaskActionMenu();
                                  openContactDrawer(contact);
                                }}
                              >
                                <ExternalLink size={15} />
                                <span>Open contact</span>
                              </button>
                              <button
                                type="button"
                                className="crm-task-row-menu-item edit"
                                onClick={() => {
                                  closeTaskActionMenu();
                                  openEditTaskModal(activeActionTask);
                                }}
                                disabled={isBusy}
                              >
                                <Pencil size={15} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="crm-task-row-menu-item complete"
                                onClick={() => {
                                  closeTaskActionMenu();
                                  handleTaskStatusChange(
                                    activeActionTask,
                                    isCompleted ? "pending" : "completed"
                                  );
                                }}
                                disabled={isBusy}
                              >
                                <BadgeCheck size={15} />
                                <span>{isCompleted ? "Mark Pending" : "Mark Complete"}</span>
                              </button>
                              <button
                                type="button"
                                className="crm-task-row-menu-item delete"
                                onClick={() => {
                                  closeTaskActionMenu();
                                  handleDeleteTask(activeActionTask);
                                }}
                                disabled={isBusy}
                              >
                                <Trash2 size={15} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    );

                    return cells;
                  }}
                  computeItemKey={(_, task) => getEntityId(task) || task?.title || "task"}
                />
              )}
            </div>
          </>
        )}
      </div>

      <CrmContactDrawer
        open={Boolean(selectedContactId)}
        contactId={selectedContactId}
        initialContact={selectedContact}
        currentUserId={currentUserId}
        onClose={handleDrawerClose}
        onContactUpdated={handleContactUpdated}
        onTaskMutation={() => loadData({ silent: true })}
        onDealMutation={() => loadData({ silent: true })}
      />
    </>
  );
};

export default CrmTasks;
