import { useEffect, useRef, useState } from "react";
import webSocketService from "../services/websocketService";
import {
  addCrmContactSyncListener,
  isCrmContactSyncForContact
} from "../utils/crmSyncEvents";
import { resolveCacheUserId } from "../utils/sidebarPageCache";

const DEFAULT_DEBOUNCE_MS = 220;
const DEFAULT_MIN_GAP_MS = 850;

const normalizeId = (value) => String(value || "").trim();

const collectContactIds = (payload = {}) => {
  const ids = [];
  const singleContactId = normalizeId(payload?.contactId);
  if (singleContactId) ids.push(singleContactId);

  if (Array.isArray(payload?.contactIds)) {
    payload.contactIds.forEach((contactId) => {
      const normalizedContactId = normalizeId(contactId);
      if (normalizedContactId) ids.push(normalizedContactId);
    });
  }

  return Array.from(new Set(ids));
};

const payloadMatchesContact = (payload = {}, contactId = "") => {
  const normalizedContactId = normalizeId(contactId);
  if (!normalizedContactId) return true;

  const contactIds = collectContactIds(payload);
  if (contactIds.length === 0) return true;

  return contactIds.some((item) => item === normalizedContactId);
};

const normalizeEntitySet = (entities = []) => {
  const source = Array.isArray(entities) ? entities : [entities];
  return new Set(source.map((entity) => String(entity || "").trim().toLowerCase()).filter(Boolean));
};

const payloadMatchesEntity = (payload = {}, entitySet = new Set()) => {
  if (!entitySet.size) return true;
  const entity = String(payload?.entity || "").trim().toLowerCase();
  return !entity || entitySet.has(entity);
};

const useCrmRealtimeRefresh = ({
  currentUserId = resolveCacheUserId(),
  onRefresh,
  enabled = true,
  entities = [],
  contactId = "",
  listenToLocalSync = true,
  listenToWebsocket = true,
  crmChannel = "",
  presenceMode = "",
  onPresence,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minGapMs = DEFAULT_MIN_GAP_MS
} = {}) => {
  const [connectionStatus, setConnectionStatus] = useState(() => {
    if (!listenToWebsocket) return "disabled";
    if (webSocketService.isConnected?.()) return "connected";
    if (webSocketService.isConnecting?.()) return "connecting";
    return "disconnected";
  });
  const timerRef = useRef(null);
  const lastRefreshAtRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const contactIdRef = useRef(normalizeId(contactId));
  const entitySetRef = useRef(normalizeEntitySet(entities));

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    contactIdRef.current = normalizeId(contactId);
  }, [contactId]);

  useEffect(() => {
    entitySetRef.current = normalizeEntitySet(entities);
  }, [entities]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;

    let isActive = true;
    const runRefresh = () => {
      if (!isActive || typeof onRefreshRef.current !== "function") return;
      lastRefreshAtRef.current = Date.now();
      onRefreshRef.current();
    };

    const scheduleRefresh = () => {
      if (typeof onRefreshRef.current !== "function") return;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!isActive) return;

        const now = Date.now();
        const minGap = Math.max(0, Number(minGapMs) || 0);
        const remainingGapMs = minGap - (now - lastRefreshAtRef.current);
        if (remainingGapMs > 0) {
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            runRefresh();
          }, remainingGapMs);
          return;
        }

        runRefresh();
      }, Math.max(0, Number(debounceMs) || 0));
    };

    const handleRealtimeMessage = (payload = {}) => {
      if (String(payload?.type || "").trim() !== "crm_changed") return;
      if (!payloadMatchesEntity(payload, entitySetRef.current)) return;
      if (!payloadMatchesContact(payload, contactIdRef.current)) return;
      scheduleRefresh();
    };

    const handleLocalSync = (payload = {}) => {
      if (contactIdRef.current && !isCrmContactSyncForContact(payload, contactIdRef.current)) {
        return;
      }
      scheduleRefresh();
    };
    const handleConnected = () => setConnectionStatus("connected");
    const handleDisconnected = () => setConnectionStatus("disconnected");
    const handleConnectingError = () => setConnectionStatus("offline");
    const handleOffline = () => setConnectionStatus("offline");
    const handleOnline = () => {
      setConnectionStatus(webSocketService.isConnected?.() ? "connected" : "connecting");
    };
    const handlePresenceViewing = (payload = {}) => onPresence?.(payload);
    const handlePresenceEditing = (payload = {}) => onPresence?.(payload);
    const handlePresenceLeave = (payload = {}) => onPresence?.(payload);
    const subscribeCrmChannel = () => {
      const channel = normalizeId(crmChannel || contactIdRef.current);
      if (!channel) return;
      webSocketService.sendCrm?.({ type: "crm_subscribe", channel, contactId: contactIdRef.current || undefined });
      if (presenceMode) {
        webSocketService.sendCrm?.({
          type: presenceMode === "editing" ? "crm_presence_editing" : "crm_presence_viewing",
          channel,
          contactId: contactIdRef.current || undefined
        });
      }
    };

    if (listenToWebsocket) {
      setConnectionStatus(webSocketService.isConnected?.() ? "connected" : "connecting");
      webSocketService.on("connected", handleConnected);
      webSocketService.on("disconnected", handleDisconnected);
      webSocketService.on("connect_error", handleConnectingError);
      webSocketService.on("offline", handleOffline);
      webSocketService.on("online", handleOnline);
      webSocketService.on("connected", subscribeCrmChannel);
      webSocketService.on("crm_presence_viewing", handlePresenceViewing);
      webSocketService.on("crm_presence_editing", handlePresenceEditing);
      webSocketService.on("crm_presence_leave", handlePresenceLeave);

      webSocketService.connect(normalizeId(currentUserId) || "crm-user").catch((error) => {
        console.warn("Failed to connect CRM realtime websocket:", error);
        setConnectionStatus("offline");
      });
      webSocketService.on("crm_changed", handleRealtimeMessage);
      subscribeCrmChannel();
    }

    const unsubscribeLocalSync = listenToLocalSync ? addCrmContactSyncListener(handleLocalSync) : () => {};

    return () => {
      isActive = false;
      unsubscribeLocalSync();
      if (listenToWebsocket) {
        webSocketService.off("crm_changed", handleRealtimeMessage);
        webSocketService.off("connected", handleConnected);
        webSocketService.off("disconnected", handleDisconnected);
        webSocketService.off("connect_error", handleConnectingError);
        webSocketService.off("offline", handleOffline);
        webSocketService.off("online", handleOnline);
        webSocketService.off("connected", subscribeCrmChannel);
        webSocketService.off("crm_presence_viewing", handlePresenceViewing);
        webSocketService.off("crm_presence_editing", handlePresenceEditing);
        webSocketService.off("crm_presence_leave", handlePresenceLeave);
        const channel = normalizeId(crmChannel || contactIdRef.current);
        if (channel) {
          webSocketService.sendCrm?.({
            type: "crm_presence_leave",
            channel,
            contactId: contactIdRef.current || undefined
          });
          webSocketService.sendCrm?.({ type: "crm_unsubscribe", channel });
        }
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    currentUserId,
    crmChannel,
    debounceMs,
    enabled,
    listenToLocalSync,
    listenToWebsocket,
    minGapMs,
    onPresence,
    presenceMode
  ]);

  return {
    connectionStatus,
    isConnected: connectionStatus === "connected",
    isConnecting: connectionStatus === "connecting"
  };
};

export default useCrmRealtimeRefresh;
