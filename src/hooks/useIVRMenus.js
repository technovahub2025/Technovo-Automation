import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';
import apiService from '../services/api';
import { normalizeIVRMenus } from '../utils/inboundNormalizers';

const IVR_MENU_SOCKET_TIMEOUT_MS = 5000;

const findMenuById = (menus, menuId) =>
  menus.find((menu) =>
    String(menu._id || '') === String(menuId) ||
    String(menu.id || '') === String(menuId) ||
    String(menu.promptKey || '') === String(menuId) ||
    String(menu.menuName || '') === String(menuId)
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

const emitWithAck = (socket, eventName, payload) =>
  new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket unavailable. Unable to process IVR menu request.'));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${eventName} timed out`));
    }, IVR_MENU_SOCKET_TIMEOUT_MS);

    socket.emit(eventName, payload, (response = {}) => {
      window.clearTimeout(timeoutId);
      if (response.success === false) {
        reject(new Error(response.error || 'IVR socket request failed'));
        return;
      }
      resolve(response);
    });
  });

const useIVRMenus = () => {
  const [ivrMenus, setIvrMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const requestTimeoutRef = useRef(null);
  const pendingListRequestRef = useRef(null);
  const menusCountRef = useRef(0);
  const requestSeqRef = useRef(0);

  const clearRequestTimeout = useCallback(() => {
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  const settlePendingListRequest = useCallback((type, value) => {
    const pending = pendingListRequestRef.current;
    if (!pending) return;
    pendingListRequestRef.current = null;
    clearRequestTimeout();
    pending[type](value);
  }, [clearRequestTimeout]);

  const requestMenus = useCallback((options = {}) => {
    const { silent = false } = options;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const socket = socketService.connect();
    if (!socket) {
      if (!silent) setLoading(true);
      setError(null);
      return apiService.getIVRMenus({ limit: 1000 })
        .then((response) => {
          if (requestSeq !== requestSeqRef.current) return [];
          const menus = normalizeIVRMenus(response.data);
          menusCountRef.current = menus.length;
          setIvrMenus(menus);
          setLoading(false);
          return menus;
        })
        .catch((error) => {
          const message = error?.response?.data?.error || error?.message || 'Unable to load IVR menus.';
          if (requestSeq === requestSeqRef.current) {
            setError(message);
            setLoading(false);
          }
          throw new Error(message);
        });
    }

    if (pendingListRequestRef.current) {
      pendingListRequestRef.current.reject(new Error('IVR menu request superseded.'));
      pendingListRequestRef.current = null;
    }

    clearRequestTimeout();
    if (!silent) setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      pendingListRequestRef.current = { resolve, reject };
      requestTimeoutRef.current = setTimeout(() => {
        apiService.getIVRMenus({ limit: 1000 })
          .then((response) => {
            const menus = normalizeIVRMenus(response.data);
            menusCountRef.current = menus.length;
            setIvrMenus(menus);
            setLoading(false);
            setError(null);
            settlePendingListRequest('resolve', menus);
          })
          .catch((error) => {
            const timeoutError = new Error(error?.response?.data?.error || error?.message || 'IVR menus request timed out. Please try again.');
            if (!silent) setLoading(false);
            setError(timeoutError.message);
            settlePendingListRequest('reject', timeoutError);
          });
      }, 8000);

      const emitListRequest = () => socket.emit('ivr_menu:list');
      if (socket.connected || socketService.isConnected()) {
        emitListRequest();
      } else if (typeof socket.connect === 'function') {
        socket.connect();
      }
    });
  }, [clearRequestTimeout, settlePendingListRequest]);

  useEffect(() => {
    const socket = socketService.connect();
    let isMounted = true;

    const applyListPayload = (payload = {}) => {
      if (!isMounted) return;
      const menus = normalizeIVRMenus(payload);
      clearRequestTimeout();
      menusCountRef.current = menus.length;
      setIvrMenus(menus);
      setLoading(false);
      setError(null);
      settlePendingListRequest('resolve', menus);
    };

    const handleListError = (eventError = {}) => {
      if (!isMounted) return;
      const message = eventError.error || eventError.message || 'Failed to load IVR menus';
      clearRequestTimeout();
      setError(message);
      setLoading(false);
      settlePendingListRequest('reject', new Error(message));
    };

    const handleConnect = () => {
      if (!isMounted) return;
      setSocketConnected(true);
      if (pendingListRequestRef.current) {
        socket.emit('ivr_menu:list');
      } else {
        requestMenus({ silent: menusCountRef.current > 0 }).catch(() => {});
      }
    };

    const handleDisconnect = () => {
      if (!isMounted) return;
      setSocketConnected(false);
    };

    const handleMenuChanged = () => {
      if (!isMounted) return;
      setError(null);
    };

    if (socket) {
      socket.on('ivr_menu:list:success', applyListPayload);
      socket.on('ivr_menu:list:error', handleListError);
      socket.on('ivr_menu:changed', handleMenuChanged);
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      setSocketConnected(socket.connected);
    }

    requestMenus({ silent: menusCountRef.current > 0 }).catch(() => {});

    return () => {
      isMounted = false;
      clearRequestTimeout();
      if (pendingListRequestRef.current) {
        pendingListRequestRef.current.reject(new Error('IVR menu request cancelled.'));
        pendingListRequestRef.current = null;
      }
      if (!socket) return;
      socket.off('ivr_menu:list:success', applyListPayload);
      socket.off('ivr_menu:list:error', handleListError);
      socket.off('ivr_menu:changed', handleMenuChanged);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [clearRequestTimeout, requestMenus, settlePendingListRequest]);

  const createMenu = useCallback(async (menuData) => {
    const socket = socketService.connect();
    const hasExistingMenus = ivrMenus.length > 0;
    try {
      if (!hasExistingMenus) setLoading(true);
      setError(null);

      const menuName = menuData.promptKey || menuData.displayName || menuData.name;
      if (!menuName) throw new Error('Menu name is required');

      const config = buildConfigPayload(menuData);
      let response;
      try {
        response = await emitWithAck(socket, 'ivr_menu:create', { menuName, config });
      } catch {
        response = await apiService.createIVRConfig(menuName, config);
      }

      if (response.snapshot) {
        const menus = normalizeIVRMenus(response.snapshot);
        menusCountRef.current = menus.length;
        setIvrMenus(menus);
      } else {
        await requestMenus({ silent: true }).catch(() => {});
      }
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ivrMenus.length, requestMenus]);

  const updateMenu = useCallback(async (menuId, menuData) => {
    const socket = socketService.connect();
    const hasExistingMenus = ivrMenus.length > 0;
    try {
      if (!hasExistingMenus) setLoading(true);
      setError(null);

      const existingMenu = findMenuById(ivrMenus, menuId);
      const menuName = existingMenu?._id || existingMenu?.promptKey || menuData?.promptKey || menuId;
      if (!menuName) throw new Error('Unable to resolve IVR menu name for update');

      const config = buildConfigPayload(menuData, existingMenu);
      let response;
      try {
        response = await emitWithAck(socket, 'ivr_menu:update', { menuName, config });
      } catch {
        response = await apiService.createIVRConfig(menuName, config);
      }

      if (response.snapshot) {
        const menus = normalizeIVRMenus(response.snapshot);
        menusCountRef.current = menus.length;
        setIvrMenus(menus);
      } else {
        await requestMenus({ silent: true }).catch(() => {});
      }
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to update IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ivrMenus, requestMenus]);

  const deleteMenu = useCallback(async (menuId) => {
    const socket = socketService.connect();
    const hasExistingMenus = ivrMenus.length > 0;
    try {
      if (!hasExistingMenus) setLoading(true);
      setError(null);

      let response;
      try {
        response = await emitWithAck(socket, 'ivr_menu:delete', { menuId });
      } catch {
        response = await apiService.deleteIVRConfig(menuId);
      }
      if (response.snapshot) {
        const menus = normalizeIVRMenus(response.snapshot);
        menusCountRef.current = menus.length;
        setIvrMenus(menus);
      } else {
        setIvrMenus((prev) => {
          const menus = prev.filter((menu) => String(menu._id) !== String(menuId) && String(menu.id) !== String(menuId));
          menusCountRef.current = menus.length;
          return menus;
        });
      }
      return response;
    } catch (err) {
      const errorMessage = err.message || 'Failed to delete IVR menu';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ivrMenus.length]);

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
