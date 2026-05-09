import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  CircleCheckBig,
  CheckCircle2,
  Eye,
  Mail,
  Paperclip,
  Plus,
  Search,
  Send,
  TrendingUp,
  UserRound,
  Bell
} from "lucide-react";
import "./EmailAutomationDashboard.css";
import { fetchEmailDashboardOverview } from "../services/emailDashboardService";

const HISTORY_STORAGE_KEY_BASE = "email_automation_history_v1";

const QUICK_ACTIONS = [
  { label: "Open Bulk Email", icon: Mail, to: "/email-automation/bulk-email", kind: "link" },
  { label: "Create Template", icon: Paperclip, kind: "button" },
  { label: "Add Recipient", icon: UserRound, kind: "button" }
];

const DASHBOARD_STATS = [
  { label: "Sent Email", value: "93", delta: "+0%", tone: "green", icon: Send },
  { label: "Delivered", value: "88", delta: "+0%", tone: "blue", icon: CircleCheckBig },
  { label: "Replies", value: "75", delta: "+0%", tone: "violet", icon: Eye },
  { label: "Failed", value: "4", delta: "-0%", tone: "red", icon: AlertCircle }
];

const PERFORMANCE_METRICS = [
  { label: "Avg Response Time", value: "N/A" },
  { label: "Response Rate", value: "81%" },
  { label: "Customer Satisfaction", value: "0/5" }
];

const RECENT_HISTORY = [
  {
    subject: "Payment received successfully",
    timestamp: "6/4/2026, 6:36:10 pm",
    total: "11",
    sent: "11",
    failed: "0",
    status: "Sent"
  },
  {
    subject: "Your order has been placed",
    timestamp: "6/4/2026, 6:30:17 pm",
    total: "11",
    sent: "11",
    failed: "0",
    status: "Sent"
  },
  {
    subject: "Your order has been placed",
    timestamp: "6/4/2026, 6:28:08 pm",
    total: "1",
    sent: "1",
    failed: "0",
    status: "Sent"
  },
  {
    subject: "Your order has been placed",
    timestamp: "6/4/2026, 6:25:41 pm",
    total: "1",
    sent: "1",
    failed: "0",
    status: "Sent"
  }
];

const MESSAGE_ANALYTICS = [
  { icon: Send, label: "Sent", value: "93 messages" },
  { icon: CircleCheckBig, label: "Delivered", value: "88 messages" },
  { icon: Eye, label: "Replies", value: "75 messages" },
  { icon: AlertCircle, label: "Failed", value: "4 messages" },
  { icon: TrendingUp, label: "Success Rate", value: "96%" }
];

const SYSTEM_STATUS = [
  "Email API Connected",
  "Workflow Active",
  "Database Connected"
];

const ICON_LOOKUP = {
  send: Send,
  check: CheckCircle2,
  eye: Eye,
  alert: AlertCircle,
  trend: TrendingUp
};

const resolveIcon = (icon) => {
  if (typeof icon === "function") return icon;
  if (typeof icon === "string") return ICON_LOOKUP[icon] || Send;
  return Send;
};

const buildZeroDashboard = () => ({
  dashboardStats: [
    { label: "Sent Email", value: 0, delta: "+0%", tone: "green", icon: Send },
    { label: "Delivered", value: 0, delta: "+0%", tone: "blue", icon: CircleCheckBig },
    { label: "Replies", value: 0, delta: "+0%", tone: "violet", icon: Eye },
    { label: "Failed", value: 0, delta: "+0%", tone: "red", icon: AlertCircle }
  ],
  performanceMetrics: [
    { label: "Avg Response Time", value: "N/A" },
    { label: "Response Rate", value: "0%" },
    { label: "Customer Satisfaction", value: "0/5" }
  ],
  recentHistory: RECENT_HISTORY,
  messageAnalytics: [
    { icon: "send", label: "Sent", value: "0 messages" },
    { icon: "check", label: "Delivered", value: "0 messages" },
    { icon: "eye", label: "Replies", value: "0 messages" },
    { icon: "alert", label: "Failed", value: "0 messages" },
    { icon: "trend", label: "Success Rate", value: "0%" }
  ],
  systemStatus: []
});

const normalizeDashboardPayload = (payload) => {
  const data = payload?.data || payload || {};
  const toNum = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    dashboardStats: Array.isArray(data.dashboardStats) && data.dashboardStats.length
      ? data.dashboardStats.map((stat) => ({
          ...stat,
          icon: resolveIcon(stat.icon),
          value: toNum(stat.value)
        }))
      : buildZeroDashboard().dashboardStats,
    performanceMetrics:
      Array.isArray(data.performanceMetrics) && data.performanceMetrics.length
        ? data.performanceMetrics
        : buildZeroDashboard().performanceMetrics,
    recentHistory:
      Array.isArray(data.recentHistory) && data.recentHistory.length
        ? data.recentHistory.map((item) => ({
            ...item,
            status: item.status || "sent"
          }))
        : [],
    messageAnalytics:
      Array.isArray(data.messageAnalytics) && data.messageAnalytics.length
        ? data.messageAnalytics.map((item) => ({
            ...item,
            icon: resolveIcon(item.icon)
          }))
        : buildZeroDashboard().messageAnalytics,
    systemStatus:
      Array.isArray(data.systemStatus) && data.systemStatus.length ? data.systemStatus : []
  };
};

const getEmailAutomationStorageScope = () => {
  if (typeof window === "undefined") return "guest";

  try {
    const userKey = import.meta.env.VITE_USER_KEY || "user";
    const rawUser = window.localStorage.getItem(userKey) || window.localStorage.getItem("user");
    if (!rawUser) return "guest";

    const parsed = JSON.parse(rawUser);
    const identity = parsed?._id || parsed?.id || parsed?.email || parsed?.username;
    if (!identity) return "guest";
    return String(identity).trim().toLowerCase();
  } catch {
    return "guest";
  }
};

const loadLocalHistory = (storageKey) => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => ({
      id: item.id || `${item.subject || "email"}-${item.createdAt || item.timestamp || ""}`,
      subject: item.subject || "Untitled email",
      timestamp: item.createdAt || item.timestamp || "",
      total: String(item.total ?? 0),
      sent: String(item.sent ?? 0),
      failed: String(item.failed ?? 0),
      status: String(item.status || "sent")
    }));
  } catch {
    return [];
  }
};

const getSentTotalFromHistory = (history = []) =>
  history.reduce((sum, item) => sum + (Number(item.sent) || 0), 0);

const getDeliveredTotalFromHistory = (history = []) =>
  history.reduce((sum, item) => {
    const sent = Number(item.sent) || 0;
    const failed = Number(item.failed) || 0;
    const delivered = Number(item.delivered);

    if (Number.isFinite(delivered) && delivered > 0) {
      return sum + delivered;
    }

    return sum + Math.max(sent - failed, 0);
  }, 0);

const getFailedTotalFromHistory = (history = []) =>
  history.reduce((sum, item) => sum + (Number(item.failed) || 0), 0);

const getRepliesTotalFromHistory = (history = []) =>
  history.reduce((sum, item) => sum + (Number(item.replies ?? item.replyCount) || 0), 0);

const getSuccessRateFromHistory = (history = []) => {
  const sent = getSentTotalFromHistory(history);
  if (!sent) return 0;
  const delivered = getDeliveredTotalFromHistory(history);
  return Math.round((delivered / sent) * 100);
};

const applyHistoryToDashboard = (current, historyData) => {
  const recentHistory = historyData.length ? historyData : RECENT_HISTORY;
  const sentTotal = getSentTotalFromHistory(recentHistory);

  return {
    ...current,
    dashboardStats: current.dashboardStats.map((stat, index) =>
      index === 0 ? { ...stat, value: sentTotal } : stat
    ),
    recentHistory
  };
};

const EmailAutomationDashboard = () => {
  const [dashboardData, setDashboardData] = useState(buildZeroDashboard());
  const historyStorageKey = `${HISTORY_STORAGE_KEY_BASE}_${getEmailAutomationStorageScope()}`;
  const sentTotal = getSentTotalFromHistory(dashboardData.recentHistory);
  const deliveredTotal = getDeliveredTotalFromHistory(dashboardData.recentHistory);
  const repliesTotal = getRepliesTotalFromHistory(dashboardData.recentHistory);
  const failedTotal = getFailedTotalFromHistory(dashboardData.recentHistory);
  const successRate = getSuccessRateFromHistory(dashboardData.recentHistory);
  const displayDashboardStats = dashboardData.dashboardStats.map((stat, index) =>
    index === 0
      ? { ...stat, value: sentTotal }
      : index === 1
        ? { ...stat, value: deliveredTotal }
        : index === 3
          ? { ...stat, value: failedTotal }
        : stat
  );

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        const overviewResponse = await fetchEmailDashboardOverview();
        if (!active) return;
        const overviewData = normalizeDashboardPayload(overviewResponse);
        setDashboardData((current) => ({
          ...current,
          ...overviewData,
          recentHistory: current.recentHistory.length ? current.recentHistory : overviewData.recentHistory
        }));
      } catch {
        if (active) {
          setDashboardData((current) => ({
            ...current,
            ...buildZeroDashboard(),
            recentHistory: current.recentHistory
          }));
        }
      }
    };

    const loadHistory = async () => {
      if (!active) return;
      const historyData = loadLocalHistory(historyStorageKey);
      setDashboardData((current) => applyHistoryToDashboard(current, historyData));
    };

    loadOverview();
    loadHistory();

    const handleStorageChange = (event) => {
      if (!active) return;
      if (event.key && event.key !== historyStorageKey) return;
      const historyData = loadLocalHistory(historyStorageKey);
      setDashboardData((current) => applyHistoryToDashboard(current, historyData));
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      active = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [historyStorageKey]);

  return (
    <div className="email-dashboard-page">
      <header className="email-dashboard-topbar">
        <div className="email-dashboard-topbar-title">Dashboard</div>
        <div className="email-dashboard-topbar-right">
          <label className="email-dashboard-search">
            <Search size={18} />
            <input type="search" placeholder="Search..." aria-label="Search email automation dashboard" />
          </label>
          <button className="email-dashboard-bell" type="button" aria-label="Notifications">
            <Bell size={18} />
            <span>1</span>
          </button>
        </div>
      </header>

      <section className="email-dashboard-hero">
        <div className="email-dashboard-hero-copy">
          <p className="hero-kicker">Email Automation</p>
          <h1>Email Dashboard</h1>
          <p className="subtitle">
            Here&apos;s what&apos;s happening with your email platform today.
          </p>
        </div>

        <Link className="email-dashboard-new-btn" to="/email-automation/bulk-email">
          <Plus size={18} />
          Bulk Email
        </Link>
      </section>

      <section className="email-dashboard-stats">
        {displayDashboardStats.map((stat) => {
          const Icon = resolveIcon(stat.icon);

          return (
            <article key={stat.label} className={`email-dashboard-stat-card tone-${stat.tone}`}>
              <div className="email-dashboard-stat-main">
                <div>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
                <div className="email-dashboard-stat-icon">
                  <Icon size={26} />
                </div>
              </div>
              <div className={`email-dashboard-stat-delta ${stat.tone}`}>
                {stat.delta} <span>vs last month</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="email-dashboard-grid">
        <article className="email-dashboard-panel email-dashboard-performance">
          <div className="panel-head-inline">
            <h2>Performance Metrics</h2>
          </div>
          <div className="email-dashboard-performance-grid">
            {dashboardData.performanceMetrics.map((metric) => (
              <div className="email-dashboard-performance-tile" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="email-dashboard-panel email-dashboard-analytics">
          <div className="panel-head-inline">
            <h2>Email Analytics</h2>
            <button type="button" className="text-link">
              Show More
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="email-dashboard-analytics-list">
            {dashboardData.messageAnalytics.map((item) => {
              const Icon = resolveIcon(item.icon);
              const analyticsValue =
                item.label === "Sent"
                  ? `${sentTotal} messages`
                  : item.label === "Delivered"
                    ? `${deliveredTotal} messages`
                    : item.label === "Replies"
                      ? `${repliesTotal} messages`
                      : item.label === "Failed"
                        ? `${failedTotal} messages`
                        : item.label === "Success Rate"
                          ? `${successRate}%`
                          : item.value;
              return (
                <div className="email-dashboard-analytics-item" key={item.label}>
                  <Icon size={16} />
                  <span>{item.label}: {analyticsValue}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="email-dashboard-grid email-dashboard-grid-main">
        <article className="email-dashboard-panel email-dashboard-recent">
          <div className="panel-head-inline">
            <h2>Recent Send History</h2>
            <span className="email-dashboard-history-count">
              {dashboardData.recentHistory.length}
            </span>
          </div>
          <div className="email-dashboard-history-scroll">
            {dashboardData.recentHistory.length ? dashboardData.recentHistory.map((item, index) => (
                <div className="email-dashboard-history-card" key={`${item.subject}-${item.timestamp}-${index}`}>
                  <div className="email-dashboard-history-copy">
                    <strong>{item.subject}</strong>
                    <p>
                      {item.timestamp} <span>Total {item.total}</span> <span>Sent {item.sent}</span> <span>Failed {item.failed}</span>
                    </p>
                  </div>
                  <div className="email-dashboard-history-side">
                    <span className="email-dashboard-active email-dashboard-active-success">
                      <CheckCircle2 size={14} />
                      {item.status}
                    </span>
                  </div>
                </div>
              )) : (
              <p className="email-dashboard-empty-state">No email history yet.</p>
            )}
          </div>
        </article>

        <aside className="email-dashboard-side">
          <article className="email-dashboard-panel">
            <div className="panel-head-inline">
              <h2>System Status</h2>
            </div>
            <div className="email-dashboard-status-list">
              {dashboardData.systemStatus.length ? dashboardData.systemStatus.map((status) => (
                <div className="email-dashboard-status-item" key={status}>
                  <span className="status-dot" />
                  <span>{status}</span>
                </div>
              )) : (
                <p className="email-dashboard-empty-state">No system status available yet.</p>
              )}
            </div>
          </article>

          <article className="email-dashboard-panel">
            <div className="panel-head-inline">
              <h2>Quick Actions</h2>
            </div>
            <div className="email-dashboard-actions-list">
              {QUICK_ACTIONS.map((action) => {
                const ActionIcon = action.icon;

                if (action.kind === "button") {
                  return (
                    <button type="button" className="email-dashboard-action" key={action.label}>
                      <ActionIcon size={16} />
                      <span>{action.label}</span>
                    </button>
                  );
                }

                return (
                  <Link to={action.to} className="email-dashboard-action" key={action.label}>
                    <ActionIcon size={16} />
                    <span>{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
};

export default EmailAutomationDashboard;
