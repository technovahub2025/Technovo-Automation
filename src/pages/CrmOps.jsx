import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeDollarSign,
  Activity,
  BellRing,
  Clock3,
  GitBranch,
  LayoutGrid,
  Layers3,
  RefreshCw,
  Send,
  ChevronDown,
  SlidersHorizontal,
  Target,
  Users,
  Zap
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import { whatsappService } from "../services/whatsappService";
import CrmToast from "../components/crm/CrmToast";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import { DEFAULT_PIPELINE_STAGE_OPTIONS, normalizePipelineStageOption } from "../utils/crmPipelineStages";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import "./CrmWorkspace.css";

const CRM_OPS_LOADING_TIMEOUT_MS = 8000;
const CRM_OPS_CACHE_TTL_MS = 5 * 60 * 1000;
const CRM_OPS_CACHE_NAMESPACE = "crm-ops-page";

const AUTOMATION_RULE_LABELS = {
  overdue_follow_up: "Overdue Follow-up",
  reply_sla_breach: "Reply SLA Breach",
  deal_close_risk: "Deal Close Risk",
  opt_in_to_nurturing: "Opt-In To Nurturing",
  lead_score_stage_advance: "Lead Score Stage Advance",
  lead_score_threshold: "Lead Score Threshold"
};

const DEFAULT_STAGE_OPTIONS = DEFAULT_PIPELINE_STAGE_OPTIONS.map((stage) => ({
  key: stage.key,
  label: String(stage.label || "").replace(" Lead", "") || "New"
}));

const sanitizeOwnerRow = (owner = {}) => ({
  ownerId: String(owner?.ownerId || "").trim(),
  ownerName: String(owner?.ownerName || "").trim(),
  contactCount:
    Number.isFinite(Number(owner?.contactCount)) && Number(owner?.contactCount) >= 0
      ? Number(owner.contactCount)
      : 0,
  overdueFollowUps:
    Number.isFinite(Number(owner?.overdueFollowUps)) && Number(owner?.overdueFollowUps) >= 0
      ? Number(owner.overdueFollowUps)
      : 0,
  dueTodayFollowUps:
    Number.isFinite(Number(owner?.dueTodayFollowUps)) && Number(owner?.dueTodayFollowUps) >= 0
      ? Number(owner.dueTodayFollowUps)
      : 0,
  needsReply:
    Number.isFinite(Number(owner?.needsReply)) && Number(owner?.needsReply) >= 0
      ? Number(owner.needsReply)
      : 0,
  responseSlaBreaches:
    Number.isFinite(Number(owner?.responseSlaBreaches)) && Number(owner?.responseSlaBreaches) >= 0
      ? Number(owner.responseSlaBreaches)
      : 0,
  openDeals:
    Number.isFinite(Number(owner?.openDeals)) && Number(owner?.openDeals) >= 0
      ? Number(owner.openDeals)
      : 0,
  pipelineValue:
    Number.isFinite(Number(owner?.pipelineValue)) && Number(owner?.pipelineValue) >= 0
      ? Number(owner.pipelineValue)
      : 0,
  openTasks:
    Number.isFinite(Number(owner?.openTasks)) && Number(owner?.openTasks) >= 0
      ? Number(owner.openTasks)
      : 0,
  overdueTasks:
    Number.isFinite(Number(owner?.overdueTasks)) && Number(owner?.overdueTasks) >= 0
      ? Number(owner.overdueTasks)
      : 0
});

const sanitizeDashboard = (dashboard = {}) => ({
  summary: dashboard?.summary || {},
  owners: Array.isArray(dashboard?.owners) ? dashboard.owners.map(sanitizeOwnerRow) : [],
  slaHours:
    Number.isFinite(Number(dashboard?.slaHours)) && Number(dashboard?.slaHours) >= 0
      ? Number(dashboard.slaHours)
      : 0,
  generatedAt: String(dashboard?.generatedAt || "").trim()
});

const sanitizeAutomationTask = (task = {}) => ({
  _id: String(task?._id || "").trim(),
  contactId: String(task?.contactId || "").trim(),
  contactName: String(task?.contactName || "").trim(),
  phone: String(task?.phone || "").trim(),
  automationRule: String(task?.automationRule || "").trim(),
  title: String(task?.title || "").trim(),
  dueAt: String(task?.dueAt || "").trim(),
  recommendedTemplate: String(task?.recommendedTemplate || "").trim(),
  leadScore:
    Number.isFinite(Number(task?.leadScore)) && Number(task?.leadScore) >= 0
      ? Number(task.leadScore)
      : 0
});

const sanitizeAutomationContactUpdate = (item = {}) => ({
  contactId: String(item?.contactId || "").trim(),
  contactName: String(item?.contactName || "").trim(),
  phone: String(item?.phone || "").trim(),
  previousStage: String(item?.previousStage || "").trim(),
  nextStage: String(item?.nextStage || "").trim(),
  automationRule: String(item?.automationRule || "").trim(),
  recommendedTemplate: String(item?.recommendedTemplate || "").trim(),
  leadScore:
    Number.isFinite(Number(item?.leadScore)) && Number(item?.leadScore) >= 0
      ? Number(item.leadScore)
      : 0
});

const sanitizeOwnerNotification = (item = {}) => ({
  contactId: String(item?.contactId || "").trim(),
  contactName: String(item?.contactName || "").trim(),
  phone: String(item?.phone || "").trim(),
  ownerId: String(item?.ownerId || "").trim(),
  automationRule: String(item?.automationRule || "").trim(),
  recommendedTemplate: String(item?.recommendedTemplate || "").trim(),
  leadScore:
    Number.isFinite(Number(item?.leadScore)) && Number(item?.leadScore) >= 0
      ? Number(item.leadScore)
      : 0
});

const sanitizeLeadScoringSettings = (settings = {}) => ({
  isEnabled: settings?.isEnabled !== false,
  readScore:
    Number.isFinite(Number(settings?.readScore)) && Number(settings?.readScore) >= 0
      ? Number(settings.readScore)
      : 2,
  replyScore:
    Number.isFinite(Number(settings?.replyScore)) && Number(settings?.replyScore) >= 0
      ? Number(settings.replyScore)
      : 5,
  keywordRules: Array.isArray(settings?.keywordRules) ? settings.keywordRules : [],
  automation: {
    isEnabled: settings?.automation?.isEnabled === true,
    stageThreshold:
      Number.isFinite(Number(settings?.automation?.stageThreshold)) &&
      Number(settings?.automation?.stageThreshold) >= 0
        ? Number(settings.automation.stageThreshold)
        : 45,
    stageOnThreshold: String(settings?.automation?.stageOnThreshold || "qualified").trim() || "qualified",
    taskThreshold:
      Number.isFinite(Number(settings?.automation?.taskThreshold)) &&
      Number(settings?.automation?.taskThreshold) >= 0
        ? Number(settings.automation.taskThreshold)
        : 60,
    taskTitle:
      String(settings?.automation?.taskTitle || "High intent lead follow-up").trim() ||
      "High intent lead follow-up",
    recommendedTemplate: String(settings?.automation?.recommendedTemplate || "").trim(),
    ownerNotification: settings?.automation?.ownerNotification !== false
  }
});

const buildLeadScoringForm = (settings = {}) => {
  const normalized = sanitizeLeadScoringSettings(settings);
  return {
    isEnabled: normalized.isEnabled,
    automationEnabled: normalized.automation.isEnabled,
    stageThreshold: String(normalized.automation.stageThreshold),
    stageOnThreshold: normalized.automation.stageOnThreshold,
    taskThreshold: String(normalized.automation.taskThreshold),
    taskTitle: normalized.automation.taskTitle,
    recommendedTemplate: normalized.automation.recommendedTemplate,
    ownerNotification: normalized.automation.ownerNotification
  };
};

const sanitizeAutomationResult = (result = {}) => ({
  dryRun: Boolean(result?.dryRun),
  createdCount:
    Number.isFinite(Number(result?.createdCount)) && Number(result?.createdCount) >= 0
      ? Number(result.createdCount)
      : 0,
  candidateCount:
    Number.isFinite(Number(result?.candidateCount)) && Number(result?.candidateCount) >= 0
      ? Number(result.candidateCount)
      : 0,
  byRule: result?.byRule && typeof result.byRule === "object" ? result.byRule : {},
  tasks: Array.isArray(result?.tasks) ? result.tasks.map(sanitizeAutomationTask) : [],
  contactUpdates: Array.isArray(result?.contactUpdates)
    ? result.contactUpdates.map(sanitizeAutomationContactUpdate)
    : [],
  ownerNotifications: Array.isArray(result?.ownerNotifications)
    ? result.ownerNotifications.map(sanitizeOwnerNotification)
    : [],
  emailNotifications: {
    attempted: Number.isFinite(Number(result?.emailNotifications?.attempted))
      ? Number(result.emailNotifications.attempted)
      : 0,
    delivered: Number.isFinite(Number(result?.emailNotifications?.delivered))
      ? Number(result.emailNotifications.delivered)
      : 0,
    skipped: Number.isFinite(Number(result?.emailNotifications?.skipped))
      ? Number(result.emailNotifications.skipped)
      : 0,
    failed: Number.isFinite(Number(result?.emailNotifications?.failed))
      ? Number(result.emailNotifications.failed)
      : 0
  },
  leadScoring: sanitizeLeadScoringSettings({
    automation: result?.leadScoring || {}
  }),
  slaHours:
    Number.isFinite(Number(result?.slaHours)) && Number(result?.slaHours) >= 0
      ? Number(result.slaHours)
      : 0,
  generatedAt: String(result?.generatedAt || "").trim()
});

const sanitizeOwnerAlert = (item = {}) => ({
  _id: String(item?._id || item?.id || "").trim(),
  createdAt: String(item?.createdAt || "").trim(),
  readAt: String(item?.readAt || "").trim(),
  isRead: item?.isRead === true,
  ownerId: String(item?.ownerId || "").trim(),
  automationRule: String(item?.automationRule || "").trim(),
  recommendedTemplate: String(item?.recommendedTemplate || "").trim(),
  leadScore:
    Number.isFinite(Number(item?.leadScore)) && Number(item?.leadScore) >= 0
      ? Number(item.leadScore)
      : 0,
  contact: {
    _id: String(item?.contact?._id || "").trim(),
    name: String(item?.contact?.name || "").trim(),
    phone: String(item?.contact?.phone || "").trim(),
    stage: String(item?.contact?.stage || "").trim(),
    ownerId: String(item?.contact?.ownerId || "").trim(),
    leadScore:
      Number.isFinite(Number(item?.contact?.leadScore)) && Number(item?.contact?.leadScore) >= 0
        ? Number(item.contact.leadScore)
        : 0
  }
});

const sanitizeAutomationHistoryItem = (item = {}) => ({
  _id: String(item?._id || "").trim(),
  triggerSource: String(item?.triggerSource || "").trim(),
  automationActor: String(item?.automationActor || "").trim(),
  dryRun: Boolean(item?.dryRun),
  candidateCount:
    Number.isFinite(Number(item?.candidateCount)) && Number(item?.candidateCount) >= 0
      ? Number(item.candidateCount)
      : 0,
  createdCount:
    Number.isFinite(Number(item?.createdCount)) && Number(item?.createdCount) >= 0
      ? Number(item.createdCount)
      : 0,
  status: String(item?.status || "").trim(),
  generatedAt: String(item?.generatedAt || item?.createdAt || "").trim(),
  errorMessage: String(item?.errorMessage || "").trim(),
  emailNotifications: {
    attempted: Number.isFinite(Number(item?.emailNotifications?.attempted))
      ? Number(item.emailNotifications.attempted)
      : 0,
    delivered: Number.isFinite(Number(item?.emailNotifications?.delivered))
      ? Number(item.emailNotifications.delivered)
      : 0,
    skipped: Number.isFinite(Number(item?.emailNotifications?.skipped))
      ? Number(item.emailNotifications.skipped)
      : 0,
    failed: Number.isFinite(Number(item?.emailNotifications?.failed))
      ? Number(item.emailNotifications.failed)
      : 0
  }
});

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  return String(Math.min(Math.max(Math.round(parsed), 1), 300));
};

const toLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "-";

const CRM_OPS_VIEWS = {
  overview: {
    label: "Overview",
    actionLabel: "Snapshot overview",
    helper: "Track owner workload, follow-up pressure, automation health, and scoring settings in one place."
  },
  "owner-workload": {
    label: "Owner Workload",
    actionLabel: "Expanded owner view",
    helper: "Inspect the live owner slice and pipeline balance."
  },
  "owner-alerts": {
    label: "Owner Alerts",
    actionLabel: "Alert feed focus",
    helper: "Review unread prompts and recent owner notifications."
  },
  "rules-runs": {
    label: "Rules & Runs",
    actionLabel: "Automation review",
    helper: "Preview and run automation, then inspect generated changes."
  },
  history: {
    label: "History",
    actionLabel: "Automation history",
    helper: "Review recent scheduler and manual runs."
  },
  "lead-scoring": {
    label: "Lead Scoring",
    actionLabel: "Lead scoring controls",
    helper: "Tune thresholds, templates, and follow-up prompts."
  }
};

const getShortTimestamp = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(parsed);
};

const CrmOps = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedHistoryStatus = String(searchParams.get("historyStatus") || "all")
    .trim()
    .toLowerCase();
  const requestedView = String(searchParams.get("view") || "overview").trim().toLowerCase();
  const [dashboard, setDashboard] = useState(null);
  const [automationResult, setAutomationResult] = useState(null);
  const [leadScoringSettings, setLeadScoringSettings] = useState(() =>
    sanitizeLeadScoringSettings({})
  );
  const [leadScoringForm, setLeadScoringForm] = useState(() => buildLeadScoringForm({}));
  const [leadStageOptions, setLeadStageOptions] = useState(DEFAULT_STAGE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [leadScoringLoading, setLeadScoringLoading] = useState(false);
  const [leadScoringSaving, setLeadScoringSaving] = useState(false);
  const [ownerAlerts, setOwnerAlerts] = useState([]);
  const [ownerAlertStatusFilter, setOwnerAlertStatusFilter] = useState("unread");
  const [ownerAlertSort, setOwnerAlertSort] = useState("newest");
  const [ownerAlertFetchLimit, setOwnerAlertFetchLimit] = useState("60");
  const [ownerAlertRenderLimit, setOwnerAlertRenderLimit] = useState(12);
  const [ownerAlertFiltersOpen, setOwnerAlertFiltersOpen] = useState(false);
  const [automationDatasetView, setAutomationDatasetView] = useState("all");
  const [automationDatasetSearch, setAutomationDatasetSearch] = useState("");
  const [leadScoringDatasetView, setLeadScoringDatasetView] = useState("all");
  const [automationHistory, setAutomationHistory] = useState([]);
  const [error, setError] = useState("");
  const [automationMessage, setAutomationMessage] = useState("");
  const [leadScoringMessage, setLeadScoringMessage] = useState("");
  const [automationLimit, setAutomationLimit] = useState("25");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
    const [historySearch, setHistorySearch] = useState("");
    const [historyFetchLimit, setHistoryFetchLimit] = useState("24");
    const [historyRenderLimit, setHistoryRenderLimit] = useState(8);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerAlertSearch, setOwnerAlertSearch] = useState("");
  const [activeView, setActiveView] = useState(() =>
    Object.prototype.hasOwnProperty.call(CRM_OPS_VIEWS, requestedView) ? requestedView : "overview"
  );
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);
  const currentUserId = resolveCacheUserId();
    const hasLoadedFromCacheRef = useRef(false);
    const hasLoadedInitialDataRef = useRef(false);
    const ownerAlertsRequestIdRef = useRef(0);
    const automationHistoryRequestIdRef = useRef(0);
    const historyLoadMoreRef = useRef(null);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    crmService.getPipelineStages().then((result) => {
      if (cancelled) return;
      if (result?.success === false) return;

      const nextStages = Array.isArray(result?.data?.stages) && result.data.stages.length
        ? result.data.stages.map((stage, index) =>
            normalizePipelineStageOption(stage, index)
          ).map((stage) => ({
            key: stage.key,
            label: String(stage.label || "").replace(" Lead", "") || "New"
          }))
        : DEFAULT_STAGE_OPTIONS;
      setLeadStageOptions(nextStages);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!["all", "success", "error", "preview", "live"].includes(requestedHistoryStatus)) return;
    setHistoryStatusFilter(requestedHistoryStatus);
  }, [requestedHistoryStatus]);

  useEffect(() => {
    const desiredStatus = String(historyStatusFilter || "all").trim().toLowerCase();
    if (!["all", "success", "error", "preview", "live"].includes(desiredStatus)) return;

    const currentStatus = String(searchParams.get("historyStatus") || "all")
      .trim()
      .toLowerCase();
    if (currentStatus === desiredStatus) return;

    const nextParams = new URLSearchParams(searchParams);
    if (desiredStatus === "all") {
      nextParams.delete("historyStatus");
    } else {
      nextParams.set("historyStatus", desiredStatus);
    }
    setSearchParams(nextParams, { replace: true });
  }, [historyStatusFilter, searchParams, setSearchParams]);

  useEffect(() => {
    if (!Object.prototype.hasOwnProperty.call(CRM_OPS_VIEWS, requestedView)) return;
    setActiveView((currentView) => (currentView === requestedView ? currentView : requestedView));
  }, [requestedView]);

  const persistCache = useCallback(
    ({
      nextDashboard = dashboard,
      nextAutomationResult = automationResult,
      nextOwnerAlerts = ownerAlerts
    } = {}) => {
      writeSidebarPageCache(
        CRM_OPS_CACHE_NAMESPACE,
        {
          dashboard: nextDashboard ? sanitizeDashboard(nextDashboard) : null,
          automationResult: nextAutomationResult
            ? sanitizeAutomationResult(nextAutomationResult)
            : null,
          ownerAlerts: Array.isArray(nextOwnerAlerts)
            ? nextOwnerAlerts.map(sanitizeOwnerAlert)
            : []
        },
        {
          currentUserId,
          ttlMs: CRM_OPS_CACHE_TTL_MS
        }
      );
    },
    [automationResult, dashboard, currentUserId, ownerAlerts]
  );

  const loadLeadScoringSettings = useCallback(async () => {
    try {
      setLeadScoringLoading(true);
      setLeadScoringMessage("");

      const result = await whatsappService.getLeadScoringSettings();
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to load lead scoring settings");
      }

      const nextSettings = sanitizeLeadScoringSettings(result?.data || result || {});
      setLeadScoringSettings(nextSettings);
      setLeadScoringForm(buildLeadScoringForm(nextSettings));

      if (result?.fallback) {
        setLeadScoringMessage("Showing default lead scoring values because the backend endpoint fallback was used.");
      }
    } catch (loadError) {
      setLeadScoringMessage(loadError?.message || "Failed to load lead scoring settings");
    } finally {
      setLeadScoringLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (!silent) setLoading(false);
        },
        CRM_OPS_LOADING_TIMEOUT_MS
      );

      try {
        if (!silent) setLoading(true);
        setError("");

        const result = await crmService.getOwnerDashboard();
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load CRM ops dashboard");
        }

        const nextDashboard = sanitizeDashboard(result?.data || {});
        setDashboard(nextDashboard);
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM ops dashboard");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
      }
    },
    []
  );

  const loadAutomationHistory = useCallback(
    async ({ silent = false, limit: limitOverride } = {}) => {
      const requestId = automationHistoryRequestIdRef.current + 1;
      automationHistoryRequestIdRef.current = requestId;

      try {
        if (!silent) setError("");

        const nextHistoryLimit = Math.min(Math.max(Number(limitOverride ?? historyFetchLimit) || 24, 6), 50);
        const result = await crmService.getAutomationHistory({ limit: nextHistoryLimit });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load CRM automation history");
        }

        if (automationHistoryRequestIdRef.current !== requestId) return;
        setAutomationHistory(
          Array.isArray(result?.data) ? result.data.map(sanitizeAutomationHistoryItem) : []
        );
      } catch (loadError) {
        if (automationHistoryRequestIdRef.current !== requestId) return;
        if (!silent) {
          setError(loadError?.message || "Failed to load CRM automation history");
        }
      }
    },
    [historyFetchLimit]
  );

  const loadOwnerAlerts = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ownerAlertsRequestIdRef.current + 1;
      ownerAlertsRequestIdRef.current = requestId;

      try {
        if (!silent) {
          setError("");
        }

        const nextLimit = Math.min(Math.max(Number(ownerAlertFetchLimit) || 60, 10), 150);
        const apiStatus = ownerAlertStatusFilter === "read" ? "all" : ownerAlertStatusFilter;
        const result = await crmService.getOwnerNotifications({
          status: apiStatus,
          limit: nextLimit
        });

        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load owner alerts");
        }

        const nextAlerts = Array.isArray(result?.data)
          ? result.data.map(sanitizeOwnerAlert)
          : [];
        if (ownerAlertsRequestIdRef.current !== requestId) return;
        setOwnerAlerts(nextAlerts);
      } catch (loadError) {
        if (ownerAlertsRequestIdRef.current !== requestId) return;
        if (!silent) {
          setError(loadError?.message || "Failed to load owner alerts");
        }
      }
    },
    [ownerAlertFetchLimit, ownerAlertStatusFilter]
  );

  const handleRealtimeRefresh = useCallback(() => {
    loadDashboard({ silent: true });
    loadOwnerAlerts({ silent: true });
  }, [loadDashboard, loadOwnerAlerts]);

  const crmRealtime = useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    if (hasLoadedFromCacheRef.current) return;
    hasLoadedFromCacheRef.current = true;

    const cachedOps = readSidebarPageCache(CRM_OPS_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (cachedOps?.data?.dashboard) {
      setDashboard(sanitizeDashboard(cachedOps.data.dashboard));
      setAutomationResult(
        cachedOps?.data?.automationResult
          ? sanitizeAutomationResult(cachedOps.data.automationResult)
          : null
      );
      setOwnerAlerts(
        Array.isArray(cachedOps?.data?.ownerAlerts)
          ? cachedOps.data.ownerAlerts.map(sanitizeOwnerAlert)
          : []
      );
      setLoading(false);
      loadDashboard({ silent: true });
      loadAutomationHistory({ silent: true });
      loadOwnerAlerts({ silent: true });
      loadLeadScoringSettings();
      hasLoadedInitialDataRef.current = true;
      return;
    }

    loadDashboard();
    loadAutomationHistory();
    loadOwnerAlerts();
    loadLeadScoringSettings();
    hasLoadedInitialDataRef.current = true;
  }, [currentUserId, loadAutomationHistory, loadDashboard, loadLeadScoringSettings, loadOwnerAlerts]);

  const runAutomation = useCallback(
    async (dryRun) => {
      const nextLimit = Number(normalizeLimit(automationLimit));
      try {
        setError("");
        setAutomationMessage("");
        if (dryRun) setPreviewing(true);
        else setRunning(true);

        const result = await crmService.runFollowUpAutomation({
          dryRun,
          limit: nextLimit
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to run CRM automation");
        }

        const nextAutomationResult = sanitizeAutomationResult(result?.data || {});
        setAutomationResult(nextAutomationResult);

        if (dryRun) {
          setAutomationMessage(
            nextAutomationResult.candidateCount > 0
              ? `Preview ready. ${nextAutomationResult.candidateCount} automation candidate(s) found.`
              : "Preview ready. No automation candidates found right now."
          );
          setToast({
            type: "success",
            message:
              nextAutomationResult.candidateCount > 0
                ? `Preview ready with ${nextAutomationResult.candidateCount} candidate(s).`
                : "Preview completed with no candidates."
          });
          await loadAutomationHistory({ silent: true });
        } else {
          setAutomationMessage(
            nextAutomationResult.createdCount > 0
              ? `Automation created ${nextAutomationResult.createdCount} task or stage update(s).`
              : "Automation run completed. No new tasks or stage updates were created."
          );
          setToast({
            type: "success",
            message:
              nextAutomationResult.createdCount > 0
                ? `Automation applied ${nextAutomationResult.createdCount} change(s).`
                : "Automation run completed with no new changes."
          });
          await loadDashboard({ silent: true });
          await loadAutomationHistory({ silent: true });
          await loadOwnerAlerts({ silent: true });
        }
      } catch (runError) {
        setError(runError?.message || "Failed to run CRM automation");
        setToast({
          type: "error",
          message: runError?.message || "Failed to run CRM automation"
        });
      } finally {
        setPreviewing(false);
        setRunning(false);
      }
    },
    [automationLimit, dashboard, loadAutomationHistory, loadDashboard, loadOwnerAlerts]
  );

  const updateLeadScoringForm = useCallback((field, value) => {
    setLeadScoringForm((previous) => ({
      ...previous,
      [field]: value
    }));
  }, []);

  const saveLeadScoringAutomation = useCallback(async () => {
    try {
      setLeadScoringSaving(true);
      setLeadScoringMessage("");

      const payload = {
        isEnabled: Boolean(leadScoringForm.isEnabled),
        readScore: leadScoringSettings.readScore,
        replyScore: leadScoringSettings.replyScore,
        keywordRules: leadScoringSettings.keywordRules,
        automation: {
          isEnabled: Boolean(leadScoringForm.automationEnabled),
          stageThreshold: Math.max(Number(leadScoringForm.stageThreshold) || 0, 0),
          stageOnThreshold: String(leadScoringForm.stageOnThreshold || "qualified").trim() || "qualified",
          taskThreshold: Math.max(Number(leadScoringForm.taskThreshold) || 0, 0),
          taskTitle: String(leadScoringForm.taskTitle || "").trim() || "High intent lead follow-up",
          recommendedTemplate: String(leadScoringForm.recommendedTemplate || "").trim(),
          ownerNotification: Boolean(leadScoringForm.ownerNotification)
        }
      };

      const result = await whatsappService.updateLeadScoringSettings(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to save lead scoring automation");
      }

      const nextSettings = sanitizeLeadScoringSettings(result?.data || payload);
      setLeadScoringSettings(nextSettings);
      setLeadScoringForm(buildLeadScoringForm(nextSettings));
      setLeadScoringMessage("Lead scoring automation saved.");
      setToast({ type: "success", message: "Lead scoring automation saved." });
    } catch (saveError) {
      setLeadScoringMessage(saveError?.message || "Failed to save lead scoring automation");
      setToast({
        type: "error",
        message: saveError?.message || "Failed to save lead scoring automation"
      });
    } finally {
      setLeadScoringSaving(false);
    }
  }, [leadScoringForm, leadScoringSettings]);

  const summary = dashboard?.summary || {};
  const owners = Array.isArray(dashboard?.owners) ? dashboard.owners : [];
  const automationEntries = Object.entries(automationResult?.byRule || {});
  const deferredOwnerSearch = useDeferredValue(String(ownerSearch || "").trim().toLowerCase());
  const leadScoringKeywordCount = useMemo(
    () => (Array.isArray(leadScoringSettings?.keywordRules) ? leadScoringSettings.keywordRules.length : 0),
    [leadScoringSettings]
  );
  const leadScoringKeywordRules = useMemo(
    () =>
      (Array.isArray(leadScoringSettings?.keywordRules) ? leadScoringSettings.keywordRules : [])
        .slice(0, 12)
        .map((item) => ({
          keyword: String(item?.keyword || item?.term || item || "").trim(),
          score: Number.isFinite(Number(item?.score)) ? Number(item.score) : null,
          stage: String(item?.stage || item?.stageOnMatch || "").trim()
        }))
        .filter((item) => item.keyword),
    [leadScoringSettings]
  );
  const leadScoringConfigCards = useMemo(
    () => [
      { label: "Read score", value: `+${leadScoringSettings.readScore}` },
      { label: "Reply score", value: `+${leadScoringSettings.replyScore}` },
      { label: "Keywords", value: leadScoringKeywordCount },
      { label: "Automation", value: leadScoringForm.automationEnabled ? "On" : "Off" }
    ],
    [
      leadScoringForm.automationEnabled,
      leadScoringKeywordCount,
      leadScoringSettings.readScore,
      leadScoringSettings.replyScore
    ]
  );
  const leadScoringDatasetTabs = useMemo(
    () => [
      {
        key: "all",
        label: "All datasets",
        count: leadScoringKeywordRules.length + 3
      },
      {
        key: "config",
        label: "Configuration",
        count: 1
      },
      {
        key: "preview",
        label: "Automation preview",
        count: 3
      },
      {
        key: "coverage",
        label: "Rule coverage",
        count: leadScoringKeywordRules.length || 6
      }
    ],
    [leadScoringKeywordRules.length]
  );
  const deferredOwnerAlertSearch = useDeferredValue(String(ownerAlertSearch || "").trim().toLowerCase());
  const ownerAlertCounts = useMemo(
    () =>
      ownerAlerts.reduce(
        (counts, item) => {
          counts.total += 1;
          if (item.isRead) counts.read += 1;
          else counts.unread += 1;
          return counts;
        },
        { total: 0, unread: 0, read: 0 }
      ),
    [ownerAlerts]
  );
  const visibleOwnerAlerts = useMemo(() => {
    const normalizedStatus = String(ownerAlertStatusFilter || "unread").toLowerCase();
    const normalizedSort = String(ownerAlertSort || "newest").toLowerCase();

    const baseAlerts = ownerAlerts.filter((item) => {
      if (normalizedStatus === "read" && !item.isRead) return false;
      if (normalizedStatus === "unread" && item.isRead) return false;

      if (!deferredOwnerAlertSearch) return true;

      const searchableText = [
        item?._id,
        item?.contact?.name,
        item?.contact?.phone,
        item?.contact?.stage,
        item?.contact?.ownerId,
        item?.ownerId,
        item?.automationRule,
        item?.recommendedTemplate,
        item?.createdAt,
        item?.readAt
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredOwnerAlertSearch);
    });

    baseAlerts.sort((left, right) => {
      const leftTime = new Date(left?.createdAt || 0).getTime();
      const rightTime = new Date(right?.createdAt || 0).getTime();
      const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRight = Number.isFinite(rightTime) ? rightTime : 0;

      if (normalizedSort === "oldest") return safeLeft - safeRight;
      if (normalizedSort === "unread-first") {
        if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
        return safeRight - safeLeft;
      }
      return safeRight - safeLeft;
    });

    return baseAlerts;
  }, [deferredOwnerAlertSearch, ownerAlertSort, ownerAlertStatusFilter, ownerAlerts]);
  const displayedOwnerAlerts = useMemo(
    () => visibleOwnerAlerts.slice(0, ownerAlertRenderLimit),
    [ownerAlertRenderLimit, visibleOwnerAlerts]
  );
  const visibleAutomationTasks = useMemo(
    () => (automationResult?.tasks || []).slice(0, 12),
    [automationResult]
  );
  const visibleAutomationUpdates = useMemo(
    () => (automationResult?.contactUpdates || []).slice(0, 12),
    [automationResult]
  );
  const visibleOwnerNotifications = useMemo(
    () => (automationResult?.ownerNotifications || []).slice(0, 12),
    [automationResult]
  );
  const unreadOwnerAlerts = useMemo(
    () => ownerAlertCounts.unread,
    [ownerAlertCounts.unread]
  );
  useEffect(() => {
    if (loading && !dashboard && !automationResult && ownerAlerts.length === 0) return;
    persistCache({
      nextDashboard: dashboard,
      nextAutomationResult: automationResult,
      nextOwnerAlerts: ownerAlerts
    });
  }, [automationResult, dashboard, loading, ownerAlerts, persistCache]);
  const readyForAutomationCount = Number(
    automationResult?.candidateCount ?? summary?.readyForAutomation ?? 25
  );
  const activeViewConfig = CRM_OPS_VIEWS[activeView] || CRM_OPS_VIEWS.overview;
  const topRightActionLabel = activeViewConfig.actionLabel;
  const handleViewChange = useCallback(
    (nextView) => {
      const normalizedView = Object.prototype.hasOwnProperty.call(CRM_OPS_VIEWS, nextView)
        ? nextView
        : "overview";

      startTransition(() => {
        setActiveView(normalizedView);

        const nextParams = new URLSearchParams(searchParams);
        if (normalizedView === "overview") {
          nextParams.delete("view");
        } else {
          nextParams.set("view", normalizedView);
        }
        setSearchParams(nextParams, { replace: true });
      });
    },
    [searchParams, setSearchParams, startTransition]
  );
  const statusChips = [
    {
      icon: Users,
      label: `${owners.length || summary.ownerRowsLoaded || 0} owner rows loaded`
    },
    {
      icon: Clock3,
      label: `Response SLA ${dashboard?.slaHours || 4}h`
    },
    {
      icon: Layers3,
      label: `${readyForAutomationCount} ready for automation`
    },
    {
      icon: RefreshCw,
      label: `Updated ${getShortTimestamp(dashboard?.generatedAt)}`
    }
  ];
  const primaryMetrics = [
    { icon: Users, value: summary.myLeads ?? 0, label: "Assigned to Me" },
    { icon: Clock3, value: summary.overdueFollowUps ?? 0, label: "Follow-ups Overdue" },
    { icon: Send, value: summary.responseSlaBreaches ?? 0, label: "SLA Breaches" },
    { icon: BadgeDollarSign, value: summary.openDeals ?? 0, label: "Open Deals" },
    { icon: Layers3, value: summary.unassignedLeads ?? 0, label: "Unassigned" },
    { icon: SlidersHorizontal, value: summary.dueTodayTasks ?? 0, label: "Due Today" }
  ];
  const secondaryMetrics = [
    { value: summary.needsReply ?? 0, label: "Replies Needed" },
    { value: summary.overdueTasks ?? 0, label: "Tasks Overdue" },
    { value: readyForAutomationCount, label: "Ready for Automation" },
    { value: unreadOwnerAlerts, label: "Unread Alerts" }
  ];
  const filteredOwners = useMemo(() => {
    if (!deferredOwnerSearch) return owners;

    return owners.filter((owner) => {
      const searchableText = [
        owner?.ownerName,
        owner?.ownerId,
        owner?.contactCount,
        owner?.overdueFollowUps,
        owner?.needsReply,
        owner?.responseSlaBreaches,
        owner?.openDeals,
        owner?.openTasks
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredOwnerSearch);
    });
  }, [deferredOwnerSearch, owners]);
  const visibleRules = useMemo(() => automationEntries.slice(0, 6), [automationEntries]);
  const currentRunState = automationResult?.dryRun ? "Preview" : automationResult ? "Live" : "Idle";
  const currentRunCount = automationResult?.createdCount ?? 0;
  const currentCandidateCount = automationResult?.candidateCount ?? 0;
  const deferredHistorySearch = useDeferredValue(String(historySearch || "").trim().toLowerCase());
  const filteredAutomationHistory = useMemo(() => {
    const normalizedFilter = String(historyStatusFilter || "all").trim().toLowerCase();

    return automationHistory.filter((item) => {
      if (normalizedFilter === "success" && item.status !== "success") return false;
      if (normalizedFilter === "error" && item.status !== "error") return false;
      if (normalizedFilter === "preview" && !item.dryRun) return false;
      if (normalizedFilter === "live" && item.dryRun) return false;

      if (!deferredHistorySearch) return true;

      const searchableText = [
        item?._id,
        item?.triggerSource,
        item?.automationActor,
        item?.status,
        item?.errorMessage,
        item?.generatedAt,
        item?.candidateCount,
        item?.createdCount,
        item?.emailNotifications?.attempted,
        item?.emailNotifications?.delivered
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredHistorySearch);
    });
  }, [automationHistory, deferredHistorySearch, historyStatusFilter]);
  const displayedAutomationHistory = useMemo(
    () => filteredAutomationHistory.slice(0, historyRenderLimit),
    [filteredAutomationHistory, historyRenderLimit]
  );
  const automationHistoryCounts = useMemo(
    () =>
      automationHistory.reduce(
        (counts, item) => {
          counts.total += 1;
          if (item.status === "success") counts.success += 1;
          if (item.status === "error") counts.error += 1;
          if (item.dryRun) counts.preview += 1;
          else counts.live += 1;
          return counts;
        },
        { total: 0, success: 0, error: 0, preview: 0, live: 0 }
      ),
    [automationHistory]
  );
  const deferredAutomationDatasetSearch = useDeferredValue(
    String(automationDatasetSearch || "").trim().toLowerCase()
  );
  const filteredAutomationTasks = useMemo(() => {
    if (!deferredAutomationDatasetSearch) return visibleAutomationTasks;

    return visibleAutomationTasks.filter((task) => {
      const searchableText = [
        task?.title,
        task?.contactName,
        task?.phone,
        task?.automationRule,
        task?.recommendedTemplate,
        task?.dueAt,
        task?.leadScore
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredAutomationDatasetSearch);
    });
  }, [deferredAutomationDatasetSearch, visibleAutomationTasks]);
  const filteredAutomationUpdates = useMemo(() => {
    if (!deferredAutomationDatasetSearch) return visibleAutomationUpdates;

    return visibleAutomationUpdates.filter((item) => {
      const searchableText = [
        item?.contactName,
        item?.phone,
        item?.automationRule,
        item?.previousStage,
        item?.nextStage,
        item?.recommendedTemplate,
        item?.leadScore
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredAutomationDatasetSearch);
    });
  }, [deferredAutomationDatasetSearch, visibleAutomationUpdates]);
  const filteredOwnerNotifications = useMemo(() => {
    if (!deferredAutomationDatasetSearch) return visibleOwnerNotifications;

    return visibleOwnerNotifications.filter((item) => {
      const searchableText = [
        item?.contactName,
        item?.ownerId,
        item?.automationRule,
        item?.recommendedTemplate,
        item?.leadScore
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return searchableText.includes(deferredAutomationDatasetSearch);
    });
  }, [deferredAutomationDatasetSearch, visibleOwnerNotifications]);
  const automationDatasetTabs = useMemo(
    () => [
      {
        key: "all",
        label: "All datasets",
        icon: LayoutGrid,
        count: filteredAutomationTasks.length + filteredAutomationUpdates.length + filteredOwnerNotifications.length + 1
      },
      {
        key: "tasks",
        label: "Task preview",
        icon: Target,
        count: filteredAutomationTasks.length
      },
      {
        key: "stage",
        label: "Stage moves",
        icon: GitBranch,
        count: filteredAutomationUpdates.length
      },
      {
        key: "owner",
        label: "Owner notifications",
        icon: BellRing,
        count: filteredOwnerNotifications.length
      },
      {
        key: "email",
        label: "Email delivery",
        icon: Send,
        count: 1
      }
    ],
    [filteredAutomationTasks.length, filteredAutomationUpdates.length, filteredOwnerNotifications.length]
  );

  const markOwnerAlertRead = useCallback(async (notificationId) => {
    try {
      const result = await crmService.markOwnerNotificationRead(notificationId);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to update owner alert");
      }
      setOwnerAlerts((previous) =>
        previous.map((item) =>
          item._id === notificationId
            ? {
                ...item,
                isRead: true,
                readAt: String(result?.data?.readAt || new Date().toISOString())
              }
            : item
        )
      );
      setToast({ type: "success", message: "Owner alert marked as read." });
    } catch (markError) {
      setToast({
        type: "error",
        message: markError?.message || "Failed to update owner alert"
      });
    }
  }, []);
  const markVisibleOwnerAlertsRead = useCallback(async () => {
    const unreadVisibleAlerts = displayedOwnerAlerts.filter((item) => !item.isRead);
    if (!unreadVisibleAlerts.length) return;

    try {
      const results = await Promise.allSettled(
        unreadVisibleAlerts.map((item) => crmService.markOwnerNotificationRead(item._id))
      );
      const succeededIds = [];

      results.forEach((result, index) => {
        if (result.status !== "fulfilled" || result.value?.success === false) return;
        succeededIds.push(unreadVisibleAlerts[index]._id);
      });

      if (succeededIds.length > 0) {
        const timestamp = new Date().toISOString();
        setOwnerAlerts((previous) =>
          previous.map((item) =>
            succeededIds.includes(item._id)
              ? {
                  ...item,
                  isRead: true,
                  readAt: timestamp
                }
              : item
          )
        );
        setToast({
          type: "success",
          message: `${succeededIds.length} owner alert${succeededIds.length === 1 ? "" : "s"} marked read.`
        });
      }

      if (succeededIds.length !== unreadVisibleAlerts.length) {
        const failedCount = unreadVisibleAlerts.length - succeededIds.length;
        setToast({
          type: failedCount ? "error" : "success",
          message:
            failedCount > 0
              ? `${succeededIds.length} alert(s) updated, ${failedCount} failed.`
              : `${succeededIds.length} owner alert(s) marked read.`
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || "Failed to update owner alerts"
      });
    }
  }, [displayedOwnerAlerts]);

  useEffect(() => {
    setOwnerAlertRenderLimit(12);
  }, [deferredOwnerAlertSearch, ownerAlertSort, ownerAlertStatusFilter]);

    useEffect(() => {
      setHistoryRenderLimit(8);
    }, [deferredHistorySearch, historyStatusFilter, historyFetchLimit]);

    useEffect(() => {
      if (!historyLoadMoreRef.current) return undefined;
      if (displayedAutomationHistory.length >= filteredAutomationHistory.length) return undefined;

      const rootNode = historyLoadMoreRef.current.closest(".crm-history-list--scrollable");
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setHistoryRenderLimit((current) =>
            Math.min(current + 8, filteredAutomationHistory.length)
          );
        },
        {
          root: rootNode instanceof HTMLElement ? rootNode : null,
          rootMargin: "120px 0px",
          threshold: 0
        }
      );

      observer.observe(historyLoadMoreRef.current);
      return () => observer.disconnect();
    }, [displayedAutomationHistory.length, filteredAutomationHistory.length]);

  return (
    <div className={`crm-workspace crm-workspace--ops crm-workspace--view-${activeView}`}>
      <CrmToast toast={toast} />
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Operations</h1>
          <p>Track owner workload, follow-up risk, automation runs, and lead scoring from one live workspace.</p>
        </div>
        <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
      </div>

      <div className="crm-viewbar crm-viewbar--header">
        <div className="crm-tab-list">
          {Object.entries(CRM_OPS_VIEWS).map(([key, view]) => (
            <button
              key={key}
              type="button"
              className={`crm-tab-pill ${activeView === key ? "active" : ""}`}
              onClick={() => handleViewChange(key)}
            >
              {key === "overview" ? <LayoutGrid size={14} /> : <Layers3 size={14} />}
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crm-metric-grid">
        <div className="crm-metric-card">
          <Users size={18} />
          <div>
            <strong>{summary.myLeads ?? 0}</strong>
            <span>Assigned to Me</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Clock3 size={18} />
          <div>
            <strong>{summary.overdueFollowUps ?? 0}</strong>
            <span>Follow-ups Overdue</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Send size={18} />
          <div>
            <strong>{summary.responseSlaBreaches ?? 0}</strong>
            <span>SLA Breaches</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <BadgeDollarSign size={18} />
          <div>
            <strong>{summary.openDeals ?? 0}</strong>
            <span>Open Deals</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Layers3 size={18} />
          <div>
            <strong>{summary.unassignedLeads ?? 0}</strong>
            <span>Unassigned</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <SlidersHorizontal size={18} />
          <div>
            <strong>{summary.dueTodayTasks ?? 0}</strong>
            <span>Due Today</span>
          </div>
        </div>
      </div>

      <div className="crm-summary-grid crm-summary-grid--compact">
        <div className="crm-summary-card">
          <strong>{summary.needsReply ?? 0}</strong>
          <span>Replies Needed</span>
        </div>
        <div className="crm-summary-card">
          <strong>{summary.overdueTasks ?? 0}</strong>
          <span>Tasks Overdue</span>
        </div>
        <div className="crm-summary-card">
          <strong>{automationResult?.candidateCount ?? summary.readyForAutomation ?? 25}</strong>
          <span>Ready for Automation</span>
        </div>
        <div className="crm-summary-card">
          <strong>{ownerAlerts.filter((item) => !item.isRead).length}</strong>
          <span>Unread Alerts</span>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {automationMessage && <div className="crm-alert crm-alert-success">{automationMessage}</div>}
      {leadScoringMessage && <div className="crm-alert crm-alert-success">{leadScoringMessage}</div>}
      {activeView === "overview" && (
        <section className="crm-ops-panel crm-ops-panel--overview">
          <div className="crm-drawer-card-header">
            <div>
              <h3>Overview</h3>
              <span className="crm-drawer-helper-text">
                Pick a section above to open just that workspace.
              </span>
            </div>
          </div>
          <div className="crm-overview-grid">
            <button type="button" className="crm-overview-card" onClick={() => handleViewChange("owner-workload")}>
              <strong>Owner Workload</strong>
              <span>Open the live owner table only.</span>
            </button>
            <button type="button" className="crm-overview-card" onClick={() => handleViewChange("owner-alerts")}>
              <strong>Owner Alerts</strong>
              <span>Open the alert feed only.</span>
            </button>
            <button type="button" className="crm-overview-card" onClick={() => handleViewChange("rules-runs")}>
              <strong>Rules &amp; Runs</strong>
              <span>Open automation preview and history only.</span>
            </button>
            <button type="button" className="crm-overview-card" onClick={() => handleViewChange("lead-scoring")}>
              <strong>Lead Scoring</strong>
              <span>Open scoring controls only.</span>
            </button>
          </div>
        </section>
      )}
      {loading && <CrmPageSkeleton variant="ops" />}

      {!loading && (
        <div key={activeView} className={`crm-ops-stage ${isPending ? "is-switching" : ""}`}>
          <div className="crm-ops-layout">
            <section className="crm-ops-panel" data-view="owner-workload">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Owner Workload</h3>
                  <div className="crm-ops-meta">
                    <span>Reply SLA: {dashboard?.slaHours ?? 0} hours</span>
                    <span>Updated: {getShortTimestamp(dashboard?.generatedAt)}</span>
                  </div>
                </div>
                <div className="crm-owner-toolbar">
                  <label className="crm-field crm-field--inline">
                    <span>Search</span>
                    <input
                      type="search"
                      className="crm-input crm-input--small"
                      placeholder="Owner, id, or metric"
                      value={ownerSearch}
                      onChange={(event) => setOwnerSearch(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="crm-owner-summary-strip">
                <span className="crm-ops-chip">Owners: {owners.length}</span>
                <span className="crm-ops-chip">Filtered: {filteredOwners.length}</span>
              </div>

              <div className="crm-owner-table-wrap">
                <table className="crm-owner-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Leads</th>
                      <th>Overdue</th>
                      <th>Needs Reply</th>
                      <th>SLA Breaches</th>
                      <th>Open Deals</th>
                      <th>Pipeline</th>
                      <th>Open Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owners.length === 0 && (
                      <tr>
                        <td className="crm-empty-row" colSpan={8}>
                          No owner workload data yet.
                        </td>
                      </tr>
                    )}
                    {owners.length > 0 && filteredOwners.length === 0 && (
                      <tr>
                        <td className="crm-empty-row" colSpan={8}>
                          No owners match the current search.
                        </td>
                      </tr>
                    )}
                    {filteredOwners.map((owner) => (
                      <tr key={owner.ownerId || owner.ownerName}>
                        <td>
                          <strong>{owner.ownerName || "Unassigned"}</strong>
                          <span>{owner.ownerName || "Unassigned"}</span>
                        </td>
                        <td>{owner.contactCount}</td>
                        <td>{owner.overdueFollowUps}</td>
                        <td>{owner.needsReply}</td>
                        <td>{owner.responseSlaBreaches}</td>
                        <td>{owner.openDeals}</td>
                        <td>{formatCurrency(owner.pipelineValue)}</td>
                        <td>{owner.openTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="crm-ops-panel crm-ops-panel--fullheight" data-view="owner-alerts">
              <div className="crm-drawer-card-header">
                <div className="crm-owner-alerts-heading">
                  <h3>Owner Alerts</h3>
                  <span className="crm-drawer-helper-text">
                    Owner prompts generated by follow-up and scoring automation.
                  </span>
                  <div className="crm-owner-summary-strip crm-owner-summary-strip--inline">
                    <span className="crm-ops-chip">Loaded: {ownerAlertCounts.total}</span>
                    <span className="crm-ops-chip">Unread: {ownerAlertCounts.unread}</span>
                    <span className="crm-ops-chip">Read: {ownerAlertCounts.read}</span>
                    <span className="crm-ops-chip">Filtered: {visibleOwnerAlerts.length}</span>
                    <span className="crm-ops-chip">Showing: {displayedOwnerAlerts.length}</span>
                  </div>
                </div>
                <div className="crm-owner-toolbar crm-owner-toolbar--alerts">
                  <div className="crm-owner-toolbar-row">
                    <label className="crm-field crm-field--inline crm-field--search">
                      <span>Search alerts</span>
                      <input
                        type="search"
                        className="crm-input crm-input--small"
                        placeholder="Contact, stage, owner, template"
                        value={ownerAlertSearch}
                        onChange={(event) => setOwnerAlertSearch(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className={`crm-btn crm-btn-secondary crm-alert-filter-toggle ${ownerAlertFiltersOpen ? "is-open" : ""}`}
                      onClick={() => setOwnerAlertFiltersOpen((current) => !current)}
                      aria-expanded={ownerAlertFiltersOpen}
                      aria-controls="owner-alert-filter-panel"
                    >
                      <SlidersHorizontal size={16} />
                      Filters
                      <ChevronDown size={15} className="crm-alert-filter-toggle-icon" />
                    </button>
                    <div className="crm-owner-toolbar-actions">
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary"
                        onClick={markVisibleOwnerAlertsRead}
                        disabled={!displayedOwnerAlerts.some((item) => !item.isRead)}
                      >
                        Mark visible read
                      </button>
                    </div>
                  </div>
                  {ownerAlertFiltersOpen && (
                    <div id="owner-alert-filter-panel" className="crm-alert-filter-panel">
                      <label className="crm-field crm-field--inline">
                        <span>Status</span>
                        <select
                          className="crm-select crm-select--small"
                          value={ownerAlertStatusFilter}
                          onChange={(event) => setOwnerAlertStatusFilter(event.target.value)}
                        >
                          <option value="unread">Unread</option>
                          <option value="all">All</option>
                          <option value="read">Read</option>
                        </select>
                      </label>
                      <label className="crm-field crm-field--inline">
                        <span>Sort</span>
                        <select
                          className="crm-select crm-select--small"
                          value={ownerAlertSort}
                          onChange={(event) => setOwnerAlertSort(event.target.value)}
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="unread-first">Unread first</option>
                        </select>
                      </label>
                      <label className="crm-field crm-field--inline">
                        <span>Fetch limit</span>
                        <input
                          type="number"
                          min="10"
                          max="150"
                          className="crm-input crm-input--small"
                          value={ownerAlertFetchLimit}
                          onChange={(event) => setOwnerAlertFetchLimit(normalizeLimit(event.target.value))}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="crm-alert-card-grid">
                {displayedOwnerAlerts.length === 0 && (
                  <div className="crm-activity-empty crm-activity-empty--alerts">
                    <strong>No alerts match the current view.</strong>
                    <span>Try switching status, clearing the search, or increasing the fetch limit.</span>
                  </div>
                )}
                {displayedOwnerAlerts.map((item) => (
                  <article key={item._id} className={`crm-alert-card ${item.isRead ? "is-read" : "is-unread"}`}>
                    <div className="crm-alert-card__top">
                      <div className="crm-alert-card__title">
                        <strong>{item.contact?.name || item.contact?.phone || "Assigned lead"}</strong>
                        <span>{item.contact?.phone || "No phone on file"}</span>
                      </div>
                      <div className="crm-alert-card__status">
                        <span className={`crm-status-chip ${item.isRead ? "crm-status-chip--done" : "crm-status-chip--pending"}`}>
                          {item.isRead ? "Read" : "Unread"}
                        </span>
                        <span className="crm-alert-card__time">{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>

                    <div className="crm-alert-card__body">
                      <p>
                        {toLabel(item.automationRule) || "Owner alert"}
                        {item.recommendedTemplate ? ` | Template: ${item.recommendedTemplate}` : ""}
                      </p>
                      <div className="crm-alert-card__meta">
                        <span>Owner: {item.ownerId || item.contact?.ownerId || "Unassigned"}</span>
                        <span>Stage: {toLabel(item.contact?.stage) || "Unknown"}</span>
                        <span>Lead score: {item.leadScore || item.contact?.leadScore || 0}</span>
                      </div>
                    </div>

                    <div className="crm-alert-card__actions">
                      <div className="crm-ops-chip-list">
                        {item.readAt && <span className="crm-ops-chip">Read at {formatDateTime(item.readAt)}</span>}
                        {item.recommendedTemplate && <span className="crm-ops-chip">Template ready</span>}
                      </div>
                      {!item.isRead && (
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          onClick={() => markOwnerAlertRead(item._id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {visibleOwnerAlerts.length > displayedOwnerAlerts.length && (
                <div className="crm-alerts-footer">
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() =>
                      setOwnerAlertRenderLimit((current) => Math.min(current + 12, visibleOwnerAlerts.length))
                    }
                  >
                    Load more alerts
                  </button>
                </div>
              )}
            </section>

            <section className="crm-ops-panel" data-view="rules-runs">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Rules &amp; Runs</h3>
                  <span className="crm-drawer-helper-text">
                    Preview rule matches before applying updates. Scheduler checks every 15 minutes.
                  </span>
                </div>
              </div>

              <div className="crm-rules-toolbar">
                <label className="crm-field crm-field--inline crm-rules-toolbar__batch">
                  <span>Batch Limit</span>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="crm-input crm-input--small"
                    value={automationLimit}
                    onChange={(event) => setAutomationLimit(normalizeLimit(event.target.value))}
                  />
                </label>
                <label className="crm-field crm-field--inline crm-rules-toolbar__search">
                  <span>Search datasets</span>
                  <input
                    type="search"
                    className="crm-input crm-input--small"
                    placeholder="Contact, rule, stage, template"
                    value={automationDatasetSearch}
                    onChange={(event) => setAutomationDatasetSearch(event.target.value)}
                  />
                </label>
                <div className="crm-rules-toolbar__actions">
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary"
                    onClick={() => runAutomation(true)}
                    disabled={previewing || running}
                  >
                    <RefreshCw size={16} className={previewing ? "spin" : ""} />
                    {previewing ? "Previewing..." : "Preview Matches"}
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    onClick={() => runAutomation(false)}
                    disabled={running || previewing}
                  >
                    <Zap size={16} />
                    {running ? "Running..." : "Run Rules"}
                  </button>
                </div>
              </div>

              <div className="crm-rules-control-strip">
                <div className="crm-ops-chip-list crm-rules-status-strip">
                  <span className="crm-ops-chip">Mode: {currentRunState}</span>
                  <span className="crm-ops-chip">Candidates: {currentCandidateCount}</span>
                  <span className="crm-ops-chip">Created: {currentRunCount}</span>
                  <span className="crm-ops-chip">Rules matched: {automationEntries.length}</span>
                </div>
                <div className="crm-rules-dataset-switcher">
                  {automationDatasetTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = automationDatasetView === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={`crm-filter-chip crm-rules-dataset-tab ${isActive ? "active" : ""}`}
                        onClick={() => setAutomationDatasetView(tab.key)}
                        aria-pressed={isActive}
                      >
                        <TabIcon size={14} />
                        <span>{tab.label}</span>
                        <strong>{tab.count}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="crm-summary-grid crm-summary-grid--compact">
                <div className="crm-summary-card">
                  <strong>{automationResult?.candidateCount ?? 0}</strong>
                  <span>Ready</span>
                </div>
                <div className="crm-summary-card">
                  <strong>{automationResult?.createdCount ?? 0}</strong>
                  <span>Created</span>
                </div>
                <div className="crm-summary-card">
                  <strong>{automationResult?.slaHours ?? dashboard?.slaHours ?? 0}</strong>
                  <span>SLA Window</span>
                </div>
                <div className="crm-summary-card">
                  <strong>{automationResult?.dryRun ? "Preview" : "Live"}</strong>
                  <span>Last Run</span>
                </div>
              </div>

              {automationEntries.length > 0 && (
                <div className="crm-ops-chip-list">
                  {automationEntries.map(([rule, count]) => (
                    <span key={rule} className="crm-ops-chip">
                      {AUTOMATION_RULE_LABELS[rule] || toLabel(rule)}: {Number(count || 0)}
                    </span>
                  ))}
                </div>
              )}

              <div className={`crm-automation-dataset-grid ${automationDatasetView !== "all" ? "is-single" : ""}`}>
                {(automationDatasetView === "all" || automationDatasetView === "tasks") && (
                  <article className="crm-automation-column crm-automation-column--dataset">
                    <div className="crm-automation-column-header crm-automation-column-header--dataset">
                      <div className="crm-automation-column-header__title">
                        <Target size={15} />
                        <span>Task Preview</span>
                      </div>
                      <span className="crm-automation-column-header__meta">{filteredAutomationTasks.length} shown</span>
                    </div>
                    <div className="crm-automation-list crm-automation-list--scrollable">
                      {filteredAutomationTasks.length ? (
                        filteredAutomationTasks.map((task) => (
                          <article
                            key={`${task.contactId}-${task.automationRule}-${task.title}`}
                            className="crm-automation-item"
                          >
                            <strong>{task.title || "Automation task"}</strong>
                            <span>
                              {task.contactName || "Unknown contact"}
                              {task.phone ? ` | ${task.phone}` : ""}
                            </span>
                            <span>{AUTOMATION_RULE_LABELS[task.automationRule] || toLabel(task.automationRule)}</span>
                            <span>
                              Score: {task.leadScore || 0}
                              {task.recommendedTemplate ? ` | Template: ${task.recommendedTemplate}` : ""}
                            </span>
                            <time>{formatDateTime(task.dueAt)}</time>
                          </article>
                        ))
                      ) : (
                        <div className="crm-empty-column">Preview or run automation to inspect generated tasks.</div>
                      )}
                    </div>
                  </article>
                )}

                {(automationDatasetView === "all" || automationDatasetView === "stage") && (
                  <article className="crm-automation-column crm-automation-column--dataset">
                    <div className="crm-automation-column-header crm-automation-column-header--dataset">
                      <div className="crm-automation-column-header__title">
                        <GitBranch size={15} />
                        <span>Stage Moves</span>
                      </div>
                      <span className="crm-automation-column-header__meta">{filteredAutomationUpdates.length} shown</span>
                    </div>
                    <div className="crm-automation-list crm-automation-list--scrollable">
                      {filteredAutomationUpdates.length ? (
                        filteredAutomationUpdates.map((item) => (
                          <article
                            key={`${item.contactId}-${item.automationRule}-${item.nextStage}`}
                            className="crm-automation-item"
                          >
                            <strong>{item.contactName || "Unknown contact"}</strong>
                            <span>
                              {item.phone || "-"} | {AUTOMATION_RULE_LABELS[item.automationRule] || toLabel(item.automationRule)}
                            </span>
                            <span>
                              {toLabel(item.previousStage)}
                              {" -> "}
                              {toLabel(item.nextStage)}
                            </span>
                            <span>
                              Score: {item.leadScore || 0}
                              {item.recommendedTemplate ? ` | Template: ${item.recommendedTemplate}` : ""}
                            </span>
                          </article>
                        ))
                      ) : (
                        <div className="crm-empty-column">Stage automation changes will appear here after a preview or run.</div>
                      )}
                    </div>
                  </article>
                )}

                {(automationDatasetView === "all" || automationDatasetView === "owner") && (
                  <article className="crm-automation-column crm-automation-column--dataset">
                    <div className="crm-automation-column-header crm-automation-column-header--dataset">
                      <div className="crm-automation-column-header__title">
                        <BellRing size={15} />
                        <span>Owner Notifications</span>
                      </div>
                      <span className="crm-automation-column-header__meta">{filteredOwnerNotifications.length} shown</span>
                    </div>
                    <div className="crm-automation-list crm-automation-list--scrollable">
                      {filteredOwnerNotifications.length ? (
                        filteredOwnerNotifications.map((item) => (
                          <article
                            key={`${item.contactId}-${item.ownerId}-${item.automationRule}`}
                            className="crm-automation-item"
                          >
                            <strong>{item.contactName || "Unknown contact"}</strong>
                            <span>
                              Owner: {item.ownerId || "-"} | {AUTOMATION_RULE_LABELS[item.automationRule] || toLabel(item.automationRule)}
                            </span>
                            <span>
                              Score: {item.leadScore || 0}
                              {item.recommendedTemplate ? ` | Template: ${item.recommendedTemplate}` : ""}
                            </span>
                          </article>
                        ))
                      ) : (
                        <div className="crm-empty-column">
                          Owner notification events will appear here when automation alerts are generated.
                        </div>
                      )}
                    </div>
                  </article>
                )}

                {(automationDatasetView === "all" || automationDatasetView === "email") && (
                  <article className="crm-automation-column crm-automation-column--dataset">
                    <div className="crm-automation-column-header crm-automation-column-header--dataset">
                      <div className="crm-automation-column-header__title">
                        <Send size={15} />
                        <span>Email Delivery</span>
                      </div>
                      <span className="crm-automation-column-header__meta">1 summary</span>
                    </div>
                    <div className="crm-automation-list crm-automation-list--scrollable">
                      <article className="crm-automation-item">
                        <strong>SMTP Delivery Summary</strong>
                        <span>Attempted: {automationResult?.emailNotifications?.attempted ?? 0}</span>
                        <span>Delivered: {automationResult?.emailNotifications?.delivered ?? 0}</span>
                        <span>Skipped: {automationResult?.emailNotifications?.skipped ?? 0}</span>
                        <span>Failed: {automationResult?.emailNotifications?.failed ?? 0}</span>
                      </article>
                    </div>
                  </article>
                )}
              </div>
            </section>
          </div>

          <div className="crm-ops-layout">
            <section className="crm-ops-panel" data-view="history">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Automation History</h3>
                  <span className="crm-drawer-helper-text">
                    Recent scheduler and manual runs with candidate volume and delivery summary.
                  </span>
                </div>
              </div>

              <div className="crm-history-toolbar">
                <label className="crm-field crm-field--inline crm-history-toolbar__search">
                  <span>Search history</span>
                  <input
                    type="search"
                    className="crm-input crm-input--small"
                    placeholder="Trigger, actor, error, counts"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                  />
                </label>
                <label className="crm-field crm-field--inline crm-history-toolbar__limit">
                  <span>Fetch limit</span>
                  <input
                    type="number"
                    min="6"
                    max="50"
                    className="crm-input crm-input--small"
                    value={historyFetchLimit}
                    onChange={(event) => {
                      const nextLimit = normalizeLimit(event.target.value);
                      setHistoryFetchLimit(nextLimit);
                      loadAutomationHistory({ silent: true, limit: nextLimit });
                    }}
                  />
                </label>
              </div>

              <div className="crm-history-control-strip">
                <div className="crm-ops-chip-list crm-history-summary-strip">
                  <span className="crm-ops-chip">Loaded: {automationHistoryCounts.total}</span>
                  <span className="crm-ops-chip">Showing: {displayedAutomationHistory.length}</span>
                  <span className="crm-ops-chip">Success: {automationHistoryCounts.success}</span>
                  <span className="crm-ops-chip">Failed: {automationHistoryCounts.error}</span>
                  <span className="crm-ops-chip">Preview: {automationHistoryCounts.preview}</span>
                  <span className="crm-ops-chip">Live: {automationHistoryCounts.live}</span>
                </div>
                <div className="crm-history-dataset-switcher">
                  {[
                    { key: "all", label: "All runs" },
                    { key: "success", label: "Success" },
                    { key: "error", label: "Failed" },
                    { key: "preview", label: "Preview" },
                    { key: "live", label: "Live" }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`crm-filter-chip crm-history-tab ${historyStatusFilter === item.key ? "active" : ""}`}
                      onClick={() => setHistoryStatusFilter(item.key)}
                      aria-pressed={historyStatusFilter === item.key}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="crm-history-list crm-history-list--scrollable">
                {displayedAutomationHistory.length === 0 && (
                  <div className="crm-activity-empty crm-activity-empty--history">No automation history recorded yet.</div>
                )}
                {displayedAutomationHistory.map((item) => (
                  <article key={item._id} className="crm-history-card">
                    <div className="crm-history-card__top">
                      <div className="crm-history-card__title">
                        <strong>{toLabel(item.triggerSource) || "Automation run"}</strong>
                        <span>{formatDateTime(item.generatedAt)}</span>
                      </div>
                      <div className="crm-history-card__status">
                        <span
                          className={`crm-status-chip ${
                            item.status === "success" ? "crm-status-chip--done" : "crm-status-chip--error"
                          }`}
                        >
                          {toLabel(item.status)}
                        </span>
                        <span className="crm-status-chip crm-status-chip--pending">
                          {item.dryRun ? "Preview" : "Live"}
                        </span>
                      </div>
                    </div>

                    <div className="crm-history-card__meta">
                      <span>Candidates: {item.candidateCount}</span>
                      <span>Created: {item.createdCount}</span>
                      <span>Email: {item.emailNotifications.delivered}/{item.emailNotifications.attempted}</span>
                      {item.automationActor && <span>Actor: {toLabel(item.automationActor)}</span>}
                    </div>

                    {item.errorMessage && <p className="crm-history-card__error">{item.errorMessage}</p>}

                    <div className="crm-history-card__actions">
                      <div className="crm-ops-chip-list">
                        {item.dryRun && <span className="crm-ops-chip">Preview run</span>}
                        {!item.dryRun && <span className="crm-ops-chip">Live run</span>}
                      </div>
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary"
                        onClick={() => runAutomation(item.dryRun)}
                        disabled={running || previewing}
                      >
                        {item.dryRun ? "Repeat Preview" : "Retry Run"}
                      </button>
                    </div>
                  </article>
                ))}
                {displayedAutomationHistory.length < filteredAutomationHistory.length && (
                  <div ref={historyLoadMoreRef} className="crm-history-load-more-sentinel" aria-hidden="true" />
                )}
              </div>
            </section>

            <section className="crm-ops-panel crm-ops-panel--lead-scoring" data-view="lead-scoring">
              <div className="crm-drawer-card-header crm-leadscoring-header">
                <div>
                  <h3>Lead Scoring</h3>
                  <span className="crm-drawer-helper-text">
                    Manage score thresholds, templates, and owner follow-up prompts.
                  </span>
                </div>
                <div className="crm-leadscoring-toolbar">
                  <div className="crm-ops-chip-list crm-leadscoring-summary-strip">
                    {leadScoringConfigCards.map((item) => (
                      <span key={item.label} className="crm-ops-chip">
                        {item.label}: {item.value}
                      </span>
                    ))}
                  </div>
                  <div className="crm-leadscoring-dataset-switcher" role="tablist" aria-label="Lead scoring datasets">
                    {leadScoringDatasetTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`crm-btn crm-btn-secondary crm-leadscoring-tab ${leadScoringDatasetView === tab.key ? "active" : ""}`}
                        onClick={() => setLeadScoringDatasetView(tab.key)}
                        aria-pressed={leadScoringDatasetView === tab.key}
                      >
                        {tab.label}
                        <span className="crm-leadscoring-tab__count">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`crm-leadscoring-grid ${leadScoringDatasetView !== "all" ? "is-single" : ""}`}>
                {(leadScoringDatasetView === "all" || leadScoringDatasetView === "config") && (
                  <section className="crm-leadscoring-panel">
                    <div className="crm-leadscoring-panel__header">
                      <div>
                        <h4>Configuration</h4>
                        <span className="crm-drawer-helper-text">
                          Control thresholds, automation rules, and owner notifications.
                        </span>
                      </div>
                      <span className="crm-ops-chip">Live config</span>
                    </div>

                    <div className="crm-leadscoring-form">
                      <label className="crm-toggle-row">
                        <input
                          type="checkbox"
                          checked={Boolean(leadScoringForm.isEnabled)}
                          onChange={(event) => updateLeadScoringForm("isEnabled", event.target.checked)}
                          disabled={leadScoringLoading || leadScoringSaving}
                        />
                        <span>Enable lead scoring</span>
                      </label>

                      <label className="crm-toggle-row">
                        <input
                          type="checkbox"
                          checked={Boolean(leadScoringForm.automationEnabled)}
                          onChange={(event) =>
                            updateLeadScoringForm("automationEnabled", event.target.checked)
                          }
                          disabled={leadScoringLoading || leadScoringSaving}
                        />
                        <span>Enable score-based automation</span>
                      </label>

                      <div className="crm-drawer-form-grid crm-drawer-form-grid--leadscoring">
                        <label className="crm-field">
                          <span>Move lead at score</span>
                          <input
                            type="number"
                            min="0"
                            className="crm-input"
                            value={leadScoringForm.stageThreshold}
                            onChange={(event) => updateLeadScoringForm("stageThreshold", event.target.value)}
                            disabled={leadScoringLoading || leadScoringSaving}
                          />
                        </label>
                        <label className="crm-field">
                          <span>Move to stage</span>
                          <select
                            className="crm-select"
                            value={leadScoringForm.stageOnThreshold}
                            onChange={(event) => updateLeadScoringForm("stageOnThreshold", event.target.value)}
                            disabled={leadScoringLoading || leadScoringSaving}
                          >
                            {leadStageOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="crm-field">
                          <span>Create task at score</span>
                          <input
                            type="number"
                            min="0"
                            className="crm-input"
                            value={leadScoringForm.taskThreshold}
                            onChange={(event) => updateLeadScoringForm("taskThreshold", event.target.value)}
                            disabled={leadScoringLoading || leadScoringSaving}
                          />
                        </label>
                        <label className="crm-field">
                          <span>Task name</span>
                          <input
                            type="text"
                            className="crm-input"
                            value={leadScoringForm.taskTitle}
                            onChange={(event) => updateLeadScoringForm("taskTitle", event.target.value)}
                            disabled={leadScoringLoading || leadScoringSaving}
                          />
                        </label>
                        <label className="crm-field crm-field--span-2">
                          <span>Suggested template</span>
                          <input
                            type="text"
                            className="crm-input"
                            value={leadScoringForm.recommendedTemplate}
                            onChange={(event) =>
                              updateLeadScoringForm("recommendedTemplate", event.target.value)
                            }
                            placeholder="welcome_offer / proposal_follow_up"
                            disabled={leadScoringLoading || leadScoringSaving}
                          />
                        </label>
                      </div>

                      <label className="crm-toggle-row">
                        <input
                          type="checkbox"
                          checked={Boolean(leadScoringForm.ownerNotification)}
                          onChange={(event) =>
                            updateLeadScoringForm("ownerNotification", event.target.checked)
                          }
                          disabled={leadScoringLoading || leadScoringSaving}
                        />
                        <span>Notify owner when scoring creates an action</span>
                      </label>

                      <div className="crm-drawer-actions">
                        <button
                          type="button"
                          className="crm-btn crm-btn-primary"
                          onClick={saveLeadScoringAutomation}
                          disabled={leadScoringLoading || leadScoringSaving}
                        >
                          {leadScoringSaving ? "Saving..." : "Save Scoring"}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {(leadScoringDatasetView === "all" || leadScoringDatasetView === "preview") && (
                  <section className="crm-leadscoring-panel">
                    <div className="crm-leadscoring-panel__header">
                      <div>
                        <h4>Automation Preview</h4>
                        <span className="crm-drawer-helper-text">
                          Quick read on what the current scoring configuration will trigger.
                        </span>
                      </div>
                      <span className="crm-ops-chip">Optimized</span>
                    </div>

                    <div className="crm-leadscoring-preview-grid">
                      <div className="crm-summary-card">
                        <strong>{leadScoringSettings.readScore}</strong>
                        <span>Read score</span>
                      </div>
                      <div className="crm-summary-card">
                        <strong>{leadScoringSettings.replyScore}</strong>
                        <span>Reply score</span>
                      </div>
                      <div className="crm-summary-card">
                        <strong>{leadScoringForm.stageThreshold}</strong>
                        <span>Stage threshold</span>
                      </div>
                      <div className="crm-summary-card">
                        <strong>{leadScoringForm.taskThreshold}</strong>
                        <span>Task threshold</span>
                      </div>
                    </div>

                    <div className="crm-rule-list">
                      <article className="crm-rule-item">
                        <Clock3 size={16} />
                        <div>
                          <strong>Lead becomes active</strong>
                          <span>Read and reply signals are already counted against the live score.</span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <Target size={16} />
                        <div>
                          <strong>Stage move</strong>
                          <span>
                            Move leads to {toLabel(leadScoringForm.stageOnThreshold)} once they cross score{" "}
                            {leadScoringForm.stageThreshold}.
                          </span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <BellRing size={16} />
                        <div>
                          <strong>High intent task</strong>
                          <span>
                            Create task "{leadScoringForm.taskTitle || "High intent lead follow-up"}" at score{" "}
                            {leadScoringForm.taskThreshold}.
                          </span>
                        </div>
                      </article>
                    </div>
                  </section>
                )}

                {(leadScoringDatasetView === "all" || leadScoringDatasetView === "coverage") && (
                  <section className="crm-leadscoring-panel">
                    <div className="crm-leadscoring-panel__header">
                      <div>
                        <h4>Rule Coverage</h4>
                        <span className="crm-drawer-helper-text">
                          What the automation engine is currently watching for.
                        </span>
                      </div>
                      <span className="crm-ops-chip">Coverage {leadScoringKeywordCount}</span>
                    </div>

                    <div className="crm-rule-list crm-leadscoring-rule-list">
                      <article className="crm-rule-item">
                        <Clock3 size={16} />
                        <div>
                          <strong>Overdue follow-up</strong>
                          <span>Create a task when the next follow-up date is already missed.</span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <Send size={16} />
                        <div>
                          <strong>Reply SLA breach</strong>
                          <span>Create a task when inbound messages wait longer than the configured SLA window.</span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <BadgeDollarSign size={16} />
                        <div>
                          <strong>Deal close risk</strong>
                          <span>Create a task when open deals are close to the expected close time.</span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <GitBranch size={16} />
                        <div>
                          <strong>Opt-in to nurturing</strong>
                          <span>Move opted-in leads from early stages into nurturing automatically.</span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <Target size={16} />
                        <div>
                          <strong>Lead score stage advance</strong>
                          <span>
                            Move leads to {toLabel(leadScoringForm.stageOnThreshold)} once they cross score{" "}
                            {leadScoringForm.stageThreshold}.
                          </span>
                        </div>
                      </article>
                      <article className="crm-rule-item">
                        <BellRing size={16} />
                        <div>
                          <strong>High intent follow-up task</strong>
                          <span>
                            Create task "{leadScoringForm.taskTitle || "High intent lead follow-up"}" at score{" "}
                            {leadScoringForm.taskThreshold}.
                          </span>
                        </div>
                      </article>
                    </div>

                    <div className="crm-leadscoring-keyword-strip">
                      <div className="crm-leadscoring-keyword-strip__header">
                        <strong>Keyword rules</strong>
                        <span>{leadScoringKeywordCount} configured</span>
                      </div>
                      <div className="crm-leadscoring-keyword-list crm-leadscoring-keyword-list--scrollable">
                        {leadScoringKeywordRules.length === 0 ? (
                          <div className="crm-activity-empty crm-activity-empty--history">
                            No keyword rules configured yet.
                          </div>
                        ) : (
                          leadScoringKeywordRules.map((item) => (
                            <div
                              key={`${item.keyword}-${item.score ?? "na"}-${item.stage || "any"}`}
                              className="crm-leadscoring-keyword-card"
                            >
                              <strong>{item.keyword}</strong>
                              <span>Score {item.score ?? "n/a"}</span>
                              <span>{item.stage ? `Stage: ${toLabel(item.stage)}` : "Any stage"}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmOps;

