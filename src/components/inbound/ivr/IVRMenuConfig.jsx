import React, { useState, useCallback, useEffect, Fragment } from 'react';
import { Plus } from 'lucide-react';
import useIVRMenus from '../../../hooks/useIVRMenus';
import useSocket from '../../../hooks/useSocket';
import { VOICE_OPTIONS } from '../../../config/api.config';
import IVRMenuCard from './IVRMenuCard';
import './IVRMenuConfig.css';

const IVRMenuConfig = () => {
  const {
    ivrMenus, // ✅ CORRECT: Use ivrMenus from hook
    createMenu,
    updateMenu,
    deleteMenu,
    loading,
    error,
    socketConnected,
    setError,
    // ❌ REMOVED refetch: fetchMenus - socket-only approach
  } = useIVRMenus();

  // WebSocket connection for real-time IVR updates
  const { socket, connected } = useSocket();

  const [editingMenu, setEditingMenu] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newIvrName, setNewIvrName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    voiceId: VOICE_OPTIONS.BRITISH_ENGLISH[0].value,
    options: [
      { digit: '1', action: 'transfer', destination: '', label: '' },
    ],
    timeout: 10,
    maxRetries: 3,
    invalidOption: {
      message: 'Invalid option. Please try again.',
      action: 'repeat',
    },
  });

  // 
  useEffect(() => {
    if (socket && connected) {
      console.log('');

      // Listen for workflow updates
      socket.on('workflow_created', (data) => {
        console.log(' Workflow created via socket:', data);
        // 
      });

      socket.on('workflow_updated', (data) => {
        console.log(' Workflow updated via socket:', data);
        // 
      });

      socket.on('workflow_deleted', (data) => {
        console.log(' Workflow deleted via socket:', data);
        // 
      });

      // Listen for IVR configuration updates (legacy)
      socket.on('ivr_config_created', (data) => {
        console.log(' IVR config created via socket:', data);
        setError(null);
      });

      socket.on('ivr_config_updated', (data) => {
        console.log(' IVR config updated via socket:', data);
        setError(null);
      });

      // Listen for IVR menu deletions (legacy)
      socket.on('ivr_config_deleted', (data) => {
        console.log(' IVR config deleted via socket:', data);
        setError(null);
      });

      // Listen for IVR test results
      socket.on('ivr_test_result', (data) => {
        console.log(' IVR test result via socket:', data);
        if (data.success) {
          setError(null);
        } else {
          setError(`Test failed: ${data.error || 'Unknown error'}`);
        }
      });

      // Listen for connection status changes
      socket.on('connect', () => {
        console.log(' IVR Socket connected');
      });

      socket.on('disconnect', () => {
        console.log(' IVR Socket disconnected');
        setError('Connection lost. Some features may not work properly.');
      });
    }

    return () => {
      if (socket) {
        socket.off('workflow_created');
        socket.off('workflow_updated');
        socket.off('workflow_deleted');
        socket.off('ivr_config_created');
        socket.off('ivr_config_updated');
        socket.off('ivr_config_deleted');
        socket.off('ivr_test_result');
        socket.off('connect');
        socket.off('disconnect');
      }
    };
  }, [socket, connected, setError]); // 

  /**
   * Handle form input changes
   */
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  /**
   * Handle menu option changes
   */
  const handleOptionChange = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      ),
    }));
  }, []);

  /**
   * Add new menu option
   */
  const addOption = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { digit: '', action: 'transfer', destination: '', label: '' },
      ],
    }));
  }, []);

  /**
   * Remove menu option
   */
  const removeOption = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }, []);

  /**
   * Create IVR from inline name input
   */
  const handleInlineCreate = useCallback(async () => {
    const trimmedName = newIvrName.trim();
    if (!trimmedName) {
      setError('IVR name is required');
      return;
    }

    try {
      const now = Date.now();
      const starterNodes = [
        {
          id: `audio_${now}`,
          type: 'audio',
          position: { x: 120, y: 60 },
          data: {
            mode: 'tts',
            messageText: `Welcome to ${trimmedName}. Please choose an option.`,
            voice: 'en-GB-SoniaNeural',
            language: 'en-GB',
            afterPlayback: 'next',
            maxRetries: 3,
            timeoutSeconds: 10,
            promptKey: `audio_${now}`
          }
        },
        {
          id: `input_${now}`,
          type: 'input',
          position: { x: 120, y: 180 },
          data: {
            digit: '1',
            label: 'Customer Support',
            action: 'transfer',
            promptAudioNodeId: `audio_${now}`,
            invalidAudioNodeId: '',
            timeoutAudioNodeId: '',
            maxAttempts: 3,
            timeoutSeconds: 10,
            promptKey: `input_${now}`
          }
        }
      ];

      const menuData = {
        name: trimmedName,
        displayName: trimmedName, // Add displayName to show the correct name
        promptKey: `ivr_${trimmedName.replace(/\s+/g, '_').toLowerCase()}_${now}`,
        voiceId: 'en-GB-SoniaNeural',
        language: 'en-GB',
        timeout: 10,
        maxRetries: 3,
        invalidOption: {
          message: 'Invalid option. Please try again.',
          action: 'repeat'
        },
        menuConfig: { type: 'workflow' },
        workflowConfig: {
          industry: 'custom',
          nodes: starterNodes,
          edges: [],
          settings: {
            timeout: 10,
            maxRetries: 3,
            language: 'en-GB',
            voice: 'en-GB-SoniaNeural'
          }
        },
        options: [
          {
            digit: '1',
            action: 'transfer',
            destination: '',
            label: 'Customer Support'
          }
        ]
      };

      await createMenu(menuData);
      setNewIvrName('');
      setError(null);
    } catch (error) {
      console.error('Error creating IVR:', error);
      setError(`Failed to create IVR: ${error.message}`);
    }
  }, [newIvrName, createMenu, setError]);

  /**
   * Handle menu deletion
   */
  const handleMenuDelete = useCallback(async (menuId) => {
    try {
      await deleteMenu(menuId);
      setError(null);
    } catch (error) {
      console.error('Error deleting menu:', error);
      setError(`Failed to delete IVR: ${error.message}`);
    }
  }, [deleteMenu, setError]);

  /**
   * Validate form data before submission
   */
  const validateForm = useCallback(() => {
    // Check menu name
    if (!formData.name.trim()) {
      setError('Menu name is required');
      return false;
    }

    // Filter and validate options
    const validOptions = formData.options.filter(opt =>
      opt.digit && opt.digit.trim() &&
      opt.action && opt.action.trim() &&
      opt.destination && opt.destination.trim()
    );

    if (validOptions.length === 0) {
      setError('At least one complete menu option is required (digit, action, and destination)');
      return false;
    }

    // Check for duplicate digits
    const digits = validOptions.map(opt => opt.digit);
    const duplicates = digits.filter((digit, index) => digits.indexOf(digit) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate digits found: ${[...new Set(duplicates)].join(', ')}`);
      return false;
    }

    return true;
  }, [formData]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      voiceId: VOICE_OPTIONS.BRITISH_ENGLISH[0].value,
      options: [
        { digit: '1', action: 'transfer', destination: '', label: '' },
      ],
      timeout: 10,
      maxRetries: 3,
      invalidOption: {
        message: 'Invalid option. Please try again.',
        action: 'repeat',
      },
    });
    setEditingMenu(null);
    setShowCreateForm(false);
  }, []);

  /**
   * Handle workflow update
   */
  const handleWorkflowUpdate = useCallback(async (menuId, workflowData) => {
    try {
      // Sanitize workflow data before sending
      const sanitizedWorkflowData = {
        ...workflowData,
        nodes: workflowData.nodes?.map(node => ({
          ...node,
          data: {
            ...node.data,
            // Ensure all required fields are present
            text: node.data.text || '',
            voice: node.data.voice || 'en-GB-SoniaNeural',
            language: node.data.language || 'en-GB'
          }
        })) || []
      };

      await updateMenu(menuId, {
        workflowConfig: sanitizedWorkflowData,
        status: 'draft',
        lastEditedBy: 'current_user' // TODO: Get actual user ID
      });
      setError(null);
    } catch (error) {
      console.error('Error updating workflow:', error);
      setError(`Failed to update workflow: ${error.message}`);
    }
  }, [updateMenu, setError]);

  /**
   * Handle workflow test
   */
  const handleWorkflowTest = useCallback(async (menuId) => {
    try {
      // TODO: Implement workflow testing logic
      console.log('Testing workflow:', menuId);
      setError(null);
    } catch (error) {
      console.error('Error testing workflow:', error);
      setError(`Failed to test workflow: ${error.message}`);
    }
  }, []); // Added missing closing bracket here

  /**
   * Handle delete menu with enhanced error handling
   */
  const handleDelete = useCallback(async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this IVR menu?')) {
      return;
    }

    try {
      setError(null);
      console.log('🗑️ Deleting IVR menu:', menuId);

      await deleteMenu(menuId);

      console.log('✅ IVR menu deleted successfully');
      setError(null);

    } catch (err) {
      console.error('❌ Error deleting IVR menu:', err);

      // Enhanced error handling
      let displayMsg = 'Failed to delete IVR menu';

      if (err.response) {
        displayMsg = err.response.data?.error || err.response.data?.message || displayMsg;
      } else if (err.request) {
        displayMsg = 'Network error. Please check your connection and try again.';
      } else {
        displayMsg = err.message || displayMsg;
      }

      setError(displayMsg);
    }
  }, [deleteMenu]);

  return (
    <>
      <div className="ivr-menu-tab">
        <div className="config-header">
          <h2>IVR Configuration</h2>
        </div>

        <div className="ivr-inline-create">
          <div className="inline-input">
            <label htmlFor="ivr-name">IVR Name</label>
            <input
              id="ivr-name"
              type="text"
              value={newIvrName}
              onChange={(e) => setNewIvrName(e.target.value)}
              placeholder="Type IVR name..."
              disabled={loading}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleInlineCreate}
            disabled={loading || !newIvrName.trim()}
          >
            <Plus size={18} />
            Create
          </button>
        </div>

        {/* Error display removed */}

        {showCreateForm && null}

        <div className="menus-list-section">

          {!Array.isArray(ivrMenus) || ivrMenus.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-content">
                <h3>No IVR Configurations Yet</h3>
                <p>Type an IVR name above to create your first workflow.</p>
              </div>
            </div>
          ) : (
            <div className="menus-grid">
              {ivrMenus.map((menu, index) => (
                <IVRMenuCard
                  key={menu._id || menu.promptKey || menu.ivrName || menu.name || `menu-${index}`}
                  menu={menu}
                  onUpdate={handleWorkflowUpdate}
                  onDelete={handleMenuDelete}
                  onTest={handleWorkflowTest}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default IVRMenuConfig;