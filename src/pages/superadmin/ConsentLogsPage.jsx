import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/api";
import "./ConsentLogsPage.css";

const DEFAULT_FILTERS = {
  phone: "",
  action: "",
  userId: "",
  companyId: "",
  startDate: "",
  endDate: ""
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const ConsentLogsPage = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(15000);
  const [exportEmail, setExportEmail] = useState("");
  const [exportJobs, setExportJobs] = useState([]);
  const isSuperAdmin = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("user") || "null");
      return String(parsed?.role || "").toLowerCase() === "superadmin";
    } catch {
      return false;
    }
  }, []);

  const params = useMemo(() => {
    const trimmed = Object.entries(filters).reduce((acc, [key, value]) => {
      const nextValue = String(value || "").trim();
      if (nextValue) acc[key] = nextValue;
      return acc;
    }, {});
    return { ...trimmed, page };
  }, [filters, page]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getConsentLogs(params);
      if (response?.data?.success === false) {
        throw new Error(response?.data?.error || "Failed to load consent logs.");
      }
      const payload = response?.data || {};
      setLogs(Array.isArray(payload.data) ? payload.data : []);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load consent logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExportJobs = async () => {
    try {
      const response = await apiService.getConsentExportJobs();
      if (response?.data?.success === false) {
        throw new Error(response?.data?.error || "Failed to load export jobs.");
      }
      setExportJobs(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (jobError) {
      setError(jobError?.message || "Failed to load export jobs.");
    }
  };

  const handleExport = async (actionOverride = "") => {
    try {
      const exportParams = {
        ...params,
        ...(actionOverride ? { action: actionOverride } : {})
      };
      const response = await apiService.exportConsentLogs(exportParams);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const startLabel = filters.startDate ? `from-${filters.startDate}` : "all";
      const endLabel = filters.endDate ? `to-${filters.endDate}` : "all";
      const actionLabel = actionOverride || "all";
      link.setAttribute("download", `whatsapp-consent-logs_${actionLabel}_${startLabel}_${endLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError?.message || "Failed to export consent logs.");
    }
  };

  const handleEmailExport = async () => {
    if (!exportEmail.trim()) {
      setError("Enter an email address to send the export.");
      return;
    }
    try {
      await apiService.requestConsentExportEmail(exportEmail.trim(), params);
      setError("");
      setExportEmail("");
      await loadExportJobs();
    } catch (requestError) {
      setError(requestError?.message || "Failed to queue email export.");
    }
  };

  const handleDownloadJob = async (job) => {
    if (!job?._id) return;
    try {
      const response = await apiService.downloadConsentExportJob(job._id);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `whatsapp-consent-logs_${job._id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError?.message || "Failed to download export.");
    }
  };

  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === "today") {
      const today = now.toISOString().slice(0, 10);
      updateFilter("startDate", today);
      updateFilter("endDate", today);
      return;
    }
    if (preset === "last7") {
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      updateFilter("startDate", start.toISOString().slice(0, 10));
      updateFilter("endDate", now.toISOString().slice(0, 10));
      return;
    }
    if (preset === "last30") {
      const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      updateFilter("startDate", start.toISOString().slice(0, 10));
      updateFilter("endDate", now.toISOString().slice(0, 10));
      return;
    }
    if (preset === "clear") {
      updateFilter("startDate", "");
      updateFilter("endDate", "");
    }
  };

  useEffect(() => {
    loadLogs();
  }, [params]);

  useEffect(() => {
    loadExportJobs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = window.setInterval(() => {
      loadLogs();
    }, autoRefreshInterval);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, autoRefreshInterval, params]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="consent-logs-page">
      <div className="consent-logs-header">
        <div>
          <h1>WhatsApp Consent Logs</h1>
          <p>Track opt-in and opt-out events with proof and metadata.</p>
        </div>
        <div className="consent-logs-actions">
          <button type="button" onClick={() => handleExport("")} disabled={loading || autoRefresh}>
            Export All
          </button>
          <button type="button" onClick={() => handleExport("opt_in")} disabled={loading || autoRefresh}>
            Export Opt-ins
          </button>
          <button type="button" onClick={() => handleExport("opt_out")} disabled={loading || autoRefresh}>
            Export Opt-outs
          </button>
          <button type="button" onClick={loadLogs} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <label className="consent-logs-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
          <select
            className="consent-logs-interval"
            value={autoRefreshInterval}
            onChange={(event) => setAutoRefreshInterval(Number(event.target.value))}
            disabled={!autoRefresh}
          >
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </div>
      </div>

      {!isSuperAdmin ? (
        <div className="consent-logs-warning">
          This page is intended for superadmin review. Permissions are enforced server-side.
        </div>
      ) : null}

      <div className="consent-logs-presets">
        <span>Quick range:</span>
        <button type="button" onClick={() => applyPreset("today")}>Today</button>
        <button type="button" onClick={() => applyPreset("last7")}>Last 7 days</button>
        <button type="button" onClick={() => applyPreset("last30")}>Last 30 days</button>
        <button type="button" onClick={() => applyPreset("clear")}>Clear</button>
        <span className="consent-logs-hint">CSV includes summary rows for opt-in/opt-out totals.</span>
      </div>

      <div className="consent-logs-filters">
        <input
          type="text"
          placeholder="Search phone..."
          value={filters.phone}
          onChange={(event) => updateFilter("phone", event.target.value)}
        />
        <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}>
          <option value="">All actions</option>
          <option value="opt_in">Opt-in</option>
          <option value="opt_out">Opt-out</option>
        </select>
        <input
          type="text"
          placeholder="User ID (optional)"
          value={filters.userId}
          onChange={(event) => updateFilter("userId", event.target.value)}
        />
        <input
          type="text"
          placeholder="Company ID (optional)"
          value={filters.companyId}
          onChange={(event) => updateFilter("companyId", event.target.value)}
        />
        <input
          type="date"
          value={filters.startDate}
          onChange={(event) => updateFilter("startDate", event.target.value)}
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(event) => updateFilter("endDate", event.target.value)}
        />
      </div>

      <div className="consent-logs-email">
        <input
          type="email"
          placeholder="Email export to..."
          value={exportEmail}
          onChange={(event) => setExportEmail(event.target.value)}
        />
        <button type="button" onClick={handleEmailExport}>
          Request Email Export
        </button>
        <button type="button" onClick={loadExportJobs}>
          Refresh Jobs
        </button>
      </div>

      {exportJobs.length ? (
        <div className="consent-logs-jobs">
          <div className="consent-logs-jobs-head">
            <strong>Recent export jobs</strong>
            {exportJobs.find((job) => job.status === "completed") ? (
              <button
                type="button"
                onClick={() =>
                  handleDownloadJob(exportJobs.find((job) => job.status === "completed"))
                }
              >
                Download Last Export
              </button>
            ) : null}
          </div>
          {exportJobs.map((job) => (
            <div key={job._id} className="consent-logs-job-row">
              <span>{job.email || "-"}</span>
              <span className={`pill pill-${job.status}`}>{job.status}</span>
              <span>{job.checksum ? job.checksum.slice(0, 10) : "-"}</span>
              <span>{job.error || "-"}</span>
              <span className={`consent-logs-job-status consent-logs-job-status--${job.status}`}>
                {job.status === "completed"
                  ? "Download ready"
                  : job.status === "failed"
                    ? "Check error"
                    : job.status === "processing"
                      ? "Sending..."
                      : "Queued"}
              </span>
              <span>
                <button
                  type="button"
                  className="consent-logs-job-download"
                  onClick={() => handleDownloadJob(job)}
                  disabled={job.status !== "completed"}
                >
                  Download
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="consent-logs-error">{error}</div> : null}

      <div className="consent-logs-table">
        <div className="consent-logs-row consent-logs-row--head">
          <span>Phone</span>
          <span>Action</span>
          <span>Source</span>
          <span>Scope</span>
          <span>Proof</span>
          <span>Captured By</span>
          <span>Time</span>
          <span>Details</span>
        </div>
        {loading ? (
          <div className="consent-logs-empty">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="consent-logs-empty">No consent logs found.</div>
        ) : (
          logs.map((item) => (
            <div className="consent-logs-row" key={item._id}>
              <span>{item.phone || "-"}</span>
              <span className={`pill pill-${item.action}`}>{item.action || "-"}</span>
              <span>{item.source || "-"}</span>
              <span>{item.scope || "-"}</span>
              <span>
                {item.proofType ? `${item.proofType}${item.proofId ? ` · ${item.proofId}` : ""}` : "-"}
                {item.proofUrl ? (
                  <>
                    {" "}
                    <a href={item.proofUrl} target="_blank" rel="noreferrer">
                      Proof
                    </a>
                  </>
                ) : null}
              </span>
              <span>{item.capturedBy || "-"}</span>
              <span>{formatDateTime(item.createdAt)}</span>
              <span>
                <button
                  type="button"
                  className="consent-logs-view"
                  onClick={() => setSelectedLog(item)}
                >
                  View
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="consent-logs-pagination">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Previous
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>

      {selectedLog ? (
        <div className="consent-logs-drawer" role="presentation">
          <div className="consent-logs-drawer-card" role="dialog" aria-modal="true">
            <div className="consent-logs-drawer-header">
              <div>
                <h3>Consent Log Details</h3>
                <p>{selectedLog.phone || "-"}</p>
              </div>
              <button type="button" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
            <div className="consent-logs-drawer-body">
              <div><strong>Action:</strong> {selectedLog.action || "-"}</div>
              <div><strong>Source:</strong> {selectedLog.source || "-"}</div>
              <div><strong>Scope:</strong> {selectedLog.scope || "-"}</div>
              <div><strong>Consent Text:</strong> {selectedLog.consentText || "-"}</div>
              <div><strong>Proof Type:</strong> {selectedLog.proofType || "-"}</div>
              <div><strong>Proof ID:</strong> {selectedLog.proofId || "-"}</div>
              <div><strong>Proof URL:</strong> {selectedLog.proofUrl || "-"}</div>
              <div><strong>Captured By:</strong> {selectedLog.capturedBy || "-"}</div>
              <div><strong>Page URL:</strong> {selectedLog.pageUrl || "-"}</div>
              <div><strong>IP:</strong> {selectedLog.ip || "-"}</div>
              <div><strong>User Agent:</strong> {selectedLog.userAgent || "-"}</div>
              <div><strong>Time:</strong> {formatDateTime(selectedLog.createdAt)}</div>
              {selectedLog.metadata ? (
                <>
                  <div className="consent-logs-drawer-actions">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            JSON.stringify(selectedLog.metadata, null, 2)
                          );
                          setError("Metadata copied.");
                          window.setTimeout(() => setError(""), 1600);
                        } catch {
                          setError("Failed to copy metadata.");
                        }
                      }}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ConsentLogsPage;
