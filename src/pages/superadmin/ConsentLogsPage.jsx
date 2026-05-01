import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiService from "../../services/consentService";
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

const escapeCsvValue = (value) =>
  `"${String(value ?? "")
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')
    .trim()}"`;

const buildMissingProofCsv = (items = []) => {
  const headers = [
    "Phone",
    "Name",
    "Source Type",
    "Opt-in Source",
    "Opt-in Status",
    "Opt-in Scope",
    "Proof Type",
    "Proof ID",
    "Consent Text",
    "Captured By",
    "Created At",
    "Updated At"
  ];

  const rows = (Array.isArray(items) ? items : []).map((item) => [
    item?.phone || "",
    item?.name || "",
    item?.sourceType || "",
    item?.whatsappOptInSource || "",
    item?.whatsappOptInStatus || "",
    item?.whatsappOptInScope || "",
    item?.whatsappOptInProofType || "",
    item?.whatsappOptInProofId || "",
    item?.whatsappOptInTextSnapshot || "",
    item?.whatsappOptInCapturedBy || "",
    item?.createdAt || "",
    item?.updatedAt || ""
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(","))
  ].join("\n");
};

const buildConsentLogsCsv = (items = []) => {
  const headers = [
    "Phone",
    "Action",
    "Source",
    "Scope",
    "Consent Text",
    "Proof Type",
    "Proof ID",
    "Proof URL",
    "Captured By",
    "Time",
    "Page URL",
    "IP",
    "User Agent"
  ];

  const rows = (Array.isArray(items) ? items : []).map((item) => [
    item?.phone || "",
    item?.action || "",
    item?.source || "",
    item?.scope || "",
    item?.consentText || "",
    item?.proofType || "",
    item?.proofId || "",
    item?.proofUrl || "",
    item?.capturedBy || "",
    item?.createdAt || "",
    item?.pageUrl || "",
    item?.ip || "",
    item?.userAgent || ""
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(","))
  ].join("\n");
};

const filterAuditRows = (items = [], { selectedIds = [], mode = "all" } = {}) => {
  const normalizedIds = new Set(
    (Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id || "").trim()).filter(Boolean)
  );

  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemId = String(item?._id || "").trim();
    const isSelected = normalizedIds.has(itemId);
    const hasProof = Boolean(String(item?.whatsappOptInProofType || "").trim());
    const hasText = Boolean(String(item?.whatsappOptInTextSnapshot || "").trim());

    if (mode === "selected") return isSelected;
    if (mode === "missing-proof") return !hasProof;
    if (mode === "missing-text") return !hasText;
    return true;
  });
};

const downloadTextFile = (content, fileName, mimeType = "text/csv;charset=utf-8;") => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const ConsentLogsPage = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(15000);
  const [exportEmail, setExportEmail] = useState("");
  const [exportJobs, setExportJobs] = useState([]);
  const [missingProofAudit, setMissingProofAudit] = useState(null);
  const [selectedAuditIds, setSelectedAuditIds] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const visibleLogsSelectAllRef = useRef(null);
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

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getConsentLogs(params);
      if (response?.data?.success === false) {
        throw new Error(response?.data?.error || "Failed to load consent logs.");
      }
      const payload = response?.data || {};
      setLogs(Array.isArray(payload.data) ? payload.data : []);
      setSelectedLogIds([]);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load consent logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadExportJobs = useCallback(async () => {
    try {
      const response = await apiService.getConsentExportJobs();
      if (response?.data?.success === false) {
        throw new Error(response?.data?.error || "Failed to load export jobs.");
      }
      setExportJobs(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (jobError) {
      setError(jobError?.message || "Failed to load export jobs.");
    }
  }, []);

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

  const handleRunMissingProofAudit = async () => {
    try {
      setAuditLoading(true);
      setAuditError("");
      const auditParams = {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.phone ? { phone: filters.phone } : {}),
        importedOnly: "true"
      };
      const response = await apiService.getConsentReviewAudit(auditParams);
      if (response?.data?.success === false) {
        throw new Error(response?.data?.error || "Failed to run missing-proof audit.");
      }
      setMissingProofAudit({
        items: Array.isArray(response?.data?.data) ? response.data.data : [],
        summary: response?.data?.summary || {},
        page: response?.data?.page || 1,
        totalPages: response?.data?.totalPages || 1
      });
    } catch (auditRunError) {
      setAuditError(auditRunError?.message || "Failed to run missing-proof audit.");
      setMissingProofAudit(null);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleDownloadVisibleLogs = () => {
    if (!logs.length) {
      setError("No visible logs available to export.");
      return;
    }

    const startLabel = filters.startDate ? `from-${filters.startDate}` : "all";
    const endLabel = filters.endDate ? `to-${filters.endDate}` : "all";
    const pageLabel = `page-${page}`;
    const fileName = `whatsapp-consent-logs_visible_${pageLabel}_${startLabel}_${endLabel}.csv`;
    downloadTextFile(buildConsentLogsCsv(logs), fileName);
  };

  const handleToggleLogSelection = (logId) => {
    const normalizedId = String(logId || "").trim();
    if (!normalizedId) return;
    setSelectedLogIds((previous) =>
      previous.includes(normalizedId)
        ? previous.filter((id) => id !== normalizedId)
        : [...previous, normalizedId]
    );
  };

  const handleSelectAllVisibleLogs = () => {
    const allIds = Array.isArray(logs)
      ? logs.map((item) => String(item?._id || "").trim()).filter(Boolean)
      : [];
    setSelectedLogIds(allIds);
  };

  const handleClearSelectedLogs = () => {
    setSelectedLogIds([]);
  };

  const handleDownloadSelectedLogs = () => {
    const selectedRows = Array.isArray(logs)
      ? logs.filter((item) => selectedLogIds.includes(String(item?._id || "").trim()))
      : [];

    if (!selectedRows.length) {
      setError("Select at least one visible row to export.");
      return;
    }

    const startLabel = filters.startDate ? `from-${filters.startDate}` : "all";
    const endLabel = filters.endDate ? `to-${filters.endDate}` : "all";
    const pageLabel = `page-${page}`;
    const fileName = `whatsapp-consent-logs_selected_${pageLabel}_${startLabel}_${endLabel}.csv`;
    downloadTextFile(buildConsentLogsCsv(selectedRows), fileName);
  };

  const handleResetConsentFromAudit = async (contact) => {
    if (!contact?._id) return;
    const confirmed = window.confirm(
      `Move ${contact.phone || contact.name || 'this contact'} back to Unknown and clear consent proof?`
    );
    if (!confirmed) return;

    try {
      setAuditLoading(true);
      setAuditError("");
      await apiService.resetContactWhatsAppConsent(contact._id, {
        source: "audit_review",
        reason: "Missing proof audit review"
      });
      await handleRunMissingProofAudit();
      await loadLogs();
    } catch (resetError) {
      setAuditError(resetError?.message || "Failed to reset contact consent.");
    } finally {
      setAuditLoading(false);
    }
  };

  const handleToggleAuditSelection = (contactId) => {
    const normalizedId = String(contactId || "").trim();
    if (!normalizedId) return;
    setSelectedAuditIds((previous) =>
      previous.includes(normalizedId)
        ? previous.filter((id) => id !== normalizedId)
        : [...previous, normalizedId]
    );
  };

  const handleSelectAllAuditRows = () => {
    const allIds = Array.isArray(missingProofAudit?.items)
      ? missingProofAudit.items
          .map((contact) => String(contact?._id || "").trim())
          .filter(Boolean)
      : [];
    setSelectedAuditIds(allIds);
  };

  const handleClearAuditSelection = () => {
    setSelectedAuditIds([]);
  };

  const handleBulkResetAuditSelection = async () => {
    const selectedRows = Array.isArray(missingProofAudit?.items)
      ? missingProofAudit.items.filter((contact) =>
          selectedAuditIds.includes(String(contact?._id || "").trim())
        )
      : [];

    if (!selectedRows.length) {
      setAuditError("Select at least one contact to mark unknown.");
      return;
    }

    const confirmed = window.confirm(
      `Mark ${selectedRows.length} selected contact${selectedRows.length === 1 ? "" : "s"} as Unknown?`
    );
    if (!confirmed) return;

    try {
      setAuditLoading(true);
      setAuditError("");
      for (const contact of selectedRows) {
        await apiService.resetContactWhatsAppConsent(contact._id, {
          source: "audit_review",
          reason: "Bulk missing-proof audit review"
        });
      }
      setSelectedAuditIds([]);
      await handleRunMissingProofAudit();
      await loadLogs();
    } catch (bulkResetError) {
      setAuditError(bulkResetError?.message || "Failed to reset selected contacts.");
    } finally {
      setAuditLoading(false);
    }
  };

  const handleDownloadFilteredAudit = (mode = "all") => {
    if (!missingProofAudit?.items?.length) {
      setAuditError("No audit rows available to export.");
      return;
    }

    const filteredRows = filterAuditRows(missingProofAudit.items, {
      selectedIds: selectedAuditIds,
      mode
    });

    if (!filteredRows.length) {
      setAuditError("No rows matched the selected export filter.");
      return;
    }

    const startLabel = filters.startDate ? `from-${filters.startDate}` : "all";
    const endLabel = filters.endDate ? `to-${filters.endDate}` : "all";
    const modeLabelMap = {
      all: "all",
      selected: "selected",
      "missing-proof": "missing-proof",
      "missing-text": "missing-text"
    };
    const modeLabel = modeLabelMap[mode] || mode.replace(/[^a-z0-9]+/gi, "-");
    const fileName = `missing-proof-audit_${modeLabel}_${startLabel}_${endLabel}.csv`;
    downloadTextFile(buildMissingProofCsv(filteredRows), fileName);
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
  }, [loadLogs]);

  useEffect(() => {
    loadExportJobs();
  }, [loadExportJobs]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = window.setInterval(() => {
      loadLogs();
    }, autoRefreshInterval);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, autoRefreshInterval, loadLogs]);

  useEffect(() => {
    if (!visibleLogsSelectAllRef.current) return;
    const isAllSelected = logs.length > 0 && selectedLogIds.length === logs.length;
    const isPartiallySelected =
      selectedLogIds.length > 0 && selectedLogIds.length < logs.length;
    visibleLogsSelectAllRef.current.indeterminate = isPartiallySelected;
    visibleLogsSelectAllRef.current.checked = isAllSelected;
  }, [logs.length, selectedLogIds.length]);

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
          <button type="button" onClick={handleDownloadVisibleLogs} disabled={loading || autoRefresh}>
            Export Visible Rows
          </button>
          <button
            type="button"
            onClick={handleDownloadSelectedLogs}
            disabled={!selectedLogIds.length || loading || autoRefresh}
          >
            Export Selected Rows ({selectedLogIds.length})
          </button>
          <button type="button" onClick={() => handleExport("")} disabled={loading || autoRefresh}>
            Export Filtered All
          </button>
          <button type="button" onClick={() => handleExport("opt_in")} disabled={loading || autoRefresh}>
            Export Filtered Opt-ins
          </button>
          <button type="button" onClick={() => handleExport("opt_out")} disabled={loading || autoRefresh}>
            Export Filtered Opt-outs
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

      <div className="consent-logs-email">
        <button type="button" onClick={handleRunMissingProofAudit} disabled={auditLoading}>
          {auditLoading ? "Running Audit..." : "Run Missing-Proof Audit"}
        </button>
        <button
          type="button"
          onClick={() => handleDownloadFilteredAudit("all")}
          disabled={!missingProofAudit?.items?.length}
        >
          Download All CSV
        </button>
        <button
          type="button"
          onClick={() => handleDownloadFilteredAudit("selected")}
          disabled={!selectedAuditIds.length || !missingProofAudit?.items?.length}
        >
          Download Selected CSV
        </button>
        <button
          type="button"
          onClick={() => handleDownloadFilteredAudit("missing-proof")}
          disabled={!missingProofAudit?.items?.length}
        >
          Download Missing Proof CSV
        </button>
        <button
          type="button"
          onClick={() => handleDownloadFilteredAudit("missing-text")}
          disabled={!missingProofAudit?.items?.length}
        >
          Download Missing Text CSV
        </button>
        <span className="consent-logs-hint">
          Finds opted-in contacts imported without saved consent proof.
        </span>
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

      {auditError ? <div className="consent-logs-error">{auditError}</div> : null}

      {missingProofAudit ? (
        <div className="consent-logs-jobs">
          <div className="consent-logs-jobs-head">
            <strong>Missing-proof contacts</strong>
            <div className="consent-logs-jobs-actions">
              <button
                type="button"
                onClick={handleSelectAllAuditRows}
                disabled={!missingProofAudit.items.length || auditLoading}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAuditSelection}
                disabled={!selectedAuditIds.length || auditLoading}
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={handleBulkResetAuditSelection}
                disabled={!selectedAuditIds.length || auditLoading}
              >
                Mark Selected Unknown ({selectedAuditIds.length})
              </button>
            </div>
            <span>
              {missingProofAudit.summary?.total || 0} found
              {" · "}
              {missingProofAudit.summary?.prooflessCount || 0} missing proof
              {" · "}
              {missingProofAudit.summary?.textlessCount || 0} missing text
            </span>
          </div>
          {missingProofAudit.items.length ? (
            missingProofAudit.items.map((contact) => {
              const isAuditSelected = selectedAuditIds.includes(String(contact._id || "").trim());
              return (
              <div
                key={contact._id}
                className={`consent-logs-job-row${isAuditSelected ? " consent-logs-job-row--selected" : ""}`}
              >
                <span>
                  <input
                    type="checkbox"
                    checked={selectedAuditIds.includes(String(contact._id || "").trim())}
                    onChange={() => handleToggleAuditSelection(contact._id)}
                  />
                </span>
                <span>{contact.phone || "-"}</span>
                <span>{contact.name || "-"}</span>
                <span>{contact.whatsappOptInSource || "-"}</span>
                <span>{contact.whatsappOptInProofType || "-"}</span>
                <span>{contact.whatsappOptInTextSnapshot ? "Has text" : "Missing text"}</span>
                <span>{contact.sourceType || "-"}</span>
                <span>{formatDateTime(contact.whatsappOptInAt || contact.updatedAt)}</span>
                <span>
                  {contact.whatsappOptInProofId || contact.whatsappOptInCapturedBy || "-"}
                </span>
                <span>
                  <button
                    type="button"
                    className="consent-logs-job-download"
                    onClick={() => handleResetConsentFromAudit(contact)}
                    disabled={auditLoading}
                  >
                    Mark Unknown
                  </button>
                </span>
              </div>
            );
            })
          ) : (
            <div className="consent-logs-empty">No risky imported contacts found.</div>
          )}
        </div>
      ) : null}

      {error ? <div className="consent-logs-error">{error}</div> : null}

      <div className="consent-logs-table">
        <div className="consent-logs-row consent-logs-row--head">
          <span>
            <input
              ref={visibleLogsSelectAllRef}
              type="checkbox"
              onChange={(event) =>
                event.target.checked ? handleSelectAllVisibleLogs() : handleClearSelectedLogs()
              }
              aria-label="Select all visible logs"
              />
            <span className="consent-logs-selection-count">
              {selectedLogIds.length ? `${selectedLogIds.length} selected` : "None selected"}
            </span>
          </span>
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
          logs.map((item) => {
            const isSelected = selectedLogIds.includes(String(item._id || "").trim());
            return (
            <div
              className={`consent-logs-row${isSelected ? " consent-logs-row--selected" : ""}`}
              key={item._id}
            >
              <span>
                <input
                  type="checkbox"
                  checked={selectedLogIds.includes(String(item._id || "").trim())}
                  onChange={() => handleToggleLogSelection(item._id)}
                  aria-label={`Select log ${item.phone || item._id || ""}`}
                />
              </span>
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
          );
          })
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
