import React, { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import useIVRMenus from '../../../hooks/useIVRMenus';
import useSocket from '../../../hooks/useSocket';
import apiService from '../../../services/api';
import { VOICE_OPTIONS } from '../../../config/api.config';
import IVRMenuCard from './IVRMenuCard';
import './IVRMenuConfig.css';



const IVRMenuConfig = () => {
  const {
    ivrMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    loading,
    error,
    socketConnected,
    setError,
  } = useIVRMenus();

  const { socket, connected } = useSocket();

  const [newIvrName, setNewIvrName] = useState('');

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

  useEffect(() => {
    if (socket && connected) {
      const handleWorkflowCreated = (data) => {
        console.log('Workflow created via socket:', data);
      };

      const handleWorkflowUpdated = (data) => {
        console.log('Workflow updated via socket:', data);
      };

      const handleWorkflowDeleted = (data) => {
        console.log('Workflow deleted via socket:', data);
      };

      const handleIvrConfigCreated = (data) => {
        console.log('IVR config created via socket:', data);
        setError(null);
      };

      const handleIvrConfigUpdated = (data) => {
        console.log('IVR config updated via socket:', data);
        setError(null);
      };

      const handleIvrConfigDeleted = (data) => {
        console.log('IVR config deleted via socket:', data);
        setError(null);
      };

      const handleIvrTestResult = (data) => {
        console.log('IVR test result via socket:', data);
        if (data.success) {
          setError(null);
        } else {
          setError(`Test failed: ${data.error || 'Unknown error'}`);
        }
      };

      const handleSocketConnect = () => {
        console.log('IVR Socket connected');
      };

      const handleSocketDisconnect = () => {
        console.log('IVR Socket disconnected');
        setError('Connection lost. Some features may not work properly.');
      };

      socket.on('workflow_created', handleWorkflowCreated);
      socket.on('workflow_updated', handleWorkflowUpdated);
      socket.on('workflow_deleted', handleWorkflowDeleted);
      socket.on('ivr_config_created', handleIvrConfigCreated);
      socket.on('ivr_config_updated', handleIvrConfigUpdated);
      socket.on('ivr_config_deleted', handleIvrConfigDeleted);
      socket.on('ivr_test_result', handleIvrTestResult);
      socket.on('connect', handleSocketConnect);
      socket.on('disconnect', handleSocketDisconnect);

      return () => {
        socket.off('workflow_created', handleWorkflowCreated);
        socket.off('workflow_updated', handleWorkflowUpdated);
        socket.off('workflow_deleted', handleWorkflowDeleted);
        socket.off('ivr_config_created', handleIvrConfigCreated);
        socket.off('ivr_config_updated', handleIvrConfigUpdated);
        socket.off('ivr_config_deleted', handleIvrConfigDeleted);
        socket.off('ivr_test_result', handleIvrTestResult);
        socket.off('connect', handleSocketConnect);
        socket.off('disconnect', handleSocketDisconnect);
      };
    }
  }, [socket, connected, setError]);

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleOptionChange = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      ),
    }));
  }, []);

  const addOption = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { digit: '', action: 'transfer', destination: '', label: '' },
      ],
    }));
  }, []);

  const removeOption = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }, []);

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
        displayName: trimmedName,
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

  const handleMenuDelete = useCallback(async (menuId) => {
    try {
      await deleteMenu(menuId);
      setError(null);
    } catch (error) {
      console.error('Error deleting menu:', error);
      setError(`Failed to delete IVR: ${error.message}`);
    }
  }, [deleteMenu, setError]);

  const validateForm = useCallback(() => {
    if (!formData.name.trim()) {
      setError('Menu name is required');
      return false;
    }

    const validOptions = formData.options.filter(opt =>
      opt.digit && opt.digit.trim() &&
      opt.action && opt.action.trim() &&
      opt.destination && opt.destination.trim()
    );

    if (validOptions.length === 0) {
      setError('At least one complete menu option is required (digit, action, and destination)');
      return false;
    }

    const digits = validOptions.map(opt => opt.digit);
    const duplicates = digits.filter((digit, index) => digits.indexOf(digit) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate digits found: ${[...new Set(duplicates)].join(', ')}`);
      return false;
    }

    return true;
  }, [formData]);

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
  }, []);

  const handleWorkflowUpdate = useCallback(async (menuId, workflowData) => {
    try {
      const sanitizedWorkflowData = {
        ...workflowData,
        nodes: workflowData.nodes?.map(node => ({
          ...node,
          data: {
            ...node.data,
            text: node.data.text || '',
            voice: node.data.voice || 'en-GB-SoniaNeural',
            language: node.data.language || 'en-GB'
          }
        })) || []
      };

      await updateMenu(menuId, {
        workflowConfig: sanitizedWorkflowData,
        status: 'draft',
        lastEditedBy: 'current_user'
      });
      setError(null);
    } catch (error) {
      console.error('Error updating workflow:', error);
      setError(`Failed to update workflow: ${error.message}`);
    }
  }, [updateMenu, setError]);

  const handleWorkflowTest = useCallback(async (menuId) => {
    try {
      const phoneNumber = prompt('Enter phone number to test the IVR workflow (or leave empty for simulation only):');
      
      console.log('Testing workflow:', menuId, 'Phone:', phoneNumber);
      
      const response = await apiService.testIVRMenu(menuId, phoneNumber || undefined);
      
      console.log('Test result:', response.data);
      
      if (response.data.success) {
        setError(null);
        alert(`Test ${phoneNumber ? 'call initiated' : 'simulation'} completed successfully!`);
      } else {
        setError(`Test failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing workflow:', error);
      setError(`Failed to test workflow: ${error.response?.data?.error || error.message}`);
    }
  }, []);

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
  );
};



export default IVRMenuConfig;
