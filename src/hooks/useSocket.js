import { useState, useEffect } from 'react';
import socketService from '../services/socketService';

const useSocket = () => {
  const [connected, setConnected] = useState(socketService.isConnected());
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(socketService.getSocket());

  useEffect(() => {
    const socketInstance = socketService.connect();
    if (!socketInstance) return undefined;
    setSocket(socketInstance);

    const syncConnectionState = () => {
      setConnected(Boolean(socketInstance.connected));
      if (socketInstance.connected) {
        setError(null);
      }
    };

    const handleConnect = () => {
      syncConnectionState();
    };

    const handleDisconnect = () => {
      syncConnectionState();
    };

    const handleConnectError = (err) => {
      syncConnectionState();
      setError(err?.message || 'Socket connection error');
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleConnectError);
    socketInstance.on('reconnect', syncConnectionState);

    // Important: sync after listeners are attached to avoid missing fast connect events.
    syncConnectionState();

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleConnectError);
      socketInstance.off('reconnect', syncConnectionState);
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
    socket,
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
