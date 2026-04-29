import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeDollarSign, CalendarClock, Plus, RefreshCw, Search } from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmDealDrawer from "../components/crm/CrmDealDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmMetricCard from "../components/crm/CrmMetricCard";
import CrmFilterBar from "../components/crm/CrmFilterBar";
import CrmEmptyState from "../components/crm/CrmEmptyState";
import "./CrmWorkspace.css";

const CRM_DEALS_LOADING_TIMEOUT_MS = 8000;
const CRM_DEALS_CACHE_TTL_MS = 10 * 60 * 1000;
const CRM_DEALS_CACHE_NAMESPACE = "crm-deals-page";

const DEAL_STAGE_ORDER = [
  { key: "discovery", label: "Discovery" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const DEAL_STATUS_OPTIONS = [
  { key: "all", label: "All Statuses" },
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const sanitizeContact = (contact = {}) => ({
  _id: String(contact?._id || "").trim(),
  id: String(contact?.id || "").trim(),
  name: String(contact?.name || "").trim(),
  phone: String(contact?.phone || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  ownerId: String(contact?.ownerId || "").trim()
});

const sanitizeDeal = (deal = {}) => ({
  _id: String(deal?._id || "").trim(),
  id: String(deal?.id || "").trim(),
  title: String(deal?.title || "").trim(),
  stage: String(deal?.stage || "").trim(),
  status: String(deal?.status || "").trim(),
  value:
    Number.isFinite(Number(deal?.value)) && Number(deal?.value) >= 0 ? Number(deal.value) : 0,
  probability:
    Number.isFinite(Number(deal?.probability)) && Number(deal?.probability) >= 0
      ? Number(deal.probability)
      : 0,
  expectedCloseAt: String(deal?.expectedCloseAt || "").trim(),
  ownerId: String(deal?.ownerId || "").trim(),
  productName: String(deal?.productName || "").trim(),
  source: String(deal?.source || "").trim(),
  notes: String(deal?.notes || "").trim(),
  lostReason: String(deal?.lostReason || "").trim(),
  contactId: sanitizeContact(deal?.contactId)
});

const normalizeDealStage = (stage) => {
  const normalized = String(stage || "").trim().toLowerCase();
  return DEAL_STAGE_ORDER.some((item) => item.key === normalized) ? normalized : "discovery";
};

const CrmDeals = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    contactId: "",
    title: "",
    stage: "discovery",
    value: "",
    probability: "25",
    expectedCloseAt: "",
    productName: "",
    ownerId: "",
    source: ""
  });
  const hasInitializedFilterEffectRef = useRef(false);
  const currentUserId = resolveCacheUserId();
  const requestedSearchQuery = String(searchParams.get("q") || "").trim();
  const requestedStatusFilter = String(searchParams.get("status") || "all").trim().toLowerCase();
  const isDefaultView = !searchQuery.trim() && statusFilter === "all";

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (searchQuery !== requestedSearchQuery) {
      setSearchQuery(requestedSearchQuery);
    }

    const isValidStatus =
      requestedStatusFilter === "all" ||
      DEAL_STATUS_OPTIONS.some((option) => option.key === requestedStatusFilter);
    if (isValidStatus && statusFilter !== requestedStatusFilter) {
      setStatusFilter(requestedStatusFilter);
    }
  }, [requestedSearchQuery, requestedStatusFilter, searchQuery, statusFilter]);

  useEffect(() => {
    const desiredSearch = String(searchQuery || "").trim();
    const desiredStatus = String(statusFilter || "all").trim().toLowerCase();

    const currentSearch = String(searchParams.get("q") || "").trim();
    const currentStatus = String(searchParams.get("status") || "all").trim().toLowerCase();
    if (desiredSearch === currentSearch && desiredStatus === currentStatus) return;

    const nextParams = new URLSearchParams(searchParams);
    if (!desiredSearch) nextParams.delete("q");
    else nextParams.set("q", desiredSearch);

    if (desiredStatus === "all") nextParams.delete("status");
    else nextParams.set("status", desiredStatus);

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, searchQuery, setSearchParams, statusFilter]);

  const persistCache = useCallback(
    (nextDeals, nextContacts, nextMetrics) => {
      if (!isDefaultView) return;

      writeSidebarPageCache(
        CRM_DEALS_CACHE_NAMESPACE,
        {
          deals: (Array.isArray(nextDeals) ? nextDeals : [])
            .map(sanitizeDeal)
            .filter((deal) => deal._id || deal.id || deal.title),
          contacts: (Array.isArray(nextContacts) ? nextContacts : [])
            .map(sanitizeContact)
            .filter((contact) => contact._id || contact.id || contact.phone),
          metrics: nextMetrics || null
        },
        {
          currentUserId,
          ttlMs: CRM_DEALS_CACHE_TTL_MS
        }
      );
    },
    [currentUserId, isDefaultView]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (silent) setRefreshing(false);
          else setLoading(false);
        },
        CRM_DEALS_LOADING_TIMEOUT_MS
      );
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError("");

        const dealParams = { limit: 300 };
        if (statusFilter !== "all") dealParams.status = statusFilter;
        if (searchQuery.trim()) dealParams.search = searchQuery.trim();

        const [dealsResult, metricsResult, contactsResult] = await Promise.all([
          crmService.getDeals(dealParams),
          crmService.getDealMetrics(),
          crmService.getContacts({ limit: 300 })
        ]);

        if (dealsResult?.success === false) {
          throw new Error(dealsResult?.error || "Failed to load deals");
        }
        if (metricsResult?.success === false) {
          throw new Error(metricsResult?.error || "Failed to load deal metrics");
        }
        if (contactsResult?.success === false) {
          throw new Error(contactsResult?.error || "Failed to load contacts");
        }

        const nextDeals = Array.isArray(dealsResult?.data) ? dealsResult.data : [];
        const nextMetrics = metricsResult?.data || null;
        const nextContacts = Array.isArray(contactsResult?.data) ? contactsResult.data : [];

        setDeals(nextDeals);
        setMetrics(nextMetrics);
        setContacts(nextContacts);
        persistCache(nextDeals, nextContacts, nextMetrics);
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM deals");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [persistCache, searchQuery, statusFilter]
  );

  const handleRealtimeRefresh = useCallback(() => {
    loadData({ silent: true });
  }, [loadData]);

  useCrmRealtimeRefresh({
    currentUserId,
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    const cachedDeals = readSidebarPageCache(CRM_DEALS_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (Array.isArray(cachedDeals?.data?.deals)) {
      setDeals(cachedDeals.data.deals);
      setContacts(Array.isArray(cachedDeals?.data?.contacts) ? cachedDeals.data.contacts : []);
      setMetrics(cachedDeals?.data?.metrics || null);
      setLoading(false);
      loadData({ silent: true });
      return;
    }

    loadData();
  }, [currentUserId, loadData]);

  useEffect(() => {
    if (!hasInitializedFilterEffectRef.current) {
      hasInitializedFilterEffectRef.current = true;
      return undefined;
    }

    const timer = setTimeout(() => {
      loadData({ silent: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [loadData, searchQuery, statusFilter]);

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        id: getEntityId(contact),
        label: `${contact?.name || "Unknown"} (${contact?.phone || "-"})`
      })),
    [contacts]
  );

  const dealsByStage = useMemo(() => {
    const visibleDeals = deals.filter((deal) => {
      const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
      if (!normalizedQuery) return true;

      const contact = deal?.contactId || {};
      return (
        String(deal?.title || "").toLowerCase().includes(normalizedQuery) ||
        String(deal?.productName || "").toLowerCase().includes(normalizedQuery) ||
        String(deal?.source || "").toLowerCase().includes(normalizedQuery) ||
        String(contact?.name || "").toLowerCase().includes(normalizedQuery) ||
        String(contact?.phone || "").toLowerCase().includes(normalizedQuery)
      );
    });

    const grouped = DEAL_STAGE_ORDER.reduce((accumulator, stage) => {
      accumulator[stage.key] = [];
      return accumulator;
    }, {});

    visibleDeals.forEach((deal) => {
      const stageKey = normalizeDealStage(deal?.stage);
      grouped[stageKey].push(deal);
    });

    return grouped;
  }, [deals, searchQuery]);

  const handleCreateDeal = useCallback(
    async (event) => {
      event.preventDefault();
      try {
        setSubmitting(true);
        setError("");

        if (!form.contactId) throw new Error("Select a contact");
        if (!String(form.title || "").trim()) throw new Error("Deal title is required");

        const payload = {
          contactId: form.contactId,
          title: String(form.title || "").trim(),
          stage: form.stage || "discovery",
          status: ["won", "lost"].includes(form.stage) ? form.stage : "open",
          value: form.value ? Number(form.value) : 0,
          probability: form.probability ? Number(form.probability) : 0,
          productName: String(form.productName || "").trim(),
          ownerId: String(form.ownerId || "").trim() || null,
          source: String(form.source || "").trim()
        };
        if (form.expectedCloseAt) {
          const parsed = new Date(form.expectedCloseAt);
          if (!Number.isNaN(parsed.getTime())) {
            payload.expectedCloseAt = parsed.toISOString();
          }
        }

        const result = await crmService.createDeal(payload);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to create deal");
        }

        setForm({
          contactId: "",
          title: "",
          stage: "discovery",
          value: "",
          probability: "25",
          expectedCloseAt: "",
          productName: "",
          ownerId: "",
          source: ""
        });
        await loadData({ silent: true });
        setToast({ type: "success", message: "Deal created successfully." });
      } catch (submitError) {
        setError(submitError?.message || "Failed to create deal");
        setToast({
          type: "error",
          message: submitError?.message || "Failed to create deal"
        });
      } finally {
        setSubmitting(false);
      }
    },
    [form, loadData]
  );

  const handleDealSaved = useCallback(
    async () => {
      await loadData({ silent: true });
      setToast({ type: "success", message: "Deal updated successfully." });
    },
    [loadData]
  );

  const handleDealDeleted = useCallback(
    async () => {
      setSelectedDeal(null);
      await loadData({ silent: true });
      setToast({ type: "success", message: "Deal deleted." });
    },
    [loadData]
  );

  const openContactDrawer = useCallback((contact) => {
    const normalizedId = getEntityId(contact);
    if (!normalizedId) return;
    setSelectedContact(contact);
    setSelectedContactId(normalizedId);
  }, []);

  return (
    <>
      <div className="crm-workspace">
        <CrmToast toast={toast} />
        <CrmPageHeader
          title="CRM Deals"
          subtitle="Track opportunities by stage, expected revenue, and closing probability."
          actions={
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={() => loadData({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          }
        />

        <div className="crm-summary-grid">
          <CrmMetricCard icon={BadgeDollarSign} value={metrics?.open ?? 0} label="Open Deals" />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.pipelineValue)}
            label="Pipeline Value"
          />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.weightedValue)}
            label="Weighted Value"
          />
          <CrmMetricCard
            icon={BadgeDollarSign}
            value={formatCurrency(metrics?.wonValue)}
            label="Won Revenue"
          />
          <CrmMetricCard icon={CalendarClock} value={metrics?.won ?? 0} label="Won Deals" />
        </div>

        <form className="crm-create-task" onSubmit={handleCreateDeal}>
          <h3>
            <Plus size={16} />
            Create Deal
          </h3>
          <div className="crm-create-task-grid crm-create-task-grid--wide">
            <select
              className="crm-select"
              value={form.contactId}
              onChange={(event) => setForm((previous) => ({ ...previous, contactId: event.target.value }))}
            >
              <option value="">Select Contact</option>
              {contactOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="crm-input"
              placeholder="Deal title"
              value={form.title}
              onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            />
            <select
              className="crm-select"
              value={form.stage}
              onChange={(event) => setForm((previous) => ({ ...previous, stage: event.target.value }))}
            >
              {DEAL_STAGE_ORDER.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              className="crm-input"
              placeholder="Deal value"
              value={form.value}
              onChange={(event) => setForm((previous) => ({ ...previous, value: event.target.value }))}
            />
            <input
              type="number"
              min="0"
              max="100"
              className="crm-input"
              placeholder="Probability %"
              value={form.probability}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, probability: event.target.value }))
              }
            />
            <input
              type="datetime-local"
              className="crm-input"
              value={form.expectedCloseAt}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, expectedCloseAt: event.target.value }))
              }
            />
          </div>
          <div className="crm-create-task-grid">
            <input
              type="text"
              className="crm-input"
              placeholder="Product / Service"
              value={form.productName}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, productName: event.target.value }))
              }
            />
            <input
              type="text"
              className="crm-input"
              placeholder="Owner ID (optional)"
              value={form.ownerId}
              onChange={(event) => setForm((previous) => ({ ...previous, ownerId: event.target.value }))}
            />
            <input
              type="text"
              className="crm-input"
              placeholder="Source"
              value={form.source}
              onChange={(event) => setForm((previous) => ({ ...previous, source: event.target.value }))}
            />
          </div>
          <button type="submit" className="crm-btn crm-btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Deal"}
          </button>
        </form>

        <CrmFilterBar>
          <label className="crm-search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              className="crm-input crm-input--inline"
              placeholder="Search deals by title, product, source..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select
            className="crm-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {DEAL_STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </CrmFilterBar>

        {error && <div className="crm-alert crm-alert-error">{error}</div>}
        {loading && <CrmPageSkeleton variant="board" />}

        {!loading && deals.length === 0 && (
          <CrmEmptyState
            title="No deals match this view."
            description="Create a new opportunity above or clear the current search/status filters."
          />
        )}

        {!loading && deals.length > 0 && (
          <div className="crm-deal-board">
            {DEAL_STAGE_ORDER.map((stage) => (
              <section key={stage.key} className="crm-stage-column">
                <header className="crm-stage-header">
                  <h3>{stage.label}</h3>
                  <span>{dealsByStage[stage.key]?.length || 0}</span>
                </header>
                <div className="crm-stage-list">
                  {(dealsByStage[stage.key] || []).map((deal) => {
                    const dealId = getEntityId(deal);
                    const contact = deal?.contactId || {};
                    return (
                      <article key={dealId} className="crm-deal-card">
                        <div className="crm-deal-card-head">
                          <strong>{deal?.title || "Untitled Deal"}</strong>
                          <span className={`crm-status-badge status-${String(deal?.status || "open").toLowerCase()}`}>
                            {String(deal?.status || "open")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="crm-link-btn"
                          onClick={() => openContactDrawer(contact)}
                        >
                          {contact?.name || "Unknown contact"}
                        </button>
                        <p>{contact?.phone || "-"}</p>
                        <div className="crm-deal-meta">
                          <span>
                            <BadgeDollarSign size={13} />
                            {formatCurrency(deal?.value)}
                          </span>
                          <span>
                            <CalendarClock size={13} />
                            {formatDate(deal?.expectedCloseAt)}
                          </span>
                          <span>{Number(deal?.probability || 0)}% probability</span>
                          <span>{deal?.productName || "No product set"}</span>
                          <span>{deal?.ownerId || "Unassigned"}</span>
                        </div>
                        <div className="crm-inline-actions">
                          <button
                            type="button"
                            className="crm-contact-action-btn"
                            onClick={() => setSelectedDeal(deal)}
                          >
                            Edit Deal
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {(dealsByStage[stage.key] || []).length === 0 && (
                    <div className="crm-empty-column">No deals in {stage.label}</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CrmDealDrawer
        open={Boolean(selectedDeal)}
        deal={selectedDeal}
        currentUserId={currentUserId}
        onClose={() => setSelectedDeal(null)}
        onSaved={handleDealSaved}
        onDeleted={handleDealDeleted}
        onOpenContact={(contact) => {
          const normalizedId = getEntityId(contact);
          if (!normalizedId) return;
          setSelectedDeal(null);
          setSelectedContact(contact);
          setSelectedContactId(normalizedId);
        }}
      />

      <CrmContactDrawer
        open={Boolean(selectedContactId)}
        contactId={selectedContactId}
        initialContact={selectedContact}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedContact(null);
          setSelectedContactId("");
        }}
        onContactUpdated={(updatedContact) => {
          setSelectedContact(updatedContact);
          setContacts((previous) =>
            previous.map((contact) =>
              getEntityId(contact) === getEntityId(updatedContact)
                ? { ...contact, ...updatedContact }
                : contact
            )
          );
          setDeals((previous) =>
            previous.map((deal) =>
              getEntityId(deal?.contactId) === getEntityId(updatedContact)
                ? { ...deal, contactId: { ...(deal?.contactId || {}), ...updatedContact } }
                : deal
            )
          );
        }}
        onTaskMutation={() => loadData({ silent: true })}
        onDealMutation={() => loadData({ silent: true })}
      />
    </>
  );
};

export default CrmDeals;
