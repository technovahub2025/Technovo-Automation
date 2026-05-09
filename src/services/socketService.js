import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isDev = import.meta.env.DEV;
    this.useCredentials = String(import.meta.env.VITE_SOCKET_WITH_CREDENTIALS || import.meta.env.VITE_API_WITH_CREDENTIALS || 'false').toLowerCase() === 'true';
    this.loggedConnectError = false;
    this.loggedReconnectFailure = false;
  }

  getToken() {
    const envTokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
    return (
      localStorage.getItem(envTokenKey) ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('token')
    );
  }

  clearAuthAndRedirect() {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const loginPath = `${normalizedBase}/login`;
    const registerPath = `${normalizedBase}/register`;
    localStorage.removeItem(tokenKey);
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.setItem('auth_expired_notice', 'Your session expired. Please login again.');

    if (window.location.pathname !== loginPath && !window.location.pathname.includes(registerPath)) {
      window.location.href = loginPath;
    }
  }

  isAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('invalid token') ||
      message.includes('expired token') ||
      message.includes('invalid or expired token')
    );
  }

  resolveUrl(url) {
    const configuredSocket =
      import.meta.env.VITE_WS_URL ||
      import.meta.env.VITE_SOCKET_URL ||
      '';
    const configuredApi =
      import.meta.env.VITE_VOICE_API_URL ||
      import.meta.env.VITE_API_URL ||
      '';

    return (
      url ||
      configuredSocket ||
      (configuredApi ? configuredApi.replace(/\/api\/?$/, '') : window.location.origin)
    );
  }

  connect(url) {
    const token = this.getToken();
    const resolvedUrl = this.resolveUrl(url);

    if (this.socket) {
      const currentToken = this.socket.auth?.token || null;
      const nextToken = token || null;
      const tokenChanged = currentToken !== nextToken;

      if (tokenChanged) {
        this.socket.auth = nextToken ? { token: nextToken } : {};
      }

      if (!this.socket.connected) {
        this.socket.connect();
      }

      return this.socket;
    }

    this.socket = io(resolvedUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      withCredentials: this.useCredentials,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      this.loggedConnectError = false;
      this.loggedReconnectFailure = false;
      if (this.isDev) {
        console.log('Shared socket connected:', this.socket.id);
      }
    });

    this.socket.on('disconnect', (reason) => {
      if (this.isDev) {
        console.log('Shared socket disconnected:', reason);
      }
    });

    this.socket.on('connect_error', (error) => {
      if (this.isDev && !this.loggedConnectError) {
        this.loggedConnectError = true;
        console.warn('Socket connection error. Realtime updates will retry quietly in the background.');
      }

      if (this.isAuthError(error)) {
        this.disconnect();
        this.clearAuthAndRedirect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      if (this.isDev) {
        console.log('Socket reconnected after attempts:', attemptNumber);
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      if (this.isDev) {
        console.log('Socket reconnect attempt:', attemptNumber);
      }
    });

    this.socket.on('reconnect_error', (error) => {
      if (this.isDev) {
        console.error('Socket reconnect error:', error.message);
      }

      if (this.isAuthError(error)) {
        this.disconnect();
        this.clearAuthAndRedirect();
      }
    });

    this.socket.on('reconnect_failed', () => {
      if (!this.loggedReconnectFailure) {
        this.loggedReconnectFailure = true;
        if (this.isDev) {
          console.warn('Socket reconnection stopped after the configured retry limit.');
        }
      }
      this.socket = null;
    });

    return this.socket;
  }

  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  emit(event, data) {
    if (!this.socket) return;
    this.socket.emit(event, data);
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  isConnected() {
    return Boolean(this.socket && this.socket.connected);
  }

  getSocket() {
    return this.socket;
  }
}

const socketService = new SocketService();

export default socketService;
