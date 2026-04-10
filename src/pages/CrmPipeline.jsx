import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { RefreshCw, Funnel, TrendingUp, ClipboardList, Clock3 } from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import "./CrmWorkspace.css";

const CRM_PIPELINE_LOADING_TIMEOUT_MS = 8000;
const CRM_PIPELINE_CACHE_TTL_MS = 10 * 60 * 1000;
const CRM_PIPELINE_CACHE_NAMESPACE = "crm-pipeline-page";

const STAGE_ORDER = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "nurturing", label: "Nurturing" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeStage = (stage) => {
  const value = String(stage || "").trim().toLowerCase();
  return STAGE_ORDER.some((item) => item.key === value) ? value : "new";
};

const getContactId = (contact) => String(contact?._id || contact?.id || "").trim();

const sanitizeCrmPipelineContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  email: String(contact?.email || "").trim(),
  status: String(contact?.status || "").trim(),
  stage: String(contact?.stage || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  nextFollowUpAt: String(contact?.nextFollowUpAt || "").trim()
});

const sanitizeCrmPipelineMetrics = (metrics = {}) => {
  if (!metrics || typeof metrics !== "object") return null;
  try {
    return JSON.parse(JSON.stringify(metrics));
  } catch {
    return null;
  }
};

const CrmPipeline = () => {
  const [contacts, setContacts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageUpdatingId, setStageUpdatingId] = useState("");
  const hasInitializedFilterEffectRef = useRef(false);
  const currentUserId = resolveCacheUserId();

  const isDefaultView = !search.trim() && statusFilter === "all";

  const persistPipelineCache = useCallback((nextContacts, nextMetrics) => {
    if (!isDefaultView) return;

    writeSidebarPageCache(
      CRM_PIPELINE_CACHE_NAMESPACE,
      {
        contacts: (Array.isArray(nextContacts) ? nextContacts : [])
          .map(sanitizeCrmPipelineContact)
          .filter((contact) => contact._id || contact.id || contact.phone),
        metrics: sanitizeCrmPipelineMetrics(nextMetrics)
      },
      {
        currentUserId,
        ttlMs: CRM_PIPELINE_CACHE_TTL_MS
      }
    );
  }, [currentUserId, isDefaultView]);

  const fetchPipelineData = useCallback(async ({ silent = false } = {}) => {
    const releaseLoadingGuard = startLoadingTimeoutGuard(
      () => {
        if (silent) setRefreshing(false);
        else setLoading(false);
      },
      CRM_PIPELINE_LOADING_TIMEOUT_MS
    );
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const params = {
        limit: 400
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;

      const [contactsResult, metricsResult] = await Promise.all([
        crmService.getContacts(params),
        crmService.getMetrics()
      ]);

      if (contactsResult?.success === false) {
        throw new Error(contactsResult?.error || "Failed to load pipeline contacts");
      }
      if (metricsResult?.success === false) {
        throw new Error(metricsResult?.error || "Failed to load CRM metrics");
      }

      const rawContacts = contactsResult?.data || [];
      const nextContacts = Array.isArray(rawContacts) ? rawContacts : [];
      const nextMetrics = metricsResult?.data || null;

      setContacts(nextContacts);
      setMetrics(nextMetrics);
      persistPipelineCache(nextContacts, nextMetrics);
    } catch (fetchError) {
      setError(fetchError?.message || "Failed to load CRM pipeline");
    } finally {
      releaseLoadingGuard();
      setLoading(false);
      setRefreshing(false);
    }
  }, [persistPipelineCache, search, statusFilter]);

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchPipelineData({ silent: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPipelineData, search, statusFilter]);

  useEffect(() => {
    const cachedPipeline = readSidebarPageCache(CRM_PIPELINE_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (Array.isArray(cachedPipeline?.data?.contacts)) {
      setContacts(cachedPipeline.data.contacts);
      setMetrics(cachedPipeline?.data?.metrics || null);
      setLoading(false);
      fetchPipelineData({ silent: true });
      return;
    }

    fetchPipelineData();
  }, [currentUserId, fetchPipelineData]);

  const contactsByStage = useMemo(() => {
    const grouped = STAGE_ORDER.reduce((acc, stage) => {
      acc[stage.key] = [];
      return acc;
    }, {});

    contacts.forEach((contact) => {
      const stageKey = normalizeStage(contact?.stage);
      grouped[stageKey].push(contact);
    });

    return grouped;
  }, [contacts]);

  const handleStageMove = useCallback(async (contact, nextStage) => {
    const contactId = getContactId(contact);
    if (!contactId || !nextStage) return;

    try {
      setStageUpdatingId(contactId);
      const result = await crmService.updateContactStage(contactId, nextStage);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to update stage");
      }

      const updated = result?.data || null;
      setContacts((prev) => {
        const nextContacts = prev.map((item) => {
          const itemId = getContactId(item);
          if (!itemId || itemId !== contactId) return item;
          return updated ? { ...item, ...updated } : { ...item, stage: nextStage };
        });

        persistPipelineCache(nextContacts, metrics);
        return nextContacts;
      });
    } catch (updateError) {
      setError(updateError?.message || "Failed to update stage");
    } finally {
      setStageUpdatingId("");
    }
  }, [metrics, persistPipelineCache]);

  return (
    <div className="crm-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Pipeline</h1>
          <p>Track WhatsApp leads across stages and move them quickly.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => fetchPipelineData({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="crm-metric-grid">
        <div className="crm-metric-card">
          <TrendingUp size={18} />
          <div>
            <strong>{metrics?.contacts?.total ?? 0}</strong>
            <span>Total Leads</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Funnel size={18} />
          <div>
            <strong>{metrics?.contacts?.qualified ?? 0}</strong>
            <span>Qualified Leads</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <ClipboardList size={18} />
          <div>
            <strong>{metrics?.tasks?.open ?? 0}</strong>
            <span>Open Tasks</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Clock3 size={18} />
          <div>
            <strong>{metrics?.tasks?.overdue ?? 0}</strong>
            <span>Overdue Tasks</span>
          </div>
        </div>
      </div>

      <div className="crm-toolbar">
        <input
          type="text"
          className="crm-input"
          placeholder="Search leads by name, phone, email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="crm-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="nurturing">Nurturing</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <div className="crm-loading">Loading CRM pipeline...</div>}

      {!loading && (
        <div className="crm-pipeline-board">
          {STAGE_ORDER.map((stage) => (
            <section key={stage.key} className="crm-stage-column">
              <header className="crm-stage-header">
                <h3>{stage.label}</h3>
                <span>{contactsByStage[stage.key]?.length || 0}</span>
              </header>

              <div className="crm-stage-list">
                {(contactsByStage[stage.key] || []).map((contact) => {
                  const contactId = getContactId(contact);
                  const isUpdating = stageUpdatingId === contactId;
                  return (
                    <article key={contactId || `${stage.key}-${contact.phone}`} className="crm-contact-card">
                      <div className="crm-contact-head">
                        <strong>{contact?.name || "Unknown"}</strong>
                        <span className={`crm-status-badge status-${String(contact?.status || "nurturing").toLowerCase()}`}>
                          {String(contact?.status || "nurturing")}
                        </span>
                      </div>
                      <p>{contact?.phone || "-"}</p>
                      <div className="crm-contact-meta">
                        <span>Score: {Number(contact?.leadScore || 0)}</span>
                        <span>Next: {formatDateTime(contact?.nextFollowUpAt)}</span>
                      </div>
                      <select
                        className="crm-select"
                        value={normalizeStage(contact?.stage)}
                        onChange={(event) => handleStageMove(contact, event.target.value)}
                        disabled={isUpdating}
                      >
                        {STAGE_ORDER.map((option) => (
                          <option key={`${contactId}-${option.key}`} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </article>
                  );
                })}

                {(contactsByStage[stage.key] || []).length === 0 && (
                  <div className="crm-empty-column">No leads in {stage.label}</div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrmPipeline;
