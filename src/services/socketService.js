import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isDev = import.meta.env.DEV;
    this.useCredentials = String(import.meta.env.VITE_SOCKET_WITH_CREDENTIALS || import.meta.env.VITE_API_WITH_CREDENTIALS || 'false').toLowerCase() === 'true';
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
    localStorage.removeItem(tokenKey);
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.setItem('auth_expired_notice', 'Your session expired. Please login again.');

    if (window.location.pathname !== '/login' && !window.location.pathname.includes('/register')) {
      window.location.href = '/login';
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
    const configuredApi = import.meta.env.VITE_API_URL || '';
    const configuredSocket = import.meta.env.VITE_SOCKET_URL || '';

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
      if (this.isDev) {
        console.error('Socket connection error:', error.message);
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
      console.error('Socket reconnection failed');
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
