import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  ListChecks,
  RefreshCw,
  Search,
  Users
} from "lucide-react";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import { readSidebarPageCache, resolveCacheUserId, writeSidebarPageCache } from "../utils/sidebarPageCache";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import CrmPageHeader from "../components/crm/CrmPageHeader";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import "./CrmWorkspace.css";

const CRM_FOLLOWUPS_LOADING_TIMEOUT_MS = 8000;
const CRM_FOLLOWUPS_CACHE_TTL_MS = 10 * 60 * 1000;
const CRM_FOLLOWUPS_CACHE_NAMESPACE = "crm-followups-page";
const FOLLOWUP_CONTACT_PAGE_SIZE = 250;
const FOLLOWUP_CONTACT_MAX_PAGES = 40;

const normalizeTaskApiList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.contacts)) return value.contacts;
  return [];
};

const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const parsed = safeDate(value);
  return parsed ? parsed.toLocaleString() : "-";
};

const formatDateTimeShort = (value) => {
  const parsed = safeDate(value);
  return parsed
    ? parsed.toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";
};

const toDayKey = (value) => {
  const parsed = safeDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const sanitizeFollowUpContact = (contact = {}) => ({
  _id: String(contact?._id || contact?.id || "").trim(),
  id: String(contact?.id || contact?._id || "").trim(),
  name: String(contact?.name || contact?.displayName || "").trim(),
  phone: String(contact?.phone || contact?.mobile || contact?.phoneNumber || "").trim(),
  email: String(contact?.email || "").trim(),
  ownerId: String(contact?.ownerId || "").trim(),
  leadStatus: String(contact?.leadStatus || contact?.status || "").trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  followupAt: String(contact?.followupAt || contact?.nextFollowUpAt || contact?.followupDate || "").trim(),
  nextFollowUpAt: String(contact?.nextFollowUpAt || contact?.followupAt || contact?.followupDate || "").trim(),
  createdAt: String(contact?.createdAt || "").trim(),
  updatedAt: String(contact?.updatedAt || "").trim()
});

const resolveBucket = (contact = {}) => {
  const dueAt = safeDate(contact?.followupAt || contact?.nextFollowUpAt || contact?.followupDate);
  if (!dueAt) return "none";

  const now = new Date();
  const todayKey = toDayKey(now);
  const dueKey = toDayKey(dueAt);
  if (dueAt.getTime() < now.getTime()) return "overdue";
  if (dueKey && dueKey === todayKey) return "due_today";
  return "upcoming";
};

const matchesSearch = (contact = {}, search = "") => {
  const normalized = String(search || "").trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    contact?.name,
    contact?.phone,
    contact?.email,
    contact?.ownerId,
    contact?.leadStatus,
    contact?.followupAt,
    contact?.nextFollowUpAt
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes(normalized);
};

const CrmFollowUps = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const cacheUserId = resolveCacheUserId();
  const requestedBucketFilter = String(searchParams.get("bucket") || "all").trim().toLowerCase();
  const requestedSearchQuery = String(searchParams.get("q") || "").trim();
  const requestedOwnerFilter = String(searchParams.get("ownerId") || "all").trim();
  const cachedSnapshot = useMemo(
    () =>
      readSidebarPageCache(CRM_FOLLOWUPS_CACHE_NAMESPACE, {
        currentUserId: cacheUserId,
        allowStale: true
      }),
    [cacheUserId]
  );
  const cachedContacts = useMemo(() => {
    const rawContacts = Array.isArray(cachedSnapshot?.data?.contacts) ? cachedSnapshot.data.contacts : [];
    return rawContacts.map(sanitizeFollowUpContact).filter((contact) =>
      String(contact?.followupAt || contact?.nextFollowUpAt || contact?.followupDate || "").trim()
    );
  }, [cachedSnapshot]);

  const [contacts, setContacts] = useState(() => cachedContacts);
  const [loading, setLoading] = useState(() => cachedContacts.length === 0);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState(requestedSearchQuery);
  const [bucketFilter, setBucketFilter] = useState(
    ["all", "overdue", "due_today", "upcoming", "none"].includes(requestedBucketFilter)
      ? requestedBucketFilter
      : "all"
  );
  const [ownerFilter, setOwnerFilter] = useState(requestedOwnerFilter || "all");
  const contactsRef = useRef(cachedContacts);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  const loadContacts = useCallback(async ({ silent = false } = {}) => {
    const releaseLoadingGuard = startLoadingTimeoutGuard(
      () => {
        if (!silent) setLoading(false);
      },
      CRM_FOLLOWUPS_LOADING_TIMEOUT_MS
    );

    try {
      if (!silent) setLoading(true);
      setError("");

      const collectedContacts = [];
      let currentPage = 1;
      let shouldContinue = true;

      while (shouldContinue && currentPage <= FOLLOWUP_CONTACT_MAX_PAGES) {
        const result = await crmService.getContacts({
          page: currentPage,
          pageSize: FOLLOWUP_CONTACT_PAGE_SIZE,
          hasFollowUp: "true"
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load follow-up contacts");
        }

        const responseData = result?.data || {};
        const pageContacts = normalizeTaskApiList(responseData).map(sanitizeFollowUpContact);
        const pageFollowUps = pageContacts.filter((contact) =>
          String(contact?.followupAt || contact?.nextFollowUpAt || contact?.followupDate || "").trim()
        );
        const nextMeta = responseData?.meta || {};

        collectedContacts.push(...pageFollowUps);

        const explicitPageSize = Number(nextMeta.pageSize || nextMeta.limit || 0);
        const pageSize = Number.isFinite(explicitPageSize) && explicitPageSize > 0 ? explicitPageSize : null;
        const totalCount = Number(nextMeta.totalCount);
        const totalPages = Number.isFinite(totalCount) && totalCount > 0 && pageSize
          ? Math.max(1, Math.ceil(totalCount / pageSize))
          : null;
        const serverSaysMore =
          nextMeta?.hasMore === true ||
          nextMeta?.exhausted === false ||
          Boolean(String(nextMeta?.nextCursor || "").trim());

        if (pageContacts.length === 0) {
          shouldContinue = false;
        } else if (totalPages && currentPage >= totalPages) {
          shouldContinue = false;
        } else if (pageSize && pageContacts.length < pageSize) {
          shouldContinue = false;
        } else if (nextMeta?.hasMore === false || nextMeta?.exhausted === true) {
          shouldContinue = false;
        } else {
          currentPage += 1;
        }
      }

      const nextContacts = collectedContacts.filter((contact) =>
        String(contact?.followupAt || contact?.nextFollowUpAt || contact?.followupDate || "").trim()
      );
      setContacts(nextContacts);
      writeSidebarPageCache(
        CRM_FOLLOWUPS_CACHE_NAMESPACE,
        { contacts: nextContacts },
        { currentUserId: cacheUserId, ttlMs: CRM_FOLLOWUPS_CACHE_TTL_MS }
      );
    } catch (loadError) {
      if (!silent || contactsRef.current.length === 0) {
        setError(loadError?.message || "Failed to load follow-up contacts");
      }
    } finally {
      releaseLoadingGuard();
      setLoading(false);
    }
  }, [cacheUserId]);

  useEffect(() => {
    if (cachedContacts.length > 0) {
      setContacts(cachedContacts);
      setLoading(false);
      void loadContacts({ silent: true });
      return;
    }

    loadContacts();
  }, [loadContacts]);

  const crmRealtime = useCrmRealtimeRefresh({
    entities: ["contact"],
    onRefresh: () => loadContacts({ silent: true })
  });

  useEffect(() => {
    if (searchInput === requestedSearchQuery) return undefined;
    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams);
      const query = String(searchInput || "").trim();
      if (!query) nextParams.delete("q");
      else nextParams.set("q", query);
      setSearchParams(nextParams, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [requestedSearchQuery, searchInput, searchParams, setSearchParams]);

  useEffect(() => {
    setBucketFilter(["all", "overdue", "due_today", "upcoming", "none"].includes(requestedBucketFilter)
      ? requestedBucketFilter
      : "all");
    setOwnerFilter(requestedOwnerFilter || "all");
    setSearchInput(requestedSearchQuery);
  }, [requestedBucketFilter, requestedOwnerFilter, requestedSearchQuery]);

  useEffect(() => {
    if (cachedContacts.length > 0) {
      setContacts(cachedContacts);
    }
  }, [cachedContacts]);

  const ownerOptions = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      const value = String(contact?.ownerId || "").trim();
      if (!value) return;
      if (!map.has(value)) map.set(value, value);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const search = String(searchInput || "").trim();
    return contacts
      .filter((contact) => {
        const bucket = resolveBucket(contact);
        if (bucketFilter !== "all" && bucket !== bucketFilter) return false;
        if (ownerFilter !== "all" && String(contact?.ownerId || "").trim() !== ownerFilter) {
          return false;
        }
        return matchesSearch(contact, search);
      })
      .sort((left, right) => {
        const leftTime =
          safeDate(left?.followupAt || left?.nextFollowUpAt || left?.followupDate || left?.updatedAt || left?.createdAt)?.getTime() || 0;
        const rightTime =
          safeDate(right?.followupAt || right?.nextFollowUpAt || right?.followupDate || right?.updatedAt || right?.createdAt)?.getTime() || 0;
        return leftTime - rightTime;
      });
  }, [bucketFilter, contacts, ownerFilter, searchInput]);

  const summary = useMemo(() => {
    return contacts.reduce(
      (acc, contact) => {
        const bucket = resolveBucket(contact);
        acc.total += 1;
        if (bucket === "overdue") acc.overdue += 1;
        if (bucket === "due_today") acc.dueToday += 1;
        if (bucket === "upcoming") acc.upcoming += 1;
        if (bucket === "none") acc.none += 1;
        return acc;
      },
      { total: 0, overdue: 0, dueToday: 0, upcoming: 0, none: 0 }
    );
  }, [contacts]);

  const followUpStats = [
    { key: "all", label: "Total", value: summary.total, icon: ListChecks },
    { key: "overdue", label: "Overdue", value: summary.overdue, icon: AlertCircle },
    { key: "due_today", label: "Due Today", value: summary.dueToday, icon: CalendarClock },
    { key: "upcoming", label: "Upcoming", value: summary.upcoming, icon: BadgeCheck },
    { key: "none", label: "Unset", value: summary.none, icon: Users }
  ];

  const handleApplyBucket = useCallback(
    (value) => {
      const nextBucket = ["all", "overdue", "due_today", "upcoming", "none"].includes(value)
        ? value
        : "all";
      setBucketFilter(nextBucket);
      const nextParams = new URLSearchParams(searchParams);
      if (nextBucket === "all") nextParams.delete("bucket");
      else nextParams.set("bucket", nextBucket);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleOwnerChange = useCallback(
    (value) => {
      const nextValue = String(value || "all").trim() || "all";
      setOwnerFilter(nextValue);
      const nextParams = new URLSearchParams(searchParams);
      if (nextValue === "all") nextParams.delete("ownerId");
      else nextParams.set("ownerId", nextValue);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setBucketFilter("all");
    setOwnerFilter("all");
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  if (loading && contacts.length === 0) {
    return <CrmPageSkeleton />;
  }

  const isTasksRoute = String(location.pathname || "").includes("/crm/tasks");
  const isFollowUpsRoute = String(location.pathname || "").includes("/crm/follow-ups");

  return (
    <div className="crm-workspace">
      <CrmPageHeader
        title="Follow Ups"
        subtitle="Only contacts with a saved next follow-up date appear here. Quick tasks stay in CRM Tasks."
        actions={
          <div className="crm-page-header__action-group">
            <div className="crm-page-switcher" aria-label="CRM page switcher">
              <button
                type="button"
                className={`crm-btn crm-btn--compact ${
                  isTasksRoute ? "crm-btn-primary" : "crm-btn-secondary"
                }`}
                onClick={() => navigate("/crm/tasks")}
              >
                Tasks
              </button>
              <button
                type="button"
                className={`crm-btn crm-btn--compact ${
                  isFollowUpsRoute ? "crm-btn-primary" : "crm-btn-secondary"
                }`}
                onClick={() => navigate("/crm/follow-ups")}
              >
                Follow Ups
              </button>
            </div>
            <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn--compact"
              onClick={() => loadContacts({ silent: false })}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="crm-summary-grid crm-summary-grid--tasks">
        {followUpStats.map((card) => {
          const Icon = card.icon;
          const active = bucketFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              className={`crm-summary-card crm-summary-card--button ${active ? "crm-summary-card--active" : ""}`}
              onClick={() => handleApplyBucket(card.key)}
            >
              <div className="crm-summary-card__top">
                <span className="crm-summary-card__icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <strong>{card.value}</strong>
              </div>
              <span className="crm-summary-card__label">{card.label}</span>
            </button>
          );
        })}
      </div>

      <div className="crm-filter-bar crm-followups-filter-bar">
        <label className="crm-field crm-field--search">
          <span className="sr-only">Search follow-ups</span>
          <span className="crm-search-input-wrap">
            <Search size={16} />
            <input
              type="search"
              className="crm-input"
              placeholder="Search contact, phone, owner, or date"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </span>
        </label>

        <label className="crm-field">
          <span>Bucket</span>
          <select
            className="crm-select"
            value={bucketFilter}
            onChange={(event) => handleApplyBucket(event.target.value)}
          >
            <option value="all">All follow-ups</option>
            <option value="overdue">Overdue</option>
            <option value="due_today">Due Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="none">Unset</option>
          </select>
        </label>

        <label className="crm-field">
          <span>Owner</span>
          <select className="crm-select" value={ownerFilter} onChange={(event) => handleOwnerChange(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="crm-btn crm-btn-secondary" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {error ? <div className="crm-alert crm-alert-error">{error}</div> : null}

      <div className="crm-task-table-wrap">
        <table className="crm-task-table crm-task-table--expanded">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Follow-up</th>
              <th>Owner</th>
              <th>Saved On</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => {
        const contactId =
          getEntityId(contact) ||
          `${contact?.name || "contact"}-${contact?.followupAt || contact?.nextFollowUpAt || ""}`;
                const bucket = resolveBucket(contact);
                const bucketLabel =
                  bucket === "overdue"
                    ? "Overdue"
                    : bucket === "due_today"
                      ? "Due Today"
                      : bucket === "upcoming"
                        ? "Upcoming"
                        : "Unset";

                return (
                  <tr key={contactId}>
                    <td className="crm-task-col-contact">
                      <strong>{contact?.name || "Unknown contact"}</strong>
                      <span className="crm-task-cell-line">{contact?.phone || "-"}</span>
                      {contact?.email ? <span className="crm-task-cell-line">{contact.email}</span> : null}
                    </td>
                    <td className="crm-task-col-task">
                      <div className="crm-task-primary">
                        <strong className="crm-task-title">{formatDateTimeShort(contact?.followupAt || contact?.nextFollowUpAt)}</strong>
                        <p className="crm-task-description">
                          {contact?.leadStatus || "Lead status not set"}
                        </p>
                        <div className="crm-task-chip-row">
                          <span className="crm-task-chip">Saved follow-up</span>
                          <span className={`crm-priority-badge priority-${bucket}`}>
                            {bucketLabel}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="crm-task-col-assignee">
                      <strong className="crm-task-assignee-value">{contact?.ownerId || "Unassigned"}</strong>
                      <span className="crm-task-cell-line">Lead score: {Number(contact?.leadScore || 0)}</span>
                    </td>
                    <td className="crm-task-col-schedule">
                      <span className="crm-task-cell-line">Created: {formatDateTime(contact?.createdAt)}</span>
                      <span className="crm-task-cell-line">Updated: {formatDateTime(contact?.updatedAt)}</span>
                    </td>
                    <td className="crm-task-col-schedule">
                      <span className="crm-task-cell-line">
                        Follow-up: {formatDateTime(contact?.followupAt || contact?.nextFollowUpAt)}
                      </span>
                      <span className="crm-task-cell-line">Bucket: {bucketLabel}</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="crm-activity-empty">
                    No saved follow-ups match this view. Try another bucket or clear filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CrmFollowUps;
