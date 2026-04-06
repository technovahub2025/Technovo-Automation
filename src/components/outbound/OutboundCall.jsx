import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Phone, ArrowLeft, CheckCircle, AlertCircle, PhoneOutgoing, Mic, Clock, BarChart3, Search, Filter, Trash2, History, ListChecks } from 'lucide-react';
import { useExotelOutbound } from '../../hooks/useBroadcast';
import socketService from '../../services/socketService';
import apiService from '../../services/api';
import OutboundDialer from './OutboundDialer';
import './OutboundCall.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const normalizeStatus = (value) => String(value || '').toLowerCase();

const matchesHistoryFilters = (item, filters) => {
  const status = normalizeStatus(item?.status);
  const phoneNumber = String(item?.phoneNumber || item?.to || '').toLowerCase();
  const createdAtValue = item?.createdAt || item?.updatedAt || item?.timestamp;
  const createdAt = createdAtValue ? new Date(createdAtValue) : null;

  if (filters.status !== 'all' && status !== normalizeStatus(filters.status)) return false;
  if (filters.phoneNumber && !phoneNumber.includes(String(filters.phoneNumber).toLowerCase())) return false;

  if (filters.startDate && createdAt) {
    const start = new Date(filters.startDate);
    if (createdAt < start) return false;
  }

  if (filters.endDate && createdAt) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    if (createdAt > end) return false;
  }

  return true;
};

const upsertHistoryItem = (items, incoming, filters, pagination) => {
  if (!incoming) return items;

  const nextItems = Array.isArray(items) ? [...items] : [];
  const incomingKey = String(incoming._id || incoming.callSid || incoming.id || '');
  const index = nextItems.findIndex((item) => {
    const itemKey = String(item?._id || item?.callSid || item?.id || '');
    return incomingKey && itemKey === incomingKey;
  });
  const matchesFilters = matchesHistoryFilters(incoming, filters);

  if (index >= 0) {
    if (matchesFilters) {
      nextItems[index] = { ...nextItems[index], ...incoming };
    } else {
      nextItems.splice(index, 1);
    }
  } else if (matchesFilters) {
    nextItems.unshift(incoming);
  }

  nextItems.sort((a, b) => new Date(b?.createdAt || b?.updatedAt || b?.timestamp || 0) - new Date(a?.createdAt || a?.updatedAt || a?.timestamp || 0));
  return nextItems.slice(0, pagination.limit || filters.limit || 10);
};

const matchesCampaignFilters = (item, filters) => {
  const status = normalizeStatus(item?.status);
  const recurrence = normalizeStatus(item?.schedule?.recurrence || 'none');
  const searchValue = `${item?.campaignName || item?.name || ''} ${item?.campaignId || ''}`.toLowerCase();

  if (filters.status !== 'all' && status !== normalizeStatus(filters.status)) return false;
  if (filters.recurrence !== 'all' && recurrence !== normalizeStatus(filters.recurrence)) return false;
  if (filters.search && !searchValue.includes(String(filters.search).toLowerCase())) return false;

  return true;
};

const upsertCampaignItem = (items, incoming) => {
  if (!incoming?._id) return items;

  const formattedIncoming = {
    _id: incoming._id,
    campaignId: incoming.campaignId,
    campaignName: incoming.campaignName || incoming.name || 'Untitled Campaign',
    provider: incoming.provider || '',
    status: incoming.status,
    mode: incoming.mode || incoming.schedule?.scheduleType || 'immediate',
    recurrence: incoming.schedule?.recurrence || 'none',
    updatedAt: incoming.updatedAt || incoming.timestamp,
    schedule: incoming.schedule || {}
  };

  const nextItems = Array.isArray(items) ? [...items] : [];
  const index = nextItems.findIndex((item) => String(item?._id) === String(formattedIncoming._id));

  if (index >= 0) {
    nextItems[index] = { ...nextItems[index], ...formattedIncoming };
  } else {
    nextItems.unshift(formattedIncoming);
  }

  nextItems.sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0));
  return nextItems;
};

const OutboundCall = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('quick');
  const [callSettings, setCallSettings] = useState({
    recordCall: true,
    maxDuration: 300,
    retryAttempts: 3,
    voice: 'ta-IN-PallaviNeural',
    disclaimerText: 'This is an automated call from',
    optOutEnabled: true,
    dndRespect: true,
    traiConsentConfirmed: false
  });
  const [historyFilters, setHistoryFilters] = useState({
    page: 1,
    limit: 10,
    status: 'all',
    phoneNumber: '',
    startDate: '',
    endDate: ''
  });
  const [historyPagination, setHistoryPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [selectedCallSids, setSelectedCallSids] = useState([]);
  const [callSelectionMode, setCallSelectionMode] = useState(false);
  const [campaignFilters, setCampaignFilters] = useState({
    search: '',
    status: 'all',
    recurrence: 'all',
    page: 1,
    limit: 10
  });
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [showCampaignFilters, setShowCampaignFilters] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [campaignSelectionMode, setCampaignSelectionMode] = useState(false);
  const [liveMonitor, setLiveMonitor] = useState(null);
  const [liveCallStatus, setLiveCallStatus] = useState(null);

  useExotelOutbound();

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setHistoryError('');
      const params = { ...historyFilters, direction: 'outbound-local' };
      if (params.status === 'all') delete params.status;
      if (!params.phoneNumber) delete params.phoneNumber;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const response = await apiService.getCallHistory(params);
      const payload = response?.data || {};
      setHistoryPagination(payload?.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
      setCallHistory(payload?.data || []);
    } catch (err) {
      setHistoryError(err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Failed to load call history');
      setCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilters]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      setCampaignError('');
      const response = await apiService.getOutboundCampaigns({ page: 1, limit: 500 });
      const payload = response?.data || {};
      const list = Array.isArray(payload?.campaigns) ? payload.campaigns : [];
      setCampaigns(list.map((item) => ({
        _id: item._id,
        campaignId: item.campaignId,
        campaignName: item.name || item.campaignName || 'Untitled Campaign',
        provider: item.provider || '',
        status: item.status,
        mode: item.mode || item.schedule?.scheduleType || 'immediate',
        recurrence: item.schedule?.recurrence || 'none',
        updatedAt: item.updatedAt || item.createdAt,
        schedule: item.schedule || {}
      })));
    } catch (err) {
      setCampaignError(err?.response?.data?.message || err?.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'campaigns') loadCampaigns();
  }, [activeTab, loadHistory, loadCampaigns]);

  useEffect(() => {
    const socket = socketService.connect();

    const handleOutboundCallUpdate = (data = {}) => {
      setCallHistory((prev) => upsertHistoryItem(prev, {
        _id: data._id,
        callSid: data.callSid,
        phoneNumber: data.phoneNumber || data.to,
        status: data.status,
        duration: data.duration,
        createdAt: data.createdAt || data.timestamp,
        updatedAt: data.updatedAt || data.timestamp
      }, historyFilters, historyPagination));

      setLiveMonitor((prev) => {
        if (!prev) return prev;
        if (prev.callSid && data.callSid && prev.callSid === data.callSid) {
          return { ...prev, status: data.status || prev.status, updatedAt: data.updatedAt || data.timestamp || new Date().toISOString() };
        }
        if (prev.campaignId && data.campaignId && prev.campaignId === data.campaignId) {
          return { ...prev, status: data.status || prev.status, updatedAt: data.updatedAt || data.timestamp || new Date().toISOString() };
        }
        return prev;
      });
    };

    const handleCallStatusUpdate = (data = {}) => {
      if (liveCallStatus && data.callSid === liveCallStatus.callSid) {
        setLiveCallStatus((prev) => ({ ...prev, status: data.status }));
      }

      setCallHistory((prev) => upsertHistoryItem(prev, {
        callSid: data.callSid,
        status: data.status,
        updatedAt: data?.execution?.updatedAt || new Date().toISOString(),
        createdAt: data?.execution?.createdAt || data?.execution?.startedAt || new Date().toISOString(),
        phoneNumber: data?.execution?.phoneNumber || data?.execution?.to
      }, historyFilters, historyPagination));

      setLiveMonitor((prev) => {
        if (!prev?.callSid || prev.callSid !== data.callSid) return prev;
        return { ...prev, status: data.status || prev.status, updatedAt: data?.execution?.updatedAt || new Date().toISOString() };
      });
    };

    const handleCampaignUpdate = (payload = {}) => {
      const incomingCampaign = payload?.campaign;
      if (!incomingCampaign?._id) return;

      setCampaigns((prev) => upsertCampaignItem(prev, incomingCampaign));
      setLiveMonitor((prev) => {
        if (!prev) return prev;
        if (prev.campaignId && incomingCampaign.campaignId && prev.campaignId === incomingCampaign.campaignId) {
          return {
            ...prev,
            status: incomingCampaign.status || prev.status,
            campaignName: incomingCampaign.campaignName || prev.campaignName,
            updatedAt: incomingCampaign.updatedAt || payload.timestamp || new Date().toISOString(),
            recurrence: incomingCampaign.schedule?.recurrence || prev.recurrence,
            scheduledAt: incomingCampaign.schedule?.scheduledAt || prev.scheduledAt
          };
        }
        return prev;
      });
    };

    socket.on('outbound_call_update', handleOutboundCallUpdate);
    socket.on('call_status_update', handleCallStatusUpdate);
    socket.on('campaign_update', handleCampaignUpdate);

    return () => {
      socket.off('outbound_call_update', handleOutboundCallUpdate);
      socket.off('call_status_update', handleCallStatusUpdate);
      socket.off('campaign_update', handleCampaignUpdate);
    };
  }, [historyFilters, historyPagination, liveCallStatus]);

  useEffect(() => {
    const savedSettings = localStorage.getItem('outboundCallSettings');
    if (!savedSettings) return;
    try {
      setCallSettings(JSON.parse(savedSettings));
    } catch (err) {
      console.error('Failed to load saved call settings:', err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('outboundCallSettings', JSON.stringify(callSettings));
  }, [callSettings]);

  const handleEndCall = async (callSid) => {
    try {
      await apiService.endCall(callSid);
      setLiveCallStatus(null);
      setCallHistory((prev) => upsertHistoryItem(prev, {
        callSid,
        status: 'completed',
        updatedAt: new Date().toISOString()
      }, historyFilters, historyPagination));
      setLiveMonitor((prev) => (prev?.callSid === callSid ? { ...prev, status: 'completed', updatedAt: new Date().toISOString() } : prev));
    } catch (err) {
      console.error('Failed to end call:', err);
    }
  };

  const handleMonitorUpdate = useCallback((monitorPayload) => {
    setLiveMonitor(monitorPayload);
    if (monitorPayload?.type === 'single' && monitorPayload?.callSid) {
      setLiveCallStatus({
        callSid: monitorPayload.callSid,
        phoneNumber: monitorPayload.to,
        startTime: monitorPayload.updatedAt || new Date().toISOString(),
        status: monitorPayload.status || 'initiated'
      });
    }
    setActiveTab('monitor');
  }, []);

  const showMonitorTab = activeTab === 'monitor';

  const historyInfo = useMemo(() => {
    const start = (historyPagination.page - 1) * historyPagination.limit + 1;
    const end = Math.min(historyPagination.page * historyPagination.limit, historyPagination.total);
    return `${historyPagination.total === 0 ? 0 : start}-${historyPagination.total === 0 ? 0 : end} of ${historyPagination.total}`;
  }, [historyPagination]);

  const filteredCampaigns = useMemo(() => campaigns.filter((item) => matchesCampaignFilters(item, campaignFilters)), [campaigns, campaignFilters]);

  const campaignPagination = useMemo(() => {
    const total = filteredCampaigns.length;
    const totalPages = Math.max(1, Math.ceil(total / campaignFilters.limit));
    const page = Math.min(campaignFilters.page, totalPages);
    return { page, totalPages, total, limit: campaignFilters.limit };
  }, [filteredCampaigns, campaignFilters.page, campaignFilters.limit]);

  const pagedCampaigns = useMemo(() => {
    const startIndex = (campaignPagination.page - 1) * campaignPagination.limit;
    return filteredCampaigns.slice(startIndex, startIndex + campaignPagination.limit);
  }, [filteredCampaigns, campaignPagination]);

  const campaignInfo = useMemo(() => {
    const start = (campaignPagination.page - 1) * campaignPagination.limit + 1;
    const end = Math.min(campaignPagination.page * campaignPagination.limit, campaignPagination.total);
    return `${campaignPagination.total === 0 ? 0 : start}-${campaignPagination.total === 0 ? 0 : end} of ${campaignPagination.total}`;
  }, [campaignPagination]);

  useEffect(() => {
    setSelectedCallSids((prev) =>
      prev.filter((sid) => callHistory.some((item) => String(item.callSid) === String(sid)))
    );
  }, [callHistory]);

  useEffect(() => {
    setSelectedCampaignIds((prev) =>
      prev.filter((id) => campaigns.some((item) => String(item._id) === String(id)))
    );
  }, [campaigns]);

  const allVisibleCallsSelected = callHistory.length > 0 && selectedCallSids.length === callHistory.length;
  const allVisibleCampaignsSelected = pagedCampaigns.length > 0 && selectedCampaignIds.length === pagedCampaigns.length;

  const toggleSelectAllCalls = () => {
    if (allVisibleCallsSelected) {
      setSelectedCallSids([]);
      setCallSelectionMode(false);
      return;
    }
    setSelectedCallSids(callHistory.map((item) => item.callSid).filter(Boolean));
  };

  const toggleSelectAllCampaigns = () => {
    if (allVisibleCampaignsSelected) {
      setSelectedCampaignIds([]);
      setCampaignSelectionMode(false);
      return;
    }
    setSelectedCampaignIds(pagedCampaigns.map((item) => item._id).filter(Boolean));
  };

  const handleDeleteSelectedCalls = async () => {
    if (!selectedCallSids.length) return;
    try {
      setHistoryError('');
      await apiService.bulkDeleteCallLogs(selectedCallSids);
      setCallHistory((prev) => prev.filter((item) => !selectedCallSids.includes(item.callSid)));
      setSelectedCallSids([]);
    } catch (err) {
      setHistoryError(err?.response?.data?.message || err?.message || 'Failed to delete call logs');
    }
  };

  const handleDeleteSelectedCampaigns = async () => {
    if (!selectedCampaignIds.length) return;
    try {
      setCampaignError('');
      await apiService.bulkDeleteOutboundCampaigns(selectedCampaignIds);
      setCampaigns((prev) => prev.filter((item) => !selectedCampaignIds.includes(item._id)));
      setSelectedCampaignIds([]);
    } catch (err) {
      setCampaignError(err?.response?.data?.message || err?.message || 'Failed to delete campaigns');
    }
  };

  const renderLiveMonitor = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <BarChart3 size={40} strokeWidth={1.5} />
          </div>
          <h2>Monitor</h2>
          <p>Track the latest single call or bulk campaign after launch.</p>
        </div>
        {!liveMonitor ? (
          <div className="history-empty-state">
            <p>No live activity yet. Start a single call or launch a bulk campaign to monitor it here.</p>
          </div>
        ) : (
          <div className="monitor-grid">
            <div className="monitor-item"><span>Type</span><strong>{liveMonitor.type === 'bulk' ? 'Bulk Campaign' : 'Single Call'}</strong></div>
            <div className="monitor-item"><span>Status</span><strong>{liveMonitor.status || 'initiated'}</strong></div>
            <div className="monitor-item"><span>Provider</span><strong>{liveMonitor.provider || '-'}</strong></div>
            {liveMonitor.callSid ? <div className="monitor-item"><span>Call SID</span><strong>{liveMonitor.callSid}</strong></div> : null}
            {liveMonitor.campaignId ? <div className="monitor-item"><span>Campaign ID</span><strong>{liveMonitor.campaignId}</strong></div> : null}
            {liveMonitor.campaignName ? <div className="monitor-item"><span>Campaign Name</span><strong>{liveMonitor.campaignName}</strong></div> : null}
            {liveMonitor.to ? <div className="monitor-item"><span>Recipient</span><strong>{liveMonitor.to}</strong></div> : null}
            {liveMonitor.contactCount ? <div className="monitor-item"><span>Contacts</span><strong>{liveMonitor.contactCount}</strong></div> : null}
            <div className="monitor-item"><span>Schedule</span><strong>{liveMonitor.scheduleType || 'immediate'}</strong></div>
            {liveMonitor.scheduledAt ? <div className="monitor-item"><span>Scheduled At</span><strong>{formatDateTime(liveMonitor.scheduledAt)}</strong></div> : null}
            {liveMonitor.recurrence ? <div className="monitor-item"><span>Recurrence</span><strong>{liveMonitor.recurrence}</strong></div> : null}
            <div className="monitor-item"><span>Workflow</span><strong>{liveMonitor.workflowId || '-'}</strong></div>
            <div className="monitor-item"><span>Voice</span><strong>{liveMonitor.voiceId || '-'}</strong></div>
            <div className="monitor-item monitor-item-wide"><span>Message</span><strong>{liveMonitor.customMessage || '-'}</strong></div>
            <div className="monitor-item monitor-item-wide"><span>Last Updated</span><strong>{formatDateTime(liveMonitor.updatedAt)}</strong></div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCallHistory = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <History size={40} strokeWidth={1.5} />
          </div>
          <h2>Call History</h2>
          <p>Instantly updated outbound history — see your latest activity live!</p>
        </div>
        {historyError && <div className="outbound-error">{historyError}</div>}
        <div className="history-filter-bar">
          <label className="history-filter-field">
            <span>Search</span>
            <div className="history-search-wrap">
              <Search size={14} />
              <input
                value={historyFilters.phoneNumber}
                onChange={(e) => setHistoryFilters((prev) => ({ ...prev, phoneNumber: e.target.value, page: 1 }))}
                placeholder="+91..."
              />
            </div>
          </label>
          <button
            type="button"
            className={`filter-toggle-btn ${showHistoryFilters ? 'active' : ''}`}
            onClick={() => {
              setShowHistoryFilters((prev) => {
                const next = !prev;
                if (!next && selectedCallSids.length === 0) {
                  setCallSelectionMode(false);
                }
                return next;
              });
            }}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {showHistoryFilters && (
          <div className="filter-panel history-filter-panel">
            <label className="history-filter-field"><span>Status</span><select value={historyFilters.status} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}><option value="all">All</option><option value="initiated">Initiated</option><option value="ringing">Ringing</option><option value="in-progress">In Progress</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="busy">Busy</option><option value="no-answer">No Answer</option><option value="cancelled">Cancelled</option></select></label>
            <label className="history-filter-field"><span>From</span><input type="date" value={historyFilters.startDate} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))} /></label>
            <label className="history-filter-field"><span>To</span><input type="date" value={historyFilters.endDate} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))} /></label>
            <label className="history-filter-field"><span>Rows</span><select value={historyFilters.limit} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
            <div className="history-filter-field filter-actions">
              <span>Select</span>
              <button
                type="button"
                className="filter-action-btn"
                onClick={() => {
                  setCallSelectionMode(true);
                  toggleSelectAllCalls();
                }}
              >
                {allVisibleCallsSelected ? 'Clear All Visible' : 'Select All Visible'}
              </button>
            </div>
            <div className="history-filter-field filter-actions delete-action">
              <button
                type="button"
                className="filter-action-btn danger icon-only"
                onClick={handleDeleteSelectedCalls}
                disabled={selectedCallSids.length === 0}
                aria-label="Delete selected calls"
                title={selectedCallSids.length ? `Delete selected (${selectedCallSids.length})` : 'Delete selected'}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
        <div className={`history-table history-table-advanced ${callSelectionMode ? 'selection-mode' : ''}`}>
          <div className="table-header history-table-header-advanced"><span /><span>Call SID</span><span>Phone</span><span>Status</span><span>Duration</span><span>Created</span><span>Monitor</span></div>
          {callHistory.length === 0 ? (
            <div className="table-row history-table-row-advanced history-empty-row"><span>No call history found.</span><span /><span /><span /><span /><span /><span /></div>
          ) : (
            callHistory.map((item) => (
              <div key={item._id || item.callSid} className="table-row history-table-row-advanced">
                <span className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCallSids.includes(item.callSid)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedCallSids((prev) =>
                        checked ? [...prev, item.callSid] : prev.filter((sid) => sid !== item.callSid)
                      );
                    }}
                  />
                </span>
                <span className="phone-number">{item.callSid || '-'}</span>
                <span className="phone-number">{item.phoneNumber || '-'}</span>
                <span className={`status ${String(item.status || '').toLowerCase()}`}>{item.status || '-'}</span>
                <span className="duration">{Number(item.duration || 0)}s</span>
                <span className="time">{formatDateTime(item.createdAt)}</span>
                <span className="actions">
                  <a
                    className="action-link"
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLiveMonitor({
                        type: 'single',
                        title: 'Single Call',
                        status: item.status || 'initiated',
                        callSid: item.callSid || '',
                        to: item.phoneNumber || '',
                        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
                      });
                      setActiveTab('monitor');
                    }}
                  >
                    View Monitor
                  </a>
                </span>
              </div>
            ))
          )}
        </div>
        <div className="history-toolbar">
          <div className="history-pagination-bar">
            <span>{historyInfo}</span>
            <div className="history-pager">
              <button type="button" disabled={historyPagination.page <= 1 || loadingHistory} onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page - 1 }))}>Prev</button>
              <span>{historyPagination.page} / {Math.max(1, historyPagination.totalPages)}</span>
              <button type="button" disabled={historyPagination.page >= historyPagination.totalPages || loadingHistory} onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCampaignList = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <ListChecks size={40} strokeWidth={1.5} />
          </div>
          <h2>Campaign List</h2>
          <p>Scheduled, recurring, and draft campaigns stay instantly up-to-date</p>
        </div>
        {campaignError && <div className="outbound-error">{campaignError}</div>}
        <div className="history-filter-bar">
          <label className="history-filter-field">
            <span>Search</span>
            <div className="history-search-wrap">
              <Search size={14} />
              <input
                value={campaignFilters.search}
                onChange={(e) => setCampaignFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Campaign name or ID"
              />
            </div>
          </label>
          <button
            type="button"
            className={`filter-toggle-btn ${showCampaignFilters ? 'active' : ''}`}
            onClick={() => {
              setShowCampaignFilters((prev) => {
                const next = !prev;
                if (!next && selectedCampaignIds.length === 0) {
                  setCampaignSelectionMode(false);
                }
                return next;
              });
            }}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {showCampaignFilters && (
          <div className="filter-panel campaign-filter-panel">
            <label className="history-filter-field"><span>Status</span><select value={campaignFilters.status} onChange={(e) => setCampaignFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}><option value="all">All</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="running">Running</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="partial">Partial</option><option value="paused">Paused</option></select></label>
            <label className="history-filter-field"><span>Recurrence</span><select value={campaignFilters.recurrence} onChange={(e) => setCampaignFilters((prev) => ({ ...prev, recurrence: e.target.value, page: 1 }))}><option value="all">All</option><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
            <label className="history-filter-field"><span>Rows</span><select value={campaignFilters.limit} onChange={(e) => setCampaignFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
            <div className="history-filter-field filter-actions">
              <span>Select</span>
              <button
                type="button"
                className="filter-action-btn"
                onClick={() => {
                  setCampaignSelectionMode(true);
                  toggleSelectAllCampaigns();
                }}
              >
                {allVisibleCampaignsSelected ? 'Clear All Visible' : 'Select All Visible'}
              </button>
            </div>
            <div className="history-filter-field filter-actions delete-action">
              <button
                type="button"
                className="filter-action-btn danger icon-only"
                onClick={handleDeleteSelectedCampaigns}
                disabled={selectedCampaignIds.length === 0}
                aria-label="Delete selected campaigns"
                title="Delete selected"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
        <div className={`history-table history-table-advanced ${campaignSelectionMode ? 'selection-mode' : ''}`}>
          <div className="table-header campaign-table-header-advanced"><span /><span>Campaign</span><span>Status</span><span>Mode</span><span>Recurrence</span><span>Updated</span><span>Monitor</span></div>
          {pagedCampaigns.length === 0 ? (
            <div className="table-row campaign-table-row-advanced history-empty-row"><span>No campaigns found.</span><span /><span /><span /><span /><span /><span /></div>
          ) : (
            pagedCampaigns.map((item) => (
              <div key={item._id} className="table-row campaign-table-row-advanced">
                <span className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCampaignIds.includes(item._id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedCampaignIds((prev) =>
                        checked ? [...prev, item._id] : prev.filter((id) => id !== item._id)
                      );
                    }}
                  />
                </span>
                <span className="phone-number"><strong>{item.campaignName}</strong><br /><small>{item.campaignId}</small></span>
                <span className={`status ${String(item.status || '').toLowerCase()}`}>{item.status}</span>
                <span className="duration">{item.mode || 'immediate'}</span>
                <span className="duration">{item.recurrence || 'none'}</span>
                <span className="time">{formatDateTime(item.updatedAt)}</span>
                <span className="actions">
                  <a
                    className="action-link"
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setLiveMonitor({
                        type: 'bulk',
                        title: 'Bulk Campaign',
                        status: item.status,
                        campaignId: item.campaignId,
                        campaignName: item.campaignName,
                        provider: item.provider || '',
                        scheduleType: item.mode || 'immediate',
                        recurrence: item.recurrence || 'none',
                        scheduledAt: item.schedule?.scheduledAt || null,
                        updatedAt: item.updatedAt
                      });
                      setActiveTab('monitor');
                    }}
                  >
                    View Monitor
                  </a>
                </span>
              </div>
            ))
          )}
        </div>
        <div className="history-toolbar">
          <div className="history-pagination-bar">
            <span>{campaignInfo}</span>
            <div className="history-pager">
              <button type="button" disabled={campaignPagination.page <= 1 || loadingCampaigns} onClick={() => setCampaignFilters((prev) => ({ ...prev, page: prev.page - 1 }))}>Prev</button>
              <span>{campaignPagination.page} / {Math.max(1, campaignPagination.totalPages)}</span>
              <button type="button" disabled={campaignPagination.page >= campaignPagination.totalPages || loadingCampaigns} onClick={() => setCampaignFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="outbound-call">
      <button className="btn-link" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: 0 }} onClick={() => window.history.back()} aria-label="Back to Dashboard">
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>
      <div className="outbound-header">
        <div className="header-content">
          <h1>Outbound Call Management</h1>
          <p>Manage outbound calls, scheduling, and voice broadcasts</p>
          <div className="connection-status">
            <span className="status-connected">
              <span className="status-dot" aria-hidden="true" />
              System Active
            </span>
          </div>
        </div>
        <div className="header-actions" />
      </div>
      <div className="outbound-tabs">
        <button className={`outbound-tab-btn ${activeTab === 'quick' ? 'active' : ''}`} onClick={() => setActiveTab('quick')}><PhoneOutgoing size={18} />Quick Calls</button>
        <button className={`outbound-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><History size={18} />History</button>
        <button className={`outbound-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`} onClick={() => setActiveTab('campaigns')}><ListChecks size={18} />Campaign List</button>
        {showMonitorTab && (
          <button className={`outbound-tab-btn ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}><BarChart3 size={18} />Monitor</button>
        )}
      </div>
      {liveCallStatus && (
        <div className="live-call-banner">
          <div className="live-call-content">
            <div className="live-call-info">
              <div className="live-indicator"><div className="live-dot" /><span>Live Call</span></div>
              <span className="live-number">{liveCallStatus.phoneNumber}</span>
              <span className="live-duration">{Math.floor((Date.now() - new Date(liveCallStatus.startTime)) / 1000)}s</span>
            </div>
            <div className="live-call-controls">
              <button className="call-control-btn mute"><Mic size={16} /></button>
              <button className="call-control-btn end" onClick={() => handleEndCall(liveCallStatus.callSid)}><Phone size={16} /></button>
            </div>
          </div>
        </div>
      )}
      <div className="outbound-content">
        {activeTab === 'quick' && <OutboundDialer showBulkUpload callSettings={callSettings} onCallSettingsChange={setCallSettings} onMonitorUpdate={handleMonitorUpdate} />}
        {activeTab === 'history' && renderCallHistory()}
        {activeTab === 'campaigns' && renderCampaignList()}
        {activeTab === 'monitor' && renderLiveMonitor()}
      </div>
      {result && (
        <div className="status-card success">
          <div className="status-icon"><CheckCircle size={24} /></div>
          <div className="status-content">
            <h3>Success</h3>
            <p>{result.message || 'Operation completed successfully'}</p>
            {(result.call_sid || result.data?.callSid || result.data?.call_sid) && <span className="sid-badge">SID: {result.call_sid || result.data?.callSid || result.data?.call_sid}</span>}
          </div>
        </div>
      )}
      {error && (
        <div className="status-card error">
          <div className="status-icon"><AlertCircle size={24} /></div>
          <div className="status-content">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundCall;
