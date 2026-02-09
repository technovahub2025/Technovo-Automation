import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';

const useIVRMenus = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Enhanced fetch with retry mechanism and better error handling
  const fetchMenus = useCallback(async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching IVR menus from authenticated endpoint...');
      const response = await apiService.getIVRConfigs();
      console.log('📥 IVR Menus API Response:', response.data);

      // Handle the actual API response structure
      let menuData = [];

      if (response.data) {
        if (response.data.ivrMenus && Array.isArray(response.data.ivrMenus)) {
          menuData = response.data.ivrMenus;
        } else if (Array.isArray(response.data)) {
          menuData = response.data;
        } else if (response.data.data) {
          if (Array.isArray(response.data.data)) {
            menuData = response.data.data;
          } else if (response.data.data.menu && Array.isArray(response.data.data.menu)) {
            menuData = response.data.data.menu;
          } else if (response.data.data.menuName) {
            menuData = [response.data.data];
          }
        }
      }

      console.log('✅ Processed menu data:', menuData);
      setMenus(menuData);

      // Emit socket event to notify other clients that data was refreshed
      const socket = socketService.connect();
      if (socket && socketService.isConnected()) {
        socket.emit('ivr_menus_refreshed', {
          count: menuData.length,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error('❌ Failed to fetch IVR menus:', err);

      // Retry logic for network errors
      if (retryCount < 2 && (err.code === 'NETWORK_ERROR' || err.code === 'ECONNABORTED')) {
        console.log(`🔄 Retrying fetch (${retryCount + 1}/3)...`);
        setTimeout(() => fetchMenus(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }

      setError(`Failed to fetch IVR menus: ${err.response?.data?.error || err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
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
        menuName: menuData.name || 'main',
        config: {
          greeting: menuData.greeting || (menuData.workflowConfig?.nodes?.find(n => n.type === 'greeting')?.data?.text),
          voiceId: menuData.voiceId || menuData.workflowConfig?.settings?.voice || 'en-GB-SoniaNeural',
          language: menuData.language || menuData.workflowConfig?.settings?.language || 'en-GB',
          provider: menuData.provider || menuData.workflowConfig?.settings?.provider || 'edge',
          menu: validOptions.map(opt => ({
            digit: opt.digit || opt.key,
            action: opt.action,
            target: opt.destination || opt.target,
            label: opt.label || `Option ${opt.digit || opt.key}`
          })),
          timeout: menuData.timeout || menuData.workflowConfig?.settings?.timeout || 10,
          maxAttempts: menuData.maxRetries || menuData.workflowConfig?.settings?.maxRetries || 3,
          invalidInputMessage: menuData.invalidOption?.message || 'Invalid selection. Please try again.',
          workflowConfig: menuData.workflowConfig,
          status: menuData.status || 'draft'
        }
      };

      console.log('📝 Creating IVR menu with payload:', payload);

      // Use centralized API service with timeout
      const response = await apiService.updateIVRConfig(payload.menuName, payload.config);
      console.log('✅ IVR menu created successfully:', response.data);

      // Emit socket event to notify other clients
      const socket = socketService.connect();
      if (socket && socketService.isConnected()) {
        socket.emit('ivr_config_created', {
          menuName: payload.menuName,
          config: payload.config,
          timestamp: new Date().toISOString()
        });
      }

      // Refresh the menu list
      await fetchMenus();

      return response.data;

    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create IVR menu';
      setError(errorMessage);
      console.error('❌ Error creating IVR menu:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchMenus]);

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
      const existingMenu = menus.find(m =>
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

      let finalGreeting = "Welcome";
      if (typeof newGreeting === 'string' && newGreeting.trim()) {
        finalGreeting = newGreeting;
      } else if (existingMenu) {
        if (existingMenu.greeting?.text && typeof existingMenu.greeting.text === 'string') {
          finalGreeting = existingMenu.greeting.text;
        } else if (typeof existingMenu.greeting === 'string') {
          finalGreeting = existingMenu.greeting;
        } else if (typeof existingMenu.text === 'string') {
          finalGreeting = existingMenu.text;
        } else if (existingMenu.greeting?.text) {
          finalGreeting = String(existingMenu.greeting.text);
        }
      }

      const payload = {
        menuName: menuData.name || menuData.menuName || menuId,
        config: {
          greeting: finalGreeting,
          voiceId: menuData.voiceId || menuData.workflowConfig?.settings?.voice || existingMenu?.greeting?.voice || existingMenu?.voiceId || 'en-GB-SoniaNeural',
          language: menuData.language || menuData.workflowConfig?.settings?.language || existingMenu?.greeting?.language || existingMenu?.language || 'en-GB',
          provider: menuData.provider || menuData.workflowConfig?.settings?.provider || existingMenu?.provider || 'edge',
          menu: validOptions.length > 0 ? validOptions.map(opt => ({
            digit: opt.digit || opt.key,
            action: opt.action,
            target: opt.destination || opt.target,
            label: opt.label || `Option ${opt.digit || opt.key}`
          })) : [{
            digit: '1',
            action: 'end',
            target: 'end',
            label: 'Default Option'
          }],
          timeout: menuData.timeout || menuData.workflowConfig?.settings?.timeout || existingMenu?.timeout || 10,
          maxRetries: menuData.maxRetries || menuData.workflowConfig?.settings?.maxRetries || existingMenu?.maxRetries || 3,
          invalidInputMessage: menuData.invalidInputMessage || menuData.workflowConfig?.settings?.invalidInputMessage || existingMenu?.invalidInputMessage || 'Invalid input. Please try again.',
          noMatchMessage: menuData.noMatchMessage || menuData.workflowConfig?.settings?.noMatchMessage || existingMenu?.noMatchMessage || 'No matching option found.',
          repeatMessage: menuData.repeatMessage || menuData.workflowConfig?.settings?.repeatMessage || existingMenu?.repeatMessage || 'Please enter your selection again.'
        }
      };
  

    console.log('📝 Updating IVR menu:', menuId, payload);

    const response = await apiService.updateIVRConfig(payload.menuName, payload.config);
    console.log('✅ IVR menu updated successfully:', response.data);

    // Emit socket event to notify other clients
    const socket = socketService.connect();
    if (socket && socketService.isConnected()) {
      socket.emit('ivr_config_updated', {
        menuId: menuId,
        menuName: payload.menuName,
        config: payload.config,
        timestamp: new Date().toISOString()
      });
    }

    // Refresh the menu list
    await fetchMenus();

    return response.data;

  } catch (err) {
    const errorMessage = err.response?.data?.error || err.message || 'Failed to update IVR menu';
    setError(errorMessage);
    console.error('❌ Error updating IVR menu:', err);
    throw new Error(errorMessage);
  } finally {
    setLoading(false);
  }
}, [fetchMenus, menus]);

// Enhanced delete menu with socket events
const deleteMenu = useCallback(async (menuName) => {
  try {
    setLoading(true);
    setError(null);
    console.log('🗑️ Deleting IVR menu:', menuName);

    const response = await apiService.deleteIVRConfig(menuName);
    console.log('✅ DELETE SUCCESS - API Response:', response.data);

    // Emit socket event to notify other clients
    const socket = socketService.connect();
    if (socket && socketService.isConnected()) {
      socket.emit('ivr_config_deleted', {
        menuName: menuName,
        timestamp: new Date().toISOString()
      });
    }

    // Remove the menu from local state immediately for better UX
    setMenus(prev => prev.filter(menu =>
      menu.name !== menuName && menu.promptKey !== menuName && menu._id !== menuName
    ));

    return response.data;
  } catch (err) {
    const errorMessage = err.response?.data?.error || err.message || 'Failed to delete IVR menu';
    setError(errorMessage);
    console.error('❌ Error deleting IVR menu:', err);
    throw new Error(errorMessage);
  } finally {
    setLoading(false);
  }
}, []);

// Socket connection monitoring and event listeners
useEffect(() => {
  const socket = socketService.connect();

  const updateSocketConnectionStatus = () => {
    const isConnected = socketService.isConnected();
    setSocketConnected(isConnected);
    console.log(`🔌 Socket connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  };

  // Initial status check
  updateSocketConnectionStatus();

  // Listen for connection events
  if (socket) {
    socket.on('connect', updateSocketConnectionStatus);
    socket.on('disconnect', updateSocketConnectionStatus);

    // Listen for IVR-related socket events from other clients
    socket.on('ivr_config_created', (data) => {
      console.log('📢 IVR config created via socket:', data);
      fetchMenus(); // Refresh to get latest data
    });

    socket.on('ivr_config_updated', (data) => {
      console.log('📢 IVR config updated via socket:', data);
      fetchMenus(); // Refresh to get latest data
    });

    socket.on('ivr_config_deleted', (data) => {
      console.log('📢 IVR config deleted via socket:', data);
      fetchMenus(); // Refresh to get latest data
    });

    socket.on('ivr_menus_refreshed', (data) => {
      console.log('📢 IVR menus refreshed via socket:', data);
      fetchMenus(); // Refresh to get latest data
    });
  }

  return () => {
    if (socket) {
      socket.off('connect', updateSocketConnectionStatus);
      socket.off('disconnect', updateSocketConnectionStatus);
      socket.off('ivr_config_created');
      socket.off('ivr_config_updated');
      socket.off('ivr_config_deleted');
      socket.off('ivr_menus_refreshed');
    }
  };
}, [fetchMenus]);

// Initial data fetch
useEffect(() => {
  fetchMenus();
}, [fetchMenus]);

return {
  menus,
  createMenu,
  updateMenu,
  deleteMenu,
  loading,
  error,
  socketConnected,
  setError,
  refetch: fetchMenus
};
};

export default useIVRMenus;
