import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isDev = import.meta.env.DEV;
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
    if (this.socket) return this.socket;

    const envTokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
    const token = localStorage.getItem(envTokenKey) || localStorage.getItem('authToken');
    const resolvedUrl = this.resolveUrl(url);

    this.socket = io(resolvedUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
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
