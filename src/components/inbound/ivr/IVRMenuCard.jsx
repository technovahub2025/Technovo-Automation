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
  const [testRunIndex, setTestRunIndex] = useState(0);
  const [activePath, setActivePath] = useState({ nodeId: null, edgeIds: [] });
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
    const seenIds = new Set();
    const uniqueNodes = [];

    for (const node of nodes) {
      if (!node?.id) continue;
      if (seenIds.has(node.id)) continue;
      seenIds.add(node.id);
      uniqueNodes.push(node);
    }

    if (uniqueNodes.length === nodes.length) {
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
            mode: 'tts',
            messageText: node.data?.text || node.data?.messageText || 'Welcome message',
            voice: node.data?.voice || 'en-GB-SoniaNeural',
            language: node.data?.language || 'en-GB',
            afterPlayback: node.data?.afterPlayback || 'next',
            maxRetries: node.data?.maxRetries || 3,
            timeoutSeconds: node.data?.timeoutSeconds || 10,
            fallbackAudioNodeId: node.data?.fallbackAudioNodeId || '',
            promptKey: node.data?.promptKey || `audio_${Date.now()}`
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

  // Migration Effect - Only fires when necessary to persist structural changes
  useEffect(() => {
    if (!migratedWorkflow || !menu?._id || !onUpdate) return;

    const hasGreetingNodes = effectiveWorkflow.nodes?.some(node => node.type === 'greeting');
    if (hasGreetingNodes) {
      console.log('🔄 Logic migration required: Auto-saving updated workflow structure...');
      onUpdate(menu._id, migratedWorkflow);
    }
  }, [menu?._id, migratedWorkflow, effectiveWorkflow.nodes]);

  // Add socket listener for backend workflow updates
  useEffect(() => {
    const socket = socketService.connect();
    if (socket) {
      const handleWorkflowUpdated = (data) => {
        if (data.workflowId === menu?._id) {
          // Handle different data structures from backend
          // Backend may send workflowData or just updates (like audioUrls, ttsStatus)
          const workflowData = data.workflowData || data;
          
          // Only update if we have actual workflow data with nodes
          if (!workflowData.nodes && !data.audioUrls) {
            // If no nodes and no audio updates, just update status
            console.log('📡 Workflow status update:', data.ttsStatus || data.status);
            return;
          }


          // Prevent useless re-renders - only update if data actually changed
          const currentData = JSON.stringify(draftWorkflow || workflow);
          const newData = JSON.stringify(workflowData);

          if (currentData === newData) {
            return;
          }

          // Update local workflow state with backend data (only when not editing)
          if (onUpdate && workflowData.nodes) {
            onUpdate(data.workflowId, workflowData);
          } else if (data.audioUrls) {
            // Handle audio URL updates separately
            console.log('📡 Audio URLs updated:', data.audioUrls);
            // Refresh the menu to get latest data
            if (onUpdate) {
              onUpdate(data.workflowId, {
                ...migratedWorkflow,
                audioProcessing: { 
                  status: data.ttsStatus || 'completed', 
                  audioUrls: data.audioUrls 
                }
              });
            }
          }
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
  }, [menu?._id, onUpdate, migratedWorkflow, isEditing, draftWorkflow, workflow]);



  // Extract backend JSON fields
  const menuOptions = safeMenu.menuOptions ?? [];
  const settings = safeMenu.settings ?? {};

  // Memoize workflow to prevent infinite loops
  const stableWorkflow = useMemo(() => workflow, [JSON.stringify(workflow)]);
  const stableMenuStatus = useMemo(() => menu?.status, [menu?.status]);

  // Validation state for buttons
  const hasValidWorkflow = useMemo(() => {
    const workflowNodes = migratedWorkflow?.nodes || [];
    if (!workflowNodes || workflowNodes.length === 0) return false;

    // Check audio node has proper configuration
    const audioNode = workflowNodes.find(n => n.type === 'audio');
    const hasAudioConfig = audioNode && (
      (audioNode.data.mode === 'tts' && audioNode.data.messageText?.trim()) ||
      (audioNode.data.mode === 'file' && audioNode.data.audioUrl?.trim())
    );

    // Check input nodes reference audio nodes properly
    const inputNodes = workflowNodes.filter(n => n.type === 'input');
    const inputNodesValid = inputNodes.every(node =>
      node.data.promptAudioNodeId?.trim() &&
      node.data.maxAttempts > 0 &&
      node.data.timeoutSeconds > 0
    );

    return hasAudioConfig && inputNodesValid;
  }, [migratedWorkflow]);

  const hasValidMenu = useMemo(() => {
    const options = menuOptions || [];
    return options && options.length > 0;
  }, [menuOptions]);

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
    setDraftWorkflow(migratedWorkflow);
    setIsDirty(false);
  }, [migratedWorkflow]);

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

    // Frontend validation: ensure menu has at least one option
    if (!menuOptions || menuOptions.length === 0) {
      alert('Cannot activate IVR menu: At least one option is required.');
      return;
    }

    setIsSavingWorkflow(true);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      await ivrService.updateWorkflowStatus(menu._id, newStatus);

      // Update local state immediately
      setCurrentStatus(newStatus);

      // Update parent component if callback exists
      if (onUpdate) {
        await onUpdate(menu._id, {
          ...migratedWorkflow,
          status: newStatus
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
        
        // Map voice to expected format
        if (transformedNode.data.voice) {
          transformedNode.data.voice = transformedNode.data.voice;
        }
        
        // Map language to expected format
        if (transformedNode.data.language) {
          transformedNode.data.language = transformedNode.data.language;
        }
        
        // Keep mode field for frontend reference, but backend may ignore it
        // afterPlayback is frontend-only, backend uses workflow edges
        
        // Remove frontend-only fields that might confuse backend
        delete transformedNode.data.mode;
        delete transformedNode.data.afterPlayback;
        delete transformedNode.data.fallbackAudioNodeId;
      }
    }

    // Handle input node field mapping
    if (transformedNode.type === 'input' && transformedNode.data) {
      // timeoutSeconds -> timeout
      if (transformedNode.data.timeoutSeconds !== undefined) {
        transformedNode.data.timeout = transformedNode.data.timeoutSeconds;
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

    // Frontend validation: ensure workflow has at least one node
    const workflowNodes = migratedWorkflow?.nodes || [];
    if (workflowNodes.length === 0) {
      alert("Workflow must have at least one node before saving.");
      return;
    }

    // Frontend validation: ensure audio node has proper configuration
    const audioNode = migratedWorkflow.nodes.find(n => n.type === 'audio');
    if (audioNode) {
      if (audioNode.data.mode === 'tts' && !audioNode.data.messageText?.trim()) {
        alert("Cannot generate audio: Audio message text is missing.");
        return;
      }

      if (audioNode.data.mode === 'file' && !audioNode.data.audioUrl?.trim()) {
        alert("Cannot save: Audio file is missing.");
        return;
      }
    }

    // Frontend validation: ensure input nodes reference audio nodes properly
    const inputNodes = workflowNodes.filter(n => n.type === 'input');
    const inputNodesValid = inputNodes.every(node =>
      node.data.promptAudioNodeId?.trim() &&
      node.data.maxAttempts > 0 &&
      node.data.timeoutSeconds > 0
    );
    if (!inputNodesValid) {
      alert("Input nodes must reference audio nodes for prompts and have valid timeout/max attempts settings.");
      return;
    }

    setIsSavingWorkflow(true);
    try {
      // Transform workflow data for backend compatibility
      const backendWorkflow = transformWorkflowForBackend(migratedWorkflow);
      
      // Use socket for real-time workflow update
      const socket = socketService.connect();
      if (socket && socketService.isConnected()) {
        socket.emit('workflow_update', {
          workflowId: menu._id,
          workflowData: backendWorkflow
        });

        console.log('📡 Workflow save sent via socket:', {
          workflowId: menu._id,
          nodeCount: backendWorkflow.nodes?.length || 0,
          transformed: true
        });
      }

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

  const advanceTestRun = () => {
    const nodes = migratedWorkflow.nodes || [];
    const edges = migratedWorkflow.edges || [];
    if (nodes.length === 0) return;

    const currentNode = nodes[testRunIndex] || nodes[0];
    let nextNode = null;
    let chosenEdge = null;

    if (currentNode.type === 'conditional') {
      chosenEdge = edges.find(e => e.source === currentNode.id && e.sourceHandle === 'true') || edges.find(e => e.source === currentNode.id);
    } else if (currentNode.type === 'input') {
      chosenEdge = edges.find(e => e.source === currentNode.id && e.sourceHandle === (currentNode.data?.digit || '1')) || edges.find(e => e.source === currentNode.id);
    } else {
      chosenEdge = edges.find(e => e.source === currentNode.id);
    }

    if (chosenEdge) {
      nextNode = nodes.find(n => n.id === chosenEdge.target);
    }

    setActivePath({
      nodeId: currentNode.id,
      edgeIds: chosenEdge ? [chosenEdge.id] : []
    });

    if (!nextNode || currentNode.type === 'end') {
      setTestRunActive(false);
      return;
    }

    const nextIndex = nodes.findIndex(n => n.id === nextNode.id);
    setTestRunIndex(nextIndex === -1 ? 0 : nextIndex);
  };


  const startTestRun = () => {
    if (validationErrors.length > 0) return;
    setTestRunActive(true);
    setTestRunIndex(0);
  };

  const stopTestRun = () => {
    setTestRunActive(false);
    setTestRunIndex(0);
    setActivePath({ nodeId: null, edgeIds: [] });
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
            disabled={validationErrors.length > 0 || isSavingWorkflow || !hasValidMenu}
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
            onClick={() => onDelete(menu._id)}
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
                className="btn btn-save"
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
              <p>Simulating call flow. Step through nodes to verify logic.</p>
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
