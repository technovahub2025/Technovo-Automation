import React, { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';
import useIVRMenus from '../../../hooks/useIVRMenus';
import useSocket from '../../../hooks/useSocket';
import apiService from '../../../services/api';
import IVRMenuCard from './IVRMenuCard';
import './IVRMenuConfig.css';



const IVRMenuConfig = () => {
  const {
    ivrMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    loading,
    setError,
  } = useIVRMenus();

  const { socket, connected } = useSocket();

  const [newIvrName, setNewIvrName] = useState('');

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

  const handleInlineCreate = useCallback(async () => {
    const trimmedName = newIvrName.trim();
    if (!trimmedName) {
      setError('IVR name is required');
      return;
    }

    try {
      const now = Date.now();

      const menuData = {
        displayName: trimmedName,
        promptKey: `ivr_${trimmedName.replace(/\s+/g, '_').toLowerCase()}_${now}`,
        workflowConfig: {
          nodes: [],
          edges: []
        },
        status: 'draft'
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

  const handleWorkflowUpdate = useCallback(async (menuId, workflowData) => {
    try {
      const incomingWorkflow = workflowData?.workflowConfig || workflowData || {};
      const hasWorkflowPayload =
        Array.isArray(incomingWorkflow?.nodes) ||
        Array.isArray(incomingWorkflow?.edges);

      const sanitizedWorkflowData = hasWorkflowPayload
        ? {
            ...incomingWorkflow,
            ...(Array.isArray(incomingWorkflow.nodes)
              ? {
                  nodes: incomingWorkflow.nodes.map(node => ({
                    ...node,
                    data: {
                      ...node.data,
                      text: node.data?.text || '',
                      voice: node.data?.voice || 'en-GB-SoniaNeural',
                      language: node.data?.language || 'en-GB'
                    }
                  }))
                }
              : {})
          }
        : null;

      const updatePayload = {
        ...(sanitizedWorkflowData ? { workflowConfig: sanitizedWorkflowData } : {}),
        ...(workflowData?.status
          ? { status: workflowData.status }
          : (sanitizedWorkflowData ? { status: 'draft' } : {})),
        ...(workflowData?.lastEditedBy ? { lastEditedBy: workflowData.lastEditedBy } : {})
      };

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      await updateMenu(menuId, updatePayload);
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

