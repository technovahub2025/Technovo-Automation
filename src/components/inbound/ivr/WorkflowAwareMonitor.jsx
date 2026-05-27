import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AudioLines,
  BookMarked,
  Clock3,
  Hash,
  MessageCircle,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  ListOrdered,
  Route,
  ShieldCheck,
  TriangleAlert,
  Workflow
} from 'lucide-react';
import useSocket from '../../../hooks/useSocket';
import { formatVoiceTime } from '../../../utils/voiceTime';
import './WorkflowAwareMonitor.css';

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'busy',
  'no-answer',
  'no_answer',
  'canceled',
  'cancelled',
  'opted_out',
  'timeout'
]);

const WORKFLOW_CAPABILITY_DEFS = [
  {
    key: 'audio',
    label: 'Audio',
    types: ['audio', 'greeting'],
    icon: AudioLines
  },
  {
    key: 'input',
    label: 'Input',
    types: ['input'],
    icon: Hash
  },
  {
    key: 'transfer',
    label: 'Transfer',
    types: ['transfer', 'handoff'],
    icon: PhoneForwarded
  },
  {
    key: 'queue',
    label: 'Queue',
    types: ['queue'],
    icon: ListOrdered
  },
  {
    key: 'booking',
    label: 'Booking',
    types: ['availability_check', 'slot_offer', 'booking_confirm', 'booking_create'],
    icon: BookMarked
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    types: ['whatsapp_notify'],
    icon: MessageCircle
  }
];

const normalizeType = (value) => String(value || '').trim().toLowerCase();

const resolveNodeLabel = (node = {}) => {
  const data = node.data || {};
  return (
    String(data.label || data.title || data.name || data.messageText || data.text || node.label || node.name || '').trim() ||
    normalizeType(node.type).replace(/_/g, ' ') ||
    node.id ||
    'Unknown node'
  );
};

const resolveNodeSummary = (node = {}) => {
  const data = node.data || {};
  const type = normalizeType(node.type);

  if (type === 'audio' || type === 'greeting') {
    const mode = String(data.mode || 'tts').toLowerCase();
    const text = String(data.messageText || data.text || '').trim();
    const audioUrl = String(data.audioUrl || '').trim();
    return mode === 'upload'
      ? (audioUrl ? `Upload playback • ${audioUrl}` : 'Upload playback')
      : (text ? `TTS • ${text}` : 'TTS prompt');
  }

  if (type === 'input') {
    const digit = String(data.digit ?? '').trim();
    const timeout = Number(data.timeoutSeconds ?? data.timeout ?? 0);
    const attempts = Number(data.maxAttempts ?? data.max_attempts ?? 0);
    const parts = [];
    if (digit) parts.push(`Digit ${digit}`);
    if (timeout) parts.push(`${timeout}s timeout`);
    if (attempts) parts.push(`${attempts} attempts`);
    return parts.join(' • ') || 'Input capture';
  }

  if (type === 'transfer' || type === 'handoff') {
    const destination = String(data.destination || data.transferNumber || '').trim();
    const department = String(data.department || '').trim();
    return destination
      ? `Transfer to ${destination}`
      : (department ? `Transfer to ${department}` : 'Transfer routing');
  }

  if (type === 'queue') {
    const queueName = String(data.queueName || data.queue_name || '').trim();
    const workflowSid = String(data.workflowSid || data.workflow_sid || '').trim();
    return queueName
      ? `Queue ${queueName}`
      : (workflowSid ? `Queue workflow ${workflowSid}` : 'Queue routing');
  }

  if (type === 'availability_check' || type === 'slot_offer' || type === 'booking_confirm' || type === 'booking_create') {
    const prompt = String(data.promptText || data.prompt_text || data.offerText || data.offer_text || '').trim();
    const timezone = String(data.timezone || '').trim();
    const prefix = String(data.bookingReferencePrefix || data.booking_reference_prefix || data.tokenPrefix || data.token_prefix || '').trim();
    const parts = [];
    if (prompt) parts.push(prompt);
    if (timezone) parts.push(timezone);
    if (prefix) parts.push(`Prefix ${prefix}`);
    return parts.join(' • ') || 'Booking flow step';
  }

  if (type === 'whatsapp_notify') {
    const customerRecipient = String(data.customerRecipient || data.customer_recipient || '').trim();
    const adminRecipient = String(data.adminRecipient || data.admin_recipient || '').trim();
    const customerTemplate = String(data.customerTemplateName || data.customer_template_name || '').trim();
    const adminTemplate = String(data.adminTemplateName || data.admin_template_name || '').trim();
    const parts = [];
    if (customerRecipient) parts.push(`Customer ${customerRecipient}`);
    if (adminRecipient) parts.push(`Admin ${adminRecipient}`);
    if (customerTemplate || adminTemplate) parts.push('Template mode');
    return parts.join(' • ') || 'WhatsApp notification';
  }

  return resolveNodeLabel(node);
};

const resolveWorkflowCapabilities = (workflow = {}) => {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes.filter(Boolean) : [];
  const nodesByType = nodes.reduce((acc, node) => {
    const type = normalizeType(node.type);
    if (!type) return acc;
    if (!acc[type]) acc[type] = [];
    acc[type].push(node);
    return acc;
  }, {});

  const capabilities = WORKFLOW_CAPABILITY_DEFS
    .map((definition) => ({
      ...definition,
      nodes: definition.types.flatMap((type) => nodesByType[type] || []),
      enabled: definition.types.some((type) => Boolean(nodesByType[type]?.length))
    }))
    .filter((capability) => capability.enabled);

  return {
    capabilities,
    nodes,
    nodesByType,
    nodeCount: nodes.length,
    edgeCount: Array.isArray(workflow?.edges) ? workflow.edges.length : 0
  };
};

const formatDuration = (startedAt, now) => {
  if (!startedAt) return '0s';
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return '0s';
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const resolveWorkflowEntryNode = (workflow = {}) => {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const preferredTypes = ['audio', 'greeting', 'availability_check', 'slot_offer', 'booking_confirm', 'booking_create'];
  for (const type of preferredTypes) {
    const node = nodes.find((item) => normalizeType(item?.type) === type);
    if (node) return node;
  }
  return nodes[0] || null;
};

const WorkflowAwareMonitor = ({
  workflowId,
  workflow,
  workflowName,
  menuStatus,
  testRunActive = false,
  testRunCurrentNodeId = null,
  testRunSteps = [],
  testRunMessage = '',
  testRunStartedAt = null,
  showHeader = true,
  headless = false,
  onSnapshotChange
}) => {
  const { socket } = useSocket();
  const [now, setNow] = useState(() => Date.now());
  const [workflowCalls, setWorkflowCalls] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);
  const workflowCallWorkflowMapRef = useRef(new Map());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const capabilityState = useMemo(() => resolveWorkflowCapabilities(workflow), [workflow]);
  const entryNode = useMemo(() => resolveWorkflowEntryNode(workflow), [workflow]);
  const nodesById = useMemo(
    () => new Map((Array.isArray(workflow?.nodes) ? workflow.nodes : []).map((node) => [node.id, node])),
    [workflow]
  );

  const getResolvedWorkflowId = useCallback((callSid, fallbackWorkflowId = null) => {
    if (fallbackWorkflowId) return String(fallbackWorkflowId);
    if (!callSid) return '';
    return String(workflowCallWorkflowMapRef.current.get(callSid) || '');
  }, []);

  const matchesWorkflow = useCallback((candidateWorkflowId, callSid = null) => {
    if (!workflowId) return true;
    const resolvedWorkflowId = getResolvedWorkflowId(callSid, candidateWorkflowId);
    return String(resolvedWorkflowId || '') === String(workflowId);
  }, [getResolvedWorkflowId, workflowId]);

  const upsertWorkflowCall = useCallback((payload = {}) => {
    const callSid = String(payload.callSid || payload.callId || payload.id || '').trim();
    const resolvedWorkflowId = String(payload.workflowId || getResolvedWorkflowId(callSid) || '').trim();
    if (workflowId && resolvedWorkflowId && String(workflowId) !== resolvedWorkflowId) {
      return;
    }
    if (workflowId && !resolvedWorkflowId && payload.scope === 'workflow') {
      return;
    }

    const normalized = {
      id: callSid || `call-${Date.now()}`,
      callSid: callSid || null,
      workflowId: resolvedWorkflowId || null,
      phoneNumber: payload.phoneNumber || payload.phone || payload.callerNumber || payload?.contact?.phone || '-',
      status: String(payload.status || 'initiated').toLowerCase(),
      source: String(payload.source || (payload.broadcastId ? 'broadcast' : (payload.direction || 'inbound'))),
      startTime: payload.startTime || payload.createdAt || payload.timestamp || Date.now(),
      updatedAt: payload.updatedAt || payload.timestamp || Date.now(),
      currentNodeId: payload.currentNodeId || payload.currentNode?.id || null,
      currentNodeType: normalizeType(payload.currentNodeType || payload.currentNode?.type),
      currentNodeLabel: payload.currentNodeLabel || resolveNodeLabel(payload.currentNode || {}),
      lastInput: payload.lastInput ?? payload.userInput ?? null,
      nextAction: payload.nextAction || null,
      response: payload.response || null,
      reason: payload.reason || null,
      error: payload.error || null,
      event: payload.event || null,
      completedAt: payload.completedAt || null,
      visitedNodes: Array.isArray(payload.visitedNodes) ? payload.visitedNodes : []
    };

    if (callSid && resolvedWorkflowId) {
      workflowCallWorkflowMapRef.current.set(callSid, resolvedWorkflowId);
    }

    setWorkflowCalls((prev) => {
      const index = prev.findIndex((item) => item.id === normalized.id);
      if (index === -1) {
        return [normalized, ...prev].slice(0, 100);
      }
      const next = [...prev];
      next[index] = { ...next[index], ...normalized };
      return next;
    });
  }, [getResolvedWorkflowId, workflowId]);

  const removeWorkflowCall = useCallback((payload = {}) => {
    const callSid = String(payload.callSid || payload.callId || payload.id || '').trim();
    if (!callSid) return;

    const resolvedWorkflowId = String(payload.workflowId || getResolvedWorkflowId(callSid) || '').trim();
    if (workflowId && resolvedWorkflowId && String(workflowId) !== resolvedWorkflowId) {
      return;
    }

    setWorkflowCalls((prev) => prev.map((item) => (
      item.id === callSid
        ? {
          ...item,
          status: String(payload.status || item.status || 'completed').toLowerCase(),
          reason: payload.reason || item.reason || null,
          error: payload.error || item.error || null,
          completedAt: payload.completedAt || Date.now(),
          updatedAt: payload.timestamp || Date.now()
        }
        : item
    )));
  }, [getResolvedWorkflowId, workflowId]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleWorkflowUpdate = (data = {}) => {
      const incomingWorkflowId = String(data.workflowId || '').trim();
      const callSid = String(data.callSid || data.callId || '').trim();
      if (workflowId && incomingWorkflowId && String(workflowId) !== incomingWorkflowId) {
        return;
      }
      if (workflowId && !incomingWorkflowId && callSid && !matchesWorkflow(null, callSid)) {
        return;
      }

      const event = String(data.event || data.type || '').toLowerCase();

      if (event === 'execution_started') {
        workflowCallWorkflowMapRef.current.set(callSid, incomingWorkflowId || String(workflowId || ''));
        upsertWorkflowCall({
          ...data,
          callSid,
          workflowId: incomingWorkflowId || workflowId,
          status: 'running',
          startTime: data.timestamp || Date.now(),
          updatedAt: data.timestamp || Date.now(),
          currentNodeId: data.currentNode?.id || data.currentNodeId || null,
          currentNodeType: data.currentNode?.type || data.currentNodeType || null,
          currentNodeLabel: resolveNodeLabel(data.currentNode || {}),
          visitedNodes: Array.isArray(data.visitedNodes) ? data.visitedNodes : [],
          event
        });
        return;
      }

      if (event === 'node_visited' || data.currentNode || data.currentNodeId) {
        upsertWorkflowCall({
          ...data,
          callSid,
          workflowId: incomingWorkflowId || workflowId,
          status: 'running',
          updatedAt: data.timestamp || Date.now(),
          currentNodeId: data.currentNode?.id || data.nodeId || data.currentNodeId || null,
          currentNodeType: data.currentNode?.type || data.nodeType || data.currentNodeType || null,
          currentNodeLabel: resolveNodeLabel(data.currentNode || nodesById.get(data.nodeId) || nodesById.get(data.currentNodeId) || {}),
          lastInput: data.userInput ?? data.lastInput ?? null,
          nextAction: data.nextAction || null,
          response: data.response || null,
          visitedNodes: Array.isArray(data.visitedNodes) ? data.visitedNodes : [],
          event
        });
        return;
      }

      if (event === 'execution_ended') {
        removeWorkflowCall({
          ...data,
          callSid,
          workflowId: incomingWorkflowId || workflowId,
          status: data.reason && data.reason !== 'normal' ? String(data.reason).toLowerCase() : 'completed',
          reason: data.reason || null,
          completedAt: data.timestamp || Date.now(),
          updatedAt: data.timestamp || Date.now(),
          event
        });
        return;
      }

      if (data.error) {
        setRecentErrors((prev) => [
          {
            callSid,
            workflowId: incomingWorkflowId || workflowId || null,
            error: String(data.error || 'Workflow error'),
            timestamp: data.timestamp || Date.now()
          },
          ...prev
        ].slice(0, 8));
      }
    };

    const handleWorkflowError = (data = {}) => {
      const incomingWorkflowId = String(data.workflowId || '').trim();
      const callSid = String(data.callSid || data.callId || '').trim();
      if (workflowId && incomingWorkflowId && String(workflowId) !== incomingWorkflowId) {
        return;
      }

      const errorMessage = String(data.error || data.message || 'Workflow error').trim();
      setRecentErrors((prev) => [
        {
          callSid,
          workflowId: incomingWorkflowId || workflowId || null,
          error: errorMessage,
          timestamp: data.timestamp || Date.now()
        },
        ...prev
      ].slice(0, 8));

      if (callSid) {
        removeWorkflowCall({
          callSid,
          workflowId: incomingWorkflowId || workflowId,
          status: 'failed',
          error: errorMessage,
          reason: data.reason || 'failed',
          completedAt: data.timestamp || Date.now(),
          updatedAt: data.timestamp || Date.now()
        });
      }
    };

    const handleWorkflowCallStarted = (data = {}) => handleWorkflowUpdate({ ...data, event: 'execution_started' });
    const handleWorkflowCallNode = (data = {}) => handleWorkflowUpdate({ ...data, event: 'node_visited' });
    const handleWorkflowCallCompleted = (data = {}) => handleWorkflowUpdate({ ...data, event: 'execution_ended' });

    socket.on('ivr_workflow_update', handleWorkflowUpdate);
    socket.on('ivr_workflow_error', handleWorkflowError);
    socket.on('workflow_call_started', handleWorkflowCallStarted);
    socket.on('workflow_call_node', handleWorkflowCallNode);
    socket.on('workflow_call_completed', handleWorkflowCallCompleted);

    return () => {
      socket.off('ivr_workflow_update', handleWorkflowUpdate);
      socket.off('ivr_workflow_error', handleWorkflowError);
      socket.off('workflow_call_started', handleWorkflowCallStarted);
      socket.off('workflow_call_node', handleWorkflowCallNode);
      socket.off('workflow_call_completed', handleWorkflowCallCompleted);
    };
  }, [matchesWorkflow, nodesById, removeWorkflowCall, socket, workflowId, upsertWorkflowCall]);

  const relevantCalls = useMemo(() => {
    const filtered = workflowCalls.filter((call) => {
      if (!workflowId) return true;
      if (!call.workflowId) return false;
      return String(call.workflowId) === String(workflowId);
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.startTime || 0).getTime();
      const bTime = new Date(b.updatedAt || b.startTime || 0).getTime();
      return bTime - aTime;
    });
  }, [workflowCalls, workflowId]);

  const activeCalls = useMemo(
    () => relevantCalls.filter((call) => !TERMINAL_STATUSES.has(String(call.status || '').toLowerCase())),
    [relevantCalls]
  );

  const currentCall = useMemo(
    () => activeCalls[0] || relevantCalls[0] || null,
    [activeCalls, relevantCalls]
  );

  const testRunCall = useMemo(() => {
    if (!testRunActive) return null;
    const node = nodesById.get(testRunCurrentNodeId) || entryNode || null;
    return {
      id: 'test-run',
      callSid: 'test-run',
      workflowId: workflowId || null,
      phoneNumber: 'Simulation',
      status: 'testing',
      source: 'simulation',
      startTime: testRunStartedAt || Date.now(),
      updatedAt: Date.now(),
      currentNodeId: testRunCurrentNodeId || node?.id || null,
      currentNodeType: normalizeType(node?.type),
      currentNodeLabel: resolveNodeLabel(node || {}),
      nextAction: testRunMessage || 'Testing workflow',
      response: testRunSteps.length ? `Step ${testRunSteps.length}` : null,
      lastInput: null,
      event: 'test_run'
    };
  }, [entryNode, nodesById, testRunActive, testRunCurrentNodeId, testRunMessage, testRunStartedAt, testRunSteps.length, workflowId]);

  const highlightedCall = currentCall || testRunCall || null;
  const currentNode = useMemo(() => {
    if (highlightedCall?.currentNodeId && nodesById.has(highlightedCall.currentNodeId)) {
      return nodesById.get(highlightedCall.currentNodeId);
    }
    if (testRunCurrentNodeId && nodesById.has(testRunCurrentNodeId)) {
      return nodesById.get(testRunCurrentNodeId);
    }
    return entryNode || null;
  }, [entryNode, highlightedCall, nodesById, testRunCurrentNodeId]);

  const currentNodeType = normalizeType(highlightedCall?.currentNodeType || currentNode?.type);
  const currentNodeLabel = resolveNodeLabel(currentNode || {});
  const currentDuration = highlightedCall?.startTime ? formatDuration(highlightedCall.startTime, now) : '0s';
  const currentStatus = testRunActive
    ? 'testing'
    : (highlightedCall?.status || String(menuStatus || 'draft').toLowerCase() || 'idle');
  const errorCount = recentErrors.length;
  const lastError = recentErrors[0]?.error || highlightedCall?.error || '';
  const liveSnapshot = useMemo(() => ({
    workflowId,
    workflowName: workflowName || 'Workflow Monitor',
    currentNodeId: highlightedCall?.currentNodeId || null,
    currentNodeType,
    currentNodeLabel,
    currentStatus,
    currentDuration,
    activeCallCount: activeCalls.length,
    activeCalls,
    currentCall: highlightedCall,
    recentErrors,
    capabilityState,
    visitedNodes: Array.isArray(highlightedCall?.visitedNodes) ? highlightedCall.visitedNodes : [],
    testRunActive,
    testRunCurrentNodeId,
    testRunSteps,
    testRunMessage
  }), [
    activeCalls,
    capabilityState,
    currentDuration,
    currentNodeLabel,
    currentNodeType,
    currentStatus,
    highlightedCall,
    recentErrors,
    testRunActive,
    testRunCurrentNodeId,
    testRunMessage,
    testRunSteps,
    workflowId,
    workflowName
  ]);
  const liveSnapshotSignature = useMemo(() => {
    const currentCallSignature = highlightedCall
      ? {
          id: highlightedCall.id || null,
          callSid: highlightedCall.callSid || null,
          status: highlightedCall.status || null,
          currentNodeId: highlightedCall.currentNodeId || null,
          currentNodeType: highlightedCall.currentNodeType || null,
          updatedAt: highlightedCall.updatedAt || null
        }
      : null;
    const recentErrorSignature = recentErrors.map((item) => ({
      callSid: item.callSid || null,
      workflowId: item.workflowId || null,
      error: item.error || null,
      timestamp: item.timestamp || null
    }));
    const visitedNodeSignature = Array.isArray(highlightedCall?.visitedNodes)
      ? highlightedCall.visitedNodes.map((item) => ({
          nodeId: item.nodeId || null,
          nodeType: item.nodeType || null,
          userInput: item.userInput ?? null,
          timestamp: item.timestamp || null
        }))
      : [];

    return JSON.stringify({
      workflowId: workflowId || null,
      currentNodeId: liveSnapshot.currentNodeId || null,
      currentNodeType: liveSnapshot.currentNodeType || null,
      currentStatus: liveSnapshot.currentStatus || null,
      currentDuration: liveSnapshot.currentDuration || null,
      activeCallCount: liveSnapshot.activeCallCount || 0,
      currentCall: currentCallSignature,
      recentErrors: recentErrorSignature,
      visitedNodes: visitedNodeSignature,
      testRunActive,
      testRunCurrentNodeId: testRunCurrentNodeId || null,
      testRunSteps: Array.isArray(testRunSteps) ? testRunSteps.map((step) => String(step || '')) : [],
      testRunMessage: testRunMessage || ''
    });
  }, [
    highlightedCall,
    liveSnapshot.activeCallCount,
    liveSnapshot.currentDuration,
    liveSnapshot.currentNodeId,
    liveSnapshot.currentNodeType,
    liveSnapshot.currentStatus,
    recentErrors,
    testRunActive,
    testRunCurrentNodeId,
    testRunMessage,
    testRunSteps,
    workflowId
  ]);
  const lastSnapshotSignatureRef = useRef('');

  useEffect(() => {
    if (!onSnapshotChange) return;
    if (lastSnapshotSignatureRef.current === liveSnapshotSignature) return;
    lastSnapshotSignatureRef.current = liveSnapshotSignature;
    onSnapshotChange(liveSnapshot);
  }, [liveSnapshot, liveSnapshotSignature, onSnapshotChange]);

  if (headless) {
    return null;
  }

  const summaryWidgets = [
    {
      key: 'active-calls',
      label: 'Active Calls',
      value: String(activeCalls.length),
      note: relevantCalls.length > activeCalls.length
        ? `${relevantCalls.length} tracked total`
        : 'Tracked in realtime',
      icon: PhoneCall
    },
    {
      key: 'current-node',
      label: 'Current Node',
      value: currentNodeLabel,
      note: currentNodeType ? `Type: ${currentNodeType}` : (entryNode ? `Entry: ${resolveNodeLabel(entryNode)}` : 'Waiting for execution'),
      icon: Workflow
    },
    {
      key: 'duration',
      label: 'Duration',
      value: highlightedCall?.startTime || testRunStartedAt ? currentDuration : '0s',
      note: highlightedCall?.phoneNumber || testRunActive ? (testRunActive ? 'Simulation running' : 'Live call running') : 'No active call',
      icon: Clock3
    },
    {
      key: 'status',
      label: 'Status',
      value: testRunActive ? 'Testing' : (currentStatus || 'idle'),
      note: testRunMessage || (currentCall?.response ? String(currentCall.response).slice(0, 72) : 'Workflow ready'),
      icon: currentStatus === 'failed' ? TriangleAlert : ShieldCheck
    },
    {
      key: 'errors',
      label: 'Errors',
      value: String(errorCount),
      note: lastError || 'No errors detected',
      icon: errorCount > 0 ? AlertTriangle : PhoneOff
    }
  ];

  const capabilityWidgetRenderers = {
    audio: () => {
      const nodes = capabilityState.nodesByType.audio || capabilityState.nodesByType.greeting || [];
      const selected = nodes[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-audio-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <AudioLines size={16} />
              <span>Audio</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">{selected ? resolveNodeLabel(selected) : 'Audio prompt configured'}</div>
          <div className="monitor-widget-note">{selected ? resolveNodeSummary(selected) : 'TTS or uploaded prompt available'}</div>
        </div>
      );
    },
    input: () => {
      const nodes = capabilityState.nodesByType.input || [];
      const selected = nodes[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-input-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <Hash size={16} />
              <span>User Input</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">{selected ? resolveNodeLabel(selected) : 'Input routing configured'}</div>
          <div className="monitor-widget-note">{selected ? resolveNodeSummary(selected) : 'Digit collection and retries are enabled'}</div>
        </div>
      );
    },
    transfer: () => {
      const nodes = [
        ...(capabilityState.nodesByType.transfer || []),
        ...(capabilityState.nodesByType.handoff || [])
      ];
      const selected = nodes[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-transfer-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <PhoneForwarded size={16} />
              <span>Transfer</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">{selected ? resolveNodeLabel(selected) : 'Handoff configured'}</div>
          <div className="monitor-widget-note">{selected ? resolveNodeSummary(selected) : 'Human transfer or department routing available'}</div>
        </div>
      );
    },
    queue: () => {
      const nodes = capabilityState.nodesByType.queue || [];
      const selected = nodes[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-queue-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <ListOrdered size={16} />
              <span>Queue</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">{selected ? resolveNodeLabel(selected) : 'Queue configured'}</div>
          <div className="monitor-widget-note">{selected ? resolveNodeSummary(selected) : 'Queue routing will appear here when used'}</div>
        </div>
      );
    },
    booking: () => {
      const nodes = capabilityState.capabilities.find((item) => item.key === 'booking')?.nodes || [];
      const availabilityNode = capabilityState.nodesByType.availability_check?.[0] || null;
      const confirmNode = capabilityState.nodesByType.booking_confirm?.[0] || null;
      const createNode = capabilityState.nodesByType.booking_create?.[0] || null;
      const slotOfferNode = capabilityState.nodesByType.slot_offer?.[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-booking-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <BookMarked size={16} />
              <span>Booking</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">
            {availabilityNode ? resolveNodeLabel(availabilityNode) : 'Booking flow enabled'}
          </div>
          <div className="monitor-widget-note">
            {[
              availabilityNode ? `Availability: ${resolveNodeSummary(availabilityNode)}` : null,
              slotOfferNode ? `Offer: ${resolveNodeSummary(slotOfferNode)}` : null,
              confirmNode ? `Confirm: ${resolveNodeSummary(confirmNode)}` : null,
              createNode ? `Create: ${resolveNodeSummary(createNode)}` : null
            ].filter(Boolean).join(' • ') || 'Slot lookup, confirmation and save steps will render here'}
          </div>
        </div>
      );
    },
    whatsapp: () => {
      const nodes = capabilityState.nodesByType.whatsapp_notify || [];
      const selected = nodes[0] || null;
      return (
        <div className="monitor-widget monitor-capability-widget monitor-whatsapp-widget">
          <div className="monitor-widget-header">
            <div className="monitor-widget-title">
              <MessageCircle size={16} />
              <span>WhatsApp</span>
            </div>
            <span className="monitor-widget-badge">{nodes.length} nodes</span>
          </div>
          <div className="monitor-widget-value">{selected ? resolveNodeLabel(selected) : 'Notification node configured'}</div>
          <div className="monitor-widget-note">{selected ? resolveNodeSummary(selected) : 'Customer and admin notifications are ready to send'}</div>
        </div>
      );
    }
  };

  const capabilityWidgets = capabilityState.capabilities.map((capability) => ({
    key: capability.key,
    render: capabilityWidgetRenderers[capability.key]
  })).filter((item) => typeof item.render === 'function');

  return (
    <div className="workflow-aware-monitor">
      {showHeader && (
        <div className="workflow-monitor-header">
          <div className="workflow-monitor-heading">
            <div className="workflow-monitor-title">
              <Activity size={18} />
              <span>{workflowName || 'Workflow Monitor'}</span>
            </div>
            <div className="workflow-monitor-subtitle">
              {capabilityState.nodeCount} nodes • {capabilityState.edgeCount} edges
            </div>
          </div>
          <div className="workflow-monitor-badges">
            {capabilityState.capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <span key={capability.key} className={`workflow-capability-chip capability-${capability.key}`}>
                  <Icon size={12} />
                  {capability.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="workflow-monitor-base-grid">
        {summaryWidgets.map((widget) => {
          const Icon = widget.icon;
          return (
            <div key={widget.key} className="monitor-widget monitor-base-widget">
              <div className="monitor-widget-header">
                <div className="monitor-widget-title">
                  <Icon size={16} />
                  <span>{widget.label}</span>
                </div>
              </div>
              <div className="monitor-widget-value">{widget.value}</div>
              <div className="monitor-widget-note">{widget.note}</div>
            </div>
          );
        })}
      </div>

      <div className="workflow-monitor-layout">
        <div className="workflow-monitor-main">
          <div className="workflow-monitor-section">
            <div className="workflow-monitor-section-header">
              <h5>Live Calls</h5>
              <span>{activeCalls.length} running</span>
            </div>

            {activeCalls.length > 0 ? (
              <div className="workflow-call-list">
                {activeCalls.map((call) => (
                  <div key={call.id} className="workflow-call-card">
                    <div className="workflow-call-card-head">
                      <div className="workflow-call-card-title">
                        <PhoneCall size={14} />
                        <span>{call.phoneNumber}</span>
                      </div>
                      <span className={`workflow-call-status status-${String(call.status || 'running').toLowerCase()}`}>
                        {String(call.status || 'running')}
                      </span>
                    </div>
                    <div className="workflow-call-meta">
                      <span>
                        <Clock3 size={12} />
                        {formatVoiceTime(call.startTime)}
                      </span>
                      <span>
                        <Workflow size={12} />
                        {call.currentNodeLabel || resolveNodeLabel(nodesById.get(call.currentNodeId) || {}) || 'Waiting'}
                      </span>
                      <span>
                        <Route size={12} />
                        {call.nextAction || 'Monitoring'}
                      </span>
                    </div>
                    <div className="workflow-call-duration">
                      Duration {formatDuration(call.startTime, now)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workflow-monitor-empty">
                No active calls for this workflow yet.
              </div>
            )}
          </div>

          <div className="workflow-monitor-section">
            <div className="workflow-monitor-section-header">
              <h5>Execution Snapshot</h5>
              <span>{currentStatus}</span>
            </div>
            <div className="workflow-snapshot-card">
              <div className="workflow-snapshot-row">
                <span>Current node</span>
                <strong>{currentNodeLabel}</strong>
              </div>
              <div className="workflow-snapshot-row">
                <span>Node type</span>
                <strong>{currentNodeType || 'idle'}</strong>
              </div>
              <div className="workflow-snapshot-row">
                <span>Duration</span>
                <strong>{highlightedCall?.startTime || testRunStartedAt ? currentDuration : '0s'}</strong>
              </div>
              <div className="workflow-snapshot-row">
                <span>Last response</span>
                <strong>{highlightedCall?.response || testRunMessage || 'Waiting for updates'}</strong>
              </div>
              <div className="workflow-snapshot-row">
                <span>Last input</span>
                <strong>{highlightedCall?.lastInput || '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="workflow-monitor-sidebar">
          {capabilityWidgets.length > 0 && (
            <div className="workflow-monitor-section">
              <div className="workflow-monitor-section-header">
                <h5>Workflow Widgets</h5>
                <span>{capabilityWidgets.length} shown</span>
              </div>
              <div className="workflow-capability-grid">
                {capabilityWidgets.map((widget) => (
                  <React.Fragment key={widget.key}>
                    {widget.render()}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="workflow-monitor-section">
            <div className="workflow-monitor-section-header">
              <h5>Errors</h5>
              <span>{errorCount}</span>
            </div>
            {errorCount > 0 ? (
              <div className="workflow-error-list">
                {recentErrors.map((error, index) => (
                  <div key={`${error.timestamp}-${index}`} className="workflow-error-item">
                    <div className="workflow-error-item-head">
                      <TriangleAlert size={14} />
                      <span>{error.callSid || 'workflow'}</span>
                    </div>
                    <div className="workflow-error-message">{error.error}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workflow-monitor-empty">
                No workflow errors recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowAwareMonitor;
