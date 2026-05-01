import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeDollarSign,
  BarChart3,
  Clock3,
  RefreshCw,
  Target,
  Users
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import { getPipelineStageLabel, normalizePipelineStageOption, DEFAULT_PIPELINE_STAGE_OPTIONS } from "../utils/crmPipelineStages";
import "./CrmWorkspace.css";

const CRM_REPORTS_LOADING_TIMEOUT_MS = 8000;

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const formatMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  if (parsed >= 60) {
    return `${(parsed / 60).toFixed(1)} hrs`;
  }
  return `${parsed.toFixed(1)} mins`;
};

const toLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "-";

const toPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "0%";
  return `${parsed.toFixed(parsed % 1 === 0 ? 0 : 1)}%`;
};

const CrmReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lostReasonQuery, setLostReasonQuery] = useState("");
  const [pipelineStages, setPipelineStages] = useState(DEFAULT_PIPELINE_STAGE_OPTIONS);
  const requestedSourceType = String(searchParams.get("sourceType") || "all").trim().toLowerCase();
  const requestedOwner = String(searchParams.get("ownerId") || "all").trim();
  const requestedStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
  const requestedReason = String(searchParams.get("reason") || "").trim();

  const loadReport = useCallback(async ({ silent = false } = {}) => {
    const releaseLoadingGuard = startLoadingTimeoutGuard(
      () => {
        if (silent) setRefreshing(false);
        else setLoading(false);
      },
      CRM_REPORTS_LOADING_TIMEOUT_MS
    );

    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const result = await crmService.getReportsSummary();
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to load CRM reports");
      }

      setReport(result?.data || {});
      const stagesResult = await crmService.getPipelineStages();
      if (stagesResult?.success !== false) {
        const nextStages = Array.isArray(stagesResult?.data?.stages) && stagesResult.data.stages.length
          ? stagesResult.data.stages.map(normalizePipelineStageOption)
          : DEFAULT_PIPELINE_STAGE_OPTIONS;
        setPipelineStages(nextStages);
      }
    } catch (loadError) {
      setError(loadError?.message || "Failed to load CRM reports");
    } finally {
      releaseLoadingGuard();
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRealtimeRefresh = useCallback(() => {
    loadReport({ silent: true });
  }, [loadReport]);

  useCrmRealtimeRefresh({
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const sourceRows = useMemo(() => report?.sources?.topSources || [], [report]);
  const sourceTypeRows = useMemo(() => report?.sources?.bySourceType || [], [report]);
  const stageRows = useMemo(() => report?.pipeline?.byStage || [], [report]);
  const stageLabelMap = useMemo(
    () =>
      pipelineStages.reduce((accumulator, stage) => {
        accumulator[String(stage.key || "").trim().toLowerCase()] = stage.label;
        return accumulator;
      }, {}),
    [pipelineStages]
  );
  const statusRows = useMemo(() => report?.pipeline?.byStatus || [], [report]);
  const dealStageRows = useMemo(() => report?.pipeline?.deals?.byStage || [], [report]);
  const ownerRows = useMemo(() => report?.owners?.leaderboard || [], [report]);
  const followUpTypeRows = useMemo(() => report?.followUps?.byType || [], [report]);
  const leadScoreBands = useMemo(() => report?.leadScoreBands || [], [report]);
  const lostReasonRows = useMemo(
    () => [...(report?.lostReasons?.contacts || []), ...(report?.lostReasons?.deals || [])],
    [report]
  );

  const sourceTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sourceTypeRows
            .map((row) => String(row?.sourceType || "").trim().toLowerCase())
            .filter(Boolean)
        )
      ),
    [sourceTypeRows]
  );

  const ownerOptions = useMemo(
    () =>
      ownerRows
        .map((owner) => ({
          id: String(owner?.ownerId || "").trim(),
          label: String(owner?.ownerName || owner?.ownerId || "").trim()
        }))
        .filter((owner) => owner.id),
    [ownerRows]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          statusRows
            .map((row) => String(row?.status || "").trim().toLowerCase())
            .filter(Boolean)
        )
      ),
    [statusRows]
  );

  useEffect(() => {
    const validSourceType =
      requestedSourceType === "all" || sourceTypeOptions.includes(requestedSourceType);
    if (validSourceType && sourceTypeFilter !== requestedSourceType) {
      setSourceTypeFilter(requestedSourceType);
    }

    const validOwner =
      requestedOwner === "all" || ownerOptions.some((owner) => owner.id === requestedOwner);
    if (validOwner && ownerFilter !== requestedOwner) {
      setOwnerFilter(requestedOwner);
    }

    const validStatus = requestedStatus === "all" || statusOptions.includes(requestedStatus);
    if (validStatus && statusFilter !== requestedStatus) {
      setStatusFilter(requestedStatus);
    }

    if (lostReasonQuery !== requestedReason) {
      setLostReasonQuery(requestedReason);
    }
  }, [
    lostReasonQuery,
    ownerFilter,
    ownerOptions,
    requestedOwner,
    requestedReason,
    requestedSourceType,
    requestedStatus,
    sourceTypeFilter,
    sourceTypeOptions,
    statusFilter,
    statusOptions
  ]);

  useEffect(() => {
    const desiredSourceType = String(sourceTypeFilter || "all").trim().toLowerCase();
    const desiredOwner = String(ownerFilter || "all").trim();
    const desiredStatus = String(statusFilter || "all").trim().toLowerCase();
    const desiredReason = String(lostReasonQuery || "").trim();

    const currentSourceType = String(searchParams.get("sourceType") || "all")
      .trim()
      .toLowerCase();
    const currentOwner = String(searchParams.get("ownerId") || "all").trim();
    const currentStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
    const currentReason = String(searchParams.get("reason") || "").trim();

    const isUnchanged =
      desiredSourceType === currentSourceType &&
      desiredOwner === currentOwner &&
      desiredStatus === currentStatus &&
      desiredReason === currentReason;
    if (isUnchanged) return;

    const nextParams = new URLSearchParams(searchParams);

    if (desiredSourceType === "all") nextParams.delete("sourceType");
    else nextParams.set("sourceType", desiredSourceType);

    if (desiredOwner === "all") nextParams.delete("ownerId");
    else nextParams.set("ownerId", desiredOwner);

    if (desiredStatus === "all") nextParams.delete("status");
    else nextParams.set("status", desiredStatus);

    if (!desiredReason) nextParams.delete("reason");
    else nextParams.set("reason", desiredReason);

    setSearchParams(nextParams, { replace: true });
  }, [
    lostReasonQuery,
    ownerFilter,
    searchParams,
    setSearchParams,
    sourceTypeFilter,
    statusFilter
  ]);

  const filteredSourceTypeRows = useMemo(() => {
    if (sourceTypeFilter === "all") return sourceTypeRows;
    return sourceTypeRows.filter(
      (source) => String(source?.sourceType || "").trim().toLowerCase() === sourceTypeFilter
    );
  }, [sourceTypeFilter, sourceTypeRows]);

  const filteredSourceRows = useMemo(() => {
    if (sourceTypeFilter === "all") return sourceRows;
    return sourceRows.filter(
      (source) => String(source?.sourceType || "").trim().toLowerCase() === sourceTypeFilter
    );
  }, [sourceRows, sourceTypeFilter]);

  const filteredOwnerRows = useMemo(() => {
    if (ownerFilter === "all") return ownerRows;
    return ownerRows.filter((owner) => String(owner?.ownerId || "").trim() === ownerFilter);
  }, [ownerFilter, ownerRows]);

  const filteredStatusRows = useMemo(() => {
    if (statusFilter === "all") return statusRows;
    return statusRows.filter((row) => String(row?.status || "").trim().toLowerCase() === statusFilter);
  }, [statusFilter, statusRows]);

  const filteredLostReasonRows = useMemo(() => {
    const normalizedReason = String(lostReasonQuery || "").trim().toLowerCase();
    if (!normalizedReason) return lostReasonRows;
    return lostReasonRows.filter((row) =>
      String(row?.reason || "").trim().toLowerCase().includes(normalizedReason)
    );
  }, [lostReasonQuery, lostReasonRows]);
  const hasActiveFilters =
    sourceTypeFilter !== "all" ||
    ownerFilter !== "all" ||
    statusFilter !== "all" ||
    Boolean(String(lostReasonQuery || "").trim());
  const getEmptyMessage = (defaultMessage) =>
    hasActiveFilters ? "No rows match current filters." : defaultMessage;

  return (
    <div className="crm-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Reports</h1>
          <p>Track conversion, source quality, response speed, owner performance, and pipeline health from one place.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => loadReport({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <CrmFilterBar>
        <select
          className="crm-select"
          value={sourceTypeFilter}
          onChange={(event) => setSourceTypeFilter(event.target.value)}
        >
          <option value="all">All Source Types</option>
          {sourceTypeOptions.map((option) => (
            <option key={option} value={option}>
              {toLabel(option)}
            </option>
          ))}
        </select>
        <select
          className="crm-select"
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
        >
          <option value="all">All Owners</option>
          {ownerOptions.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.label}
            </option>
          ))}
        </select>
        <select
          className="crm-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Lead Statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {toLabel(option)}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="crm-input"
          value={lostReasonQuery}
          onChange={(event) => setLostReasonQuery(event.target.value)}
          placeholder="Filter lost reason..."
        />
      </CrmFilterBar>

      <div className="crm-metric-grid">
        <div className="crm-metric-card">
          <Users size={18} />
          <div>
            <strong>{report?.pipeline?.totalContacts ?? 0}</strong>
            <span>Total Leads</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Target size={18} />
          <div>
            <strong>{toPercent(report?.pipeline?.qualifiedRate ?? 0)}</strong>
            <span>Qualified Rate</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <BadgeDollarSign size={18} />
          <div>
            <strong>{formatCurrency(report?.pipeline?.deals?.pipelineValue ?? 0)}</strong>
            <span>Open Pipeline</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Clock3 size={18} />
          <div>
            <strong>{formatMinutes(report?.response?.avgResponseMinutes ?? 0)}</strong>
            <span>Avg Response</span>
          </div>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <CrmPageSkeleton variant="table" />}

      {!loading && (
        <div className="crm-report-grid">
          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <BarChart3 size={16} />
                Source Attribution
              </h3>
              <span className="crm-drawer-helper-text">
                Top acquisition channels and campaign quality
              </span>
            </div>
            <div className="crm-summary-grid crm-summary-grid--compact">
              {filteredSourceTypeRows.slice(0, 4).map((source) => (
                <div key={source.sourceType} className="crm-summary-card">
                  <strong>{source.count}</strong>
                  <span>{toLabel(source.sourceType)}</span>
                </div>
              ))}
              {filteredSourceTypeRows.length === 0 && (
                <div className="crm-summary-card">
                  <strong>0</strong>
                  <span>{getEmptyMessage("No source type data yet.")}</span>
                </div>
              )}
            </div>
            <div className="crm-report-table-wrap">
              <table className="crm-owner-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Leads</th>
                    <th>Qualified</th>
                    <th>Won</th>
                    <th>Opted In</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSourceRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="crm-empty-row">
                        {getEmptyMessage("No source data yet.")}
                      </td>
                    </tr>
                  )}
                  {filteredSourceRows.map((source) => (
                    <tr key={`${source.sourceType}-${source.source}`}>
                      <td>
                        <strong>{source.source || "Unspecified"}</strong>
                        <span>{toLabel(source.sourceType)}</span>
                      </td>
                      <td>{source.count}</td>
                      <td>{source.qualified}</td>
                      <td>{source.won}</td>
                      <td>{source.optedIn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <Target size={16} />
                Pipeline Conversion
              </h3>
              <span className="crm-drawer-helper-text">Lead stage and status movement</span>
            </div>
            <div className="crm-summary-grid crm-summary-grid--compact">
              <div className="crm-summary-card">
                <strong>{report?.pipeline?.qualifiedContacts ?? 0}</strong>
                <span>Qualified</span>
              </div>
              <div className="crm-summary-card">
                <strong>{report?.pipeline?.wonContacts ?? 0}</strong>
                <span>Won Leads</span>
              </div>
              <div className="crm-summary-card">
                <strong>{toPercent(report?.pipeline?.wonRate ?? 0)}</strong>
                <span>Win Rate</span>
              </div>
              <div className="crm-summary-card">
                <strong>{report?.owners?.summary?.needsReply ?? 0}</strong>
                <span>Needs Reply</span>
              </div>
            </div>
            <div className="crm-report-two-column">
              <div className="crm-report-list">
                <h4>By Stage</h4>
                {stageRows.map((row) => (
                  <div key={row.stage} className="crm-report-list-row">
                    <span>{stageLabelMap[String(row.stage || "").trim().toLowerCase()] || getPipelineStageLabel(row.stage, pipelineStages)}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
                {stageRows.length === 0 && <p className="crm-activity-empty">No stage data yet.</p>}
              </div>
              <div className="crm-report-list">
                <h4>By Status</h4>
                {filteredStatusRows.map((row) => (
                  <div key={row.status} className="crm-report-list-row">
                    <span>{toLabel(row.status)}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
                {filteredStatusRows.length === 0 && (
                  <p className="crm-activity-empty">{getEmptyMessage("No status data yet.")}</p>
                )}
              </div>
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <BadgeDollarSign size={16} />
                Deals & Revenue
              </h3>
              <span className="crm-drawer-helper-text">Deal stage totals and won revenue</span>
            </div>
            <div className="crm-summary-grid crm-summary-grid--compact">
              <div className="crm-summary-card">
                <strong>{report?.pipeline?.deals?.open ?? 0}</strong>
                <span>Open Deals</span>
              </div>
              <div className="crm-summary-card">
                <strong>{report?.pipeline?.deals?.won ?? 0}</strong>
                <span>Won Deals</span>
              </div>
              <div className="crm-summary-card">
                <strong>{formatCurrency(report?.pipeline?.deals?.pipelineValue ?? 0)}</strong>
                <span>Pipeline Value</span>
              </div>
              <div className="crm-summary-card">
                <strong>{formatCurrency(report?.pipeline?.deals?.wonValue ?? 0)}</strong>
                <span>Won Value</span>
              </div>
            </div>
            <div className="crm-report-list">
              {dealStageRows.map((dealStage) => (
                <div key={dealStage.stage} className="crm-report-list-row">
                  <span>{toLabel(dealStage.stage)}</span>
                  <strong>
                    {dealStage.count} / {formatCurrency(dealStage.value)}
                  </strong>
                </div>
              ))}
              {dealStageRows.length === 0 && <p className="crm-activity-empty">No deal stage data yet.</p>}
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <Users size={16} />
                Owner Performance
              </h3>
              <span className="crm-drawer-helper-text">By agent workload and pipeline ownership</span>
            </div>
            <div className="crm-report-table-wrap">
              <table className="crm-owner-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Leads</th>
                    <th>Overdue</th>
                    <th>Needs Reply</th>
                    <th>Open Deals</th>
                    <th>Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOwnerRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="crm-empty-row">
                        {getEmptyMessage("No owner data yet.")}
                      </td>
                    </tr>
                  )}
                  {filteredOwnerRows.map((owner) => (
                    <tr key={owner.ownerId || owner.ownerName}>
                      <td>
                        <strong>{owner.ownerName || "Unassigned"}</strong>
                        <span>{owner.ownerId || "No owner id"}</span>
                      </td>
                      <td>{owner.contactCount ?? 0}</td>
                      <td>{owner.overdueFollowUps ?? 0}</td>
                      <td>{owner.needsReply ?? 0}</td>
                      <td>{owner.openDeals ?? 0}</td>
                      <td>{formatCurrency(owner.pipelineValue ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <Clock3 size={16} />
                Follow-up Health
              </h3>
              <span className="crm-drawer-helper-text">SLA and follow-up completion quality</span>
            </div>
            <div className="crm-summary-grid crm-summary-grid--compact">
              <div className="crm-summary-card">
                <strong>{report?.followUps?.overdue ?? 0}</strong>
                <span>Overdue</span>
              </div>
              <div className="crm-summary-card">
                <strong>{report?.followUps?.dueToday ?? 0}</strong>
                <span>Due Today</span>
              </div>
              <div className="crm-summary-card">
                <strong>{report?.followUps?.todayCalls ?? 0}</strong>
                <span>Today Calls</span>
              </div>
              <div className="crm-summary-card">
                <strong>{toPercent(report?.followUps?.followUpCompletionRate ?? 0)}</strong>
                <span>Follow-up Completion</span>
              </div>
            </div>
            <div className="crm-report-two-column">
              <div className="crm-report-list">
                <h4>Task Types</h4>
                {followUpTypeRows.map((row) => (
                  <div key={row.taskType} className="crm-report-list-row">
                    <span>{toLabel(row.taskType)}</span>
                    <strong>
                      {row.completed}/{row.total}
                    </strong>
                  </div>
                ))}
                {followUpTypeRows.length === 0 && <p className="crm-activity-empty">No task type data yet.</p>}
              </div>
              <div className="crm-report-list">
                <h4>Response SLA</h4>
                <div className="crm-report-list-row">
                  <span>Awaiting Reply</span>
                  <strong>{report?.response?.awaitingReplyCount ?? 0}</strong>
                </div>
                <div className="crm-report-list-row">
                  <span>Responded</span>
                  <strong>{report?.response?.respondedCount ?? 0}</strong>
                </div>
                <div className="crm-report-list-row">
                  <span>Average Response</span>
                  <strong>{formatMinutes(report?.response?.avgResponseMinutes ?? 0)}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <h3>
                <BarChart3 size={16} />
                Lead Quality
              </h3>
              <span className="crm-drawer-helper-text">Lead score bands and lost reason trends</span>
            </div>
            <div className="crm-ops-chip-list">
              {leadScoreBands.map((band) => (
                <span key={band.band} className="crm-ops-chip">
                  {toLabel(band.band)}: {band.count}
                </span>
              ))}
              {leadScoreBands.length === 0 && <span className="crm-ops-chip">No score data yet</span>}
            </div>
            <div className="crm-report-list">
              {filteredLostReasonRows.slice(0, 10).map((row, index) => (
                <div key={`${row.reason}-${index}`} className="crm-report-list-row">
                  <span>{row.reason || "Unspecified"}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {filteredLostReasonRows.length === 0 && (
                <p className="crm-activity-empty">{getEmptyMessage("No lost reason data yet.")}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CrmReports;
