import { useState, useEffect } from 'react';
import socketService from '../services/socketService';

const useSocket = () => {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = socketService.connect();

    // If socket is already connected, ensure state is synchronized
    if (socket.connected && !connected) {
      setConnected(true);
      setError(null);
    }

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(err.message);
    });

    return () => {
      // Don't disconnect - let socketService manage the connection
    };
  }, []);

  const emit = (event, data) => {
    socketService.emit(event, data);
  };

  // Real backend room events
  const joinBroadcast = (broadcastId) => {
    emit('join_broadcast', broadcastId);
  };

  const leaveBroadcast = (broadcastId) => {
    emit('leave_broadcast', broadcastId);
  };

  // Real backend media events
  const startTwilioMedia = (callSid) => {
    emit('twilio_media_start', { callSid });
  };

  const sendAudioChunk = (audioHex) => {
    emit('audio_chunk', { audioHex });
  };

  return {
    socket: socketService.socket,
    connected,
    error,
    emit,
    joinBroadcast,
    leaveBroadcast,
    startTwilioMedia,
    sendAudioChunk
  };
};

export default useSocket;
