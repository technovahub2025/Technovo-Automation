import { useState, useEffect } from 'react';
import socketService from '../services/socketService';

const useSocket = () => {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return undefined;

    if (socket.connected) {
      setConnected(true);
      setError(null);
    }

    const handleConnect = () => {
      setConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleConnectError = (err) => {
      setError(err?.message || 'Socket connection error');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  const emit = (event, data) => {
    socketService.emit(event, data);
  };

  const joinBroadcast = (broadcastId) => {
    emit('join_broadcast', broadcastId);
  };

  const leaveBroadcast = (broadcastId) => {
    emit('leave_broadcast', broadcastId);
  };

  const startTwilioMedia = (callSid) => {
    emit('twilio_media_start', { callSid });
  };

  const sendAudioChunk = (audioHex) => {
    emit('audio_chunk', { audioHex });
  };

  return {
    socket: socketService.getSocket(),
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
