import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Trash2, Users, Edit3, Phone, Clock, CheckCircle, Save, X, GitBranch, Workflow, AlertTriangle } from 'lucide-react';
import useIVRWorkflowSocket from '../../../hooks/useIVRWorkflowSocket';
import socketService from '../../../services/socketService';
import WorkflowBuilderCanvas from './WorkflowBuilderCanvas';
import { ivrService } from '../../../services/ivrService';
import './IVRMenuCard.css';

function IVRMenuCard({ menu, onUpdate, onDelete, onTest }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [draftWorkflow, setDraftWorkflow] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [testRunActive, setTestRunActive] = useState(false);
  const [activePath, setActivePath] = useState({ nodeId: null, edgeIds: [] });
  const [testRunCurrentNodeId, setTestRunCurrentNodeId] = useState(null);
  const [testRunSteps, setTestRunSteps] = useState([]);
  const [testRunMessage, setTestRunMessage] = useState('');
  const [testRunInputDigit, setTestRunInputDigit] = useState('');
  const [testRunConditionalMode, setTestRunConditionalMode] = useState('auto');
  const [currentStatus, setCurrentStatus] = useState(menu?.status || 'draft');
  
  // Track which node is being edited to prevent socket updates
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [lastEditTimestamp, setLastEditTimestamp] = useState(0);


  const {
    joinWorkflow,
    leaveWorkflow,
    onTTSProgress,
    onTTSCompleted,
    onTTSFailed,
    addNode,
    moveNode,
    connectNodes,
    deleteNode,
    deleteEdge,
    reattachEdge
  } = useIVRWorkflowSocket(menu?._id);

  const safeMenu = menu ?? {};

  const workflow = safeMenu.workflowConfig ?? safeMenu.workflow ?? {
    nodes: [],
    edges: [],
    settings: {}
  };
  const effectiveWorkflow = draftWorkflow ?? workflow;

  const ensureUniqueNodeIds = (workflowData) => {
    const nodes = workflowData?.nodes || [];
    const edges = workflowData?.edges || [];
    const idCount = new Map();
    let missingIdCounter = 0;

    const uniqueNodes = nodes.map((node, index) => {
      if (!node) return node;

      const rawId = typeof node.id === 'string' && node.id.trim()
        ? node.id.trim()
        : `node_auto_${index + 1}_${++missingIdCounter}`;
      const occurrence = (idCount.get(rawId) || 0) + 1;
      idCount.set(rawId, occurrence);

      const nextId = occurrence === 1 ? rawId : `${rawId}__dup${occurrence}`;
      if (nextId === node.id) {
        return node;
      }
      return { ...node, id: nextId };
    }).filter(Boolean);

    const changed = uniqueNodes.some((node, index) => node?.id !== nodes[index]?.id);
    if (!changed) {
      return workflowData;
    }

    const validNodeIds = new Set(uniqueNodes.map((node) => node.id));
    const uniqueEdges = edges.filter((edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target));

    return {
      ...workflowData,
      nodes: uniqueNodes,
      edges: uniqueEdges
    };
  };

  // Migrate greeting nodes to audio nodes for backward compatibility
  const migratedWorkflow = useMemo(() => {
    if (!effectiveWorkflow.nodes) return effectiveWorkflow;

    const hasGreetingNodes = effectiveWorkflow.nodes.some(node => node.type === 'greeting');
    if (!hasGreetingNodes) return ensureUniqueNodeIds(effectiveWorkflow);

    const migratedNodes = effectiveWorkflow.nodes.map(node => {
      if (node.type === 'greeting') {
        return {
          ...node,
          type: 'audio',
          data: {
            ...(node.data || {}),
            mode: node.data?.mode || 'tts',
            messageText: node.data?.messageText || node.data?.text || 'Welcome message',
            voice: node.data?.voice || 'en-GB-SoniaNeural',
            language: node.data?.language || 'en-GB',
            afterPlayback: node.data?.afterPlayback || 'next',
            maxRetries: node.data?.maxRetries ?? 3,
            timeoutSeconds: node.data?.timeoutSeconds ?? node.data?.timeout ?? 10,
            fallbackAudioNodeId: node.data?.fallbackAudioNodeId || '',
            promptKey: node.data?.promptKey || `audio_${Date.now()}`,
            audioPublicId: node.data?.audioPublicId || node.data?.audioAssetId || node.audioAssetId || '',
            audioUrl: node.data?.audioUrl || node.audioUrl || '',
            audioAssetId: node.data?.audioAssetId || node.audioAssetId || ''
          }
        };
      }
      return node;
    });

    return ensureUniqueNodeIds({
      ...effectiveWorkflow,
      nodes: migratedNodes
    });
  }, [effectiveWorkflow]);
  // Migration is applied in-memory; persisted only on explicit Save.

  // Add socket listener for backend workflow updates
  useEffect(() => {
    const socket = socketService.connect();
    if (socket) {
      const handleWorkflowUpdated = (data) => {
        if (data.workflowId !== menu?._id) return;

        // Backend may send workflowData or partial updates (like audioUrls/ttsStatus)
        const workflowData = data.workflowData || data;

        if (!workflowData.nodes && !data.audioUrls) {
          console.log('Workflow status update:', data.ttsStatus || data.status);
          return;
        }

        // Prevent useless re-renders - only update if data actually changed
        const currentData = JSON.stringify(draftWorkflow || workflow);
        const newData = JSON.stringify(workflowData);
        if (currentData === newData) return;

        // Never persist from socket update events here.
        // onUpdate performs API save + menu refresh, which can overwrite in-progress draft edits.
        if (workflowData.nodes) {
          if (isEditing) {
            // Keep draft stable during editing; explicit Save handles persistence.
            return;
          }
          setDraftWorkflow(ensureUniqueNodeIds(workflowData));
          return;
        }

        if (data.audioUrls) {
          console.log('Audio URLs updated:', data.audioUrls);
          setDraftWorkflow((prev) => ({
            ...(prev || migratedWorkflow),
            audioProcessing: {
              status: data.ttsStatus || 'completed',
              audioUrls: data.audioUrls
            }
          }));
        }
      };
      socket.on('workflow_updated', handleWorkflowUpdated);
      socket.on('workflow_error', (error) => {
        console.error('❌ Workflow update error via socket:', error);
        if (error.workflowId === menu?._id) {
          // Could show error notification to user
          setValidationErrors([`Update failed: ${error.error}`]);
        }
      });

      return () => {
        socket.off('workflow_updated', handleWorkflowUpdated);
        socket.off('workflow_error');
      };
    }
  }, [menu?._id, migratedWorkflow, isEditing, draftWorkflow, workflow]);



  // Memoize status to avoid unnecessary updates
  const stableMenuStatus = useMemo(() => menu?.status, [menu?.status]);

  // Production-grade local validation before save/activate
  const productionValidation = useMemo(() => {
    const nodes = migratedWorkflow?.nodes || [];
    const edges = migratedWorkflow?.edges || [];
    const issues = [];

    if (!nodes.length) {
      return {
        issues: ['Workflow must contain at least one node.'],
        isValidForSave: false,
        isValidForActivation: false
      };
    }

    const nodeIdSet = new Set();
    const duplicateNodeIds = new Set();
    const invalidNodeIds = [];
    nodes.forEach((node) => {
      const id = typeof node?.id === 'string' ? node.id.trim() : '';
      if (!id) {
        invalidNodeIds.push(String(node?.id || '<missing>'));
        return;
      }
      if (nodeIdSet.has(id)) duplicateNodeIds.add(id);
      nodeIdSet.add(id);
    });

    if (invalidNodeIds.length > 0) issues.push('One or more nodes are missing a valid node id.');
    if (duplicateNodeIds.size > 0) issues.push(`Duplicate node ids: ${Array.from(duplicateNodeIds).join(', ')}`);

    const audioNodeIds = new Set(
      nodes
        .filter((n) => ['audio', 'greeting'].includes((n.type || '').toLowerCase()))
        .map((n) => n.id)
    );

    const edgeKeySet = new Set();
    const sourceHandleMap = new Set();
    edges.forEach((edge) => {
      if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) {
        issues.push(`Broken edge ${edge.id || '<no-id>'}: source/target node not found.`);
        return;
      }
      const edgeKey = `${edge.source}|${edge.target}|${edge.sourceHandle || ''}|${edge.targetHandle || ''}`;
      if (edgeKeySet.has(edgeKey)) {
        issues.push(`Duplicate edge route detected: ${edge.source} -> ${edge.target}.`);
      }
      edgeKeySet.add(edgeKey);

      const sourceNode = nodes.find((n) => n.id === edge.source);
      const sourceType = (sourceNode?.type || '').toLowerCase();
      if (sourceType === 'input' || sourceType === 'conditional') {
        const handle = edge.sourceHandle || '__default__';
        const key = `${edge.source}:${handle}`;
        if (sourceHandleMap.has(key)) {
          issues.push(`Node ${edge.source} has multiple routes for handle "${handle}".`);
        }
        sourceHandleMap.add(key);
      }
    });

    nodes.forEach((node) => {
      const nodeType = (node.type || '').toLowerCase();
      const data = node.data || {};
      const asNodeId = (value) => (typeof value === 'string' ? value.trim() : '');

      if (nodeType === 'audio' || nodeType === 'greeting') {
        const mode = (data.mode || 'tts').toLowerCase();
        const text = (data.messageText || data.text || data.message || '').trim();
        const audioUrl = (data.audioUrl || '').trim();
        if (mode === 'tts' && !text) issues.push(`Audio node ${node.id} is missing TTS text.`);
        if ((mode === 'upload' || mode === 'file') && !audioUrl) issues.push(`Audio node ${node.id} is missing audio URL.`);

        const fallbackAudioNodeId = asNodeId(data.fallbackAudioNodeId);
        if (fallbackAudioNodeId && !audioNodeIds.has(fallbackAudioNodeId)) {
          issues.push(`Audio node ${node.id} fallback references non-audio node ${fallbackAudioNodeId}.`);
        }
      }

      if (nodeType === 'input') {
        const promptAudioNodeId = asNodeId(data.promptAudioNodeId || data.prompt_audio_node_id);
        const invalidAudioNodeId = asNodeId(data.invalidAudioNodeId || data.invalid_audio_node_id);
        const timeoutAudioNodeId = asNodeId(data.timeoutAudioNodeId || data.timeout_audio_node_id);

        if (!promptAudioNodeId || !audioNodeIds.has(promptAudioNodeId)) {
          issues.push(`Input node ${node.id} must reference a valid prompt audio node.`);
        }
        if (invalidAudioNodeId && !audioNodeIds.has(invalidAudioNodeId)) {
          issues.push(`Input node ${node.id} invalid-audio reference is not an audio node.`);
        }
        if (timeoutAudioNodeId && !audioNodeIds.has(timeoutAudioNodeId)) {
          issues.push(`Input node ${node.id} timeout-audio reference is not an audio node.`);
        }

        const timeoutSeconds = Number(data.timeoutSeconds ?? data.timeout);
        const maxAttempts = Number(data.maxAttempts ?? data.max_attempts);
        if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 60) {
          issues.push(`Input node ${node.id} timeout must be between 1 and 60 seconds.`);
        }
        if (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
          issues.push(`Input node ${node.id} max attempts must be between 1 and 10.`);
        }

        const digit = String(data.digit ?? '').trim();
        if (digit && !edges.some((edge) => edge.source === node.id && edge.sourceHandle === digit)) {
          issues.push(`Input node ${node.id} digit "${digit}" has no matching outgoing edge.`);
        }
      }

      if (nodeType === 'conditional') {
        if (!edges.some((edge) => edge.source === node.id && edge.sourceHandle === 'true')) {
          issues.push(`Conditional node ${node.id} is missing a "true" branch.`);
        }
        if (!edges.some((edge) => edge.source === node.id && edge.sourceHandle === 'false')) {
          issues.push(`Conditional node ${node.id} is missing a "false" branch.`);
        }

        const conditionType = String(data.condition || '').trim().toLowerCase();
        if (conditionType === 'custom') {
          const variable = String(data.variable || '').trim();
          const operator = String(data.operator || '').trim();
          const value = String(data.value || '').trim();
          if (!variable) {
            issues.push(`Conditional node ${node.id} custom mode requires a variable.`);
          }
          if (!operator) {
            issues.push(`Conditional node ${node.id} custom mode requires an operator.`);
          }
          if (operator !== 'exists' && !value) {
            issues.push(`Conditional node ${node.id} custom mode requires a value for operator "${operator}".`);
          }
        }

        if (conditionType === 'business_hours') {
          const start = Number(data.businessStartHour ?? data.business_start_hour ?? 9);
          const end = Number(data.businessEndHour ?? data.business_end_hour ?? 18);
          if (!Number.isFinite(start) || start < 0 || start > 23 || !Number.isFinite(end) || end < 0 || end > 23) {
            issues.push(`Conditional node ${node.id} business hours must be between 0 and 23.`);
          }
        }
      }

      if (nodeType === 'voicemail') {
        const greetingAudioNodeId = asNodeId(data.greetingAudioNodeId || data.greeting_audio_node_id);
        const fallbackNodeId = asNodeId(data.fallbackNodeId || data.fallback_node_id);
        if (greetingAudioNodeId && !audioNodeIds.has(greetingAudioNodeId)) {
          issues.push(`Voicemail node ${node.id} greeting reference is not an audio node.`);
        }
        if (fallbackNodeId && !nodeIdSet.has(fallbackNodeId)) {
          issues.push(`Voicemail node ${node.id} fallback node does not exist: ${fallbackNodeId}.`);
        }
      }
    });

    const hasStartNode = nodes.some((node) => {
      const nodeType = (node.type || '').toLowerCase();
      return nodeType === 'start' || nodeType === 'audio' || nodeType === 'greeting';
    });
    const hasInputNode = nodes.some((node) => (node.type || '').toLowerCase() === 'input');
    const hasEndNode = nodes.some((node) => (node.type || '').toLowerCase() === 'end');

    if (!hasStartNode) issues.push('Workflow must include at least one audio/greeting start node.');
    if (!hasInputNode) issues.push('Workflow must include at least one input node.');
    if (!hasEndNode) issues.push('Workflow must include at least one end node.');

    return {
      issues,
      isValidForSave: issues.length === 0,
      isValidForActivation: issues.length === 0
    };
  }, [migratedWorkflow]);

  const hasValidWorkflow = productionValidation.isValidForSave;
  const hasValidMenu = productionValidation.isValidForActivation;

  const flowMetrics = useMemo(() => {
    const nodes = migratedWorkflow?.nodes || [];
    const edges = migratedWorkflow?.edges || [];

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const incoming = new Map();
    const outgoing = new Map();

    nodes.forEach((node) => {
      incoming.set(node.id, 0);
      outgoing.set(node.id, 0);
    });

    edges.forEach((edge) => {
      outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    });

    const disconnectedCount = nodes.filter((node) => {
      const inCount = incoming.get(node.id) || 0;
      const outCount = outgoing.get(node.id) || 0;
      return inCount === 0 && outCount === 0;
    }).length;

    const hasStartNode = nodes.some((node) => {
      const nodeType = (node.type || '').toLowerCase();
      return nodeType === 'start' || nodeType === 'audio' || nodeType === 'greeting';
    });
    const hasEndNode = nodes.some((node) => (node.type || '').toLowerCase() === 'end');
    const audioNodeCount = nodes.filter((node) => {
      const nodeType = (node.type || '').toLowerCase();
      return nodeType === 'audio' || nodeType === 'greeting';
    }).length;
    const inputNodeCount = nodes.filter((node) => (node.type || '').toLowerCase() === 'input').length;

    const connectedNodes = Math.max(0, nodeCount - disconnectedCount);
    const connectivityRatio = nodeCount > 0 ? connectedNodes / nodeCount : 0;
    const connectivityPercent = Math.round(connectivityRatio * 100);

    const issues = [];
    if (!hasStartNode) issues.push('No start node');
    if (!hasEndNode) issues.push('No end node');
    if (disconnectedCount > 0) issues.push(`${disconnectedCount} disconnected node${disconnectedCount > 1 ? 's' : ''}`);

    let health = 'good';
    if (issues.length > 0 || connectivityPercent < 60) {
      health = 'warning';
    }
    if (nodeCount === 0) {
      health = 'empty';
    }

    return {
      nodeCount,
      edgeCount,
      audioNodeCount,
      inputNodeCount,
      connectivityPercent,
      disconnectedCount,
      hasStartNode,
      hasEndNode,
      issues,
      health
    };
  }, [migratedWorkflow]);

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Not available';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Not available';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (isEditing) return;
    setDraftWorkflow(migratedWorkflow);
    setIsDirty(false);
  }, [migratedWorkflow, isEditing]);

  // Listen for TTS progress events
  useEffect(() => {
    if (!menu?._id) return;

    const unsubscribeProgress = onTTSProgress((data) => {
      console.log('🎙 TTS Progress:', data);
      // Optionally update UI to show progress
    });

    const unsubscribeCompleted = onTTSCompleted((data) => {
      console.log('🎉 TTS Completed:', data);
      // Refresh the menu data to get updated audio URLs
      if (onUpdate) {
        onUpdate(menu._id, {
          ...migratedWorkflow,
          audioProcessing: { status: 'completed', ...data }
        });
      }
    });

    const unsubscribeFailed = onTTSFailed((data) => {
      console.error('❌ TTS Failed:', data);
      // Handle TTS failure
      alert(`Audio generation failed: ${data.error}`);
    });

    return () => {
      unsubscribeProgress?.();
      unsubscribeCompleted?.();
      unsubscribeFailed?.();
    };
  }, [menu?._id, onTTSProgress, onTTSCompleted, onTTSFailed, migratedWorkflow, onUpdate]);

  useEffect(() => {
    setCurrentStatus(stableMenuStatus || 'draft');
  }, [stableMenuStatus]);

  if (!menu) {
    return (
      <div className="ivr-card loading">
        Loading IVR Menu…
      </div>
    );
  }

  const handleEdit = () => {
    if (!isEditing) {
      setDraftWorkflow(migratedWorkflow);
      setIsDirty(false);
      joinWorkflow(menu._id);
    } else {
      leaveWorkflow(menu._id);
    }
    setIsEditing(!isEditing);
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await onTest(menu._id);
    } finally {
      setIsTesting(false);
    }
  };

  const handleActivate = async () => {
    if (validationErrors.length > 0) return;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Enforce strict validation only when activating
    if (newStatus === 'active' && !hasValidMenu) {
      const topIssues = productionValidation.issues.slice(0, 8);
      alert(`Cannot activate IVR menu:\n\n- ${topIssues.join('\n- ')}`);
      return;
    }

    setIsSavingWorkflow(true);
    try {
      await ivrService.updateWorkflowStatus(menu._id, newStatus);

      // Update local state immediately
      setCurrentStatus(newStatus);

      // Sync parent in background without blocking UI responsiveness
      if (onUpdate) {
        onUpdate(menu._id, {
          ...migratedWorkflow,
          status: newStatus
        }).catch((error) => {
          console.error('Failed to sync status update in parent:', error);
        });
      }

      setIsDirty(false);
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const handleNodeAdded = (node, position) => {
    addNode(node, position);
  };

  const handleNodeMoved = (nodeId, position) => {
    moveNode(nodeId, position);
  };

  const handleEdgeConnected = (edge) => {
    connectNodes(edge.source, edge.target, edge.sourceHandle, edge.targetHandle, edge.id);
  };

  const handleNodeRemoved = (nodeId) => {
    deleteNode(nodeId);
  };

  const handleEdgeRemoved = (edgeId) => {
    deleteEdge(edgeId);
  };

  const handleEdgeReattached = (edgeId, updates) => {
    reattachEdge(edgeId, updates);
  };

  const handleWorkflowChange = (workflowData) => {
    setDraftWorkflow(workflowData);
    setIsDirty(true);
    // Track that user is actively editing
    setLastEditTimestamp(Date.now());
  };

  // Track when user starts editing a specific node
  const handleNodeEditStart = (nodeId) => {
    setEditingNodeId(nodeId);
    setLastEditTimestamp(Date.now());
    console.log('📝 Started editing node:', nodeId);
  };

  // Track when user stops editing a node
  const handleNodeEditEnd = () => {
    setEditingNodeId(null);
    console.log('📝 Finished editing node');
  };


  /**
   * Transform frontend node data to backend format
   * Maps field names and types for backend/Python compatibility
   */
  const transformNodeForBackend = (node) => {
    // Deep clone to avoid mutating original
    const transformedNode = JSON.parse(JSON.stringify(node));

    // Handle audio node type conversion for backend
    if (transformedNode.type === 'audio') {
      transformedNode.type = 'greeting'; // Backend expects 'greeting' type
      
      // Map frontend field names to backend field names
      if (transformedNode.data) {
        // messageText -> text
        if (transformedNode.data.messageText !== undefined) {
          transformedNode.data.text = transformedNode.data.messageText;
        }
        
        // timeoutSeconds -> timeout
        if (transformedNode.data.timeoutSeconds !== undefined) {
          transformedNode.data.timeout = transformedNode.data.timeoutSeconds;
        }
        
        // maxRetries -> max_retries (for Python service)
        if (transformedNode.data.maxRetries !== undefined) {
          transformedNode.data.max_retries = transformedNode.data.maxRetries;
        }
        
        // audioUrl -> audio_url (snake_case for Python)
        if (transformedNode.data.audioUrl !== undefined) {
          transformedNode.data.audio_url = transformedNode.data.audioUrl;
        }
        
        // audioAssetId -> audio_asset_id (snake_case for Python)
        if (transformedNode.data.audioAssetId !== undefined) {
          transformedNode.data.audio_asset_id = transformedNode.data.audioAssetId;
        }

        // audioPublicId -> audio_public_id for strict node lifecycle tracking
        if (transformedNode.data.audioPublicId !== undefined) {
          transformedNode.data.audio_public_id = transformedNode.data.audioPublicId;
          if (!transformedNode.data.audioAssetId) {
            transformedNode.data.audioAssetId = transformedNode.data.audioPublicId;
          }
          if (!transformedNode.data.audio_asset_id) {
            transformedNode.data.audio_asset_id = transformedNode.data.audioPublicId;
          }
        }
        
        // Map voice to expected format
        if (transformedNode.data.voice) {
          transformedNode.data.voice = transformedNode.data.voice;
        }
        
        // Map language to expected format
        if (transformedNode.data.language) {
          transformedNode.data.language = transformedNode.data.language;
        }
        
        // Keep mode/afterPlayback/fallbackAudioNodeId for frontend compatibility.
        // Backend execution currently follows edges, but these fields should persist.
      }
    }

    // Handle input node field mapping
    if (transformedNode.type === 'input' && transformedNode.data) {
      // timeoutSeconds -> timeout
      if (transformedNode.data.timeoutSeconds !== undefined) {
        transformedNode.data.timeout = transformedNode.data.timeoutSeconds;
      }

      // transferTimeout -> transfer_timeout
      if (transformedNode.data.transferTimeout !== undefined) {
        transformedNode.data.transfer_timeout = transformedNode.data.transferTimeout;
      }

      // numDigits -> num_digits
      if (transformedNode.data.numDigits !== undefined) {
        transformedNode.data.num_digits = transformedNode.data.numDigits;
      }
      
      // maxAttempts -> max_attempts
      if (transformedNode.data.maxAttempts !== undefined) {
        transformedNode.data.max_attempts = transformedNode.data.maxAttempts;
      }
      
      // promptAudioNodeId -> prompt_audio_node_id
      if (transformedNode.data.promptAudioNodeId !== undefined) {
        transformedNode.data.prompt_audio_node_id = transformedNode.data.promptAudioNodeId;
      }
      
      // invalidAudioNodeId -> invalid_audio_node_id
      if (transformedNode.data.invalidAudioNodeId !== undefined) {
        transformedNode.data.invalid_audio_node_id = transformedNode.data.invalidAudioNodeId;
      }
      
      // timeoutAudioNodeId -> timeout_audio_node_id
      if (transformedNode.data.timeoutAudioNodeId !== undefined) {
        transformedNode.data.timeout_audio_node_id = transformedNode.data.timeoutAudioNodeId;
      }
    }

    // Handle voicemail node field mapping
    if (transformedNode.type === 'voicemail' && transformedNode.data) {
      // maxLength -> max_length
      if (transformedNode.data.maxLength !== undefined) {
        transformedNode.data.max_length = transformedNode.data.maxLength;
      }
      
      // greetingAudioNodeId -> greeting_audio_node_id
      if (transformedNode.data.greetingAudioNodeId !== undefined) {
        transformedNode.data.greeting_audio_node_id = transformedNode.data.greetingAudioNodeId;
      }

      // fallbackNodeId -> fallback_node_id
      if (transformedNode.data.fallbackNodeId !== undefined) {
        transformedNode.data.fallback_node_id = transformedNode.data.fallbackNodeId;
      }
    }

    // Handle end node field mapping
    if (transformedNode.type === 'end' && transformedNode.data) {
      // terminationType -> reason
      if (transformedNode.data.terminationType !== undefined) {
        transformedNode.data.reason = transformedNode.data.terminationType;
      }
      
      // transferNumber -> transfer_number
      if (transformedNode.data.transferNumber !== undefined) {
        transformedNode.data.transfer_number = transformedNode.data.transferNumber;
      }
      
      // voicemailBox -> voicemail_box
      if (transformedNode.data.voicemailBox !== undefined) {
        transformedNode.data.voicemail_box = transformedNode.data.voicemailBox;
      }
      
      // callbackDelay -> callback_delay
      if (transformedNode.data.callbackDelay !== undefined) {
        transformedNode.data.callback_delay = transformedNode.data.callbackDelay;
      }
      
      // maxCallbackAttempts -> max_callback_attempts
      if (transformedNode.data.maxCallbackAttempts !== undefined) {
        transformedNode.data.max_callback_attempts = transformedNode.data.maxCallbackAttempts;
      }
      
      // sendSurvey -> send_survey
      if (transformedNode.data.sendSurvey !== undefined) {
        transformedNode.data.send_survey = transformedNode.data.sendSurvey;
      }
      
      // logCall -> log_data
      if (transformedNode.data.logCall !== undefined) {
        transformedNode.data.log_data = transformedNode.data.logCall;
      }
      
      // sendReceipt -> send_receipt
      if (transformedNode.data.sendReceipt !== undefined) {
        transformedNode.data.send_receipt = transformedNode.data.sendReceipt;
      }
      
      // contactMethod -> contact_method
      if (transformedNode.data.contactMethod !== undefined) {
        transformedNode.data.contact_method = transformedNode.data.contactMethod;
      }
    }

    // Handle conditional node field mapping
    if (transformedNode.type === 'conditional' && transformedNode.data) {
      // truePath -> true_path
      if (transformedNode.data.truePath !== undefined) {
        transformedNode.data.true_path = transformedNode.data.truePath;
      }
      
      // falsePath -> false_path
      if (transformedNode.data.falsePath !== undefined) {
        transformedNode.data.false_path = transformedNode.data.falsePath;
      }
    }

    // Handle transfer node field mapping
    if (transformedNode.type === 'transfer' && transformedNode.data) {
      // announceText -> announce_text
      if (transformedNode.data.announceText !== undefined) {
        transformedNode.data.announce_text = transformedNode.data.announceText;
      }
    }

    return transformedNode;
  };

  /**
   * Transform entire workflow for backend compatibility
   */
  const transformWorkflowForBackend = (workflowData) => {
    if (!workflowData || !workflowData.nodes) {
      return workflowData;
    }

    return {
      ...workflowData,
      nodes: workflowData.nodes.map(transformNodeForBackend)
    };
  };

  const handleWorkflowSave = async () => {
    if (!isDirty) return;

    if (!hasValidWorkflow) {
      const topIssues = productionValidation.issues.slice(0, 8);
      alert(`Cannot save workflow:\n\n- ${topIssues.join('\n- ')}`);
      return;
    }

    setIsSavingWorkflow(true);
    try {
      // Transform workflow data for backend compatibility
      const backendWorkflow = transformWorkflowForBackend(migratedWorkflow);

      // Single explicit save on button click.
      await onUpdate(menu._id, backendWorkflow);
      setIsDirty(false);
    } finally {
      setIsSavingWorkflow(false);
    }
  };


  // Remove auto-save - only save when user explicitly clicks save button
  // useEffect(() => {
  //   if (!isEditing || !isDirty) return;
  //   const timer = setTimeout(() => {
  //     handleWorkflowSave();
  //   }, 1500);
  //   return () => clearTimeout(timer);
  // }, [isDirty, isEditing, migratedWorkflow, handleWorkflowSave]);

  const resolveStartNodeIdForTest = () => {
    const nodes = migratedWorkflow?.nodes || [];
    const edges = migratedWorkflow?.edges || [];
    if (!nodes.length) return null;

    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    edges.forEach((edge) => {
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    });

    const entryWithNoIncoming = nodes.find((node) => {
      const type = (node.type || '').toLowerCase();
      return (type === 'audio' || type === 'greeting') && (incoming.get(node.id) || 0) === 0;
    });
    if (entryWithNoIncoming) return entryWithNoIncoming.id;

    const firstEntry = nodes.find((node) => ['audio', 'greeting'].includes((node.type || '').toLowerCase()));
    if (firstEntry) return firstEntry.id;

    return nodes[0]?.id || null;
  };

  const evaluateConditionalForTest = (condition = '') => {
    const normalized = String(condition || '').toLowerCase();
    if (testRunConditionalMode === 'true') return true;
    if (testRunConditionalMode === 'false') return false;

    if (normalized === 'business_hours') {
      const hour = new Date().getHours();
      return hour >= 9 && hour < 18;
    }
    return true;
  };

  const findNextEdgeForTest = (currentNode, edges, nodesById) => {
    const outgoing = edges.filter((edge) => edge.source === currentNode.id);
    if (!outgoing.length) {
      return { edge: null, reason: 'No outgoing edge from current node.' };
    }

    const nodeType = (currentNode.type || '').toLowerCase();
    if (nodeType === 'conditional') {
      const conditionResult = evaluateConditionalForTest(currentNode.data?.condition);
      const handle = conditionResult ? 'true' : 'false';
      const matchedEdge = outgoing.find((edge) => edge.sourceHandle === handle);
      if (matchedEdge) {
        return { edge: matchedEdge, reason: `Conditional branch "${handle}" selected.` };
      }
      return { edge: null, reason: `Conditional node missing "${handle}" branch.` };
    }

    if (nodeType === 'input') {
      const preferredDigit = String(testRunInputDigit || (currentNode.data?.digit ?? '')).trim();
      if (preferredDigit) {
        const digitEdge = outgoing.find((edge) => String(edge.sourceHandle || '') === preferredDigit);
        if (digitEdge) {
          return { edge: digitEdge, reason: `Input digit "${preferredDigit}" matched.` };
        }
      }

      const noMatchEdge = outgoing.find((edge) => ['no_match', 'default'].includes(String(edge.sourceHandle || '').toLowerCase()));
      if (noMatchEdge) {
        return { edge: noMatchEdge, reason: 'No digit match, default/no_match route used.' };
      }

      const timeoutEdge = outgoing.find((edge) => String(edge.sourceHandle || '').toLowerCase() === 'timeout');
      if (timeoutEdge) {
        return { edge: timeoutEdge, reason: 'No digit match, timeout route used.' };
      }

      return { edge: null, reason: 'Input node has no matching route for test digit.' };
    }

    // For non-input nodes, allow digit-driven branching in test simulation:
    // 1) by edge source handle matching the entered digit
    // 2) by target input-node configured digit matching the entered digit
    const preferredDigit = String(testRunInputDigit || '').trim();
    if (preferredDigit) {
      const digitHandleEdge = outgoing.find(
        (edge) => String(edge.sourceHandle ?? '').trim() === preferredDigit
      );
      if (digitHandleEdge) {
        return { edge: digitHandleEdge, reason: `Digit "${preferredDigit}" matched edge handle.` };
      }

      const digitTargetInputEdge = outgoing.find((edge) => {
        const targetNode = nodesById.get(edge.target);
        if (!targetNode) return false;
        if (String(targetNode.type || '').toLowerCase() !== 'input') return false;
        return String(targetNode.data?.digit ?? '').trim() === preferredDigit;
      });
      if (digitTargetInputEdge) {
        return { edge: digitTargetInputEdge, reason: `Digit "${preferredDigit}" matched target input node.` };
      }
    }

    const directEdge = outgoing.find((edge) => !edge.sourceHandle) || outgoing[0];
    if (!directEdge) {
      return { edge: null, reason: 'No route available for current node.' };
    }

    if (!nodesById.has(directEdge.target)) {
      return { edge: null, reason: `Edge target not found: ${directEdge.target}` };
    }

    return { edge: directEdge, reason: 'Direct next edge selected.' };
  };

  const advanceTestRun = () => {
    const nodes = migratedWorkflow?.nodes || [];
    const edges = migratedWorkflow?.edges || [];
    if (!nodes.length) {
      setTestRunMessage('No nodes available for test run.');
      setTestRunActive(false);
      return;
    }

    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const currentNodeId = testRunCurrentNodeId || resolveStartNodeIdForTest();
    const currentNode = nodesById.get(currentNodeId);

    if (!currentNode) {
      setTestRunMessage('Unable to resolve start node for test run.');
      setTestRunActive(false);
      return;
    }

    const stepNumber = testRunSteps.length + 1;
    if (stepNumber > 200) {
      setTestRunMessage('Stopped: exceeded 200 test steps (loop protection).');
      setTestRunActive(false);
      return;
    }

    if ((currentNode.type || '').toLowerCase() === 'end') {
      setActivePath({ nodeId: currentNode.id, edgeIds: [] });
      setTestRunSteps((prev) => ([
        ...prev,
        { step: stepNumber, nodeId: currentNode.id, nodeType: currentNode.type, decision: 'End node reached.' }
      ]));
      setTestRunMessage('Test run completed successfully.');
      setTestRunActive(false);
      return;
    }

    const { edge, reason } = findNextEdgeForTest(currentNode, edges, nodesById);
    setActivePath({ nodeId: currentNode.id, edgeIds: edge ? [edge.id] : [] });

    if (!edge) {
      setTestRunSteps((prev) => ([
        ...prev,
        { step: stepNumber, nodeId: currentNode.id, nodeType: currentNode.type, decision: reason }
      ]));
      setTestRunMessage(`Stopped: ${reason}`);
      setTestRunActive(false);
      return;
    }

    setTestRunSteps((prev) => ([
      ...prev,
      {
        step: stepNumber,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        edgeId: edge.id,
        sourceHandle: edge.sourceHandle || null,
        targetNodeId: edge.target,
        decision: reason
      }
    ]));
    setTestRunCurrentNodeId(edge.target);
    setTestRunMessage(reason);
  };


  const startTestRun = () => {
    if (validationErrors.length > 0) return;
    const startNodeId = resolveStartNodeIdForTest();
    if (!startNodeId) {
      alert('Cannot start test run: no valid start node found.');
      return;
    }
    setTestRunActive(true);
    setTestRunCurrentNodeId(startNodeId);
    setTestRunSteps([]);
    setActivePath({ nodeId: startNodeId, edgeIds: [] });
    setTestRunMessage('Test run initialized. Click Next Step to simulate workflow.');
  };

  const stopTestRun = () => {
    setTestRunActive(false);
    setTestRunCurrentNodeId(null);
    setActivePath({ nodeId: null, edgeIds: [] });
    setTestRunMessage('');
    setTestRunSteps([]);
  };

  const handleDeleteWorkflow = () => {
    const workflowName = menu.displayName || menu.ivrName || menu.name || 'this IVR';
    const confirmed = window.confirm(
      `Delete "${workflowName}"?\n\nThis will permanently remove the IVR and associated audio files.`
    );
    if (!confirmed) return;
    onDelete(menu._id);
  };

  return (
    <div className={`menu-card ${isEditing ? 'editing' : ''}`}>
      <div className="menu-card-top">
        <div className="menu-card-title">
          <div className="title-text">
            <h3>{menu.displayName || menu.ivrName || menu.name || 'Untitled IVR'}</h3>
            <span
              className={`status-indicator status-${currentStatus}`}
              title={`Current status: ${currentStatus}`}
            >
              {currentStatus || 'draft'}
            </span>
          </div>
        </div>
        <div className="menu-actions">
          {activeUsers?.length > 0 && (
            <div className="active-users-indicator" title={`${activeUsers.length + 1} users editing`}>
              <Users size={16} />
              <span>{activeUsers.length + 1}</span>
            </div>
          )}
          <button
            className="action-btn"
            onClick={handleActivate}
            title={currentStatus === 'active' ? 'Deactivate Workflow' : 'Activate Workflow'}
            disabled={validationErrors.length > 0 || isSavingWorkflow || (currentStatus !== 'active' && !hasValidMenu)}
          >
            {currentStatus === 'active' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className="action-btn"
            onClick={handleEdit}
            title="Edit Workflow"
          >
            <Edit3 size={16} />
          </button>
          <button
            className="action-btn delete-btn"
            onClick={handleDeleteWorkflow}
            title="Delete Workflow"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="workflow-builder-full">
          <div className="workflow-header">
            <div className="workflow-info">
              <h4>Workflow Builder</h4>
              <div className="workflow-stats">
                <span className="stat-item">
                  <Phone size={14} />
                  {(migratedWorkflow?.nodes || []).length} nodes
                </span>
                <span className="stat-item">
                  <Clock size={14} />
                  {new Date(menu.updatedAt || menu.createdAt).toLocaleDateString()}
                </span>
                {activeUsers.length > 0 && (
                  <span className="stat-item active-users">
                    <Users size={14} />
                    {activeUsers.length} active
                  </span>
                )}
              </div>
            </div>
            <div className="workflow-actions">
              <button
                onClick={startTestRun}
                className="btn btn-test"
                disabled={validationErrors.length > 0}
              >
                <Play size={16} />
                Test Run
              </button>
              <button
                onClick={handleWorkflowSave}
                className={`btn btn-save ${isDirty ? 'btn-save-dirty' : 'btn-save-stable'} ${isSavingWorkflow ? 'btn-save-saving' : ''}`}
                disabled={!isDirty || isSavingWorkflow || !hasValidWorkflow}
              >
                {isDirty ? <Save size={16} /> : <CheckCircle size={16} />}
                {isSavingWorkflow ? 'Saving...' : (isDirty ? 'Save Changes' : 'Saved')}
              </button>
              <button
                onClick={handleEdit}
                className="btn btn-close-builder"
                title="Close Builder"
              >
                <X size={18} />
                Close
              </button>
            </div>
          </div>

          <WorkflowBuilderCanvas
            workflow={migratedWorkflow}
            workflowId={menu._id}
            onChange={handleWorkflowChange}
            onNodeAdded={handleNodeAdded}
            onNodeMoved={handleNodeMoved}
            onEdgeConnected={handleEdgeConnected}
            onNodeRemoved={handleNodeRemoved}
            onEdgeRemoved={handleEdgeRemoved}
            onEdgeReattached={handleEdgeReattached}
            onValidationChange={setValidationErrors}
            onNodeEditStart={handleNodeEditStart}
            onNodeEditEnd={handleNodeEditEnd}
            activeNodeId={activePath.nodeId}
            activeEdgeIds={activePath.edgeIds}
          />

          {testRunActive && (
            <div className="test-run-panel">
              <div className="test-run-header">Test Run</div>
              <p>Simulating full call flow with configured routes.</p>
              <div className="test-run-controls">
                <label>
                  Input Digit
                  <input
                    type="text"
                    value={testRunInputDigit}
                    maxLength={1}
                    onChange={(e) => setTestRunInputDigit(e.target.value)}
                    placeholder="1"
                  />
                </label>
                <label>
                  Conditional
                  <select
                    value={testRunConditionalMode}
                    onChange={(e) => setTestRunConditionalMode(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="true">Force True</option>
                    <option value="false">Force False</option>
                  </select>
                </label>
              </div>
              <div className="test-run-state">
                <div><strong>Current:</strong> {testRunCurrentNodeId || 'N/A'}</div>
                <div><strong>Steps:</strong> {testRunSteps.length}</div>
                <div className="test-run-message">{testRunMessage || 'Idle'}</div>
              </div>
              {testRunSteps.length > 0 && (
                <div className="test-run-log">
                  {testRunSteps.slice(-3).map((step) => (
                    <div key={`${step.step}-${step.nodeId}`} className="test-run-log-item">
                      {`#${step.step} ${step.nodeType} -> ${step.targetNodeId || 'stop'}`}
                    </div>
                  ))}
                </div>
              )}
              <div className="test-run-actions">
                <button className="btn btn-secondary" onClick={advanceTestRun}>Next Step</button>
                <button className="btn btn-secondary" onClick={stopTestRun}>Stop</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="menu-card-body">
            <>
              <div className="workflow-summary">
                <strong>Workflow Details</strong>
                <div className="workflow-info">
                  <span>Nodes: {flowMetrics.nodeCount}</span>
                  <span>Edges: {flowMetrics.edgeCount}</span>
                  <span>Contacts Used: {menu.contactsUsed || 0}</span>
                  <span>Status: {currentStatus || 'draft'}</span>
                </div>
              </div>

              <div className={`flow-health-summary flow-${flowMetrics.health}`}>
                <div className="flow-health-header">
                  <strong>Flow Health</strong>
                  <span className="flow-health-badge">
                    {flowMetrics.health === 'good' ? <Workflow size={12} /> : <AlertTriangle size={12} />}
                    {flowMetrics.health === 'good' ? 'Healthy' : flowMetrics.health === 'empty' ? 'No Flow' : 'Needs Attention'}
                  </span>
                </div>
                <div className="flow-metrics-grid">
                  <span><GitBranch size={12} /> Connectivity: {flowMetrics.connectivityPercent}%</span>
                  <span>Audio Nodes: {flowMetrics.audioNodeCount}</span>
                  <span>Input Nodes: {flowMetrics.inputNodeCount}</span>
                  <span>Start/End: {flowMetrics.hasStartNode ? 'Yes' : 'No'}/{flowMetrics.hasEndNode ? 'Yes' : 'No'}</span>
                </div>
                {flowMetrics.issues.length > 0 && (
                  <div className="flow-issues">
                    {flowMetrics.issues.join(' • ')}
                  </div>
                )}
              </div>

              
              {menu.lastEditedBy && (
                <div className="connection-status">
                  <span className="last-edited">
                    Last edited: {formatLastUpdated(menu.updatedAt)}
                  </span>
                </div>
              )}
            </>
        </div>
      )}
    </div>
  );
};

export default IVRMenuCard;

