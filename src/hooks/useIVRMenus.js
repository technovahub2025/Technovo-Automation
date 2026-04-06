import { useState, useEffect, useCallback, useRef } from 'react';
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
  const requestTimeoutRef = useRef(null);
  const pendingRequestRef = useRef(null);

  const clearRequestTimeout = useCallback(() => {
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  const resolvePendingRequest = useCallback((fnName, payload) => {
    if (!pendingRequestRef.current) return;
    const pending = pendingRequestRef.current;
    pendingRequestRef.current = null;
    clearRequestTimeout();
    if (typeof pending[fnName] === 'function') {
      pending[fnName](payload);
    }
  }, [clearRequestTimeout]);

  const requestMenus = useCallback((options = {}) => {
    const { silent = false } = options;
    const socket = socketService.connect();
    if (!socket) {
      const message = 'Socket unavailable. Unable to load IVR menus.';
      setError(message);
      setLoading(false);
      return Promise.reject(new Error(message));
    }

    clearRequestTimeout();
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    return new Promise((resolve, reject) => {
      pendingRequestRef.current = { resolve, reject };
      requestTimeoutRef.current = setTimeout(() => {
        const timeoutMessage = 'IVR menus request timed out. Please try again.';
        if (!silent) {
          setLoading(false);
        }
        setError(timeoutMessage);
        resolvePendingRequest('reject', new Error(timeoutMessage));
      }, 8000);

      if (socket.connected || socketService.isConnected()) {
        socket.emit('request_ivr_menus');
      } else if (typeof socket.connect === 'function') {
        socket.connect();
      }
    });
  }, [clearRequestTimeout, resolvePendingRequest]);

  useEffect(() => {
    const socket = socketService.connect();
    let isMounted = true;

    const handleIVRConfigs = (data) => {
      if (!isMounted) return;
      clearRequestTimeout();
      setIvrMenus(normalizeMenusResponse(data));
      setLoading(false);
      setError(null);
      resolvePendingRequest('resolve', normalizeMenusResponse(data));
    };

    const handleError = (eventError) => {
      if (!isMounted) return;
      clearRequestTimeout();
      const message = eventError?.error || eventError?.message || 'Failed to load IVR menus';
      setError(message);
      setLoading(false);
      resolvePendingRequest('reject', new Error(message));
    };

    const handleConnect = () => {
      if (!isMounted) return;
      setSocketConnected(true);
      if (pendingRequestRef.current) {
        socket.emit('request_ivr_menus');
      }
    };

    const handleDisconnect = () => {
      if (!isMounted) return;
      setSocketConnected(false);
    };

    const handleConfigChanged = () => {
      if (socket.connected || socketService.isConnected()) {
        socket.emit('request_ivr_menus');
      }
    };

    if (socket) {
      socket.on('ivr_menus_list', handleIVRConfigs);
      socket.on('ivr_menus_error', handleError);
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('ivr_config_created', handleConfigChanged);
      socket.on('ivr_config_updated', handleConfigChanged);
      socket.on('ivr_config_deleted', handleConfigChanged);
      setSocketConnected(socket.connected);
    }

    requestMenus({ silent: ivrMenus.length > 0 }).catch(() => {});

    return () => {
      isMounted = false;
      clearRequestTimeout();
      if (pendingRequestRef.current) {
        pendingRequestRef.current.reject(new Error('IVR menu request cancelled.'));
        pendingRequestRef.current = null;
      }
      if (!socket) return;
      socket.off('ivr_menus_list', handleIVRConfigs);
      socket.off('ivr_menus_error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('ivr_config_created', handleConfigChanged);
      socket.off('ivr_config_updated', handleConfigChanged);
      socket.off('ivr_config_deleted', handleConfigChanged);
    };
  }, [clearRequestTimeout, requestMenus, resolvePendingRequest, ivrMenus.length]);

  const createMenu = useCallback(async (menuData) => {
    try {
      const hasExistingMenus = ivrMenus.length > 0;
      if (!hasExistingMenus) {
        setLoading(true);
      }
      setError(null);

      const menuName = menuData.promptKey || menuData.displayName || menuData.name;
      if (!menuName) {
        throw new Error('Menu name is required');
      }

      const config = buildConfigPayload(menuData);
      const response = await apiService.createIVRConfig(menuName, config);
      await requestMenus({ silent: hasExistingMenus });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [requestMenus, ivrMenus.length]);

  const updateMenu = useCallback(async (menuId, menuData) => {
    try {
      const hasExistingMenus = ivrMenus.length > 0;
      if (!hasExistingMenus) {
        setLoading(true);
      }
      setError(null);

      const existingMenu = findMenuById(ivrMenus, menuId);
      const menuName = existingMenu?.promptKey || menuData?.promptKey || menuId;

      if (!menuName) {
        throw new Error('Unable to resolve IVR menu name for update');
      }

      const config = buildConfigPayload(menuData, existingMenu);
      const response = await apiService.createIVRConfig(menuName, config);
      await requestMenus({ silent: hasExistingMenus });
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
      const hasExistingMenus = ivrMenus.length > 0;
      if (!hasExistingMenus) {
        setLoading(true);
      }
      setError(null);

      const response = await apiService.deleteIVRConfig(menuId);
      setIvrMenus((prev) => prev.filter((menu) => menu._id !== menuId && menu.id !== menuId));
      await requestMenus({ silent: hasExistingMenus });
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [requestMenus, ivrMenus.length]);

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
