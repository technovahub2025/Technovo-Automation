import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Filter, Plus, Minus } from 'lucide-react';
import { apiClient } from '../../services/whatsappapi';
import './Modal.css';
import './ContactAudiencePickerModal.css';

const CONTACT_PAGE_LIMIT = 50;

const normalizeText = (value = '') => String(value || '').trim();

const getContactSelectionKey = (contact = {}) =>
  String(
    contact?._id ||
    contact?.id ||
    contact?.contactId ||
    contact?.phone ||
    contact?.mobile ||
    contact?.phoneNumber ||
    contact?.whatsappNumber ||
    ''
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

const ContactAudiencePickerModal = ({
  open,
  onClose,
  onConfirm,
  initialSelectedContacts = []
}) => {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [optInFilter, setOptInFilter] = useState('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [marketingEligibleOnly, setMarketingEligibleOnly] = useState(false);
  const [recentlyInteractedOnly, setRecentlyInteractedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [matchedContactsCount, setMatchedContactsCount] = useState(0);
  const querySignature = useMemo(
    () =>
      JSON.stringify({
        searchTerm: normalizeText(searchTerm),
        tagFilter: normalizeText(tagFilter),
        optInFilter,
        sourceTypeFilter,
        marketingEligibleOnly,
        recentlyInteractedOnly
      }),
    [searchTerm, tagFilter, optInFilter, sourceTypeFilter, marketingEligibleOnly, recentlyInteractedOnly]
  );
  const prevQuerySignatureRef = useRef(querySignature);

  const normalizeContactToRecipient = (contact = {}) => ({
    _id: getContactSelectionKey(contact),
    phone:
      normalizeText(contact?.phone) ||
      normalizeText(contact?.mobile) ||
      normalizeText(contact?.phoneNumber) ||
      normalizeText(contact?.whatsappNumber),
    name: normalizeText(contact?.name || contact?.displayName || contact?.contactName),
    sourceType: normalizeText(contact?.sourceType || 'manual') || 'manual',
    whatsappOptInStatus: normalizeText(contact?.whatsappOptInStatus || 'unknown') || 'unknown',
    variables: [],
    data: contact,
    fullData: contact
  });

  const buildContactQueryParams = useCallback((includePagination = true) => {
    const params = {
      marketingEligible: marketingEligibleOnly ? 'true' : 'false',
      recentlyInteractedOnly: recentlyInteractedOnly ? 'true' : 'false'
    };

    if (includePagination) {
      params.limit = CONTACT_PAGE_LIMIT;
      params.page = page;
    }

    if (normalizeText(searchTerm)) params.search = normalizeText(searchTerm);
    if (normalizeText(tagFilter)) params.tags = normalizeText(tagFilter);
    if (optInFilter !== 'all') params.whatsappOptInStatus = optInFilter;
    if (sourceTypeFilter !== 'all') params.sourceType = sourceTypeFilter;

    return params;
  }, [marketingEligibleOnly, recentlyInteractedOnly, page, searchTerm, tagFilter, optInFilter, sourceTypeFilter]);

  useEffect(() => {
    if (!open) return;

    setContacts([]);
    setSelectedContacts(
      (Array.isArray(initialSelectedContacts) ? initialSelectedContacts : [])
        .map((contact) => normalizeContactToRecipient(contact))
        .filter((contact) => contact.phone)
    );
    setSearchTerm('');
    setTagFilter('');
    setOptInFilter('all');
    setSourceTypeFilter('all');
    setMarketingEligibleOnly(false);
    setRecentlyInteractedOnly(false);
    setPage(1);
    setHasMore(true);
    setError('');
    setMatchedContactsCount(0);
  }, [open, initialSelectedContacts]);

  useEffect(() => {
    if (!open) return undefined;

    if (prevQuerySignatureRef.current !== querySignature) {
      prevQuerySignatureRef.current = querySignature;
      setContacts([]);
      setHasMore(true);
      if (page !== 1) {
        setPage(1);
        return undefined;
      }
    }

    let cancelled = false;

    const fetchContacts = async () => {
      setLoading(true);
      setError('');
      try {
        const params = buildContactQueryParams(true);
        const response = await apiClient.getContacts(params);
        const payload = response?.data?.data ?? response?.data ?? [];
        const nextContacts = Array.isArray(payload) ? payload : [];
        const totalCount = Number(response?.headers?.['x-total-count'] || 0);

        if (cancelled) return;

        const normalizedContacts = nextContacts
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((contact) => contact.phone);

        setContacts((previous) => (page === 1 ? normalizedContacts : [...previous, ...normalizedContacts]));
        setHasMore(nextContacts.length >= CONTACT_PAGE_LIMIT);
        setMatchedContactsCount(Number.isFinite(totalCount) ? totalCount : normalizedContacts.length);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.response?.data?.error || fetchError?.message || 'Failed to load contacts.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      cancelled = true;
    };
  }, [open, page, querySignature, buildContactQueryParams]);

  const selectedIds = useMemo(
    () => new Set(selectedContacts.map((contact) => getContactSelectionKey(contact)).filter(Boolean)),
    [selectedContacts]
  );

  const toggleContact = (contact) => {
    const normalized = normalizeContactToRecipient(contact);
    if (!normalized.phone) return;
    setSelectedContacts((previous) => {
      const exists = previous.some((item) => getContactSelectionKey(item) === normalized._id);
      if (exists) {
        return previous.filter((item) => getContactSelectionKey(item) !== normalized._id);
      }
      return [...previous, normalized];
    });
  };

  const selectAllMatching = async () => {
    setSelectAllLoading(true);
    setError('');

    try {
      const response = await apiClient.getContacts(buildContactQueryParams(false));
      const payload = response?.data?.data ?? response?.data ?? [];
      const matchedContacts = Array.isArray(payload) ? payload : [];
      const totalCount = Number(response?.headers?.['x-total-count'] || matchedContacts.length || 0);
      const normalizedContacts = matchedContacts
        .map((contact) => normalizeContactToRecipient(contact))
        .filter((contact) => contact.phone);

      setSelectedContacts((previous) => {
        const merged = [...previous];
        for (const contact of normalizedContacts) {
          if (!merged.some((item) => getContactSelectionKey(item) === contact._id)) {
            merged.push(contact);
          }
        }
        return merged;
      });
      setMatchedContactsCount(Number.isFinite(totalCount) ? totalCount : normalizedContacts.length);
    } catch (selectError) {
      setError(selectError?.response?.data?.error || selectError?.message || 'Failed to select filtered contacts.');
    } finally {
      setSelectAllLoading(false);
    }
  };

  const clearSelection = () => setSelectedContacts([]);

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm(selectedContacts, {});
    }
    if (typeof onClose === 'function') {
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

        <div className="broadcast-validation-banner broadcast-validation-banner--success" style={{ marginBottom: 16 }}>
          Pick recipients from your CRM contacts. Marketing-eligible contacts are filtered server-side.
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
          <label className="template-send-field">
            <span>
              <Search size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
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
              <Filter size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Opt-in
            </span>
            <select value={optInFilter} onChange={(event) => setOptInFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="opted_in">Opted-in</option>
              <option value="unknown">Unknown</option>
              <option value="opted_out">Opted-out</option>
            </select>
          </label>

          <label className="template-send-field">
            <span>Source</span>
            <select value={sourceTypeFilter} onChange={(event) => setSourceTypeFilter(event.target.value)}>
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="imported">Imported</option>
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

        <label className="policy-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={marketingEligibleOnly}
            onChange={(event) => setMarketingEligibleOnly(event.target.checked)}
          />
          <span>Show only marketing-ready contacts</span>
        </label>

        <label className="policy-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={recentlyInteractedOnly}
            onChange={(event) => setRecentlyInteractedOnly(event.target.checked)}
          />
          <span>Show only recently interacted contacts</span>
        </label>

        {error ? (
          <div className="broadcast-validation-banner broadcast-validation-banner--error" style={{ marginBottom: 12 }}>
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
              {selectAllLoading ? 'Selecting...' : 'Select All Matching'}
            </button>
            <button type="button" className="secondary-btn" onClick={clearSelection} disabled={!selectedContacts.length}>
              <Minus size={16} />
              Clear Selection
            </button>
          </div>
        </div>

        <p className="broadcast-validation-more contact-audience-hint">
          {matchedContactsCount > 0
            ? `Select All Matching will add up to ${matchedContactsCount} contacts from the current filters.`
            : 'Use filters above to narrow the audience before selecting contacts.'}
        </p>

        {matchedContactsCount === 0 ? (
          <div className="broadcast-validation-banner broadcast-validation-banner--warning" style={{ marginBottom: 12 }}>
            No contacts match the current filters. Try unchecking marketing-ready or recently interacted filters, or adjust opt-in, source, or tag filters.
          </div>
        ) : null}

        <div className="broadcast-validation-table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
          <table className="broadcast-validation-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Phone</th>
                <th>Opt-in</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, index) => {
                const normalized = contact;
                const checked = selectedIds.has(normalized._id);
                return (
                  <tr
                    key={normalized._id || `contact-${index}`}
                    onClick={() => toggleContact(normalized)}
                    style={{ cursor: 'pointer' }}
                  >
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
                    <td>{normalized.phone || '-'}</td>
                    <td>{normalized.whatsappOptInStatus || 'unknown'}</td>
                    <td>{normalized.sourceType || 'manual'}</td>
                  </tr>
                );
              })}
              {!loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px 12px' }}>
                    No contacts matched these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {hasMore ? (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <button type="button" className="secondary-btn" onClick={() => setPage((previous) => previous + 1)} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        ) : null}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={!selectedContacts.length}>
            Use Selected Contacts ({selectedContacts.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactAudiencePickerModal;
