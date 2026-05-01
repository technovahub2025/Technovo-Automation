import webSocketService from './websocketService';

class SocketService {
  constructor() {
    this.isDev = import.meta.env.DEV;
  }

  getToken() {
    const envTokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
    return (
      localStorage.getItem(envTokenKey) ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('token')
    );
  }

  getUserId() {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      return (
        String(storedUser?.id || storedUser?._id || localStorage.getItem('userId') || '').trim() ||
        'anonymous'
      );
    } catch {
      return String(localStorage.getItem('userId') || '').trim() || 'anonymous';
    }
  }

  connect(url) {
    if (url) {
      webSocketService.setWebSocketUrl(url);
    }

    const userId = this.getUserId();
    const token = this.getToken();

    if (this.isDev) {
      console.log(
        'Shared websocket adapter connecting for user:',
        userId,
        token ? '(auth present)' : '(no auth token)'
      );
    }

    webSocketService.connect(userId).catch((error) => {
      if (this.isDev) {
        console.error('Shared websocket connection failed:', error?.message || error);
      }
    });

    return webSocketService;
  }

  on(event, callback) {
    webSocketService.on(event, callback);
  }

  off(event, callback) {
    webSocketService.off(event, callback);
  }

  emit(event, data) {
    const payload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { type: event, ...data }
        : { type: event, payload: data };
    return webSocketService.send(payload);
  }

  disconnect() {
    webSocketService.disconnect();
  }

  isConnected() {
    return webSocketService.isConnected();
  }

  getSocket() {
    return webSocketService;
  }
}

const realtimeSocketService = new SocketService();

export default realtimeSocketService;
