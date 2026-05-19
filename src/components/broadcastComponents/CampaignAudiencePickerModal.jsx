import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  X,
  Calendar,
  Users,
  Loader2,
  Minus,
  Check,
} from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { apiClient } from "../../services/whatsappapi";
import "./CampaignAudiencePickerModal.css";

const CAMPAIGN_PAGE_LIMIT = 20;
const RECIPIENT_PAGE_LIMIT = 50;

const normalizeText = (value = "") => String(value || "").trim();
const normalizePhone = (value = "") =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const getCampaignSummary = (campaign = {}) => {
  const sentCount = Number(
    campaign?.sentCount ||
      campaign?.stats?.sent ||
      campaign?.recipientCount ||
      0,
  );
  return {
    _id: String(campaign?._id || campaign?.id || "").trim(),
    id: String(campaign?._id || "").trim(),
    name: normalizeText(campaign?.name),
    status: normalizeText(campaign?.status),
    createdAt: campaign?.createdAt || null,
    sentCount: Number.isFinite(sentCount) ? sentCount : 0,
    recipientCount: Number.isFinite(Number(campaign?.recipientCount || 0))
      ? Number(campaign.recipientCount || 0)
      : 0,
    stats: campaign?.stats || {},
  };
};

const CampaignAudienceRow = ({ campaign, active, onClick }) => (
  <button
    type="button"
    className={`pas-crm-campaign-audience-picker__campaign-card${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    <div className="pas-crm-campaign-audience-picker__campaign-card-top">
      <div className="pas-crm-campaign-audience-picker__campaign-card-title">
        {campaign.name || "Untitled campaign"}
      </div>
      <span
        className={`pas-crm-campaign-audience-picker__campaign-status pas-crm-campaign-audience-picker__campaign-status--${String(campaign.status || "").toLowerCase()}`}
      >
        {campaign.status || "unknown"}
      </span>
    </div>
    <div className="pas-crm-campaign-audience-picker__campaign-card-meta">
      <span>
        {new Date(campaign.createdAt || Date.now()).toLocaleDateString()}
      </span>
      <span>{Number(campaign.sentCount || 0).toLocaleString()} sent</span>
    </div>
  </button>
);

const CampaignRecipientRow = ({ item, selected, onToggle }) => (
  <button
    type="button"
    className={`pas-crm-campaign-audience-picker__recipient-row${selected ? " is-selected" : ""}`}
    onClick={() => onToggle(item)}
  >
    <span
      className={`pas-crm-campaign-audience-picker__recipient-check${selected ? " is-selected" : ""}`}
    >
      {selected ? <Check size={14} /> : <Minus size={14} />}
    </span>
    <div className="pas-crm-campaign-audience-picker__recipient-body">
      <div className="pas-crm-campaign-audience-picker__recipient-name">
        {item.name || item.phone || "Unknown contact"}
      </div>
      <div className="pas-crm-campaign-audience-picker__recipient-phone">{item.phone}</div>
    </div>
    <div className="pas-crm-campaign-audience-picker__recipient-meta">
      {item.whatsappOptInStatus || "unknown"}
    </div>
    <div className="pas-crm-campaign-audience-picker__recipient-meta">
      {item.status || "sent"}
    </div>
  </button>
);

const CampaignAudiencePickerModal = ({
  open,
  onClose,
  onConfirm,
  onRequestAddContacts,
  additionalContacts = [],
}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [debouncedCampaignSearch, setDebouncedCampaignSearch] = useState("");
  const [campaignCursor, setCampaignCursor] = useState("");
  const [campaignHasMore, setCampaignHasMore] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignLoadingMore, setCampaignLoadingMore] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [debouncedRecipientSearch, setDebouncedRecipientSearch] = useState("");
  const [recipientCursor, setRecipientCursor] = useState("");
  const [recipientHasMore, setRecipientHasMore] = useState(true);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientLoadingMore, setRecipientLoadingMore] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const [selectedPhones, setSelectedPhones] = useState(() => new Set());
  const campaignLoadSeqRef = useRef(0);
  const recipientLoadSeqRef = useRef(0);
  const campaignEndRef = useRef(null);
  const campaignScrollRef = useRef(null);
  const prevSelectedCampaignIdRef = useRef("");
  const campaignCursorRef = useRef("");
  const recipientCursorRef = useRef("");

  const additionalContactsList = useMemo(
    () =>
      (Array.isArray(additionalContacts) ? additionalContacts : [])
        .map((contact) => ({
          _id: String(
            contact?._id || contact?.id || contact?.contactId || "",
          ).trim(),
          name: normalizeText(
            contact?.name || contact?.displayName || contact?.contactName,
          ),
          phone: normalizeText(
            contact?.phone ||
              contact?.mobile ||
              contact?.phoneNumber ||
              contact?.whatsappNumber,
          ),
          sourceType:
            normalizeText(contact?.sourceType || "manual") || "manual",
        }))
        .filter((contact) => contact.phone),
    [additionalContacts],
  );

  const selectedCampaignCount = useMemo(() => {
    const selectedCount = selectedPhones.size;
    const extraCount = new Set(
      additionalContactsList
        .map((contact) => normalizePhone(contact.phone))
        .filter(Boolean),
    ).size;
    return Math.max(0, selectedCount + extraCount);
  }, [additionalContactsList, selectedPhones]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCampaignSearch(campaignSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [campaignSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedRecipientSearch(recipientSearch),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [recipientSearch]);

  const fetchCampaigns = useCallback(
    async ({ reset = false } = {}) => {
      const requestId = ++campaignLoadSeqRef.current;
      const cursor = reset ? "" : campaignCursorRef.current;
      if (reset) {
        setCampaignLoading(true);
        setCampaignError("");
        setCampaigns([]);
        setCampaignCursor("");
        campaignCursorRef.current = "";
        setCampaignHasMore(true);
      } else {
        setCampaignLoadingMore(true);
      }

      try {
        const response = await apiClient.getCampaignSelectionBroadcasts({
          search: debouncedCampaignSearch,
          status: "completed,completed_with_errors",
          cursor,
          limit: CAMPAIGN_PAGE_LIMIT,
        });
        if (requestId !== campaignLoadSeqRef.current) return;
        const payload = response?.data?.data || response?.data || {};
        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        const meta = payload?.meta || {};
        setCampaigns((previous) =>
          reset
            ? items.map(getCampaignSummary)
            : [...previous, ...items.map(getCampaignSummary)],
        );
        const nextCursor = String(meta?.nextCursor || "").trim();
        setCampaignCursor(nextCursor);
        campaignCursorRef.current = nextCursor;
        setCampaignHasMore(Boolean(meta?.hasMore));
        if (reset && items.length > 0) {
          const firstSummary = getCampaignSummary(items[0]);
          setSelectedCampaign((current) => {
            if (!current?.id) return firstSummary;
            const currentExists = items.some(
              (item) =>
                String(item?._id || item?.id || "").trim() === current.id,
            );
            return currentExists ? current : firstSummary;
          });
        }
      } catch (error) {
        if (requestId === campaignLoadSeqRef.current) {
          setCampaignError(
            error?.response?.data?.error ||
              error?.message ||
              "Failed to load campaigns.",
          );
        }
      } finally {
        if (requestId === campaignLoadSeqRef.current) {
          setCampaignLoading(false);
          setCampaignLoadingMore(false);
        }
      }
    },
    [debouncedCampaignSearch],
  );

  const fetchRecipients = useCallback(
    async ({ reset = false } = {}) => {
      if (!selectedCampaign?.id) return;
      const requestId = ++recipientLoadSeqRef.current;
      const cursor = reset ? "" : recipientCursorRef.current;
      if (reset) {
        setRecipientLoading(true);
        setRecipientError("");
        setRecipients([]);
        setRecipientCursor("");
        recipientCursorRef.current = "";
        setRecipientHasMore(true);
      } else {
        setRecipientLoadingMore(true);
      }

      try {
        const response = await apiClient.getBroadcastAudienceRecipients(
          selectedCampaign.id,
          {
            search: debouncedRecipientSearch,
            cursor,
            limit: RECIPIENT_PAGE_LIMIT,
          },
        );
        if (requestId !== recipientLoadSeqRef.current) return;
        const payload = response?.data?.data || response?.data || {};
        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        const meta = payload?.meta || {};
        const mapped = items.map((item) => ({
          _id: String(
            item?.contactId ||
              item?.dispatchId ||
              item?.broadcastDispatchKey ||
              item?.phone ||
              "",
          ).trim(),
          name: normalizeText(item?.name),
          phone: normalizeText(item?.phone),
          whatsappOptInStatus:
            normalizeText(item?.whatsappOptInStatus || "unknown") || "unknown",
          status: normalizeText(item?.status || "sent") || "sent",
        }));
        setRecipients((previous) =>
          reset ? mapped : [...previous, ...mapped],
        );
        const nextCursor = String(meta?.nextCursor || "").trim();
        setRecipientCursor(nextCursor);
        recipientCursorRef.current = nextCursor;
        setRecipientHasMore(Boolean(meta?.hasMore));
      } catch (error) {
        if (requestId === recipientLoadSeqRef.current) {
          setRecipientError(
            error?.response?.data?.error ||
              error?.message ||
              "Failed to load campaign recipients.",
          );
        }
      } finally {
        if (requestId === recipientLoadSeqRef.current) {
          setRecipientLoading(false);
          setRecipientLoadingMore(false);
        }
      }
    },
    [debouncedRecipientSearch, selectedCampaign?.id],
  );

  useEffect(() => {
    if (!open) return;
    setCampaignSearch("");
    setDebouncedCampaignSearch("");
    setRecipientSearch("");
    setDebouncedRecipientSearch("");
    setCampaigns([]);
    setRecipients([]);
    setSelectedCampaign(null);
    setSelectedPhones(new Set());
    setCampaignCursor("");
    setCampaignHasMore(true);
    setRecipientCursor("");
    setRecipientHasMore(true);
    prevSelectedCampaignIdRef.current = "";
    campaignLoadSeqRef.current += 1;
    recipientLoadSeqRef.current += 1;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    campaignLoadSeqRef.current += 1;
    void fetchCampaigns({ reset: true });
  }, [debouncedCampaignSearch, open, fetchCampaigns]);

  useEffect(() => {
    if (!open || !selectedCampaign?.id) return;
    const selectedCampaignChanged =
      prevSelectedCampaignIdRef.current !== selectedCampaign.id;
    prevSelectedCampaignIdRef.current = selectedCampaign.id;
    if (selectedCampaignChanged) {
      setSelectedPhones(new Set());
    }
    recipientLoadSeqRef.current += 1;
    void fetchRecipients({ reset: true });
  }, [debouncedRecipientSearch, open, selectedCampaign?.id, fetchRecipients]);

  useEffect(() => {
    if (!open) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry?.isIntersecting &&
          campaignHasMore &&
          !campaignLoading &&
          !campaignLoadingMore
        ) {
          void fetchCampaigns({ reset: false });
        }
      },
      {
        root: campaignScrollRef.current,
        rootMargin: "0px 0px 300px 0px",
        threshold: 0,
      },
    );
    if (campaignEndRef.current) observer.observe(campaignEndRef.current);
    return () => observer.disconnect();
  }, [
    open,
    campaignHasMore,
    campaignLoading,
    campaignLoadingMore,
    fetchCampaigns,
  ]);

  const toggleSelected = useCallback((recipient) => {
    const phone = normalizePhone(recipient?.phone || "");
    if (!phone) return;
    setSelectedPhones((previous) => {
      const next = new Set(previous);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }, []);

  const handleSelectCampaign = (campaign) => {
    const summary = getCampaignSummary(campaign);
    setSelectedCampaign(summary);
    setRecipientSearch("");
    setDebouncedRecipientSearch("");
    setRecipients([]);
    setRecipientCursor("");
    setRecipientHasMore(true);
    setSelectedPhones(new Set());
  };

  const handleConfirm = () => {
    if (!selectedCampaign?.id) {
      setCampaignError("Please select a campaign first.");
      return;
    }

    const selectedRecipients = recipients
      .filter((recipient) =>
        selectedPhones.has(normalizePhone(recipient?.phone || "")),
      )
      .map((recipient) => ({
        ...recipient,
      }))
      .filter((recipient) => String(recipient?.phone || "").trim());

    const normalizedAdditional = additionalContactsList.map((contact) => ({
      _id: contact._id,
      phone: contact.phone,
      name: contact.name,
      sourceType: contact.sourceType,
      variables: [],
      data: contact,
      fullData: contact,
    }));

    onConfirm?.({
      campaign: selectedCampaign,
      excludedPhones: recipients
        .map((recipient) => normalizePhone(recipient?.phone || ""))
        .filter((phone) => phone && !selectedPhones.has(phone)),
      additionalContacts: normalizedAdditional,
      campaignRecipients: selectedRecipients,
    });
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleConfirmClick = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    handleConfirm();
  };

  if (!open) return null;

  return (
    <div className="pas-crm-campaign-audience-picker-overlay">
      <div className="pas-crm-campaign-audience-picker">
        <div className="pas-crm-campaign-audience-picker__header">
          <div className="pas-crm-campaign-audience-picker__title">
            <Calendar size={20} />
            <span>Select From Campaign</span>
          </div>
          <button
            type="button"
            className="pas-crm-campaign-audience-picker__close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="pas-crm-campaign-audience-picker__content">
          <div className="pas-crm-campaign-audience-picker__toolbar">
            <div className="pas-crm-campaign-audience-picker__search">
              <Search
                size={16}
                className="pas-crm-campaign-audience-picker__search-icon"
              />
              <input
                type="text"
                className="pas-crm-campaign-audience-picker__search-input"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns..."
              />
            </div>
            <div className="pas-crm-campaign-audience-picker__summary">
              <strong>{selectedCampaignCount.toLocaleString()} selected</strong>
              <span>{selectedCampaign?.name || "No campaign selected"}</span>
            </div>
          </div>

          <div className="pas-crm-campaign-audience-picker__grid">
            <div
              className="pas-crm-campaign-audience-picker__list"
              ref={campaignScrollRef}
            >
              {campaignLoading && campaigns.length === 0 ? (
                <div className="pas-crm-campaign-audience-picker__loader">
                  <Loader2 size={18} className="pas-crm-campaign-audience-picker__spinner" />
                  Loading campaigns...
                </div>
              ) : null}

              {campaigns.map((campaign) => (
                <CampaignAudienceRow
                  key={campaign.id}
                  campaign={campaign}
                  active={campaign.id === selectedCampaign?.id}
                  onClick={() => handleSelectCampaign(campaign)}
                />
              ))}

              {campaignLoadingMore ? (
                <div className="pas-crm-campaign-audience-picker__footer-loader">
                  <Loader2 size={14} className="pas-crm-campaign-audience-picker__spinner" />
                  Loading more...
                </div>
              ) : null}
              <div ref={campaignEndRef} style={{ height: 1 }} />
              {!campaignHasMore && campaigns.length > 0 ? (
                <div className="pas-crm-campaign-audience-picker__footer-end">
                  No more campaigns
                </div>
              ) : null}
              {campaignError ? (
                <div className="pas-crm-campaign-audience-picker__error">
                  {campaignError}
                </div>
              ) : null}
              {!campaignLoading && campaigns.length === 0 && !campaignError ? (
                <div className="pas-crm-campaign-audience-picker__footer-end">
                  No campaigns found
                </div>
              ) : null}
            </div>

            <div className="pas-crm-campaign-audience-picker__panel">
              <div className="pas-crm-campaign-audience-picker__panel-header">
                <div>
                  <strong>
                    {selectedCampaign?.name || "Campaign audience"}
                  </strong>
                  <p className="pas-crm-campaign-audience-picker__panel-subtitle">
                    {selectedCampaign?.status || "—"} ·{" "}
                    {new Date(
                      selectedCampaign?.createdAt || Date.now(),
                    ).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="pas-crm-campaign-audience-picker__add-contacts-btn"
                  onClick={() =>
                    typeof onRequestAddContacts === "function" &&
                    onRequestAddContacts()
                  }
                >
                  <Users size={16} />
                  Add CRM Contacts
                </button>
              </div>

              <div className="pas-crm-campaign-audience-picker__stats">
                <div className="pas-crm-campaign-audience-picker__stat">
                  <span>TOTAL</span>
                  <strong>
                    {Number(
                      selectedCampaign?.recipientCount ||
                        selectedCampaign?.sentCount ||
                        0,
                    ).toLocaleString()}
                  </strong>
                </div>
                <div className="pas-crm-campaign-audience-picker__stat">
                  <span>SELECTED</span>
                  <strong>{selectedPhones.size.toLocaleString()}</strong>
                </div>
                <div className="pas-crm-campaign-audience-picker__stat">
                  <span>EXTRAS</span>
                  <strong>
                    {additionalContactsList.length.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="pas-crm-campaign-audience-picker__search pas-crm-campaign-audience-picker__recipient-search">
                <Search
                  size={16}
                  className="pas-crm-campaign-audience-picker__search-icon"
                />
                <input
                  type="text"
                  className="pas-crm-campaign-audience-picker__search-input"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search recipients in campaign..."
                />
              </div>

              <div className="pas-crm-campaign-audience-picker__table-wrap">
                {recipientLoading && recipients.length === 0 ? (
                  <div className="pas-crm-campaign-audience-picker__loader">
                    <Loader2 size={18} className="pas-crm-campaign-audience-picker__spinner" />
                    Loading campaign contacts...
                  </div>
                ) : null}

                <Virtuoso
                  style={{ height: 360 }}
                  data={recipients}
                  endReached={() => {
                    if (
                      recipientHasMore &&
                      !recipientLoading &&
                      !recipientLoadingMore
                    ) {
                      void fetchRecipients({ reset: false });
                    }
                  }}
                  itemContent={(index, item) => (
                    <CampaignRecipientRow
                      key={
                        item?._id || `${item?.phone || "recipient"}-${index}`
                      }
                      item={item}
                      onToggle={toggleSelected}
                      selected={selectedPhones.has(
                        normalizePhone(item?.phone || ""),
                      )}
                    />
                  )}
                />

                {recipientLoadingMore ? (
                  <div className="pas-crm-campaign-audience-picker__footer-loader">
                    <Loader2 size={14} className="pas-crm-campaign-audience-picker__spinner" />
                    Loading more recipients...
                  </div>
                ) : null}
                {!recipientHasMore && recipients.length > 0 ? (
                  <div className="pas-crm-campaign-audience-picker__footer-end">
                    No more campaign contacts
                  </div>
                ) : null}
                {recipientError ? (
                  <div className="pas-crm-campaign-audience-picker__error">
                    {recipientError}
                  </div>
                ) : null}
                {!recipientLoading &&
                !recipientLoadingMore &&
                recipients.length === 0 &&
                !recipientError &&
                selectedCampaign?.id ? (
                  <div className="pas-crm-campaign-audience-picker__footer-end">
                    No campaign contacts found
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="pas-crm-campaign-audience-picker__actions">
          <button
            type="button"
            className="pas-crm-campaign-audience-picker__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pas-crm-campaign-audience-picker__confirm-btn"
            onClick={handleConfirmClick}
            disabled={
              !selectedCampaign?.id ||
              (selectedPhones.size === 0 && additionalContactsList.length === 0)
            }
          >
            Use Campaign Audience
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignAudiencePickerModal;


