import { useEffect, useRef } from "react";
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

const useCrmRealtimeRefresh = ({
  currentUserId = resolveCacheUserId(),
  onRefresh,
  enabled = true,
  contactId = "",
  listenToLocalSync = true,
  listenToWebsocket = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minGapMs = DEFAULT_MIN_GAP_MS
} = {}) => {
  const timerRef = useRef(null);
  const lastRefreshAtRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const contactIdRef = useRef(normalizeId(contactId));

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    contactIdRef.current = normalizeId(contactId);
  }, [contactId]);

  useEffect(() => {
    if (!enabled || typeof onRefresh !== "function") return undefined;
    if (typeof window === "undefined") return undefined;

    let isActive = true;
    const scheduleRefresh = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!isActive) return;

        const now = Date.now();
        if (now - lastRefreshAtRef.current < Math.max(0, Number(minGapMs) || 0)) {
          return;
        }

        lastRefreshAtRef.current = now;
        onRefreshRef.current?.();
      }, Math.max(0, Number(debounceMs) || 0));
    };

    const handleRealtimeMessage = (payload = {}) => {
      if (String(payload?.type || "").trim() !== "crm_changed") return;
      if (!payloadMatchesContact(payload, contactIdRef.current)) return;
      scheduleRefresh();
    };

    const handleLocalSync = (payload = {}) => {
      if (contactIdRef.current && !isCrmContactSyncForContact(payload, contactIdRef.current)) {
        return;
      }
      scheduleRefresh();
    };

    if (listenToWebsocket) {
      webSocketService.connect(normalizeId(currentUserId) || "crm-user").catch((error) => {
        console.warn("Failed to connect CRM realtime websocket:", error);
      });
      webSocketService.on("crm_changed", handleRealtimeMessage);
    }

    const unsubscribeLocalSync = listenToLocalSync ? addCrmContactSyncListener(handleLocalSync) : () => {};

    return () => {
      isActive = false;
      unsubscribeLocalSync();
      if (listenToWebsocket) {
        webSocketService.off("crm_changed", handleRealtimeMessage);
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    currentUserId,
    debounceMs,
    enabled,
    listenToLocalSync,
    listenToWebsocket,
    minGapMs
  ]);
};

export default useCrmRealtimeRefresh;
