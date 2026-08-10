import { useState, useEffect, useCallback, useRef } from 'react';
import socketService from '../services/socketService';
import apiService from '../services/api';
import { normalizeIVRMenus } from '../utils/inboundNormalizers';
import { resolveCacheUserId } from '../utils/sidebarPageCache';
import { writeSidebarPageCache } from '../utils/sidebarPageCache';

const IVR_MENU_SOCKET_TIMEOUT_MS = 5000;
const IVR_MENU_CACHE_NAMESPACE = 'inbound-ivr-menus';
const IVR_MENU_CACHE_TTL_MS = 5 * 60 * 1000;

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

const useIVRMenus = ({ currentUserId } = {}) => {
  const resolvedCurrentUserId = String(currentUserId || resolveCacheUserId()).trim();
  const [ivrMenus, setIvrMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const menusCountRef = useRef(0);
  const requestSeqRef = useRef(0);
  const currentUserIdRef = useRef(resolvedCurrentUserId);
  const hasHydratedMenusRef = useRef(false);

  useEffect(() => {
    currentUserIdRef.current = resolvedCurrentUserId;
    menusCountRef.current = 0;
    setIvrMenus([]);
    setLoading(false);
    hasHydratedMenusRef.current = false;
  }, [resolvedCurrentUserId]);

  const clearRequestTimeout = useCallback(() => {
    return undefined;
  }, []);

  const settlePendingListRequest = useCallback((type, value) => {
    return value;
  }, [clearRequestTimeout]);

  const normalizeScopedMenus = useCallback(
    (data) => normalizeIVRMenus(data),
    []
  );

  const persistMenuSnapshot = useCallback((menus) => {
    const normalizedMenus = normalizeScopedMenus(menus);
    menusCountRef.current = normalizedMenus.length;
    hasHydratedMenusRef.current = normalizedMenus.length > 0;
    setIvrMenus(normalizedMenus);

    writeSidebarPageCache(
      IVR_MENU_CACHE_NAMESPACE,
      { menus: normalizedMenus },
      {
        currentUserId: currentUserIdRef.current,
        ttlMs: IVR_MENU_CACHE_TTL_MS
      }
    );

    return normalizedMenus;
  }, [normalizeScopedMenus]);

  const requestMenus = useCallback((options = {}) => {
    const { silent = false } = options;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const requestUserId = currentUserIdRef.current;
    const socket = socketService.connect();
    const shouldShowLoading = !silent && !hasHydratedMenusRef.current;
    if (shouldShowLoading) setLoading(true);
    setError(null);

    const fetchPromise = apiService.getIVRMenus({ limit: 100, userId: requestUserId, scope: 'user' })
      .then((response) => {
        if (requestSeq !== requestSeqRef.current) return [];
        if (requestUserId !== currentUserIdRef.current) return [];
        const menus = persistMenuSnapshot(response.data);
        setLoading(false);
        setError(null);
        return menus;
      })
      .catch((error) => {
        const message = error?.response?.data?.error || error?.message || 'Unable to load IVR menus.';
        if (requestSeq === requestSeqRef.current) {
          setError(message);
          if (!hasHydratedMenusRef.current) setLoading(false);
        }
        throw new Error(message);
      });

    const emitListRequest = () => socket.emit('ivr_menu:list', { userId: requestUserId, scope: 'user' });
    if (socket.connected || socketService.isConnected()) {
      emitListRequest();
    } else if (typeof socket.connect === 'function') {
      socket.connect();
    }

    return fetchPromise.finally(() => {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    });
  }, [persistMenuSnapshot]);

  useEffect(() => {
    const socket = socketService.connect();
    let isMounted = true;

    const applyListPayload = (payload = {}) => {
      if (!isMounted) return;
      const responseUserId = String(payload?.userId || payload?.requestUserId || '').trim();
      const activeUserId = currentUserIdRef.current;
      if (responseUserId && activeUserId && responseUserId !== activeUserId) return;
      const menus = persistMenuSnapshot(payload);
      setLoading(false);
      setError(null);
    };

    const handleListError = (eventError = {}) => {
      if (!isMounted) return;
      const message = eventError.error || eventError.message || 'Failed to load IVR menus';
      setError(message);
      setLoading(false);
    };

    const handleConnect = () => {
      if (!isMounted) return;
      setSocketConnected(true);
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

    requestMenus({ silent: false }).catch(() => {});

    return () => {
      isMounted = false;
      if (!socket) return;
      socket.off('ivr_menu:list:success', applyListPayload);
      socket.off('ivr_menu:list:error', handleListError);
      socket.off('ivr_menu:changed', handleMenuChanged);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [requestMenus, resolvedCurrentUserId]);

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
        const menus = normalizeScopedMenus(response.snapshot);
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
        const menus = normalizeScopedMenus(response.snapshot);
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
        const menus = normalizeScopedMenus(response.snapshot);
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
  }, [ivrMenus.length, normalizeScopedMenus]);

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
