import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Clock3,
  Copy,
  ExternalLink,
  Funnel,
  RefreshCw,
  Send,
  TrendingUp
} from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  buildPublicWhatsAppOptInDemoUrl,
  buildWhatsAppOutreachState
} from "../utils/whatsappOutreachNavigation";
import { getWhatsAppConversationState } from "../utils/whatsappContactState";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import { addCrmContactSyncListener } from "../utils/crmSyncEvents";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmMetricCard from "../components/crm/CrmMetricCard";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import CrmEmptyState from "../components/crm/CrmEmptyState";
import CrmOnboardingChecklist from "../components/crm/CrmOnboardingChecklist";
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

const QUEUE_OPTIONS = [
  { key: "all", label: "All Queues" },
  { key: "my_leads", label: "My Leads" },
  { key: "unassigned", label: "Unassigned" },
  { key: "overdue_followups", label: "Overdue Follow-ups" },
  { key: "due_today", label: "Due Today" },
  { key: "today_calls", label: "Today Calls" },
  { key: "high_score", label: "High Score" },
  { key: "needs_reply", label: "Needs Reply" },
  { key: "opted_in", label: "Opted In" }
];

const PIPELINE_STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "new", label: "New" },
  { key: "nurturing", label: "Nurturing" },
  { key: "qualified", label: "Qualified" },
  { key: "unqualified", label: "Unqualified" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
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
  source: String(contact?.source || "").trim(),
  sourceType: String(contact?.sourceType || "").trim(),
  ownerId: String(contact?.ownerId || "").trim(),
  temperature: String(contact?.temperature || "").trim(),
  dealValue:
    Number.isFinite(Number(contact?.dealValue)) && Number(contact?.dealValue) >= 0
      ? Number(contact.dealValue)
      : 0,
  lostReason: String(contact?.lostReason || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  nextFollowUpAt: String(contact?.nextFollowUpAt || "").trim(),
  lastContactAt: String(contact?.lastContactAt || "").trim(),
  lastStageChangedAt: String(contact?.lastStageChangedAt || "").trim(),
  isBlocked: Boolean(contact?.isBlocked),
  whatsappOptInStatus: String(contact?.whatsappOptInStatus || "").trim(),
  whatsappOptInAt: String(contact?.whatsappOptInAt || "").trim(),
  whatsappOptInSource: String(contact?.whatsappOptInSource || "").trim(),
  whatsappOptInScope: String(contact?.whatsappOptInScope || "").trim(),
  whatsappOptInTextSnapshot: String(contact?.whatsappOptInTextSnapshot || "").trim(),
  whatsappOptInProofType: String(contact?.whatsappOptInProofType || "").trim(),
  whatsappOptInProofId: String(contact?.whatsappOptInProofId || "").trim(),
  whatsappOptInProofUrl: String(contact?.whatsappOptInProofUrl || "").trim(),
  whatsappOptInCapturedBy: String(contact?.whatsappOptInCapturedBy || "").trim(),
  whatsappOptInPageUrl: String(contact?.whatsappOptInPageUrl || "").trim(),
  whatsappOptOutAt: String(contact?.whatsappOptOutAt || "").trim(),
  lastInboundMessageAt: String(contact?.lastInboundMessageAt || "").trim(),
  serviceWindowClosesAt: String(contact?.serviceWindowClosesAt || "").trim()
});

const decorateCrmContact = (contact = {}) => ({
  ...contact,
  whatsappState: getWhatsAppConversationState(contact)
});

const sanitizeCrmPipelineMetrics = (metrics = {}) => {
  if (!metrics || typeof metrics !== "object") return null;
  try {
    return JSON.parse(JSON.stringify(metrics));
  } catch {
    return null;
  }
};

const sanitizePipelineOwner = (owner = {}) => ({
  ownerId: String(owner?.ownerId || "").trim(),
  ownerName: String(owner?.ownerName || "").trim()
});

const CrmPipeline = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [stageUpdatingId, setStageUpdatingId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [toast, setToast] = useState(null);
  const hasInitializedFilterEffectRef = useRef(false);
  const lastExternalSyncAtRef = useRef(0);
  const currentUserId = resolveCacheUserId();
  const requestedSearch = String(searchParams.get("q") || "").trim();
  const requestedQueueFilter = String(searchParams.get("queue") || "all").trim().toLowerCase();
  const requestedStatusFilter = String(searchParams.get("status") || "all").trim().toLowerCase();
  const requestedOwnerFilter = String(searchParams.get("ownerId") || "all").trim();

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (search !== requestedSearch) {
      setSearch(requestedSearch);
    }

    const isValidQueue =
      requestedQueueFilter === "all" ||
      QUEUE_OPTIONS.some((option) => option.key === requestedQueueFilter);
    if (isValidQueue && queueFilter !== requestedQueueFilter) {
      setQueueFilter(requestedQueueFilter);
    }

    const isValidStatus =
      requestedStatusFilter === "all" ||
      PIPELINE_STATUS_OPTIONS.some((option) => option.key === requestedStatusFilter);
    if (isValidStatus && statusFilter !== requestedStatusFilter) {
      setStatusFilter(requestedStatusFilter);
    }

    const normalizedRequestedOwner = requestedOwnerFilter || "all";
    if (ownerFilter !== normalizedRequestedOwner) {
      setOwnerFilter(normalizedRequestedOwner);
    }
  }, [
    ownerFilter,
    queueFilter,
    requestedOwnerFilter,
    requestedQueueFilter,
    requestedSearch,
    requestedStatusFilter,
    search,
    statusFilter
  ]);

  useEffect(() => {
    const desiredSearch = String(search || "").trim();
    const desiredQueue = String(queueFilter || "all").trim().toLowerCase();
    const desiredStatus = String(statusFilter || "all").trim().toLowerCase();
    const desiredOwner = String(ownerFilter || "all").trim();

    const currentSearch = String(searchParams.get("q") || "").trim();
    const currentQueue = String(searchParams.get("queue") || "all").trim().toLowerCase();
    const currentStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
    const currentOwner = String(searchParams.get("ownerId") || "all").trim();

    const isUnchanged =
      desiredSearch === currentSearch &&
      desiredQueue === currentQueue &&
      desiredStatus === currentStatus &&
      desiredOwner === currentOwner;
    if (isUnchanged) return;

    const nextParams = new URLSearchParams(searchParams);
    if (!desiredSearch) nextParams.delete("q");
    else nextParams.set("q", desiredSearch);

    if (desiredQueue === "all") nextParams.delete("queue");
    else nextParams.set("queue", desiredQueue);

    if (desiredStatus === "all") nextParams.delete("status");
    else nextParams.set("status", desiredStatus);

    if (desiredOwner === "all") nextParams.delete("ownerId");
    else nextParams.set("ownerId", desiredOwner);

    setSearchParams(nextParams, { replace: true });
  }, [ownerFilter, queueFilter, search, searchParams, setSearchParams, statusFilter]);

  const isDefaultView =
    !search.trim() && statusFilter === "all" && queueFilter === "all" && ownerFilter === "all";

  const persistPipelineCache = useCallback(
    (nextContacts, nextMetrics) => {
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
    },
    [currentUserId, isDefaultView]
  );

  const fetchPipelineData = useCallback(
    async ({ silent = false } = {}) => {
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
        if (queueFilter !== "all") params.queue = queueFilter;
        if (ownerFilter !== "all") params.ownerId = ownerFilter;

        const [contactsResult, metricsResult, ownerDashboardResult] = await Promise.all([
          crmService.getContacts(params),
          crmService.getMetrics(),
          crmService.getOwnerDashboard()
        ]);

        if (contactsResult?.success === false) {
          throw new Error(contactsResult?.error || "Failed to load pipeline contacts");
        }
        if (metricsResult?.success === false) {
          throw new Error(metricsResult?.error || "Failed to load CRM metrics");
        }
        if (ownerDashboardResult?.success === false) {
          throw new Error(ownerDashboardResult?.error || "Failed to load CRM owner filters");
        }

        const rawContacts = contactsResult?.data || [];
        const nextContacts = (Array.isArray(rawContacts) ? rawContacts : []).map((contact) =>
          decorateCrmContact(contact)
        );
        const nextMetrics = metricsResult?.data || null;
        const nextOwners = Array.isArray(ownerDashboardResult?.data?.owners)
          ? ownerDashboardResult.data.owners
              .map(sanitizePipelineOwner)
              .filter((owner) => owner.ownerId)
          : [];

        setContacts(nextContacts);
        setMetrics(nextMetrics);
        setOwners(nextOwners);
        persistPipelineCache(nextContacts, nextMetrics);
      } catch (fetchError) {
        setError(fetchError?.message || "Failed to load CRM pipeline");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ownerFilter, persistPipelineCache, queueFilter, search, statusFilter]
  );

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchPipelineData({ silent: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPipelineData, ownerFilter, queueFilter, search, statusFilter]);

  useEffect(() => {
    const cachedPipeline = readSidebarPageCache(CRM_PIPELINE_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (Array.isArray(cachedPipeline?.data?.contacts)) {
      setContacts(cachedPipeline.data.contacts.map(decorateCrmContact));
      setMetrics(cachedPipeline?.data?.metrics || null);
      setLoading(false);
      fetchPipelineData({ silent: true });
      return;
    }

    fetchPipelineData();
  }, [currentUserId, fetchPipelineData]);

  useEffect(() => {
    const unsubscribe = addCrmContactSyncListener(() => {
      const now = Date.now();
      if (now - lastExternalSyncAtRef.current < 900) return;
      lastExternalSyncAtRef.current = now;
      fetchPipelineData({ silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, [fetchPipelineData]);

  const contactsByStage = useMemo(() => {
    const grouped = STAGE_ORDER.reduce((accumulator, stage) => {
      accumulator[stage.key] = [];
      return accumulator;
    }, {});

    contacts.forEach((contact) => {
      const stageKey = normalizeStage(contact?.stage);
      grouped[stageKey].push(contact);
    });

    return grouped;
  }, [contacts]);

  const handleStageMove = useCallback(
    async (contact, nextStage) => {
      const contactId = getContactId(contact);
      if (!contactId || !nextStage) return;

      try {
        setStageUpdatingId(contactId);
        setError("");
        const result = await crmService.updateContactStage(contactId, nextStage);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update stage");
        }

        const updated = result?.data || null;
        setContacts((previous) => {
          const nextContacts = previous.map((item) => {
            const itemId = getContactId(item);
            if (!itemId || itemId !== contactId) return item;
            return updated
              ? decorateCrmContact({ ...item, ...updated })
              : decorateCrmContact({ ...item, stage: nextStage });
          });

          persistPipelineCache(nextContacts, metrics);
          return nextContacts;
        });

        if (getContactId(selectedContact) === contactId) {
          setSelectedContact((previous) =>
            previous ? decorateCrmContact({ ...previous, ...(updated || { stage: nextStage }) }) : previous
          );
        }
        setToast({
          type: "success",
          message: `${contact?.name || "Lead"} moved to ${STAGE_ORDER.find((item) => item.key === nextStage)?.label || nextStage}.`
        });
      } catch (updateError) {
        setError(updateError?.message || "Failed to update stage");
        setToast({
          type: "error",
          message: updateError?.message || "Failed to update stage"
        });
      } finally {
        setStageUpdatingId("");
      }
    },
    [metrics, persistPipelineCache, selectedContact]
  );

  const handleStartWhatsAppTemplate = useCallback(
    (contact) => {
      navigate("/inbox", {
        state: buildWhatsAppOutreachState(contact, {
          openTemplateSendModal: true
        })
      });
    },
    [navigate]
  );

  const copyPublicOptInLink = useCallback(async (contact) => {
    const link = buildPublicWhatsAppOptInDemoUrl(contact, {
      source: "crm_pipeline_share",
      scope: "marketing"
    });
    if (!link) {
      setToast({ type: "error", message: "Unable to generate public opt-in link." });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setToast({ type: "success", message: "Public opt-in link copied." });
    } catch {
      setToast({ type: "error", message: "Clipboard blocked. Open the opt-in page and copy the link manually." });
    }
  }, []);

  const openPublicOptInLink = useCallback((contact) => {
    const link = buildPublicWhatsAppOptInDemoUrl(contact, {
      source: "crm_pipeline_share",
      scope: "marketing"
    });
    if (!link) {
      setToast({ type: "error", message: "Unable to generate public opt-in link." });
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    setToast({ type: "success", message: "Public opt-in page opened in a new tab." });
  }, []);

  const openContactDrawer = useCallback((contact) => {
    const normalizedId = getContactId(contact);
    setSelectedContactId(normalizedId);
    setSelectedContact(contact);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedContactId("");
    setSelectedContact(null);
  }, []);

  const handleContactUpdated = useCallback(
    (updatedContact) => {
      const normalizedId = getContactId(updatedContact);
      if (!normalizedId) return;

      const decoratedContact = decorateCrmContact(updatedContact);
      setSelectedContact(decoratedContact);
      setContacts((previous) => {
        const nextContacts = previous.map((contact) =>
          getContactId(contact) === normalizedId
            ? decorateCrmContact({ ...contact, ...updatedContact })
            : contact
        );
        persistPipelineCache(nextContacts, metrics);
        return nextContacts;
      });
    },
    [metrics, persistPipelineCache]
  );

  const handleTaskMutation = useCallback(() => {
    fetchPipelineData({ silent: true });
  }, [fetchPipelineData]);

  return (
    <>
      <div className="crm-workspace">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Pipeline"
          subtitle="Track WhatsApp leads, work queue by queue, and open each lead in a full Contact 360 drawer."
          actions={
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={() => fetchPipelineData({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          }
        />

        <div className="crm-metric-grid">
          <CrmMetricCard icon={TrendingUp} value={metrics?.contacts?.total ?? 0} label="Total Leads" />
          <CrmMetricCard icon={Funnel} value={metrics?.contacts?.qualified ?? 0} label="Qualified Leads" />
          <CrmMetricCard icon={Clock3} value={metrics?.tasks?.overdue ?? 0} label="Overdue Tasks" />
          <CrmMetricCard icon={Send} value={metrics?.contacts?.optedIn ?? 0} label="WhatsApp Opted In" />
        </div>

        <CrmOnboardingChecklist
          contactsCount={metrics?.contacts?.total ?? 0}
          tasksCount={metrics?.tasks?.open ?? 0}
          dealsCount={metrics?.deals?.open ?? 0}
        />

        <CrmFilterBar>
          <input
            type="text"
            className="crm-input"
            placeholder="Search leads by name, phone, email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="crm-select"
            value={queueFilter}
            onChange={(event) => setQueueFilter(event.target.value)}
          >
            {QUEUE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="crm-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {PIPELINE_STATUS_OPTIONS.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            className="crm-select"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
          >
            <option value="all">All Agents</option>
            {owners.map((owner) => (
              <option key={owner.ownerId || owner.ownerName} value={owner.ownerId}>
                {owner.ownerName || owner.ownerId}
              </option>
            ))}
          </select>
        </CrmFilterBar>

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {loading && <CrmPageSkeleton variant="board" />}

        {!loading && contacts.length === 0 && (
          <CrmEmptyState
            title="No leads match this CRM view."
            description="Try another queue or status filter, or bring in new leads from opt-in, Meta ads, or inbox activity."
          />
        )}

        {!loading && contacts.length > 0 && (
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
                      <article
                        key={contactId || `${stage.key}-${contact.phone}`}
                        className="crm-contact-card"
                      >
                        <div className="crm-contact-head">
                          <strong>{contact?.name || "Unknown"}</strong>
                          <span
                            className={`crm-status-badge status-${String(contact?.status || "nurturing").toLowerCase()}`}
                          >
                            {String(contact?.status || "nurturing")}
                          </span>
                        </div>
                        <p>{contact?.phone || "-"}</p>
                        <div className="crm-contact-chip-row">
                          <span
                            className={`crm-temperature-badge crm-temperature-badge--${String(contact?.temperature || "warm").toLowerCase()}`}
                          >
                            {String(contact?.temperature || "warm")}
                          </span>
                          <span
                            className={`crm-whatsapp-badge crm-whatsapp-badge--${contact?.whatsappState?.badgeTone || "template-only"}`}
                          >
                            {contact?.whatsappState?.statusLabel || "Template Only"}
                          </span>
                        </div>
                        <div className="crm-contact-meta">
                          <span>Score: {Number(contact?.leadScore || 0)}</span>
                          <span>Deal: {formatCurrency(contact?.dealValue)}</span>
                          <span>Owner: {contact?.ownerId || "Unassigned"}</span>
                          <span>Next: {formatDateTime(contact?.nextFollowUpAt)}</span>
                          <span>Source: {contact?.source || contact?.sourceType || "-"}</span>
                        </div>

                        <div className="crm-contact-actions">
                          <button
                            type="button"
                            className="crm-contact-action-btn"
                            onClick={() => handleStartWhatsAppTemplate(contact)}
                            disabled={contact?.whatsappState?.optedOut}
                          >
                            <Send size={14} />
                            Start WhatsApp
                          </button>
                          <button
                            type="button"
                            className="crm-contact-action-btn crm-contact-action-btn--secondary"
                            onClick={() => openContactDrawer(contact)}
                          >
                            Open CRM
                          </button>
                          <button
                            type="button"
                            className="crm-contact-action-btn crm-contact-action-btn--secondary"
                            onClick={() => copyPublicOptInLink(contact)}
                          >
                            <Copy size={14} />
                            Copy Opt-In
                          </button>
                          <button
                            type="button"
                            className="crm-contact-action-btn crm-contact-action-btn--secondary"
                            onClick={() => openPublicOptInLink(contact)}
                          >
                            <ExternalLink size={14} />
                            Open Opt-In
                          </button>
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

      <CrmContactDrawer
        open={Boolean(selectedContactId)}
        contactId={selectedContactId}
        initialContact={selectedContact}
        currentUserId={currentUserId}
        onClose={handleDrawerClose}
        onContactUpdated={handleContactUpdated}
        onTaskMutation={handleTaskMutation}
        onDealMutation={handleTaskMutation}
        onStartWhatsApp={handleStartWhatsAppTemplate}
      />
    </>
  );
};

export default CrmPipeline;
