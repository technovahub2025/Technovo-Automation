import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart3,
  CalendarClock,
  Eye,
  Filter,
  History,
  Mic,
  MoreVertical,
  Pause,
  Phone,
  PhoneOutgoing,
  Play,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { useExotelOutbound } from '../../hooks/useBroadcast';
import socketService from '../../services/socketService';
import apiService from '../../services/api';
import OutboundDialer from './OutboundDialer';
import './OutboundCall.css';
import {
  NON_TERMINAL_CALL_STATUSES,
  TERMINAL_CALL_STATUSES,
  deriveOutboundType,
  formatDateTime,
  normalizeHistoryItem,
  normalizeMonitorPayload,
  normalizeScheduledItem,
  normalizeStatus
} from '../../utils/outboundNormalizers';
const MONITOR_ROW_LIMIT = 1000;
const REALTIME_FLUSH_MS = 120;
const FILTER_DEBOUNCE_MS = 300;

const upsertMonitorRows = (rowsByKey, incomingRows = []) => {
  const next = { ...(rowsByKey || {}) };
  incomingRows.filter(Boolean).forEach((incoming) => {
    const previous = next[incoming.key] || {};
    const previousStatus = normalizeStatus(previous.status);
    const incomingStatus = normalizeStatus(incoming.status);
    if (previous.ended && TERMINAL_CALL_STATUSES.has(previousStatus) && NON_TERMINAL_CALL_STATUSES.has(incomingStatus)) {
      next[incoming.key] = {
        ...previous,
        updatedAt: previous.updatedAt || incoming.updatedAt || new Date().toISOString()
      };
      return;
    }
    next[incoming.key] = {
      ...previous,
      ...incoming,
      status: previous.ended && TERMINAL_CALL_STATUSES.has(previousStatus) && !TERMINAL_CALL_STATUSES.has(incomingStatus)
        ? previous.status
        : incoming.status,
      ended: previous.ended && TERMINAL_CALL_STATUSES.has(previousStatus)
        ? true
        : incoming.ended,
      createdAt: previous.createdAt || incoming.createdAt,
      updatedAt: incoming.updatedAt || previous.updatedAt || new Date().toISOString()
    };
  });

  return Object.fromEntries(
    Object.values(next)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, MONITOR_ROW_LIMIT)
      .map((item) => [item.key, item])
  );
};

const matchesHistoryFilters = (item, filters) => {
  const status = normalizeStatus(item?.status);
  const type = deriveOutboundType(item);
  const phoneNumber = String(item?.phoneNumber || item?.to || '').toLowerCase();
  const createdAtValue = item?.createdAt || item?.updatedAt || item?.timestamp;
  const createdAt = createdAtValue ? new Date(createdAtValue) : null;

  if (filters.status !== 'all' && status !== normalizeStatus(filters.status)) return false;
  if (filters.type && filters.type !== 'all' && type !== normalizeStatus(filters.type)) return false;
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
  const formattedIncoming = normalizeHistoryItem(incoming);
  const incomingKey = String(formattedIncoming._id || formattedIncoming.callSid || formattedIncoming.id || '');
  const index = nextItems.findIndex((item) => {
    const itemKey = String(item?._id || item?.callSid || item?.id || '');
    return incomingKey && itemKey === incomingKey;
  });
  const matchesFilters = matchesHistoryFilters(formattedIncoming, filters);

  if (index >= 0) {
    if (matchesFilters) {
      nextItems[index] = { ...nextItems[index], ...formattedIncoming };
    } else {
      nextItems.splice(index, 1);
    }
  } else if (matchesFilters) {
    nextItems.unshift(formattedIncoming);
  }

  nextItems.sort((a, b) => new Date(b?.createdAt || b?.updatedAt || b?.timestamp || 0) - new Date(a?.createdAt || a?.updatedAt || a?.timestamp || 0));
  return nextItems.slice(0, pagination.limit || filters.limit || 10);
};

const OutboundCall = () => {
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
    type: 'all',
    phoneNumber: '',
    startDate: '',
    endDate: ''
  });
  const [debouncedHistoryFilters, setDebouncedHistoryFilters] = useState(historyFilters);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [selectedCallSids, setSelectedCallSids] = useState([]);
  const [callSelectionMode, setCallSelectionMode] = useState(false);
  const [scheduleFilters, setScheduleFilters] = useState({
    search: '',
    status: 'all',
    recurrence: 'all',
    type: 'all',
    page: 1,
    limit: 10
  });
  const [debouncedScheduleFilters, setDebouncedScheduleFilters] = useState(scheduleFilters);
  const [scheduledItems, setScheduledItems] = useState([]);
  const [schedulePagination, setSchedulePagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [showScheduleFilters, setShowScheduleFilters] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [scheduleSelectionMode, setScheduleSelectionMode] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [scheduleDrawerItem, setScheduleDrawerItem] = useState(null);
  const [monitorRowsByKey, setMonitorRowsByKey] = useState({});
  const [selectedMonitorKey, setSelectedMonitorKey] = useState('');
  const [liveCallStatus, setLiveCallStatus] = useState(null);
  const pendingMonitorRowsRef = useRef([]);
  const monitorFlushTimerRef = useRef(null);
  const endedCallSidsRef = useRef(new Set());
  const realtimeQueueRef = useRef({ calls: new Map(), statuses: new Map(), campaigns: new Map() });
  const realtimeFlushTimerRef = useRef(null);
  const scheduleRefreshTimerRef = useRef(null);
  const historyRequestSeqRef = useRef(0);
  const scheduleRequestSeqRef = useRef(0);
  const historyFiltersRef = useRef(debouncedHistoryFilters);
  const historyPaginationRef = useRef(historyPagination);

  useExotelOutbound();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedHistoryFilters(historyFilters);
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [historyFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedScheduleFilters(scheduleFilters);
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [scheduleFilters]);

  useEffect(() => {
    historyFiltersRef.current = debouncedHistoryFilters;
  }, [debouncedHistoryFilters]);

  useEffect(() => {
    historyPaginationRef.current = historyPagination;
  }, [historyPagination]);

  const loadHistory = useCallback(async () => {
    const requestSeq = historyRequestSeqRef.current + 1;
    historyRequestSeqRef.current = requestSeq;
    try {
      setLoadingHistory(true);
      setHistoryError('');
      const params = { ...debouncedHistoryFilters, limit: Math.min(Number(debouncedHistoryFilters.limit || 10), 100), direction: 'outbound-local' };
      if (params.status === 'all') delete params.status;
      if (params.type === 'all') delete params.type;
      if (!params.phoneNumber) delete params.phoneNumber;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const response = await apiService.getCallHistory(params);
      if (requestSeq !== historyRequestSeqRef.current) return;
      const payload = response?.data || {};
      setHistoryPagination(payload?.pagination || payload?.meta?.pagination || { page: 1, totalPages: 1, total: 0, limit: params.limit });
      setCallHistory((payload?.data || []).map(normalizeHistoryItem));
    } catch (err) {
      if (requestSeq !== historyRequestSeqRef.current) return;
      setHistoryError(err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Failed to load call history');
      setCallHistory([]);
    } finally {
      if (requestSeq === historyRequestSeqRef.current) setLoadingHistory(false);
    }
  }, [debouncedHistoryFilters]);

  const loadScheduledMonitor = useCallback(async () => {
    const requestSeq = scheduleRequestSeqRef.current + 1;
    scheduleRequestSeqRef.current = requestSeq;
    try {
      setLoadingSchedules(true);
      setScheduleError('');
      const params = {
        ...debouncedScheduleFilters,
        limit: Math.min(Number(debouncedScheduleFilters.limit || 10), 100)
      };
      if (!params.search) delete params.search;
      if (params.status === 'all') delete params.status;
      if (params.recurrence === 'all') delete params.recurrence;
      if (params.type === 'all') delete params.type;

      const response = await apiService.getOutboundSchedules(params);
      if (requestSeq !== scheduleRequestSeqRef.current) return;
      const payload = response?.data || {};
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.schedules) ? payload.schedules : [];
      setSchedulePagination(payload?.pagination || payload?.meta?.pagination || { page: params.page || 1, totalPages: 1, total: list.length, limit: params.limit });
      setScheduledItems(list.map(normalizeScheduledItem));
    } catch (err) {
      if (requestSeq !== scheduleRequestSeqRef.current) return;
      setScheduleError(err?.response?.data?.message || err?.message || 'Failed to load scheduled monitor');
      setScheduledItems([]);
      setSchedulePagination({ page: 1, totalPages: 1, total: 0, limit: debouncedScheduleFilters.limit || 10 });
    } finally {
      if (requestSeq === scheduleRequestSeqRef.current) setLoadingSchedules(false);
    }
  }, [debouncedScheduleFilters]);

  const queueScheduleRefresh = useCallback(() => {
    if (scheduleRefreshTimerRef.current) return;
    scheduleRefreshTimerRef.current = window.setTimeout(() => {
      scheduleRefreshTimerRef.current = null;
      loadScheduledMonitor();
    }, FILTER_DEBOUNCE_MS);
  }, [loadScheduledMonitor]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'scheduled') loadScheduledMonitor();
  }, [activeTab, loadHistory, loadScheduledMonitor]);

  const monitorRows = useMemo(
    () => Object.values(monitorRowsByKey).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [monitorRowsByKey]
  );

  const selectedMonitor = useMemo(() => {
    if (selectedMonitorKey && monitorRowsByKey[selectedMonitorKey]) return monitorRowsByKey[selectedMonitorKey];
    return monitorRows[0] || null;
  }, [monitorRows, monitorRowsByKey, selectedMonitorKey]);

  const queueMonitorRows = useCallback((rows = []) => {
    const normalizedRows = rows.map(normalizeMonitorPayload).filter(Boolean);
    if (!normalizedRows.length) return;

    pendingMonitorRowsRef.current.push(...normalizedRows);

    if (monitorFlushTimerRef.current) return;
    monitorFlushTimerRef.current = window.setTimeout(() => {
      const pendingRows = pendingMonitorRowsRef.current;
      pendingMonitorRowsRef.current = [];
      monitorFlushTimerRef.current = null;
      if (!pendingRows.length) return;

      pendingRows.forEach((row) => {
        if (row.callSid && row.ended) {
          endedCallSidsRef.current.add(row.callSid);
        }
      });
      setMonitorRowsByKey((prev) => upsertMonitorRows(prev, pendingRows));
      setSelectedMonitorKey((prev) => prev || pendingRows[0]?.key || '');

      const latestSingle = [...pendingRows].reverse().find((row) => row.type === 'single' && row.callSid);
      if (latestSingle) {
        setLiveCallStatus((prev) => {
          if (endedCallSidsRef.current.has(latestSingle.callSid)) {
            return prev?.callSid === latestSingle.callSid ? null : prev;
          }
          if (latestSingle.ended) {
            return prev?.callSid === latestSingle.callSid ? null : prev;
          }
          return {
            callSid: latestSingle.callSid,
            phoneNumber: latestSingle.phoneNumber || latestSingle.to,
            startTime: latestSingle.createdAt || latestSingle.updatedAt || new Date().toISOString(),
            status: latestSingle.status
          };
        });
      }
    }, REALTIME_FLUSH_MS);
  }, []);

  useEffect(() => {
    const socket = socketService.connect();

    const flushRealtimeQueue = () => {
      realtimeFlushTimerRef.current = null;
      const queued = realtimeQueueRef.current;
      realtimeQueueRef.current = { calls: new Map(), statuses: new Map(), campaigns: new Map() };

      const callUpdates = Array.from(queued.calls.values());
      const statusUpdates = Array.from(queued.statuses.values());
      const campaignUpdates = Array.from(queued.campaigns.values());
      const monitorPayloads = [];

      if (callUpdates.length || statusUpdates.length) {
        setCallHistory((prev) => {
          let next = prev;
          callUpdates.forEach((data = {}) => {
            next = upsertHistoryItem(next, {
              _id: data._id,
              callSid: data.callSid,
              phoneNumber: data.phoneNumber || data.to || data.phone,
              status: data.status,
              duration: data.duration,
              createdAt: data.createdAt || data.timestamp,
              updatedAt: data.updatedAt || data.timestamp,
              providerData: data.providerData || data.metadata || data.rawResponse?.providerData || {},
              campaignName: data.campaignName || '',
              campaignId: data.campaignId || ''
            }, historyFiltersRef.current, historyPaginationRef.current);
          });

          statusUpdates.forEach((data = {}) => {
            next = upsertHistoryItem(next, {
              callSid: data.callSid,
              status: data.status,
              updatedAt: data?.execution?.updatedAt || new Date().toISOString(),
              createdAt: data?.execution?.createdAt || data?.execution?.startedAt || new Date().toISOString(),
              phoneNumber: data?.execution?.phoneNumber || data?.execution?.to,
              providerData: data?.execution?.providerData || {}
            }, historyFiltersRef.current, historyPaginationRef.current);
          });

          return next;
        });
      }

      callUpdates.forEach((data = {}) => {
        monitorPayloads.push(data);
        const status = normalizeStatus(data.status);
        if (TERMINAL_CALL_STATUSES.has(status)) {
          if (data.callSid) endedCallSidsRef.current.add(data.callSid);
          setLiveCallStatus((prev) => (prev?.callSid === data.callSid ? null : prev));
        }
      });

      statusUpdates.forEach((data = {}) => {
        const status = normalizeStatus(data.status);
        if (TERMINAL_CALL_STATUSES.has(status) && data.callSid) {
          endedCallSidsRef.current.add(data.callSid);
        }
        monitorPayloads.push({
          type: 'single',
          callSid: data.callSid,
          status: data.status,
          phoneNumber: data?.execution?.phoneNumber || data?.execution?.to,
          updatedAt: data?.execution?.updatedAt || new Date().toISOString(),
          createdAt: data?.execution?.createdAt || data?.execution?.startedAt,
          ended: TERMINAL_CALL_STATUSES.has(status)
        });
        setLiveCallStatus((prev) => {
          if (!prev || prev.callSid !== data.callSid) return prev;
          return TERMINAL_CALL_STATUSES.has(status) ? null : { ...prev, status: data.status };
        });
      });

      if (campaignUpdates.length) {
        campaignUpdates.forEach((incomingCampaign) => {
          const metadata = incomingCampaign.metadata || {};
          const originType = String(incomingCampaign.campaignType || incomingCampaign.originType || metadata.originType || '').trim().toLowerCase();
          const scheduleEnabled = Boolean(incomingCampaign.schedule?.enabled || incomingCampaign.mode === 'scheduled' || incomingCampaign.mode === 'recurring');
          if (scheduleEnabled || ['scheduled', 'paused', 'completed', 'failed'].includes(normalizeStatus(incomingCampaign.status))) {
            queueScheduleRefresh();
          }
          monitorPayloads.push({
            type: originType === 'single' ? 'single' : 'bulk',
            campaignType: originType || 'bulk',
            campaignId: incomingCampaign.campaignId,
            campaignDbId: incomingCampaign._id,
            campaignName: incomingCampaign.campaignName || incomingCampaign.name,
            provider: incomingCampaign.provider,
            status: incomingCampaign.status,
            phoneNumber: incomingCampaign.phoneNumber || incomingCampaign.recipientPhone || metadata.singleRecipient || '',
            contactCount: incomingCampaign.contactSummary?.total || metadata.contactCount || '',
            metadata,
            scheduleType: incomingCampaign.schedule?.scheduleType || incomingCampaign.mode,
            recurrence: incomingCampaign.schedule?.recurrence,
            scheduledAt: incomingCampaign.schedule?.scheduledAt,
            workflowId: incomingCampaign.ivrWorkflow?.workflowId || metadata.workflowId || '',
            voiceId: incomingCampaign.voice?.voiceId || metadata.voiceId || '',
            customMessage: incomingCampaign.message || '',
            updatedAt: incomingCampaign.updatedAt || incomingCampaign.timestamp || new Date().toISOString()
          });
        });
      }

      if (monitorPayloads.length) {
        queueMonitorRows(monitorPayloads);
      }
    };

    const scheduleRealtimeFlush = () => {
      if (realtimeFlushTimerRef.current) return;
      realtimeFlushTimerRef.current = window.setTimeout(flushRealtimeQueue, REALTIME_FLUSH_MS);
    };

    const handleOutboundCallUpdate = (data = {}) => {
      const key = String(data.callSid || data._id || `${data.campaignId || ''}:${data.contactId || ''}`).trim();
      if (!key) return;
      realtimeQueueRef.current.calls.set(key, data);
      scheduleRealtimeFlush();
    };

    const handleCallStatusUpdate = (data = {}) => {
      const key = String(data.callSid || '').trim();
      if (!key) return;
      realtimeQueueRef.current.statuses.set(key, data);
      scheduleRealtimeFlush();
    };

    const handleCampaignUpdate = (payload = {}) => {
      if (payload?.schedule || Array.isArray(payload?.scheduleIds)) {
        if (payload.action === 'schedule_deleted') {
          const deletedIds = new Set((payload.scheduleIds || []).map((id) => String(id)));
          setScheduledItems((prev) => prev.filter((item) => !deletedIds.has(String(item.id || item._id))));
          setSelectedScheduleIds((prev) => prev.filter((id) => !deletedIds.has(String(id))));
          setScheduleDrawerItem((prev) => (prev && deletedIds.has(String(prev.id || prev._id)) ? null : prev));
        } else if (payload.schedule) {
          const normalizedSchedule = normalizeScheduledItem(payload.schedule);
          setScheduledItems((prev) => {
            const scheduleId = String(normalizedSchedule.id || normalizedSchedule._id || '');
            const existingIndex = prev.findIndex((item) => String(item.id || item._id || '') === scheduleId);
            if (existingIndex < 0) return [normalizedSchedule, ...prev];
            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...normalizedSchedule };
            return next;
          });
          setScheduleDrawerItem((prev) => {
            if (!prev) return prev;
            return String(prev.id || prev._id || '') === String(normalizedSchedule.id || normalizedSchedule._id || '')
              ? { ...prev, ...normalizedSchedule }
              : prev;
          });
        }
        queueScheduleRefresh();
      }
      const incomingCampaign = payload?.campaign;
      const key = String(incomingCampaign?._id || incomingCampaign?.campaignId || '').trim();
      if (!key) return;
      realtimeQueueRef.current.campaigns.set(key, {
        ...incomingCampaign,
        timestamp: payload.timestamp
      });
      scheduleRealtimeFlush();
    };

    socket.on('outbound_call_update', handleOutboundCallUpdate);
    socket.on('call_status_update', handleCallStatusUpdate);
    socket.on('campaign_update', handleCampaignUpdate);

    return () => {
      socket.off('outbound_call_update', handleOutboundCallUpdate);
      socket.off('call_status_update', handleCallStatusUpdate);
      socket.off('campaign_update', handleCampaignUpdate);
      if (realtimeFlushTimerRef.current) {
        window.clearTimeout(realtimeFlushTimerRef.current);
        realtimeFlushTimerRef.current = null;
      }
    };
  }, [queueMonitorRows, queueScheduleRefresh]);

  useEffect(() => () => {
    if (monitorFlushTimerRef.current) {
      window.clearTimeout(monitorFlushTimerRef.current);
      monitorFlushTimerRef.current = null;
    }
    if (scheduleRefreshTimerRef.current) {
      window.clearTimeout(scheduleRefreshTimerRef.current);
      scheduleRefreshTimerRef.current = null;
    }
  }, []);

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
    const existingMonitor = Object.values(monitorRowsByKey).find((item) => item.callSid === callSid);
    const endedAt = new Date().toISOString();
    try {
      await apiService.endCall(callSid);
      endedCallSidsRef.current.add(callSid);
      setLiveCallStatus(null);
      setCallHistory((prev) => upsertHistoryItem(prev, {
        callSid,
        status: 'completed',
        updatedAt: endedAt
      }, historyFilters, historyPagination));
      queueMonitorRows([{
        ...existingMonitor,
        type: existingMonitor?.type || 'single',
        callSid,
        status: 'completed',
        ended: true,
        phoneNumber: existingMonitor?.phoneNumber || existingMonitor?.to || liveCallStatus?.phoneNumber || '',
        updatedAt: endedAt
      }]);
    } catch (err) {
      console.error('Failed to end call:', err);
    }
  };

  const handleMonitorUpdate = useCallback((monitorPayload) => {
    const normalized = normalizeMonitorPayload(monitorPayload);
    if (normalized) {
      setMonitorRowsByKey((prev) => upsertMonitorRows(prev, [normalized]));
      setSelectedMonitorKey(normalized.key);
    }
    if (normalized?.type === 'single' && normalized?.callSid && !normalized.ended) {
      setLiveCallStatus({
        callSid: normalized.callSid,
        phoneNumber: normalized.phoneNumber || normalized.to,
        startTime: normalized.createdAt || normalized.updatedAt || new Date().toISOString(),
        status: normalized.status || 'initiated'
      });
    }
    setActiveTab('monitor');
  }, []);

  const showMonitorTab = activeTab === 'monitor' || monitorRows.length > 0;

  const historyInfo = useMemo(() => {
    const start = (historyPagination.page - 1) * historyPagination.limit + 1;
    const end = Math.min(historyPagination.page * historyPagination.limit, historyPagination.total);
    return `${historyPagination.total === 0 ? 0 : start}-${historyPagination.total === 0 ? 0 : end} of ${historyPagination.total}`;
  }, [historyPagination]);

  const scheduleInfo = useMemo(() => {
    const start = (schedulePagination.page - 1) * schedulePagination.limit + 1;
    const end = Math.min(schedulePagination.page * schedulePagination.limit, schedulePagination.total);
    return `${schedulePagination.total === 0 ? 0 : start}-${schedulePagination.total === 0 ? 0 : end} of ${schedulePagination.total}`;
  }, [schedulePagination]);

  useEffect(() => {
    setSelectedCallSids((prev) =>
      prev.filter((sid) => callHistory.some((item) => String(item.callSid) === String(sid)))
    );
  }, [callHistory]);

  useEffect(() => {
    setSelectedScheduleIds((prev) =>
      prev.filter((id) => scheduledItems.some((item) => String(item.id || item._id) === String(id)))
    );
  }, [scheduledItems]);

  useEffect(() => {
    setScheduleDrawerItem((prev) => {
      if (!prev) return prev;
      const prevId = String(prev.id || prev._id || '');
      const latest = scheduledItems.find((item) => String(item.id || item._id || '') === prevId);
      return latest || null;
    });
  }, [scheduledItems]);

  const allVisibleCallsSelected = callHistory.length > 0 && selectedCallSids.length === callHistory.length;
  const allVisibleSchedulesSelected = scheduledItems.length > 0 && selectedScheduleIds.length === scheduledItems.length;

  const toggleSelectAllCalls = () => {
    if (allVisibleCallsSelected) {
      setSelectedCallSids([]);
      setCallSelectionMode(false);
      return;
    }
    setSelectedCallSids(callHistory.map((item) => item.callSid).filter(Boolean));
  };

  const toggleSelectAllSchedules = () => {
    if (allVisibleSchedulesSelected) {
      setSelectedScheduleIds([]);
      setScheduleSelectionMode(false);
      return;
    }
    setSelectedScheduleIds(scheduledItems.map((item) => item.id || item._id).filter(Boolean));
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

  const handleDeleteSelectedSchedules = async () => {
    if (!selectedScheduleIds.length) return;
    try {
      setScheduleError('');
      await apiService.bulkDeleteOutboundSchedules(selectedScheduleIds);
      setScheduledItems((prev) => prev.filter((item) => !selectedScheduleIds.includes(item.id || item._id)));
      setSelectedScheduleIds([]);
      setScheduleSelectionMode(false);
      loadScheduledMonitor();
    } catch (err) {
      setScheduleError(err?.response?.data?.message || err?.message || 'Failed to delete scheduled calls');
    }
  };

  const openMonitorFromHistory = (item = {}) => {
    const monitorItem = normalizeMonitorPayload({
      type: item.type || 'single',
      title: item.type === 'bulk' ? 'Bulk Campaign' : 'Single Call',
      status: item.status || 'initiated',
      callSid: item.callSid || '',
      phoneNumber: item.phoneNumber || '',
      to: item.phoneNumber || '',
      campaignId: item.campaignId || item.providerData?.campaignId || '',
      campaignName: item.campaignName || item.providerData?.campaignName || '',
      workflowId: item.workflowId || item.providerData?.workflowId || '',
      provider: item.provider || item.providerData?.provider || '',
      metadata: item.providerData || {},
      duration: item.duration || 0,
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
    });
    if (monitorItem) {
      setMonitorRowsByKey((prev) => upsertMonitorRows(prev, [monitorItem]));
      setSelectedMonitorKey(monitorItem.key);
    }
    setOpenActionMenu(null);
    setActiveTab('monitor');
  };

  const handleDeleteHistoryItem = async (callSid) => {
    if (!callSid) return;
    try {
      setHistoryError('');
      await apiService.bulkDeleteCallLogs([callSid]);
      setCallHistory((prev) => prev.filter((item) => String(item.callSid) !== String(callSid)));
      setSelectedCallSids((prev) => prev.filter((sid) => String(sid) !== String(callSid)));
      setOpenActionMenu(null);
    } catch (err) {
      setHistoryError(err?.response?.data?.message || err?.message || 'Failed to delete call log');
    }
  };

  const handleDeleteScheduleItem = async (scheduleId) => {
    if (!scheduleId) return;
    try {
      setScheduleError('');
      await apiService.bulkDeleteOutboundSchedules([scheduleId]);
      setScheduledItems((prev) => prev.filter((item) => String(item.id || item._id) !== String(scheduleId)));
      setSelectedScheduleIds((prev) => prev.filter((id) => String(id) !== String(scheduleId)));
      setOpenActionMenu(null);
      loadScheduledMonitor();
    } catch (err) {
      setScheduleError(err?.response?.data?.message || err?.message || 'Failed to delete schedule');
    }
  };

  const toggleActionMenu = (menuKey) => {
    setOpenActionMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  const handleScheduleStatusChange = async (scheduleId, nextAction) => {
    if (!scheduleId) return;
    try {
      setScheduleError('');
      let response;
      if (nextAction === 'pause') {
        response = await apiService.pauseOutboundSchedule(scheduleId);
      } else {
        response = await apiService.resumeOutboundSchedule(scheduleId);
      }
      const normalizedSchedule = response?.data?.schedule ? normalizeScheduledItem(response.data.schedule) : null;
      setScheduledItems((prev) =>
        prev.map((item) =>
          String(item.id || item._id) === String(scheduleId)
            ? {
                ...item,
                ...(normalizedSchedule || {}),
                status: normalizedSchedule?.status || (nextAction === 'pause' ? 'paused' : 'active'),
                updatedAt: normalizedSchedule?.updatedAt || new Date().toISOString()
              }
            : item
        )
      );
      setOpenActionMenu(null);
      loadScheduledMonitor();
    } catch (err) {
      setScheduleError(err?.response?.data?.message || err?.message || `Failed to ${nextAction} schedule`);
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
          <p>Track live and recently ended single calls or bulk campaign contacts.</p>
        </div>
        {monitorRows.length === 0 ? (
          <div className="history-empty-state">
            <p>No live activity yet. Start a single call or launch a bulk campaign to monitor it here.</p>
          </div>
        ) : (
          <>
            <div className="monitor-table">
              <div className="monitor-table-header">
                <span>State</span><span>Type</span><span>Phone</span><span>Status</span><span>Provider</span><span>Campaign</span><span>Workflow</span><span>Duration</span><span>Updated</span>
              </div>
              {monitorRows.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={`monitor-table-row ${selectedMonitor?.key === item.key ? 'selected' : ''}`}
                  onClick={() => setSelectedMonitorKey(item.key)}
                  aria-label={`View ${item.type === 'bulk' ? 'bulk' : 'single'} monitor details`}
                  title="View monitor details"
                >
                  <span><span className={`monitor-state ${item.ended ? 'ended' : 'active'}`}>{item.ended ? 'Final' : 'Active'}</span></span>
                  <span>{item.type === 'bulk' ? 'Bulk' : 'Single'}</span>
                  <span className="phone-number">{item.phoneNumber || item.to || '-'}</span>
                  <span><span className={`status ${String(item.status || '').toLowerCase()}`}>{item.status || '-'}</span></span>
                  <span>{item.provider || '-'}</span>
                  <span>{item.campaignName || item.campaignId || '-'}</span>
                  <span>{item.workflowId || '-'}</span>
                  <span>{Number(item.duration || 0)}s</span>
                  <span>{formatDateTime(item.updatedAt)}</span>
                </button>
              ))}
            </div>

            {selectedMonitor ? (
              <div className="monitor-grid monitor-detail-grid">
                <div className="monitor-item"><span>Type</span><strong>{selectedMonitor.type === 'bulk' ? 'Bulk Campaign' : 'Single Call'}</strong></div>
                <div className="monitor-item"><span>Status</span><strong>{selectedMonitor.status || 'initiated'}</strong></div>
                <div className="monitor-item"><span>Provider</span><strong>{selectedMonitor.provider || '-'}</strong></div>
                {selectedMonitor.callSid ? <div className="monitor-item"><span>Call SID</span><strong>{selectedMonitor.callSid}</strong></div> : null}
                {selectedMonitor.campaignId ? <div className="monitor-item"><span>Campaign ID</span><strong>{selectedMonitor.campaignId}</strong></div> : null}
                {selectedMonitor.campaignName ? <div className="monitor-item"><span>Campaign Name</span><strong>{selectedMonitor.campaignName}</strong></div> : null}
                {selectedMonitor.phoneNumber || selectedMonitor.to ? <div className="monitor-item"><span>Recipient</span><strong>{selectedMonitor.phoneNumber || selectedMonitor.to}</strong></div> : null}
                {selectedMonitor.contactCount ? <div className="monitor-item"><span>Contacts</span><strong>{selectedMonitor.contactCount}</strong></div> : null}
                <div className="monitor-item"><span>Schedule</span><strong>{selectedMonitor.scheduleType || 'immediate'}</strong></div>
                {selectedMonitor.scheduledAt ? <div className="monitor-item"><span>Scheduled At</span><strong>{formatDateTime(selectedMonitor.scheduledAt)}</strong></div> : null}
                {selectedMonitor.recurrence ? <div className="monitor-item"><span>Recurrence</span><strong>{selectedMonitor.recurrence}</strong></div> : null}
                <div className="monitor-item"><span>Workflow</span><strong>{selectedMonitor.workflowId || '-'}</strong></div>
                <div className="monitor-item"><span>Voice</span><strong>{selectedMonitor.voiceId || '-'}</strong></div>
                <div className="monitor-item monitor-item-wide"><span>Message</span><strong>{selectedMonitor.customMessage || '-'}</strong></div>
                <div className="monitor-item monitor-item-wide"><span>Last Updated</span><strong>{formatDateTime(selectedMonitor.updatedAt)}</strong></div>
              </div>
            ) : null}
          </>
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
          <p>Instantly updated outbound history - see your latest activity live.</p>
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
            aria-label={showHistoryFilters ? 'Hide history filters' : 'Show history filters'}
            title={showHistoryFilters ? 'Hide history filters' : 'Show history filters'}
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
            <label className="history-filter-field"><span>Type</span><select value={historyFilters.type} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))}><option value="all">All</option><option value="single">Single</option><option value="bulk">Bulk</option></select></label>
            <label className="history-filter-field"><span>From</span><input type="date" value={historyFilters.startDate} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))} /></label>
            <label className="history-filter-field"><span>To</span><input type="date" value={historyFilters.endDate} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))} /></label>
            <label className="history-filter-field"><span>Rows</span><select value={historyFilters.limit} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
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
          <div className="table-header history-table-header-advanced"><span /><span>Call SID</span><span>Type</span><span>Phone</span><span>Status</span><span>Duration</span><span>Created</span><span>Actions</span></div>
          {callHistory.length === 0 ? (
            <div className="table-row history-table-row-advanced history-empty-row"><span>No call history found.</span><span /><span /><span /><span /><span /><span /><span /></div>
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
                <span className="duration">{item.type === 'bulk' ? 'Bulk' : 'Single'}</span>
                <span className="phone-number">{item.phoneNumber || '-'}</span>
                <span className={`status ${String(item.status || '').toLowerCase()}`}>{item.status || '-'}</span>
                <span className="duration">{Number(item.duration || 0)}s</span>
                <span className="time">{formatDateTime(item.createdAt)}</span>
                <span className="actions">
                  <div className="row-action-menu">
                    <button
                      type="button"
                      className="row-action-trigger"
                      onClick={() => toggleActionMenu(`history:${item._id || item.callSid}`)}
                      aria-label="Call actions"
                      title="Call actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openActionMenu === `history:${item._id || item.callSid}` && (
                      <div className="row-action-dropdown">
                        <button type="button" onClick={() => openMonitorFromHistory(item)} title="View monitor">
                          <Eye size={14} />
                        </button>
                        <button type="button" className="danger" onClick={() => handleDeleteHistoryItem(item.callSid)} title="Delete call log">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </span>
              </div>
            ))
          )}
        </div>
        <div className="history-toolbar">
          <div className="history-pagination-bar">
            <span>{historyInfo}</span>
            <div className="history-pager">
              <button type="button" disabled={historyPagination.page <= 1 || loadingHistory} onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page - 1 }))} aria-label="Previous history page" title="Previous history page">Prev</button>
              <span>{historyPagination.page} / {Math.max(1, historyPagination.totalPages)}</span>
              <button type="button" disabled={historyPagination.page >= historyPagination.totalPages || loadingHistory} onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page + 1 }))} aria-label="Next history page" title="Next history page">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScheduledMonitor = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <CalendarClock size={40} strokeWidth={1.5} />
          </div>
          <h2>Scheduled Monitor</h2>
          <p>Track scheduled single calls and bulk campaigns without mixing them into call history.</p>
        </div>
        {scheduleError && <div className="outbound-error">{scheduleError}</div>}
        <div className="history-filter-bar">
          <label className="history-filter-field">
            <span>Search</span>
            <div className="history-search-wrap">
              <Search size={14} />
              <input
                value={scheduleFilters.search}
                onChange={(e) => setScheduleFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Campaign, phone, or ID"
              />
            </div>
          </label>
          <button
            type="button"
            className={`filter-toggle-btn ${showScheduleFilters ? 'active' : ''}`}
            aria-label={showScheduleFilters ? 'Hide schedule filters' : 'Show schedule filters'}
            title={showScheduleFilters ? 'Hide schedule filters' : 'Show schedule filters'}
            onClick={() => setShowScheduleFilters((prev) => !prev)}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {showScheduleFilters && (
          <div className="filter-panel scheduled-filter-panel">
            <label className="history-filter-field"><span>Status</span><select value={scheduleFilters.status} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}><option value="all">All</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="failed">Failed</option></select></label>
            <label className="history-filter-field"><span>Type</span><select value={scheduleFilters.type} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))}><option value="all">All</option><option value="single">Single</option><option value="bulk">Bulk</option></select></label>
            <label className="history-filter-field"><span>Recurrence</span><select value={scheduleFilters.recurrence} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, recurrence: e.target.value, page: 1 }))}><option value="all">All</option><option value="once">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
            <label className="history-filter-field"><span>Rows</span><select value={scheduleFilters.limit} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
            <div className="history-filter-field filter-actions">
              <span>Select</span>
              <button
                type="button"
                className="filter-action-btn"
                aria-label={allVisibleSchedulesSelected ? 'Clear all visible schedules' : 'Select all visible schedules'}
                title={allVisibleSchedulesSelected ? 'Clear all visible schedules' : 'Select all visible schedules'}
                onClick={() => {
                  setScheduleSelectionMode(true);
                  toggleSelectAllSchedules();
                }}
              >
                {allVisibleSchedulesSelected ? 'Clear All Visible' : 'Select All Visible'}
              </button>
            </div>
            <div className="history-filter-field filter-actions delete-action">
              <button
                type="button"
                className="filter-action-btn danger icon-only"
                onClick={handleDeleteSelectedSchedules}
                disabled={selectedScheduleIds.length === 0}
                aria-label="Delete selected schedules"
                title={selectedScheduleIds.length ? `Delete selected (${selectedScheduleIds.length})` : 'Delete selected'}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={`history-table scheduled-monitor-table ${scheduleSelectionMode ? 'selection-mode' : ''}`}>
          <div className="table-header scheduled-monitor-table-header"><span /><span>State</span><span>Type</span><span>Phone/Contacts</span><span>Status</span><span>Provider</span><span>Campaign</span><span>Workflow</span><span>Schedule</span><span>Next Run</span><span>Updated</span><span>Actions</span></div>
          {scheduledItems.length === 0 ? (
            <div className="table-row scheduled-monitor-table-row history-empty-row"><span>{loadingSchedules ? 'Loading scheduled calls...' : 'No scheduled calls found.'}</span><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          ) : (
            scheduledItems.map((item) => {
              const itemId = item.id || item._id;
              const status = String(item.status || '').toLowerCase();
              const isTerminalSchedule = ['completed', 'failed'].includes(status);
              return (
                <React.Fragment key={itemId || item.campaignId}>
                  <div className="table-row scheduled-monitor-table-row">
                    <span className="table-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedScheduleIds.includes(itemId)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedScheduleIds((prev) =>
                            checked ? [...prev, itemId] : prev.filter((id) => id !== itemId)
                          );
                        }}
                      />
                    </span>
                    <span><span className={`monitor-state ${item.state === 'Final' ? 'ended' : 'active'}`}>{item.state}</span></span>
                    <span>{item.type === 'bulk' ? 'Bulk' : 'Single'}</span>
                    <span className="phone-number">{item.displayTarget}</span>
                    <span><span className={`status ${status}`}>{item.status || '-'}</span></span>
                    <span>{item.provider || '-'}</span>
                    <span className="phone-number"><strong>{item.campaignName}</strong><br /><small>{item.campaignId || '-'}</small></span>
                    <span>{item.workflowId || '-'}</span>
                    <span>{item.recurrence || 'once'}<br /><small>{formatDateTime(item.scheduledAt)}</small></span>
                    <span>{formatDateTime(item.nextRunAt)}</span>
                    <span>{formatDateTime(item.updatedAt)}</span>
                    <span className="actions scheduled-actions">
                      <div className="row-action-menu">
                        <button
                          type="button"
                          className="row-action-trigger"
                          onClick={() => toggleActionMenu(`schedule:${itemId}`)}
                          aria-label="Schedule actions"
                          title="Schedule actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openActionMenu === `schedule:${itemId}` && (
                          <div className="row-action-dropdown">
                            <button
                              type="button"
                              disabled={isTerminalSchedule}
                              onClick={() => handleScheduleStatusChange(itemId, status === 'paused' ? 'resume' : 'pause')}
                              title={status === 'paused' ? 'Resume schedule' : 'Pause schedule'}
                            >
                              {status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleDrawerItem(item);
                                setOpenActionMenu(null);
                              }}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            <button type="button" className="danger" onClick={() => handleDeleteScheduleItem(itemId)} title="Delete schedule">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </span>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
        <div className="history-toolbar">
          <div className="history-pagination-bar">
            <span>{scheduleInfo}</span>
            <div className="history-pager">
              <button type="button" disabled={schedulePagination.page <= 1 || loadingSchedules} onClick={() => setScheduleFilters((prev) => ({ ...prev, page: prev.page - 1 }))} aria-label="Previous schedule page" title="Previous schedule page">Prev</button>
              <span>{schedulePagination.page} / {Math.max(1, schedulePagination.totalPages)}</span>
              <button type="button" disabled={schedulePagination.page >= schedulePagination.totalPages || loadingSchedules} onClick={() => setScheduleFilters((prev) => ({ ...prev, page: prev.page + 1 }))} aria-label="Next schedule page" title="Next schedule page">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScheduleDrawer = () => {
    if (!scheduleDrawerItem) return null;
    const item = scheduleDrawerItem;
    const itemId = item.id || item._id || '';
    const allowedWindow = item.allowedWindow
      ? `${item.allowedWindow.start || '-'} - ${item.allowedWindow.end || '-'}`
      : '-';

    return (
      <div className="schedule-drawer-backdrop" onClick={() => setScheduleDrawerItem(null)}>
        <aside className="schedule-details-drawer" onClick={(event) => event.stopPropagation()} aria-label="Scheduled call details">
          <div className="schedule-drawer-header">
            <div>
              <h3>{item.campaignName || 'Scheduled Call'}</h3>
              <p>{item.type === 'bulk' ? 'Bulk schedule' : 'Single schedule'}</p>
            </div>
            <button type="button" onClick={() => setScheduleDrawerItem(null)} aria-label="Close schedule details" title="Close schedule details">
              <X size={16} />
            </button>
          </div>
          <div className="schedule-drawer-body">
            <div><span>Schedule ID</span><strong>{itemId || '-'}</strong></div>
            <div><span>Campaign ID</span><strong>{item.campaignId || '-'}</strong></div>
            <div><span>Type</span><strong>{item.type === 'bulk' ? 'Bulk' : 'Single'}</strong></div>
            <div><span>Status</span><strong>{item.status || '-'}</strong></div>
            <div><span>State</span><strong>{item.state || '-'}</strong></div>
            <div><span>Phone / Contacts</span><strong>{item.type === 'single' ? item.phoneNumber || '-' : `${item.contactCount || 0} contacts`}</strong></div>
            <div><span>Provider</span><strong>{item.provider || '-'}</strong></div>
            <div><span>Workflow</span><strong>{item.workflowId || '-'}</strong></div>
            <div><span>Recurrence</span><strong>{item.recurrence || 'once'}</strong></div>
            <div><span>Scheduled At</span><strong>{formatDateTime(item.scheduledAt)}</strong></div>
            <div><span>Next Run</span><strong>{formatDateTime(item.nextRunAt)}</strong></div>
            <div><span>Updated</span><strong>{formatDateTime(item.updatedAt)}</strong></div>
            <div><span>Allowed Window</span><strong>{allowedWindow}</strong></div>
            <div><span>Timezone</span><strong>{item.timezone || item.metadata?.timezone || '-'}</strong></div>
          </div>
        </aside>
      </div>
    );
  };

  return (
    <div className="outbound-call">
      <div className="outbound-header">
        <div className="outbound-header-content">
          <h1>Outbound Call Management</h1>
          <p>Manage outbound calls, scheduling, and voice broadcasts</p>
          <div className="outbound-connection-status">
            <span className="outbound-status-connected">
              <span className="outbound-status-dot" aria-hidden="true" />
              System Active
            </span>
          </div>
        </div>
        <div className="outbound-header-actions" />
      </div>
      <div className="outbound-tabs">
        <button className={`outbound-tab-btn ${activeTab === 'quick' ? 'active' : ''}`} onClick={() => setActiveTab('quick')} aria-label="Quick Calls" title="Quick Calls"><PhoneOutgoing size={18} /><span>Quick Calls</span></button>
        <button className={`outbound-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} aria-label="History" title="History"><History size={18} /><span>History</span></button>
        <button className={`outbound-tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => setActiveTab('scheduled')} aria-label="Scheduled Monitor" title="Scheduled Monitor"><CalendarClock size={18} /><span>Scheduled Monitor</span></button>
        {showMonitorTab && (
          <button className={`outbound-tab-btn ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')} aria-label="Monitor" title="Monitor"><BarChart3 size={18} /><span>Monitor</span></button>
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
              <button className="call-control-btn mute" type="button" aria-label="Mute call" title="Mute call"><Mic size={16} /></button>
              <button className="call-control-btn end" type="button" onClick={() => handleEndCall(liveCallStatus.callSid)} aria-label="End call" title="End call"><Phone size={16} /></button>
            </div>
          </div>
        </div>
      )}
      <div className="outbound-content">
        {activeTab === 'quick' && <OutboundDialer initialMode="single" callSettings={callSettings} onCallSettingsChange={setCallSettings} onMonitorUpdate={handleMonitorUpdate} />}
        {activeTab === 'history' && renderCallHistory()}
        {activeTab === 'scheduled' && renderScheduledMonitor()}
        {activeTab === 'monitor' && renderLiveMonitor()}
      </div>
      {renderScheduleDrawer()}
    </div>
  );
};

export default OutboundCall;
