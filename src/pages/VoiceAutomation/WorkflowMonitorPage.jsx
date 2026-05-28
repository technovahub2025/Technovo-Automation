import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Filter,
  Hash,
  History,
  Layers3,
  ListOrdered,
  MessageCircle,
  MoreVertical,
  PhoneCall,
  Route,
  Search,
  ShieldCheck,
  Split,
  SlidersHorizontal,
  X,
  Workflow
} from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import { ivrService } from '../../services/ivrService';
import { formatVoiceDateTime } from '../../utils/voiceTime';
import {
  buildWorkflowCapabilityState,
  buildWorkflowMonitorChrome,
  computeWorkflowMonitorSummary,
  filterWorkflowMonitorActionOptions,
  filterWorkflowMonitorColumns,
  getWorkflowMonitorRowTags,
  resolveNodeLabel,
  resolveNodeSummary,
  resolveWorkflowName,
  WORKFLOW_MONITOR_STAT_DEFS
} from './workflowMonitorCapabilities';
import './WorkflowMonitorPage.css';

const VOICE_TIME_ZONE = 'Asia/Kolkata';

const normalizeType = (value) => String(value || '').trim().toLowerCase();
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const getTodayInputValue = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: VOICE_TIME_ZONE
}).format(new Date());

const formatFilterDateLabel = (value) => {
  const parts = String(value || '').split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part <= 0)) {
    return String(value || '-');
  }

  const [year, month, day] = parts;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
};

const resolveEventLogPayload = (response = {}) => {
  if (response?.data?.workflow || response?.data?.rows || response?.data?.columns) {
    return response.data;
  }
  if (response?.workflow || response?.rows || response?.columns) {
    return response;
  }
  return response?.data?.data || response?.data || response;
};

const formatDurationLabel = (durationMs = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const getRowKey = (row = {}) => String(row.callSid || row.id || row.callId || '').trim();

const mergeNestedObject = (base = {}, patch = {}) => ({
  ...base,
  ...patch
});

const mergeRow = (base = {}, patch = {}) => {
  const merged = {
    ...base,
    ...patch
  };

  if (base.currentNode || patch.currentNode) {
    merged.currentNode = mergeNestedObject(base.currentNode || {}, patch.currentNode || {});
  }

  if (base.entryNode || patch.entryNode) {
    merged.entryNode = mergeNestedObject(base.entryNode || {}, patch.entryNode || {});
  }

  if (base.bookingState || patch.bookingState) {
    merged.bookingState = mergeNestedObject(base.bookingState || {}, patch.bookingState || {});
  }

  if (base.whatsappState || patch.whatsappState) {
    merged.whatsappState = mergeNestedObject(base.whatsappState || {}, patch.whatsappState || {});
  }

  if (base.queueState || patch.queueState) {
    merged.queueState = mergeNestedObject(base.queueState || {}, patch.queueState || {});
  }

  if (Array.isArray(patch.nodeTrail) && patch.nodeTrail.length > 0) {
    merged.nodeTrail = patch.nodeTrail;
  }

  if (Array.isArray(patch.visitedPath) && patch.visitedPath.length > 0) {
    merged.visitedPath = patch.visitedPath;
  }

  return merged;
};

const buildFallbackColumns = () => ([
  { key: 'callTime', label: 'Call Time', type: 'datetime', group: 'core' },
  { key: 'callerNumber', label: 'Caller', type: 'phone', group: 'core' },
  { key: 'callStatus', label: 'Status', type: 'status', group: 'core' },
  { key: 'currentNodeLabel', label: 'Current Node', type: 'node', group: 'core' },
  { key: 'visitedPathLabel', label: 'Path', type: 'path', group: 'core' },
  { key: 'durationLabel', label: 'Duration', type: 'duration', group: 'core' },
  { key: 'finalResult', label: 'Result', type: 'result', group: 'core' },
  { key: 'lastInput', label: 'Last Input', type: 'input', group: 'input' },
  { key: 'entryNodeLabel', label: 'Entry Node', type: 'node', group: 'audio' },
  { key: 'transferDestination', label: 'Transfer To', type: 'text', group: 'transfer' },
  { key: 'queueName', label: 'Queue', type: 'text', group: 'queue' },
  { key: 'queuePosition', label: 'Queue Position', type: 'number', group: 'queue' },
  { key: 'queueWaitTime', label: 'Queue Wait', type: 'duration', group: 'queue' },
  { key: 'queueEnteredAt', label: 'Queue Entered', type: 'datetime', group: 'queue' },
  { key: 'queueLeftAt', label: 'Queue Left', type: 'datetime', group: 'queue' },
  { key: 'queueResult', label: 'Queue Result', type: 'status', group: 'queue' },
  { key: 'bookingStatus', label: 'Booking Status', type: 'status', group: 'booking' },
  { key: 'bookingReference', label: 'Booking Ref', type: 'text', group: 'booking' },
  { key: 'slotLabel', label: 'Slot', type: 'text', group: 'booking' },
  { key: 'slotDate', label: 'Slot Date', type: 'date', group: 'booking' },
  { key: 'tokenNumber', label: 'Token', type: 'text', group: 'booking' },
  { key: 'customerWhatsAppStatus', label: 'Customer WhatsApp', type: 'status', group: 'whatsapp' },
  { key: 'adminWhatsAppStatus', label: 'Admin WhatsApp', type: 'status', group: 'whatsapp' },
  { key: 'voicemailRecorded', label: 'Voicemail', type: 'boolean', group: 'voicemail' }
]);

const ROW_TAG_CAPABILITY_MAP = {
  booking: 'booking',
  cancelled: 'booking',
  rejected: 'booking',
  whatsapp: 'whatsapp',
  transfer: 'transfer',
  voicemail: 'voicemail',
  input: 'input',
  queue: 'queue'
};

const getVisibleRowTags = (row, capabilityState) => {
  const tags = getWorkflowMonitorRowTags(row);
  return tags.filter((tag) => {
    const capability = ROW_TAG_CAPABILITY_MAP[tag];
    return !capability || Boolean(capabilityState.capabilityMap?.[capability]);
  });
};

const formatQueueWait = (value) => formatDurationLabel(Number(value || 0) * 1000);

const ICON_BY_CAPABILITY = {
  audio: Workflow,
  input: Hash,
  transfer: Route,
  queue: ListOrdered,
  booking: BookMarked,
  whatsapp: MessageCircle,
  voicemail: FileText
};

const WorkflowMonitorPage = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [columns, setColumns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [liveRows, setLiveRows] = useState({});
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [whatsappFilter, setWhatsappFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [startDate, setStartDate] = useState(getTodayInputValue());
  const [endDate, setEndDate] = useState(getTodayInputValue());
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [openPanels, setOpenPanels] = useState({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isWorkflowDrawerOpen, setIsWorkflowDrawerOpen] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const refreshTimerRef = useRef(null);
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const defaultDateValue = useMemo(() => getTodayInputValue(), []);

  const loadEventLog = useCallback(async ({ silent = false, resetLive = false } = {}) => {
    if (!workflowId) return;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      if (resetLive) {
        setLiveRows({});
      }

      const response = await ivrService.getWorkflowEventLog(workflowId, {
        startDate,
        endDate,
        limit: 250
      });

      const payload = resolveEventLogPayload(response);
      const nextWorkflow = payload?.workflow || null;
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const nextColumns = Array.isArray(payload?.columns) ? payload.columns : [];

      setWorkflow(nextWorkflow);
      setColumns(nextColumns);
      setRows(nextRows);
      setSummary(payload?.summary || computeWorkflowMonitorSummary(nextRows));
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load workflow event log:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load workflow event log');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [endDate, startDate, workflowId]);

  useEffect(() => {
    loadEventLog({ silent: false, resetLive: true });
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [loadEventLog]);

  const scheduleReconcile = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadEventLog({ silent: true, resetLive: false });
    }, 1200);
  }, [loadEventLog]);

  const capabilityState = useMemo(() => buildWorkflowCapabilityState(workflow || {}), [workflow]);
  const chromeState = useMemo(() => buildWorkflowMonitorChrome(capabilityState), [capabilityState]);
  const hasBookingCapability = Boolean(capabilityState.capabilityMap.booking);
  const hasWhatsappCapability = Boolean(capabilityState.capabilityMap.whatsapp);
  const hasTransferCapability = Boolean(capabilityState.capabilityMap.transfer);
  const hasQueueCapability = Boolean(capabilityState.capabilityMap.queue);
  const hasVoicemailCapability = Boolean(capabilityState.capabilityMap.voicemail);
  const hasInputCapability = Boolean(capabilityState.capabilityMap.input);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchText.trim()) count += 1;
    if (startDate && startDate !== defaultDateValue) count += 1;
    if (endDate && endDate !== defaultDateValue) count += 1;
    if (statusFilter !== 'all') count += 1;
    if (hasBookingCapability && bookingFilter !== 'all') count += 1;
    if (hasWhatsappCapability && whatsappFilter !== 'all') count += 1;
    if (hasQueueCapability && queueFilter !== 'all') count += 1;
    if (actionFilter !== 'all') count += 1;
    if (nodeTypeFilter !== 'all') count += 1;
    if (sortOrder !== 'newest') count += 1;
    return count;
  }, [actionFilter, bookingFilter, defaultDateValue, endDate, hasBookingCapability, hasQueueCapability, hasWhatsappCapability, nodeTypeFilter, queueFilter, searchText, sortOrder, statusFilter, startDate, whatsappFilter]);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (searchText.trim()) {
      chips.push({
        key: 'search',
        label: 'Search',
        value: searchText.trim(),
        onClear: () => setSearchText('')
      });
    }

    if (startDate && startDate !== defaultDateValue) {
      chips.push({
        key: 'startDate',
        label: 'Start',
        value: formatFilterDateLabel(startDate),
        onClear: () => setStartDate(defaultDateValue)
      });
    }

    if (endDate && endDate !== defaultDateValue) {
      chips.push({
        key: 'endDate',
        label: 'End',
        value: formatFilterDateLabel(endDate),
        onClear: () => setEndDate(defaultDateValue)
      });
    }

    if (statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: statusFilter.replace(/_/g, ' '),
        onClear: () => setStatusFilter('all')
      });
    }

    if (hasBookingCapability && bookingFilter !== 'all') {
      chips.push({
        key: 'booking',
        label: 'Booking',
        value: bookingFilter.replace(/_/g, ' '),
        onClear: () => setBookingFilter('all')
      });
    }

    if (hasWhatsappCapability && whatsappFilter !== 'all') {
      chips.push({
        key: 'whatsapp',
        label: 'WhatsApp',
        value: whatsappFilter.replace(/_/g, ' '),
        onClear: () => setWhatsappFilter('all')
      });
    }

    if (hasQueueCapability && queueFilter !== 'all') {
      chips.push({
        key: 'queue',
        label: 'Queue',
        value: queueFilter,
        onClear: () => setQueueFilter('all')
      });
    }

    if (actionFilter !== 'all') {
      chips.push({
        key: 'action',
        label: 'Action',
        value: actionFilter.replace(/_/g, ' '),
        onClear: () => setActionFilter('all')
      });
    }

    if (nodeTypeFilter !== 'all') {
      chips.push({
        key: 'nodeType',
        label: 'Node',
        value: nodeTypeFilter.replace(/_/g, ' '),
        onClear: () => setNodeTypeFilter('all')
      });
    }

    if (sortOrder !== 'newest') {
      chips.push({
        key: 'sortOrder',
        label: 'Sort',
        value: sortOrder,
        onClear: () => setSortOrder('newest')
      });
    }

    return chips;
  }, [actionFilter, bookingFilter, defaultDateValue, endDate, hasBookingCapability, hasQueueCapability, hasWhatsappCapability, nodeTypeFilter, queueFilter, searchText, sortOrder, statusFilter, startDate, whatsappFilter]);

  const nodesById = useMemo(() => (
    new Map((Array.isArray(workflow?.nodes) ? workflow.nodes : []).map((node) => [String(node.id), node]))
  ), [workflow]);

  const patchLiveRow = useCallback((callSid, patch = {}) => {
    const key = String(callSid || patch.callSid || patch.callId || patch.id || '').trim();
    if (!key) return;

    setLiveRows((prev) => {
      const next = { ...prev };
      const base = prev[key] || {};
      next[key] = mergeRow(base, {
        ...patch,
        callSid: patch.callSid || key
      });
      return next;
    });
  }, []);

  const removeLiveRow = useCallback((callSid, patch = {}) => {
    const key = String(callSid || patch.callSid || patch.callId || patch.id || '').trim();
    if (!key) return;

    setLiveRows((prev) => {
      const next = { ...prev };
      const existing = next[key] || {};
      next[key] = mergeRow(existing, {
        ...patch,
        callSid: key,
        callStatus: patch.status || patch.callStatus || 'completed',
        finalResult: patch.reason && patch.reason !== 'normal'
          ? String(patch.reason).replace(/_/g, ' ')
          : existing.finalResult || 'Completed',
        endedAt: patch.timestamp || Date.now(),
        updatedAt: patch.timestamp || Date.now()
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket || !workflowId) return undefined;

    const handleWorkflowUpdate = (data = {}) => {
      const incomingWorkflowId = String(data.workflowId || '').trim();
      const callSid = String(data.callSid || data.callId || '').trim();
      if (incomingWorkflowId && String(workflowId) !== incomingWorkflowId) return;

      const event = normalizeStatus(data.event || data.type || '');
      const currentNode = data.currentNode || (data.currentNodeId ? nodesById.get(String(data.currentNodeId)) : null);
      const visitedNodes = Array.isArray(data.visitedNodes) ? data.visitedNodes : [];
      const queueData = data.queueState || data.queueInfo || data.queue || {};
      const bookingData = data.bookingState || data.booking || {};
      const whatsappData = data.whatsappState || data.whatsapp || {};

      const rowPatch = {
        callSid,
        workflowId: incomingWorkflowId || workflowId,
        updatedAt: data.timestamp || Date.now(),
        callTime: data.timestamp || Date.now(),
        startedAt: data.startTime || data.timestamp || Date.now(),
        callStatus: event === 'execution_ended'
          ? normalizeStatus(data.reason && data.reason !== 'normal' ? data.reason : 'completed')
          : 'running',
        currentNodeId: data.currentNodeId || currentNode?.id || data.nodeId || null,
        currentNodeType: normalizeType(data.currentNodeType || currentNode?.type || data.nodeType || ''),
        currentNodeLabel: resolveNodeLabel(currentNode || nodesById.get(String(data.currentNodeId)) || {
          id: data.currentNodeId,
          type: data.currentNodeType
        }),
        lastInput: data.userInput ?? data.lastInput ?? null,
        reason: data.reason || null,
        errorMessage: data.error || data.errorMessage || null,
        durationMs: Number(data.duration || data.executionStats?.duration || 0),
        durationLabel: data.duration ? formatDurationLabel(data.duration) : null,
        visitedPath: visitedNodes.map((visit) => resolveNodeLabel(nodesById.get(String(visit.nodeId)) || {
          id: visit.nodeId,
          type: visit.nodeType,
          data: {}
        })),
        nodeTrail: visitedNodes.map((visit) => ({
          nodeId: visit.nodeId || '',
          nodeType: normalizeType(visit.nodeType || ''),
          label: resolveNodeLabel(nodesById.get(String(visit.nodeId)) || {
            id: visit.nodeId,
            type: visit.nodeType,
            data: {}
          }),
          userInput: visit.userInput || '',
          timestamp: visit.timestamp || null,
          duration: visit.duration || 0
        })),
        transferAttempted: Boolean(data.transferAttempted || data.transfer?.attempted),
        transferDestination: data.transferDestination || data.transfer?.transferredTo || data.transfer?.destination || '',
        voicemailRecorded: Boolean(data.voicemailRecorded || data.voicemail?.recorded),
        bookingState: bookingData && (bookingData.status || bookingData.reference || bookingData.bookingReference)
          ? {
              status: bookingData.status || bookingData.bookingStatus || 'confirmed',
              reference: bookingData.reference || bookingData.bookingReference || '',
              tokenNumber: bookingData.tokenNumber || '',
              slotLabel: bookingData.slotLabel || '',
              slotDate: bookingData.slotDate || '',
              customerName: bookingData.customerName || '',
              customerPhone: bookingData.customerPhone || '',
              notes: bookingData.notes || ''
            }
          : null,
        whatsappState: whatsappData && (whatsappData.customer || whatsappData.admin || whatsappData.providerMessageId)
          ? {
              customer: whatsappData.customer || whatsappData.customerStatus || 'not sent',
              admin: whatsappData.admin || whatsappData.adminStatus || 'not sent',
              providerMessageId: whatsappData.providerMessageId || '',
              templateName: whatsappData.templateName || ''
            }
          : null,
        queueState: queueData && (queueData.queueName || queueData.name || queueData.queuePosition || queueData.position)
          ? {
              name: queueData.queueName || queueData.name || '',
              position: Number(queueData.queuePosition || queueData.position || 0),
              waitTime: Number(queueData.queueWaitTime || queueData.waitTime || 0),
              enteredAt: queueData.queueEnteredAt || queueData.enteredAt || null,
              leftAt: queueData.queueLeftAt || queueData.leftAt || null,
              result: queueData.queueResult || queueData.result || '',
              queued: Boolean(queueData.queued)
            }
          : null
      };

      if (event === 'execution_ended') {
        removeLiveRow(callSid, rowPatch);
      } else {
        patchLiveRow(callSid, rowPatch);
      }

      scheduleReconcile();
    };

    const handleWorkflowError = (data = {}) => {
      const callSid = String(data.callSid || data.callId || '').trim();
      const incomingWorkflowId = String(data.workflowId || '').trim();
      if (incomingWorkflowId && String(workflowId) !== incomingWorkflowId) return;

      patchLiveRow(callSid, {
        callSid,
        workflowId: incomingWorkflowId || workflowId,
        callStatus: 'failed',
        finalResult: 'Failed',
        errorMessage: data.error || data.message || 'Workflow error',
        reason: data.reason || 'failed',
        updatedAt: data.timestamp || Date.now()
      });
      scheduleReconcile();
    };

    const handleCallDetailsUpdate = (data = {}) => {
      const callSid = String(data.callSid || data.callId || '').trim();
      const incomingWorkflowId = String(data.workflowId || '').trim();
      if (incomingWorkflowId && String(workflowId) !== incomingWorkflowId) return;
      patchLiveRow(callSid, {
        ...data,
        callSid,
        workflowId: incomingWorkflowId || workflowId,
        updatedAt: data.timestamp || Date.now()
      });
      scheduleReconcile();
    };

    const handleWorkflowCallStarted = (data = {}) => handleWorkflowUpdate({ ...data, event: 'execution_started' });
    const handleWorkflowCallNode = (data = {}) => handleWorkflowUpdate({ ...data, event: 'node_visited' });
    const handleWorkflowCallCompleted = (data = {}) => handleWorkflowUpdate({ ...data, event: 'execution_ended' });

    socket.on('ivr_workflow_update', handleWorkflowUpdate);
    socket.on('ivr_workflow_error', handleWorkflowError);
    socket.on('workflow_call_started', handleWorkflowCallStarted);
    socket.on('workflow_call_node', handleWorkflowCallNode);
    socket.on('workflow_call_completed', handleWorkflowCallCompleted);
    socket.on('call_details_update', handleCallDetailsUpdate);
    socket.on('ivr_call_details_update', handleCallDetailsUpdate);
    socket.on('call_updated', handleCallDetailsUpdate);

    return () => {
      socket.off('ivr_workflow_update', handleWorkflowUpdate);
      socket.off('ivr_workflow_error', handleWorkflowError);
      socket.off('workflow_call_started', handleWorkflowCallStarted);
      socket.off('workflow_call_node', handleWorkflowCallNode);
      socket.off('workflow_call_completed', handleWorkflowCallCompleted);
      socket.off('call_details_update', handleCallDetailsUpdate);
      socket.off('ivr_call_details_update', handleCallDetailsUpdate);
      socket.off('call_updated', handleCallDetailsUpdate);
    };
  }, [nodesById, patchLiveRow, removeLiveRow, scheduleReconcile, socket, workflowId]);

  const mergedRows = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = getRowKey(row);
      if (!key) return;
      map.set(key, row);
    });

    Object.values(liveRows).forEach((row) => {
      const key = getRowKey(row);
      if (!key) return;
      const existing = map.get(key) || {};
      map.set(key, mergeRow(existing, row));
    });

    return Array.from(map.values()).sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.endedAt || a.callTime || a.startedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.endedAt || b.callTime || b.startedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [liveRows, rows]);

  const computedSummary = useMemo(() => ({
    ...(summary || {}),
    ...computeWorkflowMonitorSummary(mergedRows)
  }), [mergedRows, summary]);

  useEffect(() => {
    if (nodeTypeFilter !== 'all' && !Array.from(nodesById.values()).some((node) => normalizeType(node.type) === nodeTypeFilter)) {
      setNodeTypeFilter('all');
    }
  }, [nodeTypeFilter, nodesById]);

  const actionOptions = useMemo(() => {
    const set = new Set(['all']);
    mergedRows.forEach((row) => {
      getVisibleRowTags(row, capabilityState).forEach((tag) => set.add(tag));
    });
    return filterWorkflowMonitorActionOptions(Array.from(set), capabilityState);
  }, [capabilityState, mergedRows]);

  useEffect(() => {
    if (actionFilter !== 'all' && !actionOptions.includes(actionFilter)) {
      setActionFilter('all');
    }
  }, [actionFilter, actionOptions]);

  const nodeTypeOptions = useMemo(() => {
    const types = new Set(['all']);
    (Array.isArray(workflow?.nodes) ? workflow.nodes : []).forEach((node) => {
      const type = normalizeType(node?.type);
      if (type) types.add(type);
    });
    return Array.from(types);
  }, [workflow]);

  useEffect(() => {
    if (nodeTypeFilter !== 'all' && !nodeTypeOptions.includes(nodeTypeFilter)) {
      setNodeTypeFilter('all');
    }
  }, [nodeTypeFilter, nodeTypeOptions]);

  const queueFilterOptions = useMemo(() => {
    const values = Array.from(new Set(
      mergedRows
        .map((row) => String(row.queueName || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    return ['all', ...values];
  }, [mergedRows]);

  useEffect(() => {
    if (queueFilter !== 'all' && !queueFilterOptions.includes(queueFilter)) {
      setQueueFilter('all');
    }
  }, [queueFilter, queueFilterOptions]);

  const clearAllFilters = useCallback(() => {
    setSearchText('');
    setStatusFilter('all');
    setBookingFilter('all');
    setWhatsappFilter('all');
    setQueueFilter('all');
    setActionFilter('all');
    setNodeTypeFilter('all');
    setSortOrder('newest');
    setStartDate(defaultDateValue);
    setEndDate(defaultDateValue);
    setIsFilterPanelOpen(false);
  }, [defaultDateValue]);

  const toggleFilterPanel = useCallback(() => {
    setIsFilterPanelOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isFilterPanelOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (filterButtonRef.current?.contains(target) || filterPanelRef.current?.contains(target)) {
        return;
      }
      setIsFilterPanelOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFilterPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterPanelOpen]);

  const visibleRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    const filteredRows = mergedRows.filter((row) => {
      if (statusFilter !== 'all' && normalizeStatus(row.callStatus) !== statusFilter) return false;
      if (bookingFilter !== 'all' && normalizeStatus(row.bookingStatus) !== bookingFilter) return false;
      if (whatsappFilter !== 'all') {
        const rowWhatsAppStatuses = [
          normalizeStatus(row.customerWhatsAppStatus),
          normalizeStatus(row.adminWhatsAppStatus)
        ];
        if (!rowWhatsAppStatuses.includes(whatsappFilter)) return false;
      }
      if (queueFilter !== 'all' && String(row.queueName || '').trim() !== queueFilter) return false;
      if (nodeTypeFilter !== 'all') {
        const nodeTrailMatch = Array.isArray(row.nodeTrail) && row.nodeTrail.some((visit) => normalizeType(visit.nodeType) === nodeTypeFilter);
        const currentMatch = normalizeType(row.currentNodeType) === nodeTypeFilter;
        const entryMatch = normalizeType(row.entryNodeType) === nodeTypeFilter;
        if (!nodeTrailMatch && !currentMatch && !entryMatch) return false;
      }
      if (actionFilter !== 'all') {
        const actions = getVisibleRowTags(row, capabilityState);
        if (!actions.includes(actionFilter)) return false;
      }
      if (!query) return true;

      const haystack = [
        row.callSid,
        row.callerNumber,
        row.destinationNumber,
        row.callStatus,
        row.finalResult,
        row.currentNodeLabel,
        row.entryNodeLabel,
        row.lastInput,
        row.bookingStatus,
        row.bookingReference,
        row.slotLabel,
        row.slotDate,
        row.customerName,
        row.customerPhone,
        row.customerWhatsAppStatus,
        row.adminWhatsAppStatus,
        row.queueName,
        row.queueResult,
        row.errorMessage,
        row.reason,
        row.visitedPathLabel,
        row.transferDestination
      ];

      return haystack.some((value) => String(value || '').toLowerCase().includes(query));
    });
    return filteredRows.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.endedAt || a.callTime || a.startedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.endedAt || b.callTime || b.startedAt || 0).getTime();
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });
  }, [actionFilter, bookingFilter, capabilityState, mergedRows, nodeTypeFilter, queueFilter, searchText, sortOrder, statusFilter, whatsappFilter]);

  const visibleColumns = useMemo(() => {
    const datasetColumns = Array.isArray(columns) && columns.length > 0
      ? columns
      : buildFallbackColumns();
    return filterWorkflowMonitorColumns(datasetColumns, capabilityState);
  }, [capabilityState, columns]);

  useEffect(() => {
    if (!hasBookingCapability && bookingFilter !== 'all') setBookingFilter('all');
  }, [bookingFilter, hasBookingCapability]);

  useEffect(() => {
    if (!hasWhatsappCapability && whatsappFilter !== 'all') setWhatsappFilter('all');
  }, [hasWhatsappCapability, whatsappFilter]);

  useEffect(() => {
    if (!hasQueueCapability && queueFilter !== 'all') setQueueFilter('all');
  }, [hasQueueCapability, queueFilter]);

  const openRowDrawer = useCallback((row) => {
    const rowKey = getRowKey(row);
    if (!rowKey) return;
    setSelectedRowKey(rowKey);
    setIsDrawerOpen(true);
  }, []);

  const closeRowDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const openWorkflowDrawer = useCallback(() => {
    setIsWorkflowDrawerOpen((prev) => !prev);
  }, []);

  const closeWorkflowDrawer = useCallback(() => {
    setIsWorkflowDrawerOpen(false);
  }, []);

  const togglePanel = useCallback((panelKey) => {
    setOpenPanels((prev) => ({
      ...prev,
      [panelKey]: !(prev[panelKey] ?? false)
    }));
  }, []);

  const renderStatusPill = (value) => {
    const normalized = normalizeStatus(value);
    const tone =
      normalized === 'running' || normalized === 'active' || normalized === 'sent' || normalized === 'confirmed' || normalized === 'reserved'
        ? 'success'
        : normalized === 'failed' || normalized === 'cancelled' || normalized === 'rejected'
          ? 'danger'
          : normalized === 'timeout' || normalized === 'pending'
            ? 'warning'
            : 'neutral';

    return <span className={`monitor-pill monitor-pill--${tone}`}>{String(value || '-').replace(/_/g, ' ')}</span>;
  };

  const renderCell = (row, column) => {
    const value = row?.[column.key];

    if (column.key === 'queueWaitTime') {
      return <span>{formatQueueWait(value ?? row.queueState?.waitTime ?? 0)}</span>;
    }

    if (column.type === 'datetime') {
      return (
        <span title={String(value || '')}>
          {value ? formatVoiceDateTime(value, { fallback: '-' }) : '-'}
        </span>
      );
    }

    if (column.type === 'duration') {
      return <span>{value || row.durationLabel || formatDurationLabel(row.durationMs || 0)}</span>;
    }

    if (column.type === 'phone') {
      return <span className="monitor-mono">{value || '-'}</span>;
    }

    if (column.type === 'status') {
      return renderStatusPill(value);
    }

    if (column.type === 'node') {
      return (
        <div className="monitor-node-cell">
          <strong>{value || '-'}</strong>
          {row.currentNodeType ? <span>{row.currentNodeType.replace(/_/g, ' ')}</span> : null}
        </div>
      );
    }

    if (column.type === 'path') {
      return <span className="monitor-path-cell" title={value || row.visitedPathLabel || ''}>{value || row.visitedPathLabel || '-'}</span>;
    }

    if (column.type === 'boolean') {
      return renderStatusPill(value ? 'yes' : 'no');
    }

    return <span>{value || '-'}</span>;
  };

  const selectedRow = useMemo(() => {
    if (!selectedRowKey) return null;
    return mergedRows.find((row) => getRowKey(row) === selectedRowKey) || null;
  }, [mergedRows, selectedRowKey]);

  useEffect(() => {
    if (!selectedRowKey) return;
    if (!mergedRows.some((row) => getRowKey(row) === selectedRowKey)) {
      setIsDrawerOpen(false);
    }
  }, [mergedRows, selectedRowKey]);

  useEffect(() => {
    if (!isDrawerOpen && !isWorkflowDrawerOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeRowDrawer();
        closeWorkflowDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeRowDrawer, closeWorkflowDrawer, isDrawerOpen, isWorkflowDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen && !isWorkflowDrawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen, isWorkflowDrawerOpen]);

  const renderCapabilityPanelBody = (capabilityKey) => {
    const nodes = capabilityState.capabilityMap?.[capabilityKey]?.nodes || [];
    if (nodes.length === 0) {
      return <div className="workflow-monitor-empty-inline">No nodes of this type were detected.</div>;
    }

    return (
      <div className="workflow-monitor-capability-list">
        {nodes.map((node) => (
          <div key={node.id} className="workflow-monitor-capability-card">
            <strong>{resolveNodeLabel(node)}</strong>
            <span>{resolveNodeSummary(node)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderDetailSection = (row) => {
    const booking = row.bookingState || {};
    const whatsapp = row.whatsappState || {};
    const queue = row.queueState || {};

    return (
      <div className="workflow-monitor-row-detail">
        <div className="workflow-monitor-detail-section">
          <div className="workflow-monitor-detail-section-title">
            <History size={15} />
            <span>Call Timeline</span>
          </div>
          <div className="workflow-monitor-detail-grid">
            <div className="workflow-monitor-detail-card">
              <label>Start</label>
              <strong>{row.startedAt ? formatVoiceDateTime(row.startedAt, { fallback: '-' }) : '-'}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>End</label>
              <strong>{row.endedAt ? formatVoiceDateTime(row.endedAt, { fallback: '-' }) : 'Live'}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>Duration</label>
              <strong>{row.durationLabel || formatDurationLabel(row.durationMs || 0)}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>Outcome</label>
              <strong>{row.finalResult || '-'}</strong>
            </div>
          </div>
        </div>

        <div className="workflow-monitor-detail-section">
          <div className="workflow-monitor-detail-section-title">
            <Split size={15} />
            <span>Node Trail</span>
          </div>
          {Array.isArray(row.nodeTrail) && row.nodeTrail.length > 0 ? (
            <div className="workflow-monitor-trail-list">
              {row.nodeTrail.map((visit, index) => (
                <div className="workflow-monitor-trail-item" key={`${row.callSid || row.id || 'row'}-${visit.nodeId || index}-${index}`}>
                  <div className="workflow-monitor-trail-badge">{index + 1}</div>
                  <div className="workflow-monitor-trail-copy">
                    <strong>{visit.label || visit.nodeType || 'Node'}</strong>
                    <span>
                      {visit.nodeType || '-'}
                      {visit.userInput ? ` • Input ${visit.userInput}` : ''}
                    </span>
                  </div>
                  <div className="workflow-monitor-trail-time">
                    {visit.timestamp ? formatVoiceDateTime(visit.timestamp, { fallback: '-' }) : '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="workflow-monitor-empty-inline">No node trail available for this row.</div>
          )}
        </div>

        {hasBookingCapability && (
          <div className="workflow-monitor-detail-section">
            <div className="workflow-monitor-detail-section-title">
              <BookMarked size={15} />
              <span>Booking</span>
            </div>
            {booking && booking.status ? (
              <div className="workflow-monitor-detail-stack">
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Status</label>
                  <strong>{renderStatusPill(booking.status)}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Reference</label>
                  <strong className="monitor-mono">{booking.reference || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Slot</label>
                  <strong>{booking.slotLabel || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Token</label>
                  <strong>{booking.tokenNumber || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Customer</label>
                  <strong>{booking.customerName || booking.customerPhone || '-'}</strong>
                </div>
              </div>
            ) : (
              <div className="workflow-monitor-empty-inline">No booking recorded for this call.</div>
            )}
          </div>
        )}

        {hasQueueCapability && (
          <div className="workflow-monitor-detail-section">
            <div className="workflow-monitor-detail-section-title">
              <ListOrdered size={15} />
              <span>Queue</span>
            </div>
            {queue && (queue.name || queue.position || queue.waitTime || queue.result) ? (
              <div className="workflow-monitor-detail-stack">
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Name</label>
                  <strong>{queue.name || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Position</label>
                  <strong>{queue.position || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Wait</label>
                  <strong>{formatQueueWait(queue.waitTime || 0)}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Entered</label>
                  <strong>{queue.enteredAt ? formatVoiceDateTime(queue.enteredAt, { fallback: '-' }) : '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                  <label>Result</label>
                  <strong>{queue.result || '-'}</strong>
                </div>
              </div>
            ) : (
              <div className="workflow-monitor-empty-inline">No queue data recorded for this call.</div>
            )}
          </div>
        )}

        {hasTransferCapability && (
          <div className="workflow-monitor-detail-section">
            <div className="workflow-monitor-detail-section-title">
              <Route size={15} />
              <span>Transfer</span>
            </div>
            {row.transferAttempted || row.transferDestination ? (
              <div className="workflow-monitor-detail-grid">
                <div className="workflow-monitor-detail-card">
                  <label>Destination</label>
                  <strong>{row.transferDestination || '-'}</strong>
                </div>
                <div className="workflow-monitor-detail-card">
                  <label>Attempted</label>
                  <strong>{row.transferAttempted ? 'Yes' : 'No'}</strong>
                </div>
              </div>
            ) : (
              <div className="workflow-monitor-empty-inline">No transfer event recorded for this call.</div>
            )}
          </div>
        )}

        {hasWhatsappCapability && (
          <div className="workflow-monitor-detail-section">
            <div className="workflow-monitor-detail-section-title">
              <MessageCircle size={15} />
              <span>WhatsApp</span>
            </div>
            <div className="workflow-monitor-detail-stack">
              <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                <label>Customer</label>
                <strong>{renderStatusPill(whatsapp.customer || 'not sent')}</strong>
              </div>
              <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                <label>Admin</label>
                <strong>{renderStatusPill(whatsapp.admin || 'not sent')}</strong>
              </div>
              <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                <label>Template</label>
                <strong>{whatsapp.templateName || '-'}</strong>
              </div>
              <div className="workflow-monitor-detail-card workflow-monitor-detail-card--compact">
                <label>Provider ID</label>
                <strong className="monitor-mono">{whatsapp.providerMessageId || '-'}</strong>
              </div>
            </div>
          </div>
        )}

        {hasVoicemailCapability && (
          <div className="workflow-monitor-detail-section">
            <div className="workflow-monitor-detail-section-title">
              <FileText size={15} />
              <span>Voicemail</span>
            </div>
            {row.voicemailRecorded ? (
              <div className="workflow-monitor-detail-grid">
                <div className="workflow-monitor-detail-card">
                  <label>Recorded</label>
                  <strong>Yes</strong>
                </div>
                <div className="workflow-monitor-detail-card">
                  <label>Recording URL</label>
                  <strong className="monitor-mono">{row.recordingUrl || '-'}</strong>
                </div>
              </div>
            ) : (
              <div className="workflow-monitor-empty-inline">No voicemail recorded for this call.</div>
            )}
          </div>
        )}

        <div className="workflow-monitor-detail-section">
          <div className="workflow-monitor-detail-section-title">
            <ShieldCheck size={15} />
            <span>Execution Metadata</span>
          </div>
          <div className="workflow-monitor-detail-grid">
            <div className="workflow-monitor-detail-card">
              <label>Call SID</label>
              <strong className="monitor-mono">{row.callSid || '-'}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>Current Node</label>
              <strong>{row.currentNodeLabel || '-'}</strong>
            </div>
            {hasInputCapability ? (
              <div className="workflow-monitor-detail-card">
                <label>Last Input</label>
                <strong>{row.lastInput || '-'}</strong>
              </div>
            ) : null}
            <div className="workflow-monitor-detail-card">
              <label>Reason</label>
              <strong>{row.reason || '-'}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>Error</label>
              <strong>{row.errorMessage || 'No errors'}</strong>
            </div>
            <div className="workflow-monitor-detail-card">
              <label>Node Count</label>
              <strong>{row.nodeExecutionCount || 0}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const workflowStats = useMemo(() => WORKFLOW_MONITOR_STAT_DEFS.map((stat) => {
    let value = computedSummary[stat.key] || 0;
    if (stat.key === 'avgQueueWaitLabel') {
      value = formatDurationLabel((computedSummary.avgQueueWaitSeconds || 0) * 1000);
    }
    return {
      ...stat,
      value
    };
  }), [computedSummary]);

  const sidebarPanels = useMemo(() => {
    const panels = [
      {
        key: 'scope',
        label: 'Workflow Scope',
        icon: Workflow,
        body: (
          <>
            <div className="workflow-monitor-meta-row">
              <label>Name</label>
              <strong>{resolveWorkflowName(workflow || {})}</strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Prompt Key</label>
              <strong className="monitor-mono">{workflow?.promptKey || workflow?._id || '-'}</strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Status</label>
              <strong>{normalizeStatus(workflow?.status || 'draft')}</strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Nodes</label>
              <strong>{capabilityState.nodeCount}</strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Edges</label>
              <strong>{capabilityState.edgeCount}</strong>
            </div>
          </>
        )
      },
      {
        key: 'capabilities',
        label: 'Detected Capabilities',
        icon: Layers3,
        body: (
          <div className="workflow-monitor-panel__chips">
            {capabilityState.capabilities.length > 0 ? capabilityState.capabilities.map((item) => (
              <span key={item.key} className="workflow-monitor-chip">{item.label}</span>
            )) : (
              <span className="workflow-monitor-empty-chip">No capabilities detected</span>
            )}
          </div>
        )
      },
      {
        key: 'audio',
        label: 'Audio Nodes',
        icon: ICON_BY_CAPABILITY.audio,
        capability: 'audio',
        body: renderCapabilityPanelBody('audio')
      },
      {
        key: 'input',
        label: 'Input Nodes',
        icon: ICON_BY_CAPABILITY.input,
        capability: 'input',
        body: renderCapabilityPanelBody('input')
      },
      {
        key: 'transfer',
        label: 'Transfer Nodes',
        icon: ICON_BY_CAPABILITY.transfer,
        capability: 'transfer',
        body: renderCapabilityPanelBody('transfer')
      },
      {
        key: 'queue',
        label: 'Queue Nodes',
        icon: ICON_BY_CAPABILITY.queue,
        capability: 'queue',
        body: renderCapabilityPanelBody('queue')
      },
      {
        key: 'booking',
        label: 'Booking Nodes',
        icon: ICON_BY_CAPABILITY.booking,
        capability: 'booking',
        body: renderCapabilityPanelBody('booking')
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp Nodes',
        icon: ICON_BY_CAPABILITY.whatsapp,
        capability: 'whatsapp',
        body: renderCapabilityPanelBody('whatsapp')
      },
      {
        key: 'voicemail',
        label: 'Voicemail Nodes',
        icon: ICON_BY_CAPABILITY.voicemail,
        capability: 'voicemail',
        body: renderCapabilityPanelBody('voicemail')
      },
      {
        key: 'live',
        label: 'Live Status',
        icon: Clock3,
        body: (
          <>
            <div className="workflow-monitor-meta-row">
              <label>Connection</label>
              <strong className={connected ? 'workflow-monitor-positive' : 'workflow-monitor-negative'}>
                {connected ? 'Socket connected' : 'Socket disconnected'}
              </strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Last Sync</label>
              <strong>{lastSyncedAt ? formatVoiceDateTime(lastSyncedAt, { fallback: '—' }) : '—'}</strong>
            </div>
            <div className="workflow-monitor-meta-row">
              <label>Range</label>
              <strong>{startDate || '-'} → {endDate || '-'}</strong>
            </div>
          </>
        )
      },
      {
        key: 'sources',
        label: 'Data Sources',
        icon: ShieldCheck,
        body: (
          <div className="workflow-monitor-panel__sources">
            <div className="workflow-monitor-source">
              <strong>ExecutionLog</strong>
              <span>Call lifecycle, node visits, status, duration</span>
            </div>
            <div className="workflow-monitor-source">
              <strong>AppointmentBooking</strong>
              <span>Booking reference, slot, status, cancellation</span>
            </div>
            <div className="workflow-monitor-source">
              <strong>BookingNotificationLog</strong>
              <span>Customer and admin WhatsApp delivery status</span>
            </div>
            <div className="workflow-monitor-source">
              <strong>Call</strong>
              <span>Queue entry, wait time, and queue exit details</span>
            </div>
          </div>
        )
      }
    ];

    return panels.filter((panel) => !panel.capability || Boolean(capabilityState.capabilityMap?.[panel.capability]));
  }, [capabilityState, connected, endDate, lastSyncedAt, workflow, startDate]);

  const visibleStats = workflowStats.filter((stat) => !stat.capability || Boolean(capabilityState.capabilityMap?.[stat.capability]));

  if (loading && !workflow) {
    return (
      <div className="workflow-monitor-page">
        <div className="workflow-monitor-loading">
          <div className="workflow-monitor-spinner" />
          <div>Loading workflow event log...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-monitor-page">
      <div className="workflow-monitor-shell">
        <header className="workflow-monitor-hero">
          <div className="workflow-monitor-hero__left">
            <div className="workflow-monitor-hero__copy">
              <div className="workflow-monitor-hero__eyebrow">
                <Workflow size={14} />
                <span>Workflow Event Log</span>
              </div>
              <h1>{resolveWorkflowName(workflow || {})}</h1>
              <p>{chromeState.heroSubtitle}</p>
            </div>
          </div>

          <div className="workflow-monitor-hero__right">
            <div className={`workflow-monitor-live ${connected ? 'is-live' : 'is-offline'}`}>
              <span className="workflow-monitor-live__dot" />
              {connected ? 'Socket live' : 'Socket offline'}
            </div>
            <button
              type="button"
              className="workflow-monitor-hero__details-button"
              onClick={openWorkflowDrawer}
              aria-haspopup="dialog"
              aria-expanded={isWorkflowDrawerOpen}
              aria-controls="workflow-monitor-details-drawer"
              title="Open workflow details"
            >
              <MoreVertical size={16} />
              <span>Details</span>
            </button>
          </div>
        </header>

        <section className="workflow-monitor-metrics">
          {visibleStats.map((stat) => {
            const Icon = stat.key === 'avgQueueWaitLabel' ? Clock3 : (
              stat.key === 'bookedCalls' ? BookMarked :
              stat.key === 'whatsappSent' || stat.key === 'whatsappFailed' ? MessageCircle :
              stat.key === 'transfers' ? Route :
              stat.key === 'voicemailCalls' ? FileText :
              stat.key === 'queuedCalls' ? ListOrdered :
              PhoneCall
            );
            return (
              <article className={`workflow-monitor-stat workflow-monitor-stat--${stat.tone}`} key={stat.key}>
                <div className="workflow-monitor-stat__label">
                  <Icon size={15} />
                  <span>{stat.label}</span>
                </div>
                <strong>{stat.value}</strong>
              </article>
            );
          })}
        </section>

        <section className="workflow-monitor-toolbar">
          <div className="workflow-monitor-toolbar__top">
            <div className="workflow-monitor-toolbar__left">
              <div className="workflow-monitor-toolbar__search">
                <Search size={16} />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search caller, booking ref, slot, queue, path, node, or action"
                />
              </div>

              <button
                type="button"
                className={`workflow-monitor-toolbar__filter-button ${isFilterPanelOpen ? 'is-open' : ''}`}
                onClick={toggleFilterPanel}
                aria-expanded={isFilterPanelOpen}
                aria-controls="workflow-monitor-filter-panel"
                ref={filterButtonRef}
              >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
                {activeFilterCount > 0 ? <span className="workflow-monitor-toolbar__count">{activeFilterCount}</span> : null}
                {isFilterPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="workflow-monitor-toolbar__clear"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="workflow-monitor-toolbar__chips" aria-label="Active filters">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="workflow-monitor-toolbar__chip"
                  onClick={chip.onClear}
                  title={`Clear ${chip.label.toLowerCase()}`}
                >
                  <span className="workflow-monitor-toolbar__chip-label">{chip.label}</span>
                  <span className="workflow-monitor-toolbar__chip-value">{chip.value}</span>
                  <X size={12} />
                </button>
              ))}
            </div>
          ) : null}

          {isFilterPanelOpen ? (
            <div
              className="workflow-monitor-filter-popover"
              id="workflow-monitor-filter-panel"
              ref={filterPanelRef}
            >
              <div className="workflow-monitor-filter-popover__header">
                <div>
                  <strong>Filters</strong>
                  <span>Refine the live call log without hiding the main table.</span>
                </div>
              </div>

              <div className="workflow-monitor-filter-popover__grid">
                <div className="workflow-monitor-field">
                  <label>Start</label>
                  <div className="workflow-monitor-field__input">
                    <CalendarDays size={14} />
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                </div>

                <div className="workflow-monitor-field">
                  <label>End</label>
                  <div className="workflow-monitor-field__input">
                    <CalendarDays size={14} />
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                </div>

                <div className="workflow-monitor-field">
                  <label>Status</label>
                  <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                    <Filter size={14} />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="timeout">Timeout</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                </div>

                {hasBookingCapability ? (
                  <div className="workflow-monitor-field">
                    <label>Booking</label>
                    <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                      <BookMarked size={14} />
                      <select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)}>
                        <option value="all">All</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="reserved">Reserved</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rejected">Rejected</option>
                        <option value="not booked">Not booked</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {hasWhatsappCapability ? (
                  <div className="workflow-monitor-field">
                    <label>WhatsApp</label>
                    <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                      <MessageCircle size={14} />
                      <select value={whatsappFilter} onChange={(event) => setWhatsappFilter(event.target.value)}>
                        <option value="all">All</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                        <option value="not sent">Not sent</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {hasQueueCapability ? (
                  <div className="workflow-monitor-field">
                    <label>Queue</label>
                    <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                      <ListOrdered size={14} />
                      <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}>
                        {queueFilterOptions.map((option) => (
                          <option key={option} value={option}>{option === 'all' ? 'All' : option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <div className="workflow-monitor-field">
                  <label>Action</label>
                  <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                    <Layers3 size={14} />
                    <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                      {actionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all' ? 'All' : option.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="workflow-monitor-field">
                  <label>Node Type</label>
                  <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                    <Workflow size={14} />
                    <select value={nodeTypeFilter} onChange={(event) => setNodeTypeFilter(event.target.value)}>
                      {nodeTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all' ? 'All' : option.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="workflow-monitor-field">
                  <label>Sort</label>
                  <div className="workflow-monitor-field__input workflow-monitor-field__input--select">
                    <Clock3 size={14} />
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="workflow-monitor-filter-popover__footer">
                <button
                  type="button"
                  className="workflow-monitor-toolbar__clear"
                  onClick={clearAllFilters}
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  className="workflow-monitor-filter-popover__done"
                  onClick={() => setIsFilterPanelOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="workflow-monitor-layout">
          <main className="workflow-monitor-main">
            <div className="workflow-monitor-table-card">
              <div className="workflow-monitor-table-card__header">
                <div>
                  <h2>Call Event Log</h2>
                  <p>Past and present incoming calls, with user actions and workflow outcomes rendered as one row per call.</p>
                </div>
                <div className="workflow-monitor-table-card__meta">
                  <span>{visibleRows.length} rows</span>
                  <span>{capabilityState.capabilities.length} capabilities</span>
                  <span className="workflow-monitor-table-card__hint">{sortOrder === 'oldest' ? 'Oldest first' : 'Newest first'}</span>
                  <span>Last sync {lastSyncedAt ? formatVoiceDateTime(lastSyncedAt, { fallback: '—' }) : '—'}</span>
                </div>
              </div>

              {error ? (
                <div className="workflow-monitor-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="workflow-monitor-table-wrap">
                <table className="workflow-monitor-table">
                  <thead>
                    <tr>
                      <th className="workflow-monitor-table__serial">S.No</th>
                      {visibleColumns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      <th className="workflow-monitor-table__actions-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length + 2}>
                          <div className="workflow-monitor-empty">
                            <CheckCircle2 size={16} />
                            <span>No calls match the current filters.</span>
                          </div>
                        </td>
                      </tr>
                    ) : visibleRows.map((row, index) => {
                      const rowKey = getRowKey(row);

                      return (
                        <tr className={`workflow-monitor-row ${normalizeStatus(row.callStatus) === 'running' ? 'is-live' : ''}`} key={rowKey}>
                          <td className="workflow-monitor-table__serial">{index + 1}</td>
                          {visibleColumns.map((column) => (
                            <td key={`${rowKey}-${column.key}`}>{renderCell(row, column)}</td>
                          ))}
                          <td className="workflow-monitor-table__actions">
                            <button
                              type="button"
                              className="workflow-monitor-row__action"
                              onClick={() => openRowDrawer(row)}
                              aria-label={`Open actions for ${row.callerNumber || 'call row'}`}
                              title="Open call details"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>

        </section>

        {isWorkflowDrawerOpen ? createPortal(
          <div
            className="workflow-monitor-details-drawer-overlay"
            role="presentation"
            onClick={closeWorkflowDrawer}
          >
            <aside
              className="workflow-monitor-details-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="workflow-monitor-details-drawer-title"
              id="workflow-monitor-details-drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workflow-monitor-details-drawer__header">
                <div className="workflow-monitor-details-drawer__title">
                  <div className="workflow-monitor-details-drawer__eyebrow">
                    <Layers3 size={13} />
                    <span>Workflow details</span>
                  </div>
                  <h2 id="workflow-monitor-details-drawer-title">{resolveWorkflowName(workflow || {})}</h2>
                  <p>{chromeState.heroSubtitle}</p>
                </div>
                <button
                  type="button"
                  className="workflow-monitor-details-drawer__close"
                  onClick={closeWorkflowDrawer}
                  aria-label="Close workflow details"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="workflow-monitor-details-drawer__body">
                {sidebarPanels.map((panel) => {
                  const Icon = panel.icon;
                  const isOpen = openPanels[panel.key] ?? false;

                  return (
                    <section
                      className={`workflow-monitor-panel ${isOpen ? 'is-open' : 'is-collapsed'}`}
                      key={panel.key}
                    >
                      <button
                        type="button"
                        className="workflow-monitor-panel__header workflow-monitor-panel__header--button"
                        onClick={() => togglePanel(panel.key)}
                        aria-expanded={isOpen}
                      >
                        <span className="workflow-monitor-panel__header-copy">
                          <Icon size={16} />
                          <span>{panel.label}</span>
                        </span>
                        <span className="workflow-monitor-panel__chevron">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="workflow-monitor-panel__body">
                          {panel.body}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </aside>
          </div>,
          document.body
        ) : null}

        {isDrawerOpen && selectedRow ? createPortal(
          <div className="workflow-monitor-drawer-overlay" role="presentation" onClick={closeRowDrawer}>
            <aside
              className="workflow-monitor-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Call details drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="workflow-monitor-drawer__header">
                <div className="workflow-monitor-drawer__title">
                  <div className="workflow-monitor-drawer__eyebrow">
                    <Split size={13} />
                    <span>Call details</span>
                  </div>
                  <h2>{selectedRow.callerNumber || 'Unknown caller'}</h2>
                  <p>{selectedRow.visitedPathLabel || selectedRow.currentNodeLabel || 'Call execution details'}</p>
                </div>
                <div className="workflow-monitor-drawer__actions">
                  <span className={`workflow-monitor-drawer__status workflow-monitor-drawer__status--${normalizeStatus(selectedRow.callStatus)}`}>
                    {String(selectedRow.callStatus || 'unknown').replace(/_/g, ' ')}
                  </span>
                  <button
                    type="button"
                    className="workflow-monitor-drawer__close"
                    onClick={closeRowDrawer}
                    aria-label="Close call details"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="workflow-monitor-drawer__body">
                <div className="workflow-monitor-row__detail-head workflow-monitor-row__detail-head--drawer">
                  <div>
                    <strong>{selectedRow.callerNumber || '-'}</strong>
                    <span>{selectedRow.visitedPathLabel || 'No visited path yet'}</span>
                  </div>
                  <div className="workflow-monitor-row__detail-tags">
                    {getVisibleRowTags(selectedRow, capabilityState).map((tag) => (
                      <span key={`drawer-${selectedRowKey}-${tag}`} className="workflow-monitor-tag">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                {renderDetailSection(selectedRow)}
              </div>
            </aside>
          </div>,
          document.body
        ) : null}
      </div>
    </div>
  );
};

export default WorkflowMonitorPage;
