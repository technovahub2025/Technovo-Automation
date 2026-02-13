import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Settings, Trash2, Users, Edit3, Phone, Clock, CheckCircle, Building, ShoppingCart, Stethoscope, PhoneCall, HeadphonesIcon, Briefcase, Edit, Save, X } from 'lucide-react';
import useIVRWorkflowSocket from '../../../hooks/useIVRWorkflowSocket';
import socketService from '../../../services/socketService';
import WorkflowBuilderCanvas from './WorkflowBuilderCanvas';
import { ivrService } from '../../../services/ivrService';
import './IVRMenuCard.css';

function IVRMenuCard({ menu, onUpdate, onDelete, onTest }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editingData, setEditingData] = useState({});
  const [draftWorkflow, setDraftWorkflow] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [testRunActive, setTestRunActive] = useState(false);
  const [testRunIndex, setTestRunIndex] = useState(0);
  const [activePath, setActivePath] = useState({ nodeId: null, edgeIds: [] });
  const [currentStatus, setCurrentStatus] = useState(menu?.status || 'draft');

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

  // Add socket listener for backend workflow updates
  useEffect(() => {
    const socket = socketService.connect();
    if (socket) {
      const handleWorkflowUpdated = (data) => {
        if (data.workflowId === menu?._id) {
          // Prevent useless re-renders - only update if data actually changed
          const currentData = JSON.stringify(draftWorkflow || workflow);
          const newData = JSON.stringify(data.workflowData);

          if (currentData === newData) {
            return;
          }

          // Update local workflow state with backend data
          if (onUpdate) {
            onUpdate(data.workflowId, data.workflowData);
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
  }, [menu?._id, onUpdate]);

  const safeMenu = menu ?? {};
  const workflow = safeMenu.workflowConfig ?? safeMenu.workflow ?? {
    nodes: [],
    edges: [],
    settings: {}
  };
  const effectiveWorkflow = draftWorkflow ?? workflow;

  // Migrate greeting nodes to audio nodes for backward compatibility
  const migratedWorkflow = useMemo(() => {
    if (!effectiveWorkflow.nodes) return effectiveWorkflow;

    const hasGreetingNodes = effectiveWorkflow.nodes.some(node => node.type === 'greeting');
    if (!hasGreetingNodes) return effectiveWorkflow;

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

    return {
      ...effectiveWorkflow,
      nodes: migratedNodes
    };
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
      // Use socket for real-time workflow update
      const socket = socketService.connect();
      if (socket && socketService.isConnected()) {
        socket.emit('workflow_update', {
          workflowId: menu._id,
          workflowData: migratedWorkflow
        });

        console.log('📡 Workflow save sent via socket:', {
          workflowId: menu._id,
          nodeCount: migratedWorkflow.nodes?.length || 0
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

  const handleSettingsSave = () => {
    const updatedMenuOptions = editingData.menuOptions || menuOptions;

    // Frontend validation: ensure menu has at least one option
    if (!updatedMenuOptions || updatedMenuOptions.length === 0) {
      alert("IVR menu must have at least one option before saving.");
      return;
    }

    const updatedMenu = {
      ...menu,
      menuOptions: updatedMenuOptions,
      settings: editingData.settings || settings
    };

    // Update audio nodes with message text and voice from settings
    const updatedWorkflow = {
      ...migratedWorkflow,
      nodes: migratedWorkflow.nodes?.map(node => {
        if (node.type === 'audio') {
          return {
            ...node,
            data: {
              ...node.data,
              messageText: editingData.messageText || node.data.messageText,
              voice: editingData.voice || node.data.voice
            }
          };
        }
        return node;
      }) || []
    };

    // Update both the menu and the workflow
    onUpdate(menu._id, updatedMenu);

    // Also update the workflow via socket to sync changes
    const socket = socketService.connect();
    if (socket && socketService.isConnected()) {
      socket.emit('workflow_update', {
        workflowId: menu._id,
        workflowData: updatedWorkflow
      });

      console.log('📡 Workflow audio sync sent via socket:', {
        workflowId: menu._id,
        messageText: editingData.messageText
      });
    }

    setIsEditingSettings(false);
    setEditingData({});
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

  const startEditingSettings = () => {
    setEditingData({
      messageText: '',
      voice: 'en-GB-SoniaNeural',
      menuOptions: [...menuOptions],
      settings: { ...settings }
    });
    setIsEditingSettings(true);
  };

  const cancelEditing = () => {
    setIsEditingSettings(false);
    setEditingData({});
  };

  const getIndustryIcon = (industry) => {
    const iconMap = {
      hotel: Building,
      insurance: Briefcase,
      healthcare: Stethoscope,
      retail: ShoppingCart,
      custom: HeadphonesIcon
    };
    const IconComponent = iconMap[industry] || HeadphonesIcon;
    return <IconComponent size={20} />;
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#f59e0b',
      testing: '#06b6d4',
      active: '#10b981',
      inactive: '#ef4444'
    };
    return colors[status] || '#6b757d';
  };

  return (
    <div className={`menu-card ${isEditing ? 'editing' : ''}`}>
      <div className="menu-card-top">
        <div className="menu-card-title">
          <div className="industry-icon">{getIndustryIcon(menu.workflowConfig?.industry)}</div>
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
            className="action-btn"
            onClick={startEditingSettings}
            title="Edit Settings"
          >
            <Edit size={16} />
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
          {isEditingSettings ? (
            <div className="editable-settings">
              <div className="edit-section">
                <div className="edit-header">
                  <strong>Audio Message</strong>
                </div>
                <textarea
                  value={editingData.messageText || ''}
                  onChange={(e) => setEditingData(prev => ({
                    ...prev,
                    messageText: e.target.value
                  }))}
                  placeholder="Enter audio message..."
                  rows={2}
                />
                <input
                  type="text"
                  value={editingData.voice || ''}
                  onChange={(e) => setEditingData(prev => ({
                    ...prev,
                    voice: e.target.value
                  }))}
                  placeholder="Voice type"
                />
              </div>

              <div className="edit-section">
                <div className="edit-header">
                  <strong>Menu Options</strong>
                </div>
                {editingData.menuOptions?.map((option, index) => (
                  <div key={index} className="option-edit-row">
                    <input
                      type="text"
                      value={option.digit}
                      onChange={(e) => {
                        const newOptions = [...editingData.menuOptions];
                        newOptions[index].digit = e.target.value;
                        setEditingData(prev => ({ ...prev, menuOptions: newOptions }));
                      }}
                      placeholder="Digit"
                      maxLength={1}
                    />
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => {
                        const newOptions = [...editingData.menuOptions];
                        newOptions[index].label = e.target.value;
                        setEditingData(prev => ({ ...prev, menuOptions: newOptions }));
                      }}
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      value={option.destination}
                      onChange={(e) => {
                        const newOptions = [...editingData.menuOptions];
                        newOptions[index].destination = e.target.value;
                        setEditingData(prev => ({ ...prev, menuOptions: newOptions }));
                      }}
                      placeholder="Destination"
                    />
                  </div>
                ))}
              </div>

              <div className="edit-section">
                <div className="edit-header">
                  <strong>Settings</strong>
                </div>
                <div className="settings-edit-row">
                  <input
                    type="number"
                    value={editingData.settings?.timeout || 10}
                    onChange={(e) => setEditingData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, timeout: parseInt(e.target.value) }
                    }))}
                    placeholder="Timeout"
                  />
                  <input
                    type="number"
                    value={editingData.settings?.maxAttempts || 3}
                    onChange={(e) => setEditingData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, maxAttempts: parseInt(e.target.value) }
                    }))}
                    placeholder="Max Attempts"
                  />
                </div>
                <input
                  type="text"
                  value={editingData.settings?.invalidInputMessage || ''}
                  onChange={(e) => setEditingData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, invalidInputMessage: e.target.value }
                  }))}
                  placeholder="Invalid input message"
                />
              </div>

              <div className="edit-actions">
                <button
                  className="btn btn-save"
                  onClick={handleSettingsSave}
                  disabled={!hasValidMenu}
                >
                  <Save size={16} />
                  Save
                </button>
                <button className="btn btn-cancel" onClick={cancelEditing}>
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="audio-summary">
                <strong>Audio Message</strong>
                <div className="audio-text">
                  {settings.audioMessage || 'No audio message set'}
                </div>
              </div>

              {menuOptions.length > 0 && (
                <div className="menu-options-summary">
                  <strong>Menu Options</strong>
                  <div className="options-list">
                    {menuOptions.slice(0, 3).map((option, index) => (
                      <div key={option._id || index} className="option-item" data-digit={option.digit}>
                        {option.label || option.action}
                      </div>
                    ))}
                    {menuOptions.length > 3 && (
                      <div className="option-item" data-digit="+">
                        {menuOptions.length - 3} more options
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="settings-summary">
                <strong>Call Settings</strong>
                <div className="settings-grid">
                  <span>Timeout: {settings.timeout}s</span>
                  <span>Retries: {settings.maxAttempts}</span>
                  <span>Voice: {settings.voice?.split('-')[0] || 'Default'}</span>
                </div>
              </div>

              {menu.lastEditedBy && (
                <div className="connection-status">
                  <span className="last-edited">
                    Last edited: {new Date(menu.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default IVRMenuCard;
