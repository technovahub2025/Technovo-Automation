import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmFilterBar from "../components/crm/CrmFilterBar";
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

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

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

const CrmTasks = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("complete");
  const [bulkDueAt, setBulkDueAt] = useState("");
  const [bulkReminderAt, setBulkReminderAt] = useState("");
  const [bulkAssignedTo, setBulkAssignedTo] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [toast, setToast] = useState(null);
  const hasInitializedFilterEffectRef = useRef(false);
  const currentUserId = resolveCacheUserId();
  const requestedBucketFilter = String(searchParams.get("bucket") || "all").trim().toLowerCase();
  const requestedStatusFilter = String(searchParams.get("status") || "all").trim().toLowerCase();
  const requestedPriorityFilter = String(searchParams.get("priority") || "all").trim().toLowerCase();
  const requestedTaskTypeFilter = String(searchParams.get("taskType") || "all").trim().toLowerCase();
  const requestedAssignedToFilter = String(searchParams.get("assignedTo") || "all").trim();
  const requestedSearchQuery = String(searchParams.get("q") || "").trim();
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

  const persistTasksCache = useCallback(
    (nextTasks, nextContacts, nextSummary) => {
      if (!isDefaultView) return;

      writeSidebarPageCache(
        CRM_TASKS_CACHE_NAMESPACE,
        {
          tasks: (Array.isArray(nextTasks) ? nextTasks : [])
            .map(sanitizeCrmTask)
            .filter((task) => task._id || task.id || task.title),
          contacts: (Array.isArray(nextContacts) ? nextContacts : [])
            .map(sanitizeCrmTaskContact)
            .filter((contact) => contact._id || contact.id || contact.phone),
          summary: nextSummary || null
        },
        {
          currentUserId,
          ttlMs: CRM_TASKS_CACHE_TTL_MS
        }
      );
    },
    [currentUserId, isDefaultView]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (silent) setRefreshing(false);
          else setLoading(false);
        },
        CRM_TASKS_LOADING_TIMEOUT_MS
      );
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError("");

        const taskParams = { limit: 200 };
        if (statusFilter !== "all") taskParams.status = statusFilter;
        if (priorityFilter !== "all") taskParams.priority = priorityFilter;
        if (bucketFilter !== "all") taskParams.bucket = bucketFilter;
        if (taskTypeFilter !== "all") taskParams.taskType = taskTypeFilter;
        if (assignedToFilter !== "all") taskParams.assignedTo = assignedToFilter;

        const summaryParams = {};
        if (assignedToFilter !== "all") summaryParams.assignedTo = assignedToFilter;

        const [tasksResult, contactsResult, summaryResult] = await Promise.all([
          crmService.getTasks(taskParams),
          crmService.getContacts({ limit: 300 }),
          crmService.getTaskSummary(summaryParams)
        ]);

        if (tasksResult?.success === false) {
          throw new Error(tasksResult?.error || "Failed to fetch tasks");
        }
        if (contactsResult?.success === false) {
          throw new Error(contactsResult?.error || "Failed to fetch contacts");
        }
        if (summaryResult?.success === false) {
          throw new Error(summaryResult?.error || "Failed to fetch task summary");
        }

        const nextTasks = Array.isArray(tasksResult?.data) ? tasksResult.data.map(sanitizeCrmTask) : [];
        const nextContacts = Array.isArray(contactsResult?.data)
          ? contactsResult.data.map(sanitizeCrmTaskContact)
          : [];
        const nextSummary = summaryResult?.data || null;

        setTasks(nextTasks);
        setContacts(nextContacts);
        setSummary(nextSummary);
        setSelectedTaskIds((previous) =>
          previous.filter((taskId) => nextTasks.some((task) => getEntityId(task) === taskId))
        );
        persistTasksCache(nextTasks, nextContacts, nextSummary);
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM tasks");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      assignedToFilter,
      bucketFilter,
      persistTasksCache,
      priorityFilter,
      statusFilter,
      taskTypeFilter
    ]
  );

  const handleRealtimeRefresh = useCallback(() => {
    loadData({ silent: true });
  }, [loadData]);

  useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    setForm(getInitialTaskForm(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    const isValidBucket = TASK_BUCKETS.some((bucket) => bucket.key === requestedBucketFilter);
    if (isValidBucket && bucketFilter !== requestedBucketFilter) {
      setBucketFilter(requestedBucketFilter);
    }

    const isValidStatus =
      requestedStatusFilter === "all" ||
      TASK_STATUSES.some((status) => status.key === requestedStatusFilter);
    if (isValidStatus && statusFilter !== requestedStatusFilter) {
      setStatusFilter(requestedStatusFilter);
    }

    const isValidPriority =
      requestedPriorityFilter === "all" ||
      TASK_PRIORITIES.some((priority) => priority.key === requestedPriorityFilter);
    if (isValidPriority && priorityFilter !== requestedPriorityFilter) {
      setPriorityFilter(requestedPriorityFilter);
    }

    const isValidTaskType =
      requestedTaskTypeFilter === "all" ||
      TASK_TYPES.some((taskType) => taskType.key === requestedTaskTypeFilter);
    if (isValidTaskType && taskTypeFilter !== requestedTaskTypeFilter) {
      setTaskTypeFilter(requestedTaskTypeFilter);
    }

    const normalizedRequestedAssignedTo = requestedAssignedToFilter || "all";
    if (assignedToFilter !== normalizedRequestedAssignedTo) {
      setAssignedToFilter(normalizedRequestedAssignedTo);
    }

    if (searchQuery !== requestedSearchQuery) {
      setSearchQuery(requestedSearchQuery);
    }
  }, [
    assignedToFilter,
    bucketFilter,
    priorityFilter,
    requestedAssignedToFilter,
    requestedBucketFilter,
    requestedPriorityFilter,
    requestedSearchQuery,
    requestedStatusFilter,
    requestedTaskTypeFilter,
    searchQuery,
    statusFilter,
    taskTypeFilter
  ]);

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

    if (Array.isArray(cachedTasks?.data?.tasks)) {
      setTasks(cachedTasks.data.tasks.map(sanitizeCrmTask));
      setContacts(
        Array.isArray(cachedTasks?.data?.contacts)
          ? cachedTasks.data.contacts.map(sanitizeCrmTaskContact)
          : []
      );
      setSummary(cachedTasks?.data?.summary || null);
      setLoading(false);
      loadData({ silent: true });
      return;
    }

    loadData();
  }, [currentUserId, loadData]);

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }
    loadData({ silent: true });
  }, [assignedToFilter, bucketFilter, loadData, priorityFilter, statusFilter, taskTypeFilter]);

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        id: getEntityId(contact),
        label: `${contact?.name || "Unknown"} (${contact?.phone || "-"})`
      })),
    [contacts]
  );

  const assigneeOptions = useMemo(() => {
    const uniqueValues = new Set();
    [currentUserId, bulkAssignedTo, form.assignedTo].forEach((value) => {
      const normalized = String(value || "").trim();
      if (normalized) uniqueValues.add(normalized);
    });
    contacts.forEach((contact) => {
      const normalized = String(contact?.ownerId || "").trim();
      if (normalized) uniqueValues.add(normalized);
    });
    tasks.forEach((task) => {
      const normalized = String(task?.assignedTo || "").trim();
      if (normalized) uniqueValues.add(normalized);
    });
    return Array.from(uniqueValues).map((value) => ({
      id: value,
      label: value === currentUserId ? `${value} (Me)` : value
    }));
  }, [bulkAssignedTo, contacts, currentUserId, form.assignedTo, tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
    if (!normalizedQuery) return tasks;
    return tasks.filter((task) => {
      const title = String(task?.title || "").toLowerCase();
      const description = String(task?.description || "").toLowerCase();
      const contactName = String(task?.contactId?.name || "").toLowerCase();
      const contactPhone = String(task?.contactId?.phone || "").toLowerCase();
      const assignedTo = String(task?.assignedTo || "").toLowerCase();
      return (
        title.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        contactName.includes(normalizedQuery) ||
        contactPhone.includes(normalizedQuery) ||
        assignedTo.includes(normalizedQuery)
      );
    });
  }, [searchQuery, tasks]);

  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);

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
        if (String(form.comment || "").trim()) {
          payload.comment = String(form.comment || "").trim();
        }

        const result = await crmService.createTask(payload);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to create task");
        }

        setForm(getInitialTaskForm(currentUserId));
        await loadData({ silent: true });
        setToast({ type: "success", message: "Task created successfully." });
      } catch (submitError) {
        setError(submitError?.message || "Failed to create task");
        setToast({
          type: "error",
          message: submitError?.message || "Failed to create task"
        });
      } finally {
        setSubmitting(false);
      }
    },
    [currentUserId, form, loadData]
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

  const openContactDrawer = useCallback((contact) => {
    const normalizedId = getEntityId(contact);
    setSelectedContactId(normalizedId);
    setSelectedContact(contact);
  }, []);

  const handleContactUpdated = useCallback((updatedContact) => {
    const normalizedId = getEntityId(updatedContact);
    if (!normalizedId) return;

    setSelectedContact(updatedContact);
    setContacts((previous) =>
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

  const toggleTaskSelection = useCallback((taskId) => {
    setSelectedTaskIds((previous) =>
      previous.includes(taskId)
        ? previous.filter((value) => value !== taskId)
        : [...previous, taskId]
    );
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    const visibleTaskIds = filteredTasks.map((task) => getEntityId(task)).filter(Boolean);
    const allSelected = visibleTaskIds.every((taskId) => selectedTaskIdSet.has(taskId));
    setSelectedTaskIds((previous) =>
      allSelected
        ? previous.filter((taskId) => !visibleTaskIds.includes(taskId))
        : Array.from(new Set([...previous, ...visibleTaskIds]))
    );
  }, [filteredTasks, selectedTaskIdSet]);

  const summaryCards = [
    { key: "open", label: "Open", value: summary?.open ?? 0, interactive: true },
    { key: "overdue", label: "Overdue", value: summary?.overdue ?? 0, interactive: true },
    { key: "due_today", label: "Due Today", value: summary?.dueToday ?? 0, interactive: true },
    { key: "today_calls", label: "Today Calls", value: summary?.todayCalls ?? 0, interactive: false },
    { key: "completed", label: "Completed", value: summary?.completed ?? 0, interactive: true },
    { key: "all", label: "Total", value: summary?.total ?? 0, interactive: true },
    {
      key: "completion_rate",
      label: "Completion Rate",
      value: `${summary?.completionRate ?? 0}%`,
      interactive: false
    },
    {
      key: "follow_up_completion",
      label: "Follow-up Rate",
      value: `${summary?.followUpCompletionRate ?? 0}%`,
      interactive: false
    }
  ];

  const allVisibleSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((task) => selectedTaskIdSet.has(getEntityId(task)));

  return (
    <>
      <div className="crm-workspace">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Tasks"
          subtitle="Run follow-ups like a control center with assignees, recurring reminders, comments, and bulk actions."
          actions={
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={() => loadData({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
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
                onClick={() => setBucketFilter(card.key)}
              >
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </button>
            ) : (
              <div key={card.key} className="crm-summary-card">
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            )
          )}
        </div>

        <form className="crm-create-task" onSubmit={handleCreateTask}>
          <h3>
            <Plus size={16} />
            Create Task
          </h3>
          <div className="crm-create-task-grid crm-create-task-grid--dense">
            <select
              className="crm-select"
              value={form.contactId}
              onChange={(event) => setForm((previous) => ({ ...previous, contactId: event.target.value }))}
            >
              <option value="">Select Contact</option>
              {contactOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="crm-input"
              placeholder="Task title"
              value={form.title}
              onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            />
            <select
              className="crm-select"
              value={form.taskType}
              onChange={(event) => setForm((previous) => ({ ...previous, taskType: event.target.value }))}
            >
              {TASK_TYPES.map((taskType) => (
                <option key={taskType.key} value={taskType.key}>
                  {taskType.label}
                </option>
              ))}
            </select>
            <select
              className="crm-select"
              value={form.priority}
              onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))}
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.key} value={priority.key}>
                  {priority.label}
                </option>
              ))}
            </select>
            <select
              className="crm-select"
              value={form.assignedTo}
              onChange={(event) => setForm((previous) => ({ ...previous, assignedTo: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="crm-input"
              value={form.dueAt}
              onChange={(event) => setForm((previous) => ({ ...previous, dueAt: event.target.value }))}
            />
            <input
              type="datetime-local"
              className="crm-input"
              value={form.reminderAt}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, reminderAt: event.target.value }))
              }
            />
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
          </div>
          <textarea
            className="crm-textarea"
            placeholder="Task description (optional)"
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            rows={3}
          />
          <textarea
            className="crm-textarea"
            placeholder="Initial comment or context note (optional)"
            value={form.comment}
            onChange={(event) => setForm((previous) => ({ ...previous, comment: event.target.value }))}
            rows={2}
          />
          <button type="submit" className="crm-btn crm-btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Task"}
          </button>
        </form>

        <CrmFilterBar>
          <label className="crm-search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search tasks, assignees, or contacts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select
            className="crm-select"
            value={bucketFilter}
            onChange={(event) => setBucketFilter(event.target.value)}
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
            onChange={(event) => setStatusFilter(event.target.value)}
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
            onChange={(event) => setPriorityFilter(event.target.value)}
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
            onChange={(event) => setTaskTypeFilter(event.target.value)}
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
            onChange={(event) => setAssignedToFilter(event.target.value)}
          >
            <option value="all">All Assignees</option>
            {currentUserId && <option value={currentUserId}>My Tasks</option>}
            {assigneeOptions.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.label}
              </option>
            ))}
          </select>
        </CrmFilterBar>

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
              <option value="delete">Delete</option>
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
              onClick={() => setSelectedTaskIds([])}
              disabled={bulkBusy}
            >
              Clear
            </button>
          </div>
        )}

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {loading && <CrmPageSkeleton variant="table" />}

        {!loading && (
          <div className="crm-task-table-wrap">
            <table className="crm-task-table crm-task-table--expanded">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible tasks"
                    />
                  </th>
                  <th>Task</th>
                  <th>Contact</th>
                  <th>Assignee</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const taskId = getEntityId(task);
                  const contact = task?.contactId || {};
                  const isBusy = busyTaskId === taskId;
                  const isCompleted = String(task?.status || "").toLowerCase() === "completed";
                  const recurrence =
                    task?.recurrence?.frequency && task.recurrence.frequency !== "none"
                      ? `${toTaskTypeLabel(task.recurrence.frequency)} x${task.recurrence.interval || 1}`
                      : "";

                  return (
                    <tr key={taskId || task.title}>
                      <td className="crm-task-select-cell">
                        <input
                          type="checkbox"
                          checked={selectedTaskIdSet.has(taskId)}
                          onChange={() => toggleTaskSelection(taskId)}
                          aria-label={`Select task ${task?.title || taskId}`}
                        />
                      </td>
                      <td>
                        <strong>{task?.title || "Untitled"}</strong>
                        <p>{task?.description || "-"}</p>
                        <div className="crm-task-chip-row">
                          <span className="crm-task-chip">{toTaskTypeLabel(task?.taskType)}</span>
                          <span
                            className={`crm-priority-badge priority-${String(task?.priority || "medium").toLowerCase()}`}
                          >
                            {String(task?.priority || "medium")}
                          </span>
                          {recurrence && <span className="crm-task-chip">{recurrence}</span>}
                        </div>
                        <div className="crm-task-submeta">
                          <span>Reminder: {formatDateTime(task?.reminderAt)}</span>
                          {task?.completedAt && <span>Completed: {formatDateTime(task.completedAt)}</span>}
                          {task?.completedBy && <span>By: {task.completedBy}</span>}
                        </div>
                        {task?.comments?.length > 0 && (
                          <div className="crm-task-comment-list">
                            {task.comments.slice(0, 2).map((comment, index) => (
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
                      </td>
                      <td>
                        <button
                          type="button"
                          className="crm-link-btn"
                          onClick={() => openContactDrawer(contact)}
                        >
                          {contact?.name || "-"}
                        </button>
                        <span>{contact?.phone || "-"}</span>
                        <span>Score: {Number(contact?.leadScore || 0)}</span>
                        <span>Stage: {toTaskTypeLabel(contact?.stage || "new")}</span>
                      </td>
                      <td>
                        <strong>{task?.assignedTo || "Unassigned"}</strong>
                        <span>Owner: {contact?.ownerId || "-"}</span>
                      </td>
                      <td>
                        <span>Due: {formatDateTime(task?.dueAt)}</span>
                        <span>Reminder: {formatDateTime(task?.reminderAt)}</span>
                        <span>Follow-up: {formatDateTime(contact?.nextFollowUpAt)}</span>
                      </td>
                      <td>
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
                      <td>
                        <div className="crm-inline-actions">
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() =>
                              handleTaskStatusChange(
                                task,
                                isCompleted ? "pending" : "completed"
                              )
                            }
                            disabled={isBusy}
                            title="Toggle completed"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn crm-inline-action-btn--danger"
                            onClick={() => handleDeleteTask(task)}
                            disabled={isBusy}
                            title="Delete task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="crm-empty-row">
                      No tasks match this view. Try another bucket, clear filters, or create a new follow-up above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
