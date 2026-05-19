import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, X, Filter, Plus, Minus } from "lucide-react";
import { TableVirtuoso } from "react-virtuoso";
import { apiClient } from "../../services/whatsappapi";
import "./Modal.css";
import "./ContactAudiencePickerModal.css";

const CONTACT_PAGE_LIMIT = 50;
const CONTACT_SELECT_ALL_LIMIT = 500;
const CONTACT_TABLE_HEIGHT = 420;

const normalizeText = (value = "") => String(value || "").trim();

const getContactSelectionKey = (contact = {}) =>
  String(
    contact?._id ||
      contact?.id ||
      contact?.contactId ||
      contact?.phone ||
      contact?.mobile ||
      contact?.phoneNumber ||
      contact?.whatsappNumber ||
      "",
  ).trim();

const getContactLabel = (contact = {}, index = 0) => {
  const name =
    normalizeText(contact?.name) ||
    normalizeText(contact?.displayName) ||
    normalizeText(contact?.contactName);
  const phone =
    normalizeText(contact?.phone) ||
    normalizeText(contact?.mobile) ||
    normalizeText(contact?.phoneNumber) ||
    normalizeText(contact?.whatsappNumber);
  if (name && phone) return `${name} - ${phone}`;
  if (name) return name;
  if (phone) return phone;
  return `Contact ${index + 1}`;
};

const ContactAudiencePickerTable = React.forwardRef(
  ({ style, className = "", ...props }, ref) => (
    <table
      {...props}
      ref={ref}
      className={`broadcast-validation-table ${className}`.trim()}
      style={{
        ...style,
        width: "100%",
        tableLayout: "fixed",
      }}
    />
  ),
);
ContactAudiencePickerTable.displayName = "ContactAudiencePickerTable";

const ContactAudiencePickerTableRow = ({
  children,
  item,
  context,
  ...props
}) => {
  const toggleContact = context?.toggleContact;

  const handleRowClick = (event) => {
    if (typeof props?.onClick === "function") {
      props.onClick(event);
    }
    if (event?.defaultPrevented) return;
    if (typeof toggleContact === "function") {
      toggleContact(item);
    }
  };

  return (
    <tr
      {...props}
      onClick={handleRowClick}
      style={{ ...props.style, cursor: "pointer" }}
    >
      {children}
    </tr>
  );
};
ContactAudiencePickerTableRow.displayName = "ContactAudiencePickerTableRow";

const ContactAudiencePickerModal = ({
  open,
  onClose,
  onConfirm,
  initialSelectedContacts = [],
  initialSourceType = "all",
}) => {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [optInFilter, setOptInFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [marketingEligibleOnly, setMarketingEligibleOnly] = useState(false);
  const [recentlyInteractedOnly, setRecentlyInteractedOnly] = useState(false);
  const [pageCursor, setPageCursor] = useState("");
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [matchedContactsCount, setMatchedContactsCount] = useState(0);
  const contactsLoadSeqRef = useRef(0);
  const selectAllSeqRef = useRef(0);
  const wasOpenRef = useRef(false);
  const hydratedSelectionSignatureRef = useRef("");
  const initialSourceTypeRef = useRef("all");
  const querySignature = useMemo(
    () =>
      JSON.stringify({
        searchTerm: normalizeText(debouncedSearchTerm),
        tagFilter: normalizeText(tagFilter),
        optInFilter,
        sourceTypeFilter,
        marketingEligibleOnly,
        recentlyInteractedOnly,
      }),
    [
      debouncedSearchTerm,
      tagFilter,
      optInFilter,
      sourceTypeFilter,
      marketingEligibleOnly,
      recentlyInteractedOnly,
    ],
  );
  const initialSelectedContactsSignature = useMemo(
    () =>
      (Array.isArray(initialSelectedContacts) ? initialSelectedContacts : [])
        .map((contact) => getContactSelectionKey(contact))
        .filter(Boolean)
        .join("|"),
    [initialSelectedContacts],
  );
  const prevQuerySignatureRef = useRef(querySignature);

  useEffect(() => {
    const timerId = window.setTimeout(
      () => {
        setDebouncedSearchTerm(searchTerm);
      },
      normalizeText(searchTerm) ? 250 : 0,
    );

    return () => window.clearTimeout(timerId);
  }, [searchTerm]);

  const normalizeContactToRecipient = (contact = {}) => ({
    _id: getContactSelectionKey(contact),
    phone:
      normalizeText(contact?.phone) ||
      normalizeText(contact?.mobile) ||
      normalizeText(contact?.phoneNumber) ||
      normalizeText(contact?.whatsappNumber),
    name: normalizeText(
      contact?.name || contact?.displayName || contact?.contactName,
    ),
    sourceType: normalizeText(contact?.sourceType || "manual") || "manual",
    whatsappOptInStatus:
      normalizeText(contact?.whatsappOptInStatus || "unknown") || "unknown",
    variables: [],
    data: contact,
    fullData: contact,
  });

  const buildContactQueryParams = useCallback(
    (includePagination = true, cursor = pageCursor) => {
      const params = {
        marketingEligible: marketingEligibleOnly ? "true" : "false",
        recentlyInteractedOnly: recentlyInteractedOnly ? "true" : "false",
      };

      if (includePagination) {
        params.limit = CONTACT_PAGE_LIMIT;
        if (cursor) {
          params.cursor = cursor;
        }
      }

      if (normalizeText(debouncedSearchTerm))
        params.search = normalizeText(debouncedSearchTerm);
      if (normalizeText(tagFilter)) params.tags = normalizeText(tagFilter);
      if (optInFilter !== "all") params.whatsappOptInStatus = optInFilter;
      if (sourceTypeFilter !== "all") params.sourceType = sourceTypeFilter;

      return params;
    },
    [
      marketingEligibleOnly,
      recentlyInteractedOnly,
      pageCursor,
      debouncedSearchTerm,
      tagFilter,
      optInFilter,
      sourceTypeFilter,
    ],
  );

  useEffect(() => {
    if (!open) return;

    const isOpening = !wasOpenRef.current;
    const shouldHydrateSelection =
      isOpening ||
      hydratedSelectionSignatureRef.current !==
        initialSelectedContactsSignature;

    wasOpenRef.current = true;

    if (!shouldHydrateSelection) {
      return;
    }

    hydratedSelectionSignatureRef.current = initialSelectedContactsSignature;
    initialSourceTypeRef.current =
      normalizeText(initialSourceType || "all").toLowerCase() || "all";
    contactsLoadSeqRef.current += 1;
    selectAllSeqRef.current += 1;
    setSelectAllLoading(false);
    setContacts([]);
    setSelectedContacts(
      (Array.isArray(initialSelectedContacts) ? initialSelectedContacts : [])
        .map((contact) => normalizeContactToRecipient(contact))
        .filter((contact) => contact.phone),
    );
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setTagFilter("");
    setOptInFilter("all");
    setSourceTypeFilter(initialSourceTypeRef.current);
    setMarketingEligibleOnly(false);
    setRecentlyInteractedOnly(false);
    setPageCursor("");
    setNextCursor("");
    setHasMore(true);
    setError("");
    setMatchedContactsCount(0);
  }, [
    open,
    initialSelectedContactsSignature,
    initialSelectedContacts,
    initialSourceType,
  ]);

  useEffect(() => {
    if (!open) return undefined;

    const isNewQuery = prevQuerySignatureRef.current !== querySignature;
    if (isNewQuery) {
      prevQuerySignatureRef.current = querySignature;
      selectAllSeqRef.current += 1;
      contactsLoadSeqRef.current += 1;
      setSelectAllLoading(false);
      setContacts([]);
      setHasMore(true);
      setNextCursor("");
      setMatchedContactsCount(0);
      if (pageCursor) {
        setPageCursor("");
        return undefined;
      }
    }

    let cancelled = false;
    const requestSeq = ++contactsLoadSeqRef.current;
    const effectiveCursor = isNewQuery ? "" : pageCursor;

    const fetchContacts = async () => {
      setLoading(true);
      setError("");
      try {
        const params = buildContactQueryParams(true, effectiveCursor);
        const response = await apiClient.getContacts(params);
        const payload = response?.data?.data ?? response?.data ?? [];
        const nextContacts = Array.isArray(payload) ? payload : [];
        const totalCount = Number(response?.headers?.["x-total-count"] || 0);
        const meta = response?.data?.meta || {};

        if (cancelled || requestSeq !== contactsLoadSeqRef.current) return;

        const normalizedContacts = nextContacts
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((contact) => contact.phone);

        if (cancelled || requestSeq !== contactsLoadSeqRef.current) return;

        setContacts((previous) =>
          effectiveCursor
            ? [...previous, ...normalizedContacts]
            : normalizedContacts,
        );
        setHasMore(Boolean(meta?.hasMore));
        setNextCursor(String(meta?.nextCursor || "").trim());
        setMatchedContactsCount(
          Number.isFinite(totalCount) ? totalCount : normalizedContacts.length,
        );
      } catch (fetchError) {
        if (!cancelled && requestSeq === contactsLoadSeqRef.current) {
          setError(
            fetchError?.response?.data?.error ||
              fetchError?.message ||
              "Failed to load contacts.",
          );
        }
      } finally {
        if (!cancelled && requestSeq === contactsLoadSeqRef.current)
          setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      cancelled = true;
    };
  }, [open, pageCursor, querySignature, buildContactQueryParams]);

  useEffect(() => {
    if (open) return undefined;
    wasOpenRef.current = false;
    contactsLoadSeqRef.current += 1;
    selectAllSeqRef.current += 1;
    setSelectAllLoading(false);
    return undefined;
  }, [open]);

  const selectedIds = useMemo(
    () =>
      new Set(
        selectedContacts
          .map((contact) => getContactSelectionKey(contact))
          .filter(Boolean),
      ),
    [selectedContacts],
  );

  const toggleContact = useCallback((contact) => {
    const normalized = normalizeContactToRecipient(contact);
    if (!normalized.phone) return;
    setSelectedContacts((previous) => {
      const exists = previous.some(
        (item) => getContactSelectionKey(item) === normalized._id,
      );
      if (exists) {
        return previous.filter(
          (item) => getContactSelectionKey(item) !== normalized._id,
        );
      }
      return [...previous, normalized];
    });
  }, []);

  const selectAllMatching = async () => {
    const requestId = ++selectAllSeqRef.current;
    setSelectAllLoading(true);
    setError("");

    try {
      const allMatchedContacts = [];
      let requestCursor = "";
      let pageToken = "";
      let keepLoading = true;
      let totalCount = 0;

      while (keepLoading) {
        if (requestId !== selectAllSeqRef.current) return;
        const params = {
          marketingEligible: marketingEligibleOnly ? "true" : "false",
          recentlyInteractedOnly: recentlyInteractedOnly ? "true" : "false",
          limit: CONTACT_SELECT_ALL_LIMIT,
        };
        if (requestCursor) {
          params.cursor = requestCursor;
        }
        if (normalizeText(debouncedSearchTerm))
          params.search = normalizeText(debouncedSearchTerm);
        if (normalizeText(tagFilter)) params.tags = normalizeText(tagFilter);
        if (optInFilter !== "all") params.whatsappOptInStatus = optInFilter;
        if (sourceTypeFilter !== "all") params.sourceType = sourceTypeFilter;
        const response = await apiClient.getContacts(params);
        if (requestId !== selectAllSeqRef.current) return;
        const payload = response?.data?.data ?? response?.data ?? [];
        const matchedContacts = Array.isArray(payload) ? payload : [];
        const meta = response?.data?.meta || {};
        totalCount = Number(
          response?.headers?.["x-total-count"] ||
            totalCount ||
            matchedContacts.length ||
            0,
        );
        allMatchedContacts.push(...matchedContacts);
        pageToken = String(meta?.nextCursor || "").trim();
        keepLoading = Boolean(meta?.hasMore) && Boolean(pageToken);
        requestCursor = pageToken;
      }

      const normalizedContacts = allMatchedContacts
        .map((contact) => normalizeContactToRecipient(contact))
        .filter((contact) => contact.phone);

      if (requestId !== selectAllSeqRef.current) return;

      setSelectedContacts((previous) => {
        const merged = [...previous];
        for (const contact of normalizedContacts) {
          if (
            !merged.some((item) => getContactSelectionKey(item) === contact._id)
          ) {
            merged.push(contact);
          }
        }
        return merged;
      });
      setMatchedContactsCount(
        Number.isFinite(totalCount) ? totalCount : normalizedContacts.length,
      );
    } catch (selectError) {
      setError(
        selectError?.response?.data?.error ||
          selectError?.message ||
          "Failed to select filtered contacts.",
      );
    } finally {
      if (requestId === selectAllSeqRef.current) {
        setSelectAllLoading(false);
      }
    }
  };

  const clearSelection = () => setSelectedContacts([]);
  const tableContext = useMemo(
    () => ({
      toggleContact,
    }),
    [toggleContact],
  );

  const handleConfirm = () => {
    if (typeof onConfirm === "function") {
      onConfirm(selectedContacts, {});
    }
    if (typeof onClose === "function") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="contact-audience-modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-content--wide broadcast-validation-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Select From Contacts</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          className="broadcast-validation-banner broadcast-validation-banner--success"
          style={{ marginBottom: 16 }}
        >
          Pick recipients from your CRM contacts. Marketing-eligible contacts
          are filtered server-side.
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: 16,
          }}
        >
          <label className="template-send-field">
            <span>
              <Search
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, phone or email"
            />
          </label>

          <label className="template-send-field">
            <span>
              <Filter
                size={14}
                style={{ marginRight: 6, verticalAlign: "middle" }}
              />
              Opt-in
            </span>
            <select
              value={optInFilter}
              onChange={(event) => setOptInFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="opted_in">Opted-in</option>
              <option value="unknown">Unknown</option>
              <option value="opted_out">Opted-out</option>
            </select>
          </label>

          <label className="template-send-field">
            <span>Source</span>
            <select
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value)}
            >
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="imported">Imported</option>
              <option value="campaign">Campaign</option>
              <option value="public_opt_in">Public opt-in</option>
              <option value="meta_lead_ads">Meta lead ads</option>
              <option value="incoming_message">Incoming message</option>
              <option value="incoming_call">Incoming call</option>
            </select>
          </label>

          <label className="template-send-field">
            <span>Tags</span>
            <input
              type="text"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="vip, follow-up"
            />
          </label>
        </div>

        <label
          className="policy-checkbox"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={marketingEligibleOnly}
            onChange={(event) => setMarketingEligibleOnly(event.target.checked)}
          />
          <span>Show only marketing-ready contacts</span>
        </label>

        <label
          className="policy-checkbox"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={recentlyInteractedOnly}
            onChange={(event) =>
              setRecentlyInteractedOnly(event.target.checked)
            }
          />
          <span>Show only recently interacted contacts</span>
        </label>

        {error ? (
          <div
            className="broadcast-validation-banner broadcast-validation-banner--error"
            style={{ marginBottom: 12 }}
          >
            {error}
          </div>
        ) : null}

        <div className="contact-audience-summary-row">
          <div className="broadcast-validation-stat contact-audience-stat">
            <span>Loaded</span>
            <strong>{contacts.length}</strong>
          </div>
          <div className="broadcast-validation-stat contact-audience-stat">
            <span>Matched</span>
            <strong>{matchedContactsCount}</strong>
          </div>
          <div className="broadcast-validation-stat contact-audience-stat">
            <span>Selected</span>
            <strong>{selectedContacts.length}</strong>
          </div>
          <div className="contact-audience-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={selectAllMatching}
              disabled={selectAllLoading || !contacts.length}
            >
              <Plus size={16} />
              {selectAllLoading ? "Selecting..." : "Select All Matching"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={clearSelection}
              disabled={!selectedContacts.length}
            >
              <Minus size={16} />
              Clear Selection
            </button>
          </div>
        </div>

        <p className="broadcast-validation-more contact-audience-hint">
          {matchedContactsCount > 0
            ? `Select All Matching will add up to ${matchedContactsCount} contacts from the current filters.`
            : "Use filters above to narrow the audience before selecting contacts."}
        </p>

        {matchedContactsCount === 0 ? (
          <div
            className="broadcast-validation-banner broadcast-validation-banner--warning"
            style={{ marginBottom: 12 }}
          >
            No contacts match the current filters. Try unchecking
            marketing-ready or recently interacted filters, or adjust opt-in,
            source, or tag filters.
          </div>
        ) : null}

        <div
          className="broadcast-validation-table-wrap"
          style={{ height: CONTACT_TABLE_HEIGHT }}
        >
          {contacts.length > 0 ? (
            <TableVirtuoso
              style={{ height: CONTACT_TABLE_HEIGHT }}
              data={contacts}
              context={tableContext}
              components={{
                Table: ContactAudiencePickerTable,
                TableRow: ContactAudiencePickerTableRow,
              }}
              fixedHeaderContent={() => (
                <tr>
                  <th />
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Opt-in</th>
                  <th>Source</th>
                </tr>
              )}
              itemContent={(index, contact) => {
                const normalized = contact;
                const checked = selectedIds.has(normalized._id);
                return (
                  <>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleContact(normalized)}
                        aria-label={`Select ${getContactLabel(contact, index)}`}
                      />
                    </td>
                    <td>{normalized.name || `Contact ${index + 1}`}</td>
                    <td>{normalized.phone || "-"}</td>
                    <td>{normalized.whatsappOptInStatus || "unknown"}</td>
                    <td>{normalized.sourceType || "manual"}</td>
                  </>
                );
              }}
            />
          ) : !loading ? (
            <div style={{ textAlign: "center", padding: "20px 12px" }}>
              No contacts matched these filters.
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 12px" }}>
              Loading contacts...
            </div>
          )}
        </div>

        {hasMore ? (
          <div
            style={{ marginTop: 12, display: "flex", justifyContent: "center" }}
          >
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setPageCursor(nextCursor)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleConfirm}
            disabled={!selectedContacts.length}
          >
            Use Selected Contacts ({selectedContacts.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactAudiencePickerModal;
