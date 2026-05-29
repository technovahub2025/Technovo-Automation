import { resolveApiBaseUrl } from './apiBaseUrl';

import { normalizeError } from "../utils/errorUtils";

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this.events[event]) return this;
    const index = this.events[event].indexOf(listener);
    if (index >= 0) this.events[event].splice(index, 1);
    return this;
  }

  emit(event, ...args) {
    const listeners = this.events[event];
    if (!listeners || listeners.length === 0) return this;
    listeners.slice().forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Error in websocket event listener:', error);
      }
    });
    return this;
  }

  removeAllListeners(event) {
    if (event) delete this.events[event];
    else this.events = {};
    return this;
  }
}

const isLocalHostname = (hostname = '') => /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || '').trim());

const deriveWsUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed
    .replace(/^ws:\/\//i, 'http://')
    .replace(/^wss:\/\//i, 'https://')
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/g, '');

  if (/^https:\/\//i.test(normalized)) return normalized.replace(/^https:\/\//i, 'wss://');
  if (/^http:\/\//i.test(normalized)) return normalized.replace(/^http:\/\//i, 'ws://');
  return normalized;
};

const resolveWebSocketUrl = () => {
  const explicit = deriveWsUrl(import.meta.env.VITE_WS_URL || import.meta.env.VITE_SOCKET_URL || '');
  const apiFallback = deriveWsUrl(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '');
  const defaultUrl = 'ws://localhost:3001';
  const browserLocation = typeof window !== 'undefined' ? window.location : null;
  const browserHostIsLocal = isLocalHostname(browserLocation?.hostname || '');

  const candidate = explicit || apiFallback || defaultUrl;
  if (!browserHostIsLocal && /localhost|127\.0\.0\.1/i.test(candidate)) {
    return deriveWsUrl(browserLocation?.origin || resolveApiBaseUrl()) || candidate;
  }

  return candidate;
};

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connectionPromise = null;
    this.messageHandler = null;
    this.connected = false;
    this.connecting = false;
    this.manualClose = false;
    this.currentUserId = null;
    this.currentCompanyId = null;
    this.activeConversationId = '';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 2000;
    this.maxReconnectDelay = 30000;
    this.reconnectJitterMs = 0;
    this.connectionTimeoutMs = 20000;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.pongTimeout = null;
    this.circuitOpenUntil = 0;
    this.lastCloseCode = null;
    this.lastPongAt = null;
    this.offlineListenerAttached = false;
    this.heartbeatInterval = null;
    this.crmMessageQueue = [];
    this.connecting = false;
    this.connectionPromise = null;
    
    // WhatsApp/CRM realtime uses the raw WebSocket backend, not the voice Socket.IO backend.
    const explicitWhatsAppWsUrl = import.meta.env.VITE_WHATSAPP_WS_URL || '';
    const whatsappApiBaseForFallback = import.meta.env.VITE_API_BASE_URL || '';
    const legacyWsUrl =
      import.meta.env.VITE_WS_URL ||
      import.meta.env.VITE_SOCKET_URL ||
      '';
    const legacyApiBaseForFallback = import.meta.env.VITE_API_URL || '';

    this.wsUrl =
      deriveWsUrl(explicitWhatsAppWsUrl) ||
      deriveWsUrl(whatsappApiBaseForFallback) ||
      deriveWsUrl(legacyWsUrl) ||
      deriveWsUrl(legacyApiBaseForFallback) ||
      resolveWebSocketUrl();
    console.log('🔌 WebSocket URL:', this.wsUrl);
    
    // Bind methods to maintain context
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
  }

  setupNetworkListeners() {
    if (typeof window === 'undefined' || this.offlineListenerAttached) return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.offlineListenerAttached = true;
  }

  teardownNetworkListeners() {
    if (typeof window === 'undefined' || !this.offlineListenerAttached) return;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.offlineListenerAttached = false;
  }

  handleOnline() {
    this.emit('online', { reason: 'browser_online' });
    if (!this.manualClose && !this.isConnected() && !this.isConnecting()) {
      this.scheduleReconnect();
    }
  }

  handleOffline() {
    this.emit('offline', { reason: 'browser_offline' });
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  armPongTimeout() {
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    this.pongTimeout = setTimeout(() => {
      if (this.isConnected()) {
        console.warn('WebSocket heartbeat timed out, closing connection.');
        try {
          this.ws?.close(4000, 'Heartbeat timeout');
        } catch (error) {
          console.error('Failed to close stale websocket:', error);
        }
      }
    }, 45000);
  }

  markPong(data) {
    this.lastPongAt = Date.now();
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    this.emit('pong', data);
  }

  emitIncomingEvent(data = {}) {
    if (!data || typeof data !== 'object') return;

    const eventType = String(data.type || '').trim();
    if (!eventType) return;

    this.emit(eventType, data);

    const normalizedStatus = String(data.status || '').trim().toLowerCase();
    switch (eventType) {
      case 'new_message':
        this.emit('message_received', data);
        break;
      case 'message_received':
        this.emit('new_message', data);
        break;
      case 'message_status':
        if (normalizedStatus === 'delivered') {
          this.emit('message_delivered', data);
        } else if (normalizedStatus === 'read') {
          this.emit('message_read', data);
        }
        break;
      case 'message_delivered':
        this.emit('message_status', {
          ...data,
          type: 'message_status',
          status: 'delivered'
        });
        break;
      case 'message_read':
        this.emit('message_status', {
          ...data,
          type: 'message_status',
          status: 'read'
        });
        break;
      case 'conversation_read':
        this.emit('message_read', data);
        this.emit('message_status', {
          ...data,
          type: 'message_status',
          status: 'read'
        });
        break;
      case 'typing:update':
        this.emit('typing', data);
        this.emit('typing_status', data);
        break;
      case 'typing_status':
        this.emit('typing', data);
        this.emit('typing:update', data);
        break;
      case 'presence:update':
        this.emit('presence', data);
        break;
      case 'presence':
        this.emit('presence:update', data);
        break;
      default:
        break;
    }
  }

  async connect(userId, onMessage) {
    if (this.connectionPromise) return this.connectionPromise;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.emit('offline', { reason: 'browser_offline' });
      throw new Error('Browser is offline');
    }
    if (Date.now() < this.circuitOpenUntil) {
      throw new Error('Reconnect circuit is open');
    }
    if (this.isConnected() && this.currentUserId === userId) {
      return this.ws;
    }

    this.currentUserId = userId || this.currentUserId;
    this.messageHandler = onMessage || this.messageHandler;
    this.manualClose = false;
    this.connecting = true;
    this.setupNetworkListeners();
    this.clearReconnect();

    this.connectionPromise = new Promise((resolve, reject) => {
      let timeoutId = null;

      try {
        console.log(`Connecting to WebSocket: ${this.wsUrl}`);
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = (event) => this.handleOpen(event, resolve, reject, timeoutId);
        this.ws.onmessage = this.handleMessage;
        this.ws.onerror = (error) => this.handleError(error, reject, timeoutId);
        this.ws.onclose = this.handleClose;

        timeoutId = setTimeout(() => {
          if (!this.connecting) return;
          this.connecting = false;
          reject(new Error('WebSocket connection timeout'));
        }, this.connectionTimeoutMs);
      } catch (error) {
        this.connecting = false;
        reject(normalizeError(error, "WebSocket connection failed"));
      }
    }).finally(() => {
      this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  handleOpen(event, resolve, _reject, timeoutId) {
    if (timeoutId) clearTimeout(timeoutId);
    this.connecting = false;
    this.connected = true;
    this.reconnectAttempts = 0;
    this.circuitOpenUntil = 0;
    this.lastCloseCode = null;
    this.lastPongAt = Date.now();
    this.clearHeartbeat();
    this.startHeartbeat();
    this.identify();
    this.flushCrmMessageQueue();
    this.emit('connected', { ws: this.ws, userId: this.currentUserId, event });
    this.emit('connect', { ws: this.ws, userId: this.currentUserId, event });
    if (resolve) resolve(this.ws);
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === 'pong') {
        this.markPong(data);
        return;
      }

      if (data?.type === 'realtime_batch' && Array.isArray(data.events)) {
        data.events.forEach((entry) => {
          if (!entry || typeof entry !== 'object') return;
          this.emitIncomingEvent(entry);
          if (this.messageHandler) this.messageHandler(entry);
        });
        return;
      }

      this.emitIncomingEvent(data);
      if (this.messageHandler) this.messageHandler(data);
    } catch (error) {
      console.error('WebSocket message parse error:', error);
      this.emit('error', { type: 'parse_error', error, data: event.data });
    }
  }

  handleError(error, reject, timeoutId) {
    if (timeoutId) clearTimeout(timeoutId);
    const wasConnecting = this.connecting;
    this.connecting = false;
    this.emit('error', { type: 'websocket_error', error });
    this.emit('connect_error', error);
    if (reject && wasConnecting) reject(normalizeError(error, "WebSocket connection failed"));
  }

  handleClose(event) {
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.lastCloseCode = Number(event?.code || 0) || null;
    this.clearHeartbeat();
    this.connectionPromise = null;

    this.emit('disconnected', {
      code: event?.code,
      reason: event?.reason,
      wasClean: event?.wasClean
    });
    this.emit('disconnect', {
      code: event?.code,
      reason: event?.reason,
      wasClean: event?.wasClean
    });

    if (!this.manualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.circuitOpenUntil = Date.now() + 30000;
      this.emit('reconnect_failed');
    }
  }

  scheduleReconnect() {
    this.clearReconnect();

    if (typeof window !== 'undefined' && !navigator.onLine) {
      this.emit('offline', { reason: 'browser_offline' });
      return;
    }

    if (Date.now() < this.circuitOpenUntil) {
      return;
    }

    const delay =
      Math.min(this.baseReconnectDelay * (2 ** this.reconnectAttempts), this.maxReconnectDelay) +
      Math.floor(Math.random() * this.reconnectJitterMs);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts += 1;
      this.connect(this.currentUserId, this.messageHandler).catch((error) => {
        console.error('Reconnection failed:', normalizeError(error, 'WebSocket reconnection failed'));
        if (this.reconnectAttempts >= 5) {
          this.circuitOpenUntil = Date.now() + 15000;
        }
      });
    }, delay);
  }

  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected()) return;
      this.send({ type: 'ping', timestamp: Date.now() });
      this.armPongTimeout();
    }, 30000);
    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref();
    }
  }

  identify() {
    if (!this.currentUserId) return;
    this.send({
      type: 'identify',
      userId: this.currentUserId,
      companyId: this.currentCompanyId || undefined,
      activeConversationId: this.activeConversationId || undefined,
      timestamp: Date.now()
    });
  }

  setCompanyId(companyId) {
    this.currentCompanyId = String(companyId || '').trim() || null;
    if (this.isConnected()) this.identify();
  }

  setActiveConversationId(conversationId) {
    const nextConversationId = String(conversationId || '').trim();
    if (this.activeConversationId === nextConversationId) return;

    const previousConversationId = this.activeConversationId;
    this.activeConversationId = nextConversationId;
    if (!this.isConnected()) return;

    if (previousConversationId) {
      this.send({
        type: 'conversation:unsubscribe',
        conversationId: previousConversationId,
        timestamp: Date.now()
      });
    }

    if (nextConversationId) {
      this.send({
        type: 'conversation:subscribe',
        conversationId: nextConversationId,
        timestamp: Date.now()
      });
    }

    this.send({
      type: 'presence:ping',
      conversationId: nextConversationId || undefined,
      activeConversationId: nextConversationId || undefined,
      companyId: this.currentCompanyId || undefined,
      timestamp: Date.now()
    });
  }

  send(data) {
    if (!this.isConnected()) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  sendCrm(data) {
    const payload = {
      ...(data || {}),
      scope: 'crm',
      timestamp: data?.timestamp || Date.now()
    };
    if (this.send(payload)) return true;
    this.crmMessageQueue.push(payload);
    this.crmMessageQueue = this.crmMessageQueue.slice(-100);
    return false;
  }

  flushCrmMessageQueue() {
    if (!this.isConnected() || this.crmMessageQueue.length === 0) return;
    const queuedMessages = [...this.crmMessageQueue];
    this.crmMessageQueue = [];
    queuedMessages.forEach((message) => {
      if (!this.send(message)) this.crmMessageQueue.push(message);
    });
  }

  disconnect() {
    this.manualClose = true;
    this.clearReconnect();
    this.clearHeartbeat();
    this.connecting = false;
    this.connectionPromise = null;
    this.teardownNetworkListeners();

    if (this.ws) {
      try {
        this.ws.close(1000, 'Manual disconnect');
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  setUserId(userId) {
    this.currentUserId = userId;
    if (this.isConnected()) this.identify();
  }

  setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  isConnected() {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  isConnecting() {
    return this.connecting || Boolean(this.ws && this.ws.readyState === WebSocket.CONNECTING);
  }

  getConnectionState() {
    if (!this.ws) return 'DISCONNECTED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  getStats() {
    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting(),
      userId: this.currentUserId,
      companyId: this.currentCompanyId,
      activeConversationId: this.activeConversationId,
      reconnectAttempts: this.reconnectAttempts,
      connectionState: this.getConnectionState(),
      wsUrl: this.wsUrl,
      lastCloseCode: this.lastCloseCode,
      lastPongAt: this.lastPongAt,
      hasMessageHandler: Boolean(this.messageHandler)
    };
  }

  setDebugMode(enabled) {
    this.debugMode = Boolean(enabled);
  }

  getWebSocketUrl() {
    return this.wsUrl;
  }

  setWebSocketUrl(url) {
    this.wsUrl = deriveWsUrl(url) || this.wsUrl;
  }
}

const webSocketService = new WebSocketService();

export const connectWebSocket = (userId, onMessage) => webSocketService.connect(userId, onMessage);
export const disconnectWebSocket = () => webSocketService.disconnect();
export const sendWebSocketMessage = (data) => webSocketService.send(data);
export const sendCrmWebSocketMessage = (data) => webSocketService.sendCrm(data);
export const getWebSocketStats = () => webSocketService.getStats();
export const isWebSocketConnected = () => webSocketService.isConnected();

export { webSocketService, WebSocketService };
export default webSocketService;
