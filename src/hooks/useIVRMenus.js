import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';

const normalizeMenusResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.menus)) return data.menus;
  if (Array.isArray(data?.ivrMenus)) return data.ivrMenus;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const findMenuById = (menus, menuId) =>
  menus.find((menu) =>
    menu._id === menuId ||
    menu.id === menuId ||
    menu.promptKey === menuId ||
    menu.menuName === menuId
  );

const buildConfigPayload = (menuData = {}, existingMenu = null) => {
  const workflowConfig = menuData.workflowConfig || {};
  const workflowNodes = menuData.nodes || workflowConfig.nodes || existingMenu?.workflowConfig?.nodes || [];
  const workflowEdges = menuData.edges || workflowConfig.edges || existingMenu?.workflowConfig?.edges || [];
  const workflowSettings = workflowConfig.settings || menuData.settings || existingMenu?.workflowConfig?.settings || {};

  return {
    displayName: menuData.displayName || existingMenu?.displayName || existingMenu?.promptKey || 'Untitled IVR',
    nodes: workflowNodes,
    edges: workflowEdges,
    config: {
      timeout: workflowSettings.timeout || menuData.timeout || 10,
      maxAttempts: workflowSettings.maxAttempts || workflowSettings.maxRetries || menuData.maxRetries || 3,
      invalidInputMessage:
        workflowSettings.invalidInputMessage ||
        menuData.invalidOption?.message ||
        'Invalid selection. Please try again.',
      language: workflowSettings.language || menuData.language || 'en-GB',
      voiceId: workflowSettings.voiceId || workflowSettings.voice || menuData.voiceId || 'en-GB-SoniaNeural'
    },
    status: menuData.status || existingMenu?.status || 'draft'
  };
};

const useIVRMenus = () => {
  const [ivrMenus, setIvrMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchMenusFromApi = useCallback(async () => {
    const response = await apiService.getIVRConfigs();
    const menus = normalizeMenusResponse(response.data);
    setIvrMenus(menus);
    return menus;
  }, []);

  const requestMenus = useCallback(async () => {
    const socket = socketService.connect();
    if (socket && socketService.isConnected()) {
      socket.emit('request_ivr_menus');
      return;
    }
    await fetchMenusFromApi();
  }, [fetchMenusFromApi]);

  useEffect(() => {
    const socket = socketService.connect();
    let isMounted = true;

    const handleIVRConfigs = (data) => {
      if (!isMounted) return;
      setIvrMenus(normalizeMenusResponse(data));
      setLoading(false);
      setError(null);
    };

    const handleError = (eventError) => {
      if (!isMounted) return;
      setError(eventError?.error || eventError?.message || 'Failed to load IVR menus');
      setLoading(false);
    };

    const handleConnect = async () => {
      if (!isMounted) return;
      setSocketConnected(true);
      socket.emit('request_ivr_menus');
    };

    const handleDisconnect = () => {
      if (!isMounted) return;
      setSocketConnected(false);
    };

    const handleConfigChanged = () => {
      socket.emit('request_ivr_menus');
    };

    const bootstrap = async () => {
      setLoading(true);
      try {
        if (socket) {
          socket.on('ivr_menus_list', handleIVRConfigs);
          socket.on('ivr_menus_error', handleError);
          socket.on('connect', handleConnect);
          socket.on('disconnect', handleDisconnect);
          socket.on('ivr_config_created', handleConfigChanged);
          socket.on('ivr_config_updated', handleConfigChanged);
          socket.on('ivr_config_deleted', handleConfigChanged);

          setSocketConnected(socket.connected);
          if (socket.connected) {
            socket.emit('request_ivr_menus');
            return;
          }
        }

        await fetchMenusFromApi();
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load IVR menus');
        setLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      if (!socket) return;
      socket.off('ivr_menus_list', handleIVRConfigs);
      socket.off('ivr_menus_error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('ivr_config_created', handleConfigChanged);
      socket.off('ivr_config_updated', handleConfigChanged);
      socket.off('ivr_config_deleted', handleConfigChanged);
    };
  }, [fetchMenusFromApi]);

  const createMenu = useCallback(async (menuData) => {
    try {
      setLoading(true);
      setError(null);

      const menuName = menuData.promptKey || menuData.displayName || menuData.name;
      if (!menuName) {
        throw new Error('Menu name is required');
      }

      const config = buildConfigPayload(menuData);
      const response = await apiService.createIVRConfig(menuName, config);
      await requestMenus();
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [requestMenus]);

  const updateMenu = useCallback(async (menuId, menuData) => {
    try {
      setLoading(true);
      setError(null);

      const existingMenu = findMenuById(ivrMenus, menuId);
      const menuName = existingMenu?.promptKey || menuData?.promptKey || menuId;

      if (!menuName) {
        throw new Error('Unable to resolve IVR menu name for update');
      }

      const config = buildConfigPayload(menuData, existingMenu);
      const response = await apiService.createIVRConfig(menuName, config);
      await requestMenus();
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ivrMenus, requestMenus]);

  const deleteMenu = useCallback(async (menuId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.deleteIVRConfig(menuId);
      setIvrMenus((prev) => prev.filter((menu) => menu._id !== menuId && menu.id !== menuId));
      await requestMenus();
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete IVR menu';
      setError(errorMessage);
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
};

export default useIVRMenus;
