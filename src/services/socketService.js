/**
 * Shared Socket Service
 * Prevents multiple WebSocket connections across components
 */
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(url) {
    if (!this.socket) {
      this.socket = io(url || import.meta.env.VITE_API_URL || 'https://technova-hub-voice-backend-node.onrender.com');

      this.socket.on('connect', () => {
        console.log('✅ Shared socket connected');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Shared socket disconnected');
        this.socket = null;
      });

      // Reconnect on disconnect
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }

    return this.socket;
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
