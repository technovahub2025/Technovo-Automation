import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Calendar, Users, Loader2, Minus, Check } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { apiClient } from '../../services/whatsappapi';
import './Modal.css';
import './CampaignAudiencePickerModal.css';

const CAMPAIGN_PAGE_LIMIT = 20;
const RECIPIENT_PAGE_LIMIT = 50;

const normalizeText = (value = '') => String(value || '').trim();
const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '').trim();

const getCampaignSummary = (campaign = {}) => {
  const sentCount = Number(campaign?.sentCount || campaign?.stats?.sent || campaign?.recipientCount || 0);
  return {
    _id: String(campaign?._id || campaign?.id || '').trim(),
    id: String(campaign?._id || '').trim(),
    name: normalizeText(campaign?.name),
    status: normalizeText(campaign?.status),
    createdAt: campaign?.createdAt || null,
    sentCount: Number.isFinite(sentCount) ? sentCount : 0,
    recipientCount: Number.isFinite(Number(campaign?.recipientCount || 0)) ? Number(campaign.recipientCount || 0) : 0,
    stats: campaign?.stats || {}
  };
};

const CampaignAudienceRow = ({ campaign, active, onClick }) => (
  <button
    type="button"
    className={`campaign-audience-card${active ? ' is-active' : ''}`}
    onClick={onClick}
  >
    <div className="campaign-audience-card__top">
      <div className="campaign-audience-card__title">{campaign.name || 'Untitled campaign'}</div>
      <span className={`campaign-audience-card__status status-${String(campaign.status || '').toLowerCase()}`}>
        {campaign.status || 'unknown'}
      </span>
    </div>
    <div className="campaign-audience-card__meta">
      <span>{new Date(campaign.createdAt || Date.now()).toLocaleDateString()}</span>
      <span>{Number(campaign.sentCount || 0).toLocaleString()} sent</span>
    </div>
  </button>
);

const CampaignRecipientRow = ({ item, excluded, onToggle }) => (
  <button
    type="button"
    className={`campaign-audience-recipient-row${excluded ? ' is-excluded' : ''}`}
    onClick={() => onToggle(item)}
  >
    <span className={`campaign-audience-check${excluded ? ' is-excluded' : ''}`}>
      {excluded ? <Minus size={14} /> : <Check size={14} />}
    </span>
    <div className="campaign-audience-recipient-row__body">
      <div className="campaign-audience-recipient__name">{item.name || item.phone || 'Unknown contact'}</div>
      <div className="campaign-audience-recipient__phone">{item.phone}</div>
    </div>
    <div className="campaign-audience-recipient-row__meta">{item.whatsappOptInStatus || 'unknown'}</div>
    <div className="campaign-audience-recipient-row__meta">{item.status || 'sent'}</div>
  </button>
);

const CampaignAudiencePickerModal = ({
  open,
  onClose,
  onConfirm,
  onRequestAddContacts,
  additionalContacts = []
}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [debouncedCampaignSearch, setDebouncedCampaignSearch] = useState('');
  const [campaignCursor, setCampaignCursor] = useState('');
  const [campaignHasMore, setCampaignHasMore] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignLoadingMore, setCampaignLoadingMore] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [debouncedRecipientSearch, setDebouncedRecipientSearch] = useState('');
  const [recipientCursor, setRecipientCursor] = useState('');
  const [recipientHasMore, setRecipientHasMore] = useState(true);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientLoadingMore, setRecipientLoadingMore] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [excludedPhones, setExcludedPhones] = useState(() => new Set());
  const campaignLoadSeqRef = useRef(0);
  const recipientLoadSeqRef = useRef(0);
  const campaignEndRef = useRef(null);
  const campaignScrollRef = useRef(null);
  const prevSelectedCampaignIdRef = useRef('');
  const campaignCursorRef = useRef('');
  const recipientCursorRef = useRef('');

  const additionalContactsList = useMemo(
    () =>
      (Array.isArray(additionalContacts) ? additionalContacts : [])
        .map((contact) => ({
          _id: String(contact?._id || contact?.id || contact?.contactId || '').trim(),
          name: normalizeText(contact?.name || contact?.displayName || contact?.contactName),
          phone: normalizeText(contact?.phone || contact?.mobile || contact?.phoneNumber || contact?.whatsappNumber),
          sourceType: normalizeText(contact?.sourceType || 'manual') || 'manual'
        }))
        .filter((contact) => contact.phone),
    [additionalContacts]
  );

  const selectedCampaignCount = useMemo(() => {
    const baseCount = Math.max(0, Number(selectedCampaign?.recipientCount || selectedCampaign?.sentCount || 0));
    const excludedCount = excludedPhones.size;
    const extraCount = new Set(
      additionalContactsList.map((contact) => normalizePhone(contact.phone)).filter(Boolean)
    ).size;
    return Math.max(0, baseCount - excludedCount + extraCount);
  }, [additionalContactsList, excludedPhones, selectedCampaign]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCampaignSearch(campaignSearch), 250);
    return () => window.clearTimeout(timer);
  }, [campaignSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRecipientSearch(recipientSearch), 250);
    return () => window.clearTimeout(timer);
  }, [recipientSearch]);

  const fetchCampaigns = useCallback(
    async ({ reset = false } = {}) => {
      const requestId = ++campaignLoadSeqRef.current;
      const cursor = reset ? '' : campaignCursorRef.current;
      if (reset) {
        setCampaignLoading(true);
        setCampaignError('');
        setCampaigns([]);
        setCampaignCursor('');
        campaignCursorRef.current = '';
        setCampaignHasMore(true);
      } else {
        setCampaignLoadingMore(true);
      }

      try {
        const response = await apiClient.getCampaignSelectionBroadcasts({
          search: debouncedCampaignSearch,
          status: 'completed,completed_with_errors',
          cursor,
          limit: CAMPAIGN_PAGE_LIMIT
        });
        if (requestId !== campaignLoadSeqRef.current) return;
        const payload = response?.data?.data || response?.data || {};
        const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
        const meta = payload?.meta || {};
        setCampaigns((previous) => (reset ? items.map(getCampaignSummary) : [...previous, ...items.map(getCampaignSummary)]));
        const nextCursor = String(meta?.nextCursor || '').trim();
        setCampaignCursor(nextCursor);
        campaignCursorRef.current = nextCursor;
        setCampaignHasMore(Boolean(meta?.hasMore));
        if (reset && items.length > 0) {
          const firstSummary = getCampaignSummary(items[0]);
          setSelectedCampaign((current) => {
            if (!current?.id) return firstSummary;
            const currentExists = items.some((item) => String(item?._id || item?.id || '').trim() === current.id);
            return currentExists ? current : firstSummary;
          });
        }
      } catch (error) {
        if (requestId === campaignLoadSeqRef.current) {
          setCampaignError(error?.response?.data?.error || error?.message || 'Failed to load campaigns.');
        }
      } finally {
        if (requestId === campaignLoadSeqRef.current) {
          setCampaignLoading(false);
          setCampaignLoadingMore(false);
        }
      }
    },
    [debouncedCampaignSearch]
  );

  const fetchRecipients = useCallback(
    async ({ reset = false } = {}) => {
      if (!selectedCampaign?.id) return;
      const requestId = ++recipientLoadSeqRef.current;
      const cursor = reset ? '' : recipientCursorRef.current;
      if (reset) {
        setRecipientLoading(true);
        setRecipientError('');
        setRecipients([]);
        setRecipientCursor('');
        recipientCursorRef.current = '';
        setRecipientHasMore(true);
      } else {
        setRecipientLoadingMore(true);
      }

      try {
        const response = await apiClient.getBroadcastAudienceRecipients(selectedCampaign.id, {
          search: debouncedRecipientSearch,
          cursor,
          limit: RECIPIENT_PAGE_LIMIT
        });
        if (requestId !== recipientLoadSeqRef.current) return;
        const payload = response?.data?.data || response?.data || {};
        const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
        const meta = payload?.meta || {};
        const mapped = items.map((item) => ({
          _id: String(item?.contactId || item?.dispatchId || item?.broadcastDispatchKey || item?.phone || '').trim(),
          name: normalizeText(item?.name),
          phone: normalizeText(item?.phone),
          whatsappOptInStatus: normalizeText(item?.whatsappOptInStatus || 'unknown') || 'unknown',
          status: normalizeText(item?.status || 'sent') || 'sent'
        }));
        setRecipients((previous) => (reset ? mapped : [...previous, ...mapped]));
        const nextCursor = String(meta?.nextCursor || '').trim();
        setRecipientCursor(nextCursor);
        recipientCursorRef.current = nextCursor;
        setRecipientHasMore(Boolean(meta?.hasMore));
      } catch (error) {
        if (requestId === recipientLoadSeqRef.current) {
          setRecipientError(error?.response?.data?.error || error?.message || 'Failed to load campaign recipients.');
        }
      } finally {
        if (requestId === recipientLoadSeqRef.current) {
          setRecipientLoading(false);
          setRecipientLoadingMore(false);
        }
      }
    },
    [debouncedRecipientSearch, selectedCampaign?.id]
  );

  useEffect(() => {
    if (!open) return;
    setCampaignSearch('');
    setDebouncedCampaignSearch('');
    setRecipientSearch('');
    setDebouncedRecipientSearch('');
    setCampaigns([]);
    setRecipients([]);
    setSelectedCampaign(null);
    setExcludedPhones(new Set());
    setCampaignCursor('');
    setCampaignHasMore(true);
    setRecipientCursor('');
    setRecipientHasMore(true);
    prevSelectedCampaignIdRef.current = '';
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
    const selectedCampaignChanged = prevSelectedCampaignIdRef.current !== selectedCampaign.id;
    prevSelectedCampaignIdRef.current = selectedCampaign.id;
    if (selectedCampaignChanged) {
      setExcludedPhones(new Set());
    }
    recipientLoadSeqRef.current += 1;
    void fetchRecipients({ reset: true });
  }, [debouncedRecipientSearch, open, selectedCampaign?.id, fetchRecipients]);

  useEffect(() => {
    if (!open) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && campaignHasMore && !campaignLoading && !campaignLoadingMore) {
          void fetchCampaigns({ reset: false });
        }
      },
      { root: campaignScrollRef.current, rootMargin: '0px 0px 300px 0px', threshold: 0 }
    );
    if (campaignEndRef.current) observer.observe(campaignEndRef.current);
    return () => observer.disconnect();
  }, [open, campaignHasMore, campaignLoading, campaignLoadingMore, fetchCampaigns]);

  const toggleExcluded = useCallback((recipient) => {
    const phone = normalizePhone(recipient?.phone || '');
    if (!phone) return;
    setExcludedPhones((previous) => {
      const next = new Set(previous);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }, []);

  const handleSelectCampaign = (campaign) => {
    const summary = getCampaignSummary(campaign);
    setSelectedCampaign(summary);
    setRecipientSearch('');
    setDebouncedRecipientSearch('');
    setRecipients([]);
    setRecipientCursor('');
    setRecipientHasMore(true);
    setExcludedPhones(new Set());
  };

  const handleConfirm = () => {
    if (!selectedCampaign?.id) {
      setCampaignError('Please select a campaign first.');
      return;
    }

    const normalizedAdditional = additionalContactsList.map((contact) => ({
      _id: contact._id,
      phone: contact.phone,
      name: contact.name,
      sourceType: contact.sourceType,
      variables: [],
      data: contact,
      fullData: contact
    }));

    onConfirm?.({
      campaign: selectedCampaign,
      excludedPhones: Array.from(excludedPhones),
      additionalContacts: normalizedAdditional
    });
  };

  if (!open) return null;

  return (
    <div className="popup-overlay campaign-audience-modal-overlay">
      <div className="popup-container campaign-audience-modal">
        <div className="popup-header">
          <div className="popup-title">
            <Calendar size={20} />
            <span>Select From Campaign</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content campaign-audience-modal__content">
          <div className="campaign-audience-modal__toolbar">
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns..."
              />
            </div>
            <div className="campaign-audience-modal__summary">
              <strong>{selectedCampaignCount.toLocaleString()} selected</strong>
              <span>{selectedCampaign?.name || 'No campaign selected'}</span>
            </div>
          </div>

          <div className="campaign-audience-modal__grid">
            <div className="campaign-audience-modal__list" ref={campaignScrollRef}>
              {campaignLoading && campaigns.length === 0 ? (
                <div className="campaign-audience-modal__loader">
                  <Loader2 size={18} className="is-spinning" />
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
                <div className="campaign-audience-modal__footer-loader">
                  <Loader2 size={14} className="is-spinning" />
                  Loading more...
                </div>
              ) : null}
              <div ref={campaignEndRef} style={{ height: 1 }} />
              {!campaignHasMore && campaigns.length > 0 ? (
                <div className="campaign-audience-modal__footer-end">No more campaigns</div>
              ) : null}
              {campaignError ? <div className="campaign-audience-modal__error">{campaignError}</div> : null}
              {!campaignLoading && campaigns.length === 0 && !campaignError ? (
                <div className="campaign-audience-modal__footer-end">No campaigns found</div>
              ) : null}
            </div>

            <div className="campaign-audience-modal__panel">
              <div className="campaign-audience-modal__panel-header">
                <div>
                  <strong>{selectedCampaign?.name || 'Campaign audience'}</strong>
                  <p>
                    {selectedCampaign?.status || '—'} · {new Date(selectedCampaign?.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="replace-upload-btn"
                  onClick={() => typeof onRequestAddContacts === 'function' && onRequestAddContacts()}
                >
                  <Users size={16} />
                  Add CRM Contacts
                </button>
              </div>

              <div className="campaign-audience-modal__stats">
                <div className="campaign-audience-stat">
                  <span>TOTAL</span>
                  <strong>{Number(selectedCampaign?.recipientCount || selectedCampaign?.sentCount || 0).toLocaleString()}</strong>
                </div>
                <div className="campaign-audience-stat">
                  <span>REMOVED</span>
                  <strong>{excludedPhones.size.toLocaleString()}</strong>
                </div>
                <div className="campaign-audience-stat">
                  <span>EXTRAS</span>
                  <strong>{additionalContactsList.length.toLocaleString()}</strong>
                </div>
              </div>

              <div className="search-input campaign-audience-modal__recipient-search">
                <Search size={16} />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search recipients in campaign..."
                />
              </div>

              <div className="campaign-audience-modal__table-wrap">
                {recipientLoading && recipients.length === 0 ? (
                  <div className="campaign-audience-modal__loader">
                    <Loader2 size={18} className="is-spinning" />
                    Loading campaign contacts...
                  </div>
                ) : null}

                <Virtuoso
                  style={{ height: 360 }}
                  data={recipients}
                  endReached={() => {
                    if (recipientHasMore && !recipientLoading && !recipientLoadingMore) {
                      void fetchRecipients({ reset: false });
                    }
                  }}
                  itemContent={(index, item) => (
                    <CampaignRecipientRow
                      key={item?._id || `${item?.phone || 'recipient'}-${index}`}
                      item={item}
                      onToggle={toggleExcluded}
                      excluded={excludedPhones.has(normalizePhone(item?.phone || ''))}
                    />
                  )}
                />

                {recipientLoadingMore ? (
                  <div className="campaign-audience-modal__footer-loader">
                    <Loader2 size={14} className="is-spinning" />
                    Loading more recipients...
                  </div>
                ) : null}
                {!recipientHasMore && recipients.length > 0 ? (
                  <div className="campaign-audience-modal__footer-end">No more campaign contacts</div>
                ) : null}
                {recipientError ? <div className="campaign-audience-modal__error">{recipientError}</div> : null}
                {!recipientLoading && !recipientLoadingMore && recipients.length === 0 && !recipientError && selectedCampaign?.id ? (
                  <div className="campaign-audience-modal__footer-end">No campaign contacts found</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={!selectedCampaign?.id}>
            Use Campaign Audience
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignAudiencePickerModal;
