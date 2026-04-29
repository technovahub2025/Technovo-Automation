import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmMetricCard from "../components/crm/CrmMetricCard";
import CrmOnboardingChecklist from "../components/crm/CrmOnboardingChecklist";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import "./CrmWorkspace.css";

const actionCards = [
  {
    title: "Open Pipeline",
    description: "Move leads by stage, queue, and owner.",
    to: "/crm/pipeline",
    icon: TrendingUp
  },
  {
    title: "Manage Follow-ups",
    description: "Track overdue and due-today tasks.",
    to: "/crm/tasks",
    icon: CheckSquare
  },
  {
    title: "Run Deals",
    description: "Monitor value, probability, and close date.",
    to: "/crm/deals",
    icon: Briefcase
  },
  {
    title: "Open Inbox",
    description: "Continue WhatsApp conversations with leads.",
    to: "/inbox",
    icon: MessageSquare
  }
];

const CrmHome = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [taskSummary, setTaskSummary] = useState(null);
  const [dealMetrics, setDealMetrics] = useState(null);

  const loadHomeData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [metricsResult, taskSummaryResult, dealMetricsResult] = await Promise.all([
        crmService.getMetrics(),
        crmService.getTaskSummary(),
        crmService.getDealMetrics()
      ]);

      if (metricsResult?.success === false) {
        throw new Error(metricsResult?.error || "Failed to load CRM metrics");
      }
      if (taskSummaryResult?.success === false) {
        throw new Error(taskSummaryResult?.error || "Failed to load task summary");
      }
      if (dealMetricsResult?.success === false) {
        throw new Error(dealMetricsResult?.error || "Failed to load deal metrics");
      }

      setMetrics(metricsResult?.data || null);
      setTaskSummary(taskSummaryResult?.data || null);
      setDealMetrics(dealMetricsResult?.data || null);
    } catch (requestError) {
      setError(requestError?.message || "Failed to load CRM home");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useCrmRealtimeRefresh({
    onRefresh: () => loadHomeData({ silent: true })
  });

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const topMetrics = useMemo(
    () => [
      {
        icon: Users,
        value: metrics?.contacts?.total ?? 0,
        label: "Total Leads"
      },
      {
        icon: TrendingUp,
        value: metrics?.contacts?.qualified ?? 0,
        label: "Qualified Leads"
      },
      {
        icon: CheckSquare,
        value: taskSummary?.overdue ?? 0,
        label: "Overdue Tasks"
      },
      {
        icon: Briefcase,
        value: dealMetrics?.open ?? 0,
        label: "Open Deals"
      }
    ],
    [dealMetrics?.open, metrics?.contacts?.qualified, metrics?.contacts?.total, taskSummary?.overdue]
  );

  return (
    <div className="crm-workspace">
      <CrmPageHeader
        title="CRM Home"
        subtitle="One place to run leads, conversations, tasks, and deals with a clear daily workflow."
        actions={
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={() => loadHomeData({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {error ? <div className="crm-alert crm-alert-error">{error}</div> : null}
      {loading ? <CrmPageSkeleton variant="metrics" /> : null}

      {!loading ? (
        <>
          <div className="crm-metric-grid">
            {topMetrics.map((metric) => (
              <CrmMetricCard
                key={metric.label}
                icon={metric.icon}
                value={metric.value}
                label={metric.label}
              />
            ))}
          </div>

          <CrmOnboardingChecklist
            contactsCount={metrics?.contacts?.total ?? 0}
            tasksCount={taskSummary?.open ?? 0}
            dealsCount={dealMetrics?.open ?? 0}
          />

          <section className="crm-home-actions">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} to={card.to} className="crm-home-action-card">
                  <div className="crm-home-action-card__head">
                    <Icon size={18} />
                    <ArrowRight size={16} />
                  </div>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                </Link>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default CrmHome;
