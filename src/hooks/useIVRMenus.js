import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';

const useIVRMenus = () => {
  const [ivrMenus, setIvrMenus] = useState([]); // ✅ CORRECT: Use ivrMenus state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Request IVR menus via socket
  const requestMenus = useCallback(() => {
    const socket = socketService.connect();
    if (socket && socketService.isConnected()) {
      console.log('📡 Requesting IVR menus via socket...');
      socket.emit('request_ivr_menus');
    }
  }, []);

  // Request menus on component mount and socket connection
  useEffect(() => {
    const socket = socketService.connect();
    
    if (socket) {
      console.log('🔥 Socket state:', socket.connected);
      console.log('🔥 Setting up IVR socket listeners FIRST...');

      // 1️⃣ Register listeners BEFORE emitting
      const handleIVRConfigs = (data) => {
        console.log('🔥 SOCKET RESPONSE RECEIVED:', data);
        setIvrMenus(data.menus || data || []);
        setLoading(false);
        setError(null);
      };

      const handleError = (error) => {
        console.error('❌ Socket error receiving IVR menus:', error);
        setError(error.error || error.message || 'Failed to load IVR menus');
        setIvrMenus([]);
        setLoading(false);
      };

      const handleConnect = () => {
        console.log('🔌 Socket connected, requesting IVR menus...');
        // 2️⃣ Emit AFTER listener is registered
        socket.emit('request_ivr_menus');
      };

      const handleIVRConfigCreated = (data) => {
        console.log('🔥 IVR Config created via socket:', data);
        // Refresh the menu list when a new IVR is created
        socket.emit('request_ivr_menus');
      };

      // Register listeners first
      socket.on('ivr_menus_list', handleIVRConfigs);
      socket.on('ivr_menus_error', handleError);
      socket.on('connect', handleConnect);
      socket.on('ivr_config_created', handleIVRConfigCreated);

      // If already connected, emit immediately
      if (socket.connected) {
        console.log('📡 Socket already connected, emitting request_ivr_menus...');
        socket.emit('request_ivr_menus');
      }

      return () => {
        console.log('🧹 Cleaning up socket listeners...');
        socket.off('ivr_menus_list', handleIVRConfigs);
        socket.off('ivr_menus_error', handleError);
        socket.off('connect', handleConnect);
        socket.off('ivr_config_created', handleIVRConfigCreated);
      };
    }
  }, []);

  // Enhanced create menu with socket events
  const createMenu = useCallback(async (menuData) => {
    try {
      setLoading(true);
      setError(null);

      // Filter out incomplete options
      const options = menuData.options || [];
      const validOptions = options.filter(opt =>
        opt.digit && opt.digit.toString().trim() &&
        opt.action && opt.action.trim() &&
        (opt.destination || opt.target)
      );

      const payload = {
        menuName: menuData.promptKey || menuData.displayName || 'main',
        config: {
          displayName: menuData.displayName || menuData.promptKey || 'Untitled IVR',
          nodes: menuData.nodes || [],
          edges: menuData.edges || [],
          config: menuData.config || {
            timeout: 10,
            maxRetries: 3,
            language: 'en-GB',
            voice: 'en-GB-SoniaNeural'
          },
          status: menuData.status || 'draft'
        }
      };

      console.log('📝 Creating IVR menu with payload:', payload);
      console.log('🔍 Checking for _id in menuData:', menuData._id);
      console.log('🔍 Full menuData being sent:', JSON.stringify(menuData, null, 2));

      // Use centralized API service with timeout
      const response = await apiService.createIVRConfig(payload.menuName, payload.config);
      console.log('✅ IVR menu created successfully:', response.data);

      // Defensive checks for response structure
      if (!response) {
        console.error('❌ No response received from server');
        throw new Error('No response received from server');
      }

      if (!response.data) {
        console.error('❌ Response missing data:', response);
        throw new Error('Response missing data from server');
      }

      // Check for workflow data in the correct location
      // Backend returns data in response.data.ivrMenu.workflowConfig or response.data.workflowConfig
      const ivrMenuData = response.data.ivrMenu || response.data;
      const workflowData = ivrMenuData.workflowConfig || response.data.workflowConfig || response.data;
      
      console.log('🔍 Debugging response structure:', {
        responseData: response.data,
        ivrMenuData: ivrMenuData,
        workflowData: workflowData,
        hasNodes: workflowData?.nodes,
        nodesArray: Array.isArray(workflowData?.nodes)
      });
      
      if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
        console.error('❌ Missing or invalid nodes array in response:', response.data);
        console.error('❌ workflowConfig:', response.data.workflowConfig);
        console.error('❌ ivrMenu.workflowConfig:', ivrMenuData.workflowConfig);
        console.error('❌ Direct data nodes:', response.data.nodes);
        throw new Error('Invalid workflow data structure in response');
      }

      // NO LONGER NEEDED - backend emits socket events with complete data
      // const socket = socketService.connect();
      // if (socket && socketService.isConnected()) {
      //   socket.emit('ivr_config_created', {
      //     menuName: payload.menuName,
      //     config: payload.config,
      //     timestamp: new Date().toISOString()
      //   });
      // }

      // Refresh the menu list after successful creation
      requestMenus();

      return response.data;

    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create IVR menu';
      setError(errorMessage);
      console.error('❌ Error creating IVR menu:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [requestMenus]); // ✅ Added requestMenus dependency for refresh

  // Enhanced update menu with socket events
  const updateMenu = useCallback(async (menuId, menuData) => {
    try {
      setLoading(true);
      setError(null);

      // Support both traditional options and workflow updates
      const options = menuData.options || [];
      const validOptions = options.filter(opt =>
        opt.digit && opt.digit.toString().trim() &&
        opt.action && opt.action.trim() &&
        (opt.destination || opt.target)
      );

      // Find existing menu to preserve values if not provided in update
      const existingMenu = ivrMenus.find(m =>
        m.name === menuId || m.menuName === menuId || m._id === menuId || m.promptKey === menuId
      );

      // Determine if menuData is actually just the workflowConfig (has nodes/edges)
      const isDirectWorkflowConfig = menuData.nodes && Array.isArray(menuData.nodes);

      const workflowConfigToUse = isDirectWorkflowConfig ? menuData : (menuData.workflowConfig || existingMenu?.workflowConfig);

      // Extract greeting safely ensuring it's a string
      let newGreeting = menuData.greeting;
      if (!newGreeting && isDirectWorkflowConfig) {
        // If we received just workflow config, try to find greeting node in it
        newGreeting = menuData.nodes?.find(n => n.type === 'greeting')?.data?.text;
      } else if (!newGreeting) {
        newGreeting = menuData.workflowConfig?.nodes?.find(n => n.type === 'greeting')?.data?.text;
      }

      setLoading(false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update IVR menu';
      setError(errorMessage);
      console.error('❌ Error updating IVR menu:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Enhanced delete menu with socket events
  const deleteMenu = useCallback(async (menuId) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🗑️ Deleting IVR menu:', menuId);

      const response = await apiService.deleteIVRConfig(menuId);
      console.log('✅ DELETE SUCCESS - API Response:', response.data);

      // Remove menu from local state immediately for better UX
      setIvrMenus(prev => prev.filter(menu => menu._id === menuId));
      
      // Refresh to ensure sync with backend
      requestMenus();

      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete IVR menu';
      setError(errorMessage);
      console.error('❌ Error deleting IVR menu:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [requestMenus]);

  return {
    ivrMenus,
    requestMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    loading,
    error,
    socketConnected,
    setError
  };
}

export default useIVRMenus;