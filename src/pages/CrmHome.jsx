import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowRightLeft,
  Briefcase,
  CheckSquare,
  Circle,
  ChevronRight,
  FileInput,
  IndianRupee,
  GitBranch,
  MessageCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  Users
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import { readSidebarPageCache, resolveCacheUserId, writeSidebarPageCache } from "../utils/sidebarPageCache";
import "./CrmWorkspace.css";

const CRM_HOME_CACHE_NAMESPACE = "crm-home-light-layout";
const CRM_HOME_CACHE_TTL_MS = 3 * 60 * 1000;

const KPI_DEFINITIONS = [
  {
    key: "totalLeads",
    label: "Total Leads",
    icon: Users,
    accent: "#185FA5",
    iconBg: "#E6F1FB"
  },
  {
    key: "qualifiedLeads",
    label: "Qualified Leads",
    icon: TrendingUp,
    accent: "#378ADD",
    iconBg: "#EFF6FF"
  },
  {
    key: "overdueTasks",
    label: "Overdue Tasks",
    icon: Clock,
    accent: "#EF9F27",
    iconBg: "#FFFBEB"
  },
  {
    key: "openDeals",
    label: "Open Deals",
    icon: Briefcase,
    accent: "#E24B4A",
    iconBg: "#FEF2F2"
  },
  {
    key: "pipelineValue",
    label: "Pipeline Value",
    icon: IndianRupee,
    accent: "#7F77DD",
    iconBg: "#EEEDFE",
    prefix: "₹",
    formatter: (value) => Number(value || 0).toLocaleString("en-IN")
  }
];

const QUICK_ACTIONS = [
  {
    title: "Keep the pipeline moving",
    subtitle: "Review active deals before they stall.",
    to: "/crm/deals?quickFilter=closing_this_week",
    icon: GitBranch,
    accent: "#1D9E75"
  },
  {
    title: "Follow up before deals stall",
    subtitle: "Check overdue tasks and send follow-ups.",
    to: "/crm/tasks?bucket=overdue",
    icon: Clock,
    accent: "#EF9F27"
  },
  {
    title: "Use the Inbox to close the loop",
    subtitle: "Reply to open WhatsApp threads.",
    to: "/inbox?filter=unread",
    icon: MessageCircle,
    accent: "#378ADD"
  }
];

const SHORTCUTS = [
  {
    title: "Open Pipeline",
    description: "Move leads by stage, queue, and owner.",
    to: "/crm/pipeline",
    icon: GitBranch,
    accent: { bg: "#E1F5EE", fg: "#1D9E75" }
  },
  {
    title: "Manage Tasks",
    description: "Track overdue and due-today follow-ups.",
    to: "/crm/tasks",
    icon: CheckSquare,
    accent: { bg: "#EFF6FF", fg: "#378ADD" }
  },
  {
    title: "Run Deals",
    description: "Monitor value, probability, and close date.",
    to: "/crm/deals",
    icon: IndianRupee,
    accent: { bg: "#F5F3FF", fg: "#7F77DD" }
  },
  {
    title: "Import Contacts",
    description: "Bring leads into CRM from contacts or opt-ins.",
    to: "/contacts",
    icon: FileInput,
    accent: { bg: "#FFFBEB", fg: "#EF9F27" }
  },
  {
    title: "Open Inbox",
    description: "Continue WhatsApp conversations with leads.",
    to: "/inbox",
    icon: MessageCircle,
    accent: { bg: "#FEF2F2", fg: "#E24B4A" }
  }
];

const ACTIVITY_TONES = {
  lead_created: { dot: "#1D9E75" },
  qualified: { dot: "#639922" },
  task_overdue: { dot: "#E24B4A" },
  deal_updated: { dot: "#378ADD" },
  meeting_scheduled: { dot: "#185FA5" },
  owner_notified: { dot: "#854F0B" }
};

const formatClock = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatCurrency = (value, currency = "INR") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `INR ${Math.round(amount).toLocaleString()}`;
  }
};

const isQualifiedContact = (contact = {}) =>
  String(contact?.stage || contact?.status || "").trim().toLowerCase() === "qualified";

const buildActivityItem = ({ id, type, title, description, timestamp, contactId = "", dealId = "", taskId = "", meetingId = "", notificationId = "" }) => ({
  id,
  type,
  title,
  description,
  timestamp,
  timeLabel: formatClock(timestamp),
  contactId,
  dealId,
  taskId,
  meetingId,
  notificationId
});

const buildRecentActivity = ({
  contacts = [],
  tasks = [],
  deals = [],
  meetings = [],
  notifications = []
} = {}) => {
  const items = [];

  contacts.slice(0, 4).forEach((contact, index) => {
    const timestamp = contact?.lastStageChangedAt || contact?.createdAt || contact?.updatedAt || null;
    if (!timestamp) return;

    const name = String(contact?.name || "Untitled lead").trim();
    const type = isQualifiedContact(contact) ? "qualified" : "lead_created";
    const title = isQualifiedContact(contact) ? `${name} qualified` : `${name} added as a new lead`;
    const description = isQualifiedContact(contact)
      ? `Stage updated to ${String(contact?.stage || contact?.status || "qualified").toLowerCase()}`
      : `Lead source: ${String(contact?.source || "manual import").trim()}`;

    items.push(
      buildActivityItem({
        id: `contact-${String(contact?._id || index).trim()}`,
        type,
        title,
        description,
        timestamp,
        contactId: String(contact?._id || "").trim()
      })
    );
  });

  tasks.slice(0, 3).forEach((task, index) => {
    const timestamp = task?.dueAt || task?.updatedAt || task?.createdAt || null;
    if (!timestamp) return;

    const contactName = String(task?.contactId?.name || task?.contactName || "Unknown lead").trim();
    const title = `Overdue task: ${String(task?.title || "Follow up").trim()}`;
    const description = `${contactName}${task?.dueAt ? ` - Due ${formatClock(task.dueAt)}` : ""}`;

    items.push(
      buildActivityItem({
        id: `task-${String(task?._id || index).trim()}`,
        type: "task_overdue",
        title,
        description,
        timestamp,
        contactId: String(task?.contactId?._id || task?.contactId || "").trim(),
        taskId: String(task?._id || "").trim()
      })
    );
  });

  deals.slice(0, 3).forEach((deal, index) => {
    const timestamp = deal?.updatedAt || deal?.createdAt || null;
    if (!timestamp) return;

    const contactName = String(deal?.contactId?.name || "Unknown lead").trim();
    const title = `${String(deal?.title || "Deal").trim()} updated`;
    const value = formatCurrency(deal?.value, deal?.currency);
    const status = String(deal?.status || deal?.stage || "open").trim();
    const description = `${contactName} - ${status}${value ? ` - ${value}` : ""}`;

    items.push(
      buildActivityItem({
        id: `deal-${String(deal?._id || index).trim()}`,
        type: "deal_updated",
        title,
        description,
        timestamp,
        contactId: String(deal?.contactId?._id || deal?.contactId || "").trim(),
        dealId: String(deal?._id || "").trim()
      })
    );
  });

  meetings.slice(0, 2).forEach((meeting, index) => {
    const timestamp = meeting?.createdAt || meeting?.start?.dateTime || meeting?.start || null;
    if (!timestamp) return;

    const contactName = String(meeting?.contact?.name || "Unknown lead").trim();
    const title = String(meeting?.summary || "Meeting scheduled").trim();
    const description = `${contactName}${meeting?.start?.dateTime || meeting?.start ? ` - ${formatClock(meeting?.start?.dateTime || meeting?.start)}` : ""}`;

    items.push(
      buildActivityItem({
        id: `meeting-${String(meeting?._id || index).trim()}`,
        type: "meeting_scheduled",
        title,
        description,
        timestamp,
        contactId: String(meeting?.contact?._id || "").trim(),
        meetingId: String(meeting?._id || "").trim()
      })
    );
  });

  notifications.slice(0, 2).forEach((notification, index) => {
    const timestamp = notification?.createdAt || null;
    if (!timestamp) return;

    const contactName = String(notification?.contactId?.name || "Unknown lead").trim();
    const title = "Owner notification";
    const description = `${contactName} - ${String(notification?.isRead ? "Read" : "Unread").toLowerCase()}`;

    items.push(
      buildActivityItem({
        id: `note-${String(notification?._id || index).trim()}`,
        type: "owner_notified",
        title,
        description,
        timestamp,
        contactId: String(notification?.contactId?._id || "").trim(),
        notificationId: String(notification?._id || "").trim()
      })
    );
  });

  return items
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0))
    .slice(0, 6);
};

const AnimatedCounter = ({ value = 0, duration = 800, formatter = (input) => Number(input || 0).toLocaleString("en-US") }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Math.max(0, Number(value) || 0);
    const start = performance.now();
    const startValue = 0;

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }

    const step = (now) => {
      const progress = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      }
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [duration, value]);

  return <span>{formatter(displayValue)}</span>;
};

const HomeMetricCard = ({ icon, label, value, accent, iconBg, prefix = "", formatter }) => {
  const MetricIcon = icon;

  return (
    <div className="crm-home-kpi-tile">
      <span className="crm-home-kpi-tile__icon" style={{ color: accent, backgroundColor: iconBg || undefined }}>
        <MetricIcon size={20} />
      </span>
      <div className="crm-home-kpi-tile__body">
        <span className="crm-home-kpi-tile__label">{label}</span>
        <strong className="crm-home-kpi-tile__value">
          {prefix}
          <AnimatedCounter value={value} formatter={formatter} />
        </strong>
      </div>
    </div>
  );
};

const CrmHome = () => {
  const currentUserId = useMemo(() => resolveCacheUserId(), []);
  const cachedHomeSnapshot = useMemo(
    () => readSidebarPageCache(CRM_HOME_CACHE_NAMESPACE, { currentUserId, allowStale: true }),
    [currentUserId]
  );

  const [loading, setLoading] = useState(
    () => !(cachedHomeSnapshot?.data?.metrics && cachedHomeSnapshot?.data?.taskSummary && cachedHomeSnapshot?.data?.dealMetrics)
  );
  const [activityLoading, setActivityLoading] = useState(
    () => !Array.isArray(cachedHomeSnapshot?.data?.recentActivity)
  );
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(() => cachedHomeSnapshot?.data?.metrics || null);
  const [taskSummary, setTaskSummary] = useState(() => cachedHomeSnapshot?.data?.taskSummary || null);
  const [dealMetrics, setDealMetrics] = useState(() => cachedHomeSnapshot?.data?.dealMetrics || null);
  const [recentActivity, setRecentActivity] = useState(() => cachedHomeSnapshot?.data?.recentActivity || []);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => cachedHomeSnapshot?.data?.lastUpdatedAt || null);
  const [newLeadsToday, setNewLeadsToday] = useState(() => Number(cachedHomeSnapshot?.data?.newLeadsToday || 0));
  const [needsReplyCount, setNeedsReplyCount] = useState(() => Number(cachedHomeSnapshot?.data?.needsReplyCount || 0));
  const loadRequestIdRef = useRef(0);
  const activityTimerRef = useRef(null);

  const persistHomeSnapshot = useCallback(
    (nextState) => {
      writeSidebarPageCache(
        CRM_HOME_CACHE_NAMESPACE,
        nextState,
        { currentUserId, ttlMs: CRM_HOME_CACHE_TTL_MS }
      );
    },
    [currentUserId]
  );

  const loadHomeActivityData = useCallback(
    async ({ requestId, metricsData, taskSummaryData, dealMetricsData } = {}) => {
      const [
        contactsResult,
        tasksResult,
        dealsResult,
        meetingsResult,
        notificationsResult
      ] = await Promise.allSettled([
        crmService.getContacts({
          limit: 50,
          sortOrder: "newest",
          fields: "_id,name,phone,stage,status,source,ownerId,leadScore,createdAt,updatedAt,lastStageChangedAt,lastContactAt"
        }),
        crmService.getTasks({ limit: 6, bucket: "overdue" }),
        crmService.getDeals({ limit: 6, page: 1 }),
        crmService.getMeetings({ limit: 4 }),
        crmService.getOwnerNotifications({ status: "unread", limit: 4 })
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      const contacts =
        contactsResult.status === "fulfilled" && Array.isArray(contactsResult.value?.data)
          ? contactsResult.value.data
          : [];
      const tasks =
        tasksResult.status === "fulfilled" && Array.isArray(tasksResult.value?.data)
          ? tasksResult.value.data
          : [];
      const deals =
        dealsResult.status === "fulfilled" && Array.isArray(dealsResult.value?.data)
          ? dealsResult.value.data
          : [];
      const meetings =
        meetingsResult.status === "fulfilled" && Array.isArray(meetingsResult.value?.data)
          ? meetingsResult.value.data
          : [];
      const notifications =
        notificationsResult.status === "fulfilled" && Array.isArray(notificationsResult.value?.data)
          ? notificationsResult.value.data
          : [];
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayLeadCount = contacts.filter((contact) => {
        const createdAt = contact?.createdAt ? new Date(contact.createdAt) : null;
        return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= startOfDay;
      }).length;
      const nextRecentActivity = buildRecentActivity({ contacts, tasks, deals, meetings, notifications });
      const nextNeedsReplyCount = notifications.length;

      setRecentActivity(nextRecentActivity);
      setNewLeadsToday(todayLeadCount);
      setNeedsReplyCount(nextNeedsReplyCount);
      setActivityLoading(false);
      setLastUpdatedAt(Date.now());
      persistHomeSnapshot({
        metrics: metricsData,
        taskSummary: taskSummaryData,
        dealMetrics: dealMetricsData,
        recentActivity: nextRecentActivity,
        lastUpdatedAt: Date.now(),
        newLeadsToday: todayLeadCount,
        needsReplyCount: nextNeedsReplyCount
      });
    },
    [persistHomeSnapshot]
  );

  const loadHomeData = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++loadRequestIdRef.current;
      if (!silent) setLoading(true);
      setError("");

      try {
        const [metricsResult, taskSummaryResult, dealMetricsResult] = await Promise.allSettled([
          crmService.getMetrics(),
          crmService.getTaskSummary(),
          crmService.getDealMetrics()
        ]);

        if (requestId !== loadRequestIdRef.current) return;

        const metricsData =
          metricsResult.status === "fulfilled" && metricsResult.value?.success !== false
            ? metricsResult.value?.data || null
            : null;
        const taskSummaryData =
          taskSummaryResult.status === "fulfilled" && taskSummaryResult.value?.success !== false
            ? taskSummaryResult.value?.data || null
            : null;
        const dealMetricsData =
          dealMetricsResult.status === "fulfilled" && dealMetricsResult.value?.success !== false
            ? dealMetricsResult.value?.data || null
            : null;

        if (!metricsData) {
          throw new Error(
            metricsResult.status === "fulfilled"
              ? metricsResult.value?.error || "Failed to load CRM metrics"
              : "Failed to load CRM metrics"
          );
        }
        if (!taskSummaryData) {
          throw new Error(
            taskSummaryResult.status === "fulfilled"
              ? taskSummaryResult.value?.error || "Failed to load task summary"
              : "Failed to load task summary"
          );
        }
        if (!dealMetricsData) {
          throw new Error(
            dealMetricsResult.status === "fulfilled"
              ? dealMetricsResult.value?.error || "Failed to load deal metrics"
              : "Failed to load deal metrics"
          );
        }

        setMetrics(metricsData);
        setTaskSummary(taskSummaryData);
        setDealMetrics(dealMetricsData);
        setLastUpdatedAt(Date.now());
        setLoading(false);

        if (activityTimerRef.current) {
          window.clearTimeout(activityTimerRef.current);
        }

        activityTimerRef.current = window.setTimeout(() => {
          activityTimerRef.current = null;
          void loadHomeActivityData({
            requestId,
            metricsData,
            taskSummaryData,
            dealMetricsData
          });
        }, 0);

      } catch (requestError) {
        if (requestId !== loadRequestIdRef.current) return;
        setError(requestError?.message || "Failed to load CRM home");
        setLoading(false);
      }
    },
    [loadHomeActivityData]
  );

  const crmRealtime = useCrmRealtimeRefresh({
    onRefresh: () => loadHomeData({ silent: true })
  });

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  useEffect(
    () => () => {
      loadRequestIdRef.current += 1;
      if (activityTimerRef.current) {
        window.clearTimeout(activityTimerRef.current);
      }
    },
    []
  );

  const heroValues = useMemo(
    () => ({
      totalLeads: metrics?.contacts?.total ?? 0,
      qualifiedLeads: metrics?.contacts?.qualified ?? 0,
      overdueTasks: taskSummary?.overdue ?? 0,
      openDeals: dealMetrics?.open ?? 0,
      pipelineValue: dealMetrics?.pipelineValue ?? 0
    }),
    [dealMetrics?.open, dealMetrics?.pipelineValue, metrics?.contacts?.qualified, metrics?.contacts?.total, taskSummary?.overdue]
  );

  const quickActionStats = useMemo(
    () => ({
      winRate:
        heroValues.totalLeads > 0
          ? Number((((dealMetrics?.won ?? 0) / heroValues.totalLeads) * 100).toFixed(1))
          : 0,
      wonLeads: Number(dealMetrics?.won || 0),
      needsReply: Number(needsReplyCount || 0),
      newToday: Number(newLeadsToday || 0)
    }),
    [dealMetrics?.won, heroValues.totalLeads, needsReplyCount, newLeadsToday]
  );

  const topPriority = useMemo(() => {
    if ((taskSummary?.overdue ?? 0) > 0) {
      return {
        label: "BEST NEXT MOVE",
        title: `${taskSummary.overdue} overdue tasks`,
        subtitle: "Clear stale follow-ups before they stall active deals.",
        to: "/crm/tasks",
        cta: "Review tasks"
      };
    }

    if ((metrics?.contacts?.qualified ?? 0) > 0) {
      return {
        label: "BEST NEXT MOVE",
        title: "Work qualified leads",
        subtitle: "Prioritize the highest-intent leads in the pipeline.",
        to: "/crm/pipeline",
        cta: "Open pipeline"
      };
    }

    return {
      label: "BEST NEXT MOVE",
      title: "Import contacts and start outreach",
      subtitle: "Seed the CRM so your pipeline and inbox can start filling up.",
      to: "/contacts",
      cta: "Import contacts"
    };
  }, [metrics?.contacts?.qualified, taskSummary?.overdue]);

  const syncedLabel = useMemo(() => {
    if (!lastUpdatedAt) return "Waiting for first sync";
    return `Synced ${new Date(lastUpdatedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }, [lastUpdatedAt]);

  const realtimeStatusLabel = useMemo(() => {
    const normalized = String(crmRealtime.connectionStatus || "").toLowerCase();
    if (normalized === "connected") return "Live";
    if (normalized === "connecting") return "Connecting";
    if (normalized === "offline" || normalized === "disconnected" || normalized === "disabled") return "Offline";
    return "Live";
  }, [crmRealtime.connectionStatus]);

  return (
    <div className="crm-workspace crm-home-page">
      <section className="crm-home-shell">
        <header className="crm-home-topbar">
          <div className="crm-home-topbar__brand">
            <h1>CRM Home</h1>
            <p>Realtime analytics for leads, pipeline quality, owner performance, and revenue movement.</p>
          </div>

          <div className="crm-home-topbar__status">
            <span
              className={`crm-home-live-pill crm-home-live-pill--${String(crmRealtime.connectionStatus || "").toLowerCase() || "offline"}`}
              role="status"
              aria-live="polite"
              title={`CRM realtime: ${realtimeStatusLabel}`}
            >
              <span className="crm-home-live-pill__dot" aria-hidden="true" />
              <span>{realtimeStatusLabel}</span>
            </span>
            <span className="crm-home-sync" title={syncedLabel}>
              <RefreshCw size={13} />
              <span>{syncedLabel}</span>
            </span>
          </div>
        </header>

        <section className="crm-home-kpi-strip" aria-label="CRM summary statistics">
          {KPI_DEFINITIONS.map((metric) => {
            return (
              <HomeMetricCard
                key={metric.key}
                icon={metric.icon}
                label={metric.label}
                value={heroValues[metric.key]}
                accent={metric.accent}
                iconBg={metric.key === "pipelineValue" ? "#F5F3FF" : metric.iconBg}
                prefix={metric.key === "pipelineValue" ? "\u20B9" : metric.prefix}
                formatter={metric.formatter}
              />
            );
          })}
        </section>

        <div className="crm-home-body">
          {error ? <div className="crm-alert crm-alert-error crm-home-error">{error}</div> : null}
          {loading ? (
            <CrmPageSkeleton variant="home" />
          ) : metrics && taskSummary && dealMetrics ? (
            <section className="crm-home-content">
              <aside className="crm-home-panel crm-home-quick-actions">
                <div className="crm-home-panel__header">
                  <div>
                    <h2>Quick actions</h2>
                    <p>Jump to what matters right now.</p>
                  </div>
                </div>

                <div className="crm-home-actions">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link key={action.title} to={action.to} className="crm-home-action-row">
                        <span
                          className="crm-home-action-row__icon"
                          style={{
                            backgroundColor: `${action.accent}1F`,
                            color: action.accent
                          }}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="crm-home-action-row__body">
                          <strong>{action.title}</strong>
                          <span>{action.subtitle}</span>
                        </span>
                        <ChevronRight size={14} className="crm-home-action-row__arrow" />
                      </Link>
                    );
                  })}
                </div>

                <div className="crm-home-stats">
                  <div className="crm-home-stats__item">
                    <span>Win rate</span>
                    <strong>{quickActionStats.winRate.toFixed(1)}%</strong>
                  </div>
                  <div className="crm-home-stats__item">
                    <span>Won leads</span>
                    <strong>{quickActionStats.wonLeads.toLocaleString()}</strong>
                  </div>
                  <div className="crm-home-stats__item">
                    <span>Needs reply</span>
                    <strong>{quickActionStats.needsReply.toLocaleString()}</strong>
                  </div>
                  <div className="crm-home-stats__item">
                    <span>New today</span>
                    <strong>{quickActionStats.newToday.toLocaleString()}</strong>
                  </div>
                </div>
              </aside>

              <article className="crm-home-panel crm-home-center">
                <div className="crm-home-next">
                  <span className="crm-home-next__badge">{topPriority.label}</span>
                  <div className="crm-home-next__content">
                    <h3>{topPriority.title}</h3>
                    <p>{topPriority.subtitle}</p>
                  </div>
                  <Link to={topPriority.to} className="crm-home-next__button">
                    {topPriority.cta}
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <div className="crm-home-divider" aria-hidden="true" />

                <div className="crm-home-activity">
                  <div className="crm-home-panel__header crm-home-panel__header--compact">
                    <div>
                      <h2>Recent activity</h2>
                      <p>Activity from existing CRM events and live websocket refreshes.</p>
                    </div>
                  </div>

                  <div className="crm-home-activity__list" role="list" aria-label="Recent CRM activity">
                    {activityLoading && !recentActivity.length ? (
                      <div className="crm-home-activity__loading">Loading recent activity...</div>
                    ) : recentActivity.length ? (
                      recentActivity.map((item) => {
                        const tone = ACTIVITY_TONES[item.type] || ACTIVITY_TONES.deal_updated;
                        return (
                          <div key={item.id} className="crm-home-activity__row" role="listitem">
                            <span className="crm-home-activity__dot" style={{ backgroundColor: tone.dot }} aria-hidden="true" />
                            <div className="crm-home-activity__text">
                              <strong>{item.title}</strong>
                              <span>{item.description}</span>
                            </div>
                            <time className="crm-home-activity__time" dateTime={item.timestamp}>
                              {item.timeLabel}
                            </time>
                          </div>
                        );
                      })
                    ) : (
                      <div className="crm-home-activity__empty">
                        <Circle size={24} />
                        <strong>No recent activity</strong>
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <aside className="crm-home-panel crm-home-shortcuts">
                <div className="crm-home-panel__header crm-home-panel__header--compact">
                  <div>
                    <h2>Workspace shortcuts</h2>
                    <p>Open the modules you use every day.</p>
                  </div>
                </div>

                <div className="crm-home-shortcuts__stack">
                  {SHORTCUTS.map((shortcut) => {
                    const Icon = shortcut.icon;
                    return (
                      <Link key={shortcut.title} to={shortcut.to} className="crm-home-shortcut-row">
                        <span
                          className="crm-home-shortcut-row__icon"
                          style={{
                            backgroundColor: shortcut.accent.bg,
                            color: shortcut.accent.fg
                          }}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="crm-home-shortcut-row__body">
                          <strong>{shortcut.title}</strong>
                          <span>{shortcut.description}</span>
                        </span>
                        <ChevronRight size={14} className="crm-home-shortcut-row__arrow" />
                      </Link>
                    );
                  })}
                </div>
              </aside>
            </section>
          ) : null}
        </div>

        <footer className="crm-home-footer">
          <div className="crm-home-footer__item">
            <span className="crm-home-footer__dot" aria-hidden="true" />
            <div>
              <strong>Realtime CRM sync</strong>
              <span>Refreshes automatically on crm_changed.</span>
            </div>
          </div>
          <span className="crm-home-footer__divider" aria-hidden="true" />
          <div className="crm-home-footer__item">
            <ArrowRightLeft size={16} />
            <div>
              <strong>Fast handoff</strong>
              <span>Jump from lead to inbox without losing context.</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default CrmHome;
