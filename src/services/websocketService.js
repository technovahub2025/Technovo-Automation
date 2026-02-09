/**
 * Custom EventEmitter for browser compatibility
 * Replicates Node.js EventEmitter functionality
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this.events[event]) {
      return this;
    }
    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
    return this;
  }

  emit(event, ...args) {
    if (!this.events[event]) {
      return this;
    }
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}

/**
 * Enhanced WebSocket Service - WhatsApp Business Platform
 * Provides real-time communication with automatic reconnection and event handling
 */
class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.reconnectTimer = null;
    this.manualClose = false;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 2000; // Start with 2 seconds
    this.maxReconnectInterval = 30000; // Max 30 seconds
    this.heartbeatInterval = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // WebSocket URL from environment or default
    this.wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    console.log('🔌 WebSocket URL:', this.wsUrl);
    
    // Bind methods to maintain context
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - User identifier
   * @param {Function} onMessage - Message handler function
   * @returns {Promise} Promise that resolves when connected
   */
  async connect(userId, onMessage) {
    // If already connecting, return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected and same user, resolve immediately
    if (this.isConnected() && this.currentUserId === userId) {
      return Promise.resolve(this.ws);
    }

    this.currentUserId = userId;
    this.messageHandler = onMessage;
    this.manualClose = false;
    this.isConnecting = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      this.clearReconnect();
      
      try {
        console.log(`🔌 Connecting to WebSocket: ${this.wsUrl}`);
        this.ws = new WebSocket(this.wsUrl);
        
        // Set up event listeners
        this.ws.onopen = (event) => this.handleOpen(event, resolve, reject);
        this.ws.onmessage = this.handleMessage;
        this.ws.onerror = (error) => this.handleError(error, reject);
        this.ws.onclose = (event) => this.handleClose(event);
        
        // Set connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen(event, resolve, reject) {
    console.log('✅ WebSocket connected successfully');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectInterval = 2000; // Reset reconnect interval
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Identify this client to backend
    this.identify();
    
    // Emit connection event
    this.emit('connected', { ws: this.ws, userId: this.currentUserId });
    
    // Resolve connection promise
    if (resolve) resolve(this.ws);
  }

  /**
   * Handle WebSocket message event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle heartbeat response
      if (data.type === 'pong') {
        this.emit('pong', data);
        return;
      }
      
      console.log('📨 WebSocket message received:', data.type);
      
      // Emit specific event based on message type
      this.emit(data.type, data);
      
      // Call custom message handler if provided
      if (this.messageHandler) {
        this.messageHandler(data);
      }
      
    } catch (error) {
      console.error('❌ WebSocket message parse error:', error);
      this.emit('error', { type: 'parse_error', error, data: event.data });
    }
  }

  /**
   * Handle WebSocket error event
   */
  handleError(error, reject) {
    console.error('❌ WebSocket error:', error);
    this.isConnecting = false;
    
    // Emit error event
    this.emit('error', { type: 'websocket_error', error });
    
    // Reject connection promise if still connecting
    if (reject && this.isConnecting) {
      reject(error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    console.log(`🔌 WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
    this.ws = null;
    this.stopHeartbeat();
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // Emit disconnect event
    this.emit('disconnected', { 
      code: event.code, 
      reason: event.reason, 
      wasClean: event.wasClean 
    });
    
    // Attempt reconnection if not manually closed
    if (!this.manualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect_failed');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.clearReconnect();
    
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectInterval
    );
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.currentUserId, this.messageHandler)
        .catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Identify client to server
   */
  identify() {
    if (this.currentUserId) {
      this.send({ 
        type: 'identify', 
        userId: this.currentUserId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} data - Message data to send
   * @returns {boolean} True if sent, false otherwise
   */
  send(data) {
    if (this.isConnected()) {
      try {
        const message = JSON.stringify(data);
        this.ws.send(message);
        console.log('📤 WebSocket message sent:', data.type);
        return true;
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('⚠️ WebSocket not connected, message not sent:', data);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log('🔌 Manually disconnecting WebSocket');
    this.manualClose = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.isConnecting = false;
    this.connectionPromise = null;
    
    if (this.ws) {
      try {
        this.ws.close(1000, 'Manual disconnect');
      } catch (error) {
        console.error('❌ Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  /**
   * Update user ID
   * @param {string} userId - New user ID
   */
  setUserId(userId) {
    this.currentUserId = userId;
    if (this.isConnected()) {
      this.identify();
    }
  }

  /**
   * Update message handler
   * @param {Function} handler - New message handler function
   */
  setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Check if WebSocket is connecting
   * @returns {boolean} Connecting status
   */
  isConnecting() {
    return this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING);
  }

  /**
   * Get current connection state
   * @returns {string} Connection state
   */
  getConnectionState() {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  getStats() {
    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting(),
      userId: this.currentUserId,
      reconnectAttempts: this.reconnectAttempts,
      connectionState: this.getConnectionState(),
      wsUrl: this.wsUrl,
      hasMessageHandler: !!this.messageHandler
    };
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Debug mode status
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    if (enabled) {
      console.log('🐛 WebSocket debug mode enabled');
    }
  }

  /**
   * Get WebSocket URL
   * @returns {string} Current WebSocket URL
   */
  getWebSocketUrl() {
    return this.wsUrl;
  }

  /**
   * Update WebSocket URL
   * @param {string} url - New WebSocket URL
   */
  setWebSocketUrl(url) {
    this.wsUrl = url;
    console.log(`🔗 WebSocket URL updated to: ${url}`);
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Export convenience methods for backward compatibility
export const connectWebSocket = (userId, onMessage) => {
  return webSocketService.connect(userId, onMessage);
};

export const disconnectWebSocket = () => {
  webSocketService.disconnect();
};

export const sendWebSocketMessage = (data) => {
  return webSocketService.send(data);
};

export const getWebSocketStats = () => {
  return webSocketService.getStats();
};

export const isWebSocketConnected = () => {
  return webSocketService.isConnected();
};

// Export the service instance and class
export { webSocketService, WebSocketService };
export default webSocketService;
