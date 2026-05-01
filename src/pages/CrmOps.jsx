import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeDollarSign,
  BellRing,
  Clock3,
  GitBranch,
  RefreshCw,
  Send,
  Target,
  Users,
  Zap
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import { whatsappService } from "../services/whatsappService";
import CrmToast from "../components/crm/CrmToast";
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
    stage: String(item?.contact?.stage || "").trim()
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

const CrmOps = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [automationResult, setAutomationResult] = useState(null);
  const [leadScoringSettings, setLeadScoringSettings] = useState(() =>
    sanitizeLeadScoringSettings({})
  );
  const [leadScoringForm, setLeadScoringForm] = useState(() => buildLeadScoringForm({}));
  const [leadStageOptions, setLeadStageOptions] = useState(DEFAULT_STAGE_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [leadScoringLoading, setLeadScoringLoading] = useState(false);
  const [leadScoringSaving, setLeadScoringSaving] = useState(false);
  const [ownerAlerts, setOwnerAlerts] = useState([]);
  const [automationHistory, setAutomationHistory] = useState([]);
  const [error, setError] = useState("");
  const [automationMessage, setAutomationMessage] = useState("");
  const [leadScoringMessage, setLeadScoringMessage] = useState("");
  const [automationLimit, setAutomationLimit] = useState("25");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const currentUserId = resolveCacheUserId();
  const hasLoadedFromCacheRef = useRef(false);
  const requestedHistoryStatus = String(searchParams.get("historyStatus") || "all")
    .trim()
    .toLowerCase();

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
    if (!["all", "success", "error"].includes(requestedHistoryStatus)) return;
    setHistoryStatusFilter(requestedHistoryStatus);
  }, [requestedHistoryStatus]);

  useEffect(() => {
    const desiredStatus = String(historyStatusFilter || "all").trim().toLowerCase();
    if (!["all", "success", "error"].includes(desiredStatus)) return;

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

  const persistCache = useCallback(
    (nextDashboard, nextAutomationResult = automationResult) => {
      writeSidebarPageCache(
        CRM_OPS_CACHE_NAMESPACE,
        {
          dashboard: nextDashboard ? sanitizeDashboard(nextDashboard) : null,
          automationResult: nextAutomationResult
            ? sanitizeAutomationResult(nextAutomationResult)
            : null
        },
        {
          currentUserId,
          ttlMs: CRM_OPS_CACHE_TTL_MS
        }
      );
    },
    [automationResult, currentUserId]
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
          if (silent) setRefreshing(false);
          else setLoading(false);
        },
        CRM_OPS_LOADING_TIMEOUT_MS
      );

      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError("");

        const [result, ownerNotificationResult, historyResult] = await Promise.all([
          crmService.getOwnerDashboard(),
          crmService.getOwnerNotifications({ status: "all", limit: 20 }),
          crmService.getAutomationHistory({ limit: 12 })
        ]);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load CRM ops dashboard");
        }

        const nextDashboard = sanitizeDashboard(result?.data || {});
        setDashboard(nextDashboard);
        if (ownerNotificationResult?.success !== false) {
          setOwnerAlerts(
            Array.isArray(ownerNotificationResult?.data)
              ? ownerNotificationResult.data.map(sanitizeOwnerAlert)
              : []
          );
        }
        if (historyResult?.success !== false) {
          setAutomationHistory(
            Array.isArray(historyResult?.data)
              ? historyResult.data.map(sanitizeAutomationHistoryItem)
              : []
          );
        }
        persistCache(nextDashboard);
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM ops dashboard");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [persistCache]
  );

  const handleRealtimeRefresh = useCallback(() => {
    loadDashboard({ silent: true });
  }, [loadDashboard]);

  useCrmRealtimeRefresh({
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
      setLoading(false);
      loadDashboard({ silent: true });
      loadLeadScoringSettings();
      return;
    }

    loadDashboard();
    loadLeadScoringSettings();
  }, [currentUserId, loadDashboard, loadLeadScoringSettings]);

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
        persistCache(dashboard, nextAutomationResult);

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
    [automationLimit, dashboard, loadDashboard, persistCache]
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
  const visibleAutomationHistory = useMemo(() => {
    if (historyStatusFilter === "all") return automationHistory;
    return automationHistory.filter((item) => item.status === historyStatusFilter);
  }, [automationHistory, historyStatusFilter]);
  const leadScoringKeywordCount = useMemo(
    () => (Array.isArray(leadScoringSettings?.keywordRules) ? leadScoringSettings.keywordRules.length : 0),
    [leadScoringSettings]
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

  return (
    <div className="crm-workspace">
      <CrmToast toast={toast} />
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Ops</h1>
          <p>Monitor owner queues, response SLA pressure, pipeline automation rules, and lead scoring triggers.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => {
            loadDashboard({ silent: true });
            loadLeadScoringSettings();
          }}
          disabled={refreshing || leadScoringLoading}
        >
          <RefreshCw size={16} className={refreshing || leadScoringLoading ? "spin" : ""} />
          {refreshing || leadScoringLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="crm-metric-grid">
        <div className="crm-metric-card">
          <Users size={18} />
          <div>
            <strong>{summary.myLeads ?? 0}</strong>
            <span>My Leads</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Clock3 size={18} />
          <div>
            <strong>{summary.overdueFollowUps ?? 0}</strong>
            <span>Overdue Follow-ups</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Send size={18} />
          <div>
            <strong>{summary.responseSlaBreaches ?? 0}</strong>
            <span>Reply SLA Breaches</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <BadgeDollarSign size={18} />
          <div>
            <strong>{summary.openDeals ?? 0}</strong>
            <span>Open Deals</span>
          </div>
        </div>
      </div>

      <div className="crm-summary-grid crm-summary-grid--compact">
        <div className="crm-summary-card">
          <strong>{summary.unassignedLeads ?? 0}</strong>
          <span>Unassigned Leads</span>
        </div>
        <div className="crm-summary-card">
          <strong>{summary.needsReply ?? 0}</strong>
          <span>Needs Reply</span>
        </div>
        <div className="crm-summary-card">
          <strong>{summary.overdueTasks ?? 0}</strong>
          <span>Overdue Tasks</span>
        </div>
        <div className="crm-summary-card">
          <strong>{summary.dueTodayTasks ?? 0}</strong>
          <span>Tasks Due Today</span>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {automationMessage && <div className="crm-alert crm-alert-success">{automationMessage}</div>}
      {leadScoringMessage && <div className="crm-alert crm-alert-success">{leadScoringMessage}</div>}
      {loading && <CrmPageSkeleton variant="ops" />}

      {!loading && (
        <>
          <div className="crm-ops-layout">
            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Owner Performance</h3>
                  <div className="crm-ops-meta">
                    <span>Reply SLA: {dashboard?.slaHours ?? 0} hours</span>
                    <span>Updated: {formatDateTime(dashboard?.generatedAt)}</span>
                  </div>
                </div>
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
                          No owner performance data yet.
                        </td>
                      </tr>
                    )}
                    {owners.map((owner) => (
                      <tr key={owner.ownerId || owner.ownerName}>
                        <td>
                          <strong>{owner.ownerName || "Unassigned"}</strong>
                          <span>{owner.ownerId || "No owner id"}</span>
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

            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Owner Alert Feed</h3>
                  <span className="crm-drawer-helper-text">
                    Automation-generated owner notifications and follow-up prompts.
                  </span>
                </div>
              </div>

              <div className="crm-activity-list">
                {ownerAlerts.length === 0 && (
                  <div className="crm-activity-empty">No owner alerts yet.</div>
                )}
                {ownerAlerts.map((item) => (
                  <div key={item._id} className="crm-activity-item">
                    <div className="crm-activity-dot" />
                    <div className="crm-activity-content">
                      <div className="crm-activity-head">
                        <strong>{item.contact?.name || item.contact?.phone || "Assigned lead"}</strong>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                      <p>
                        {toLabel(item.automationRule) || "Owner alert"}
                        {item.recommendedTemplate ? ` • Template: ${item.recommendedTemplate}` : ""}
                        {item.contact?.stage ? ` • Stage: ${item.contact.stage}` : ""}
                      </p>
                      <div className="crm-inline-actions">
                        <span className={`crm-status-chip ${item.isRead ? "crm-status-chip--done" : "crm-status-chip--pending"}`}>
                          {item.isRead ? "Read" : "Unread"}
                        </span>
                        {!item.isRead && (
                          <button
                            type="button"
                            className="crm-btn crm-btn-secondary"
                            onClick={() => markOwnerAlertRead(item._id)}
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Automation Control</h3>
                  <span className="crm-drawer-helper-text">
                    Scheduler runs every 15 minutes. Preview and trigger pipeline rules here.
                  </span>
                </div>
              </div>

              <div className="crm-ops-actions">
                <label className="crm-field">
                  <span>Batch Size</span>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="crm-input crm-input--small"
                    value={automationLimit}
                    onChange={(event) => setAutomationLimit(normalizeLimit(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={() => runAutomation(true)}
                  disabled={previewing || running}
                >
                  <RefreshCw size={16} className={previewing ? "spin" : ""} />
                  {previewing ? "Previewing..." : "Preview Rules"}
                </button>
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={() => runAutomation(false)}
                  disabled={running || previewing}
                >
                  <Zap size={16} />
                  {running ? "Running..." : "Run Automation"}
                </button>
              </div>

              <div className="crm-summary-grid crm-summary-grid--compact">
                <div className="crm-summary-card">
                  <strong>{automationResult?.candidateCount ?? 0}</strong>
                  <span>Candidates</span>
                </div>
                <div className="crm-summary-card">
                  <strong>{automationResult?.createdCount ?? 0}</strong>
                  <span>Applied</span>
                </div>
                <div className="crm-summary-card">
                  <strong>{automationResult?.slaHours ?? dashboard?.slaHours ?? 0}</strong>
                  <span>SLA Hours</span>
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

              <div className="crm-automation-dual-list">
                <div className="crm-automation-column">
                  <div className="crm-automation-column-header">
                    <Target size={15} />
                    <span>Task Candidates</span>
                  </div>
                  <div className="crm-automation-list">
                    {automationResult?.tasks?.length ? (
                      automationResult.tasks.map((task) => (
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
                </div>

                <div className="crm-automation-column">
                  <div className="crm-automation-column-header">
                    <GitBranch size={15} />
                    <span>Stage Updates</span>
                  </div>
                  <div className="crm-automation-list">
                    {automationResult?.contactUpdates?.length ? (
                      automationResult.contactUpdates.map((item) => (
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
                </div>
              </div>

              <div className="crm-automation-column">
                <div className="crm-automation-column-header">
                  <BellRing size={15} />
                  <span>Owner Notifications</span>
                </div>
                <div className="crm-automation-list">
                  {automationResult?.ownerNotifications?.length ? (
                    automationResult.ownerNotifications.map((item) => (
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
                    <div className="crm-empty-column">Owner notification events will appear here when automation alerts are generated.</div>
                  )}
                </div>
              </div>

              <div className="crm-automation-column">
                <div className="crm-automation-column-header">
                  <Send size={15} />
                  <span>Email Delivery</span>
                </div>
                <div className="crm-automation-list">
                  <article className="crm-automation-item">
                    <strong>SMTP Delivery Summary</strong>
                    <span>Attempted: {automationResult?.emailNotifications?.attempted ?? 0}</span>
                    <span>Delivered: {automationResult?.emailNotifications?.delivered ?? 0}</span>
                    <span>Skipped: {automationResult?.emailNotifications?.skipped ?? 0}</span>
                    <span>Failed: {automationResult?.emailNotifications?.failed ?? 0}</span>
                  </article>
                </div>
              </div>
            </section>
          </div>

          <div className="crm-ops-layout">
            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Automation History</h3>
                  <span className="crm-drawer-helper-text">
                    Recent scheduler and manual runs with candidate volume and delivery summary.
                  </span>
                </div>
              </div>

              <div className="crm-activity-list">
                <div className="crm-filter-group">
                  <button
                    type="button"
                    className={`crm-filter-chip ${historyStatusFilter === "all" ? "active" : ""}`}
                    onClick={() => setHistoryStatusFilter("all")}
                  >
                    All Runs
                  </button>
                  <button
                    type="button"
                    className={`crm-filter-chip ${historyStatusFilter === "success" ? "active" : ""}`}
                    onClick={() => setHistoryStatusFilter("success")}
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    className={`crm-filter-chip ${historyStatusFilter === "error" ? "active" : ""}`}
                    onClick={() => setHistoryStatusFilter("error")}
                  >
                    Failed
                  </button>
                </div>

                {visibleAutomationHistory.length === 0 && (
                  <div className="crm-activity-empty">No automation history recorded yet.</div>
                )}
                {visibleAutomationHistory.map((item) => (
                  <div key={item._id} className="crm-activity-item">
                    <div className="crm-activity-dot" />
                    <div className="crm-activity-content">
                      <div className="crm-activity-head">
                        <strong>{toLabel(item.triggerSource)}</strong>
                        <span>{formatDateTime(item.generatedAt)}</span>
                      </div>
                      <p>
                        {item.dryRun ? "Preview" : "Live run"} | Candidates: {item.candidateCount} | Created: {item.createdCount}
                      </p>
                      {item.errorMessage && <p>{item.errorMessage}</p>}
                      <div className="crm-inline-actions">
                        <span className={`crm-status-chip ${item.status === "success" ? "crm-status-chip--done" : "crm-status-chip--error"}`}>
                          {toLabel(item.status)}
                        </span>
                        <span className="crm-status-chip crm-status-chip--pending">
                          Email {item.emailNotifications.delivered}/{item.emailNotifications.attempted}
                        </span>
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary"
                          onClick={() => runAutomation(item.dryRun)}
                          disabled={running || previewing}
                        >
                          {item.dryRun ? "Repeat Preview" : "Retry Run"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Lead Scoring Automation</h3>
                  <span className="crm-drawer-helper-text">
                    Make score thresholds visible and control stage/task automation without opening sidebar settings.
                  </span>
                </div>
              </div>

              <div className="crm-ops-chip-list">
                <span className="crm-ops-chip">Read Score: {leadScoringSettings.readScore}</span>
                <span className="crm-ops-chip">Reply Score: {leadScoringSettings.replyScore}</span>
                <span className="crm-ops-chip">Keywords: {leadScoringKeywordCount}</span>
              </div>

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

              <div className="crm-drawer-form-grid">
                <label className="crm-field">
                  <span>Stage Threshold</span>
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
                  <span>Move To Stage</span>
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
                  <span>Task Threshold</span>
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
                  <span>Task Title</span>
                  <input
                    type="text"
                    className="crm-input"
                    value={leadScoringForm.taskTitle}
                    onChange={(event) => updateLeadScoringForm("taskTitle", event.target.value)}
                    disabled={leadScoringLoading || leadScoringSaving}
                  />
                </label>
                <label className="crm-field crm-field--span-2">
                  <span>Recommended Template</span>
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
                <span>Notify owner when threshold automation triggers</span>
              </label>

              <div className="crm-drawer-actions">
                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={saveLeadScoringAutomation}
                  disabled={leadScoringLoading || leadScoringSaving}
                >
                  {leadScoringSaving ? "Saving..." : "Save Automation"}
                </button>
              </div>
            </section>

            <section className="crm-ops-panel">
              <div className="crm-drawer-card-header">
                <div>
                  <h3>Rule Coverage</h3>
                  <span className="crm-drawer-helper-text">
                    What the automation engine is currently watching for
                  </span>
                </div>
              </div>

              <div className="crm-rule-list">
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
                      Move leads to {toLabel(leadScoringForm.stageOnThreshold)} once they cross score {leadScoringForm.stageThreshold}.
                    </span>
                  </div>
                </article>
                <article className="crm-rule-item">
                  <BellRing size={16} />
                  <div>
                    <strong>High intent follow-up task</strong>
                    <span>
                      Create task "{leadScoringForm.taskTitle || "High intent lead follow-up"}" at score {leadScoringForm.taskThreshold}.
                    </span>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default CrmOps;
