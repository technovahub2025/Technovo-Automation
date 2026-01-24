/**
 * Custom React Hook for Broadcast Management
 */
import { useState, useCallback } from 'react';
import { broadcastAPI } from '../../../services/broadcastAPI';

export const useBroadcast = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshBroadcasts = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await broadcastAPI.listBroadcasts(filters);
      setBroadcasts(response.broadcasts);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load broadcasts');
      console.error('Refresh broadcasts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getBroadcastById = useCallback(
    (broadcastId) => {
      return broadcasts.find(b => b.id === broadcastId);
    },
    [broadcasts]
  );

  const getActiveBroadcasts = useCallback(() => {
    return broadcasts.filter(b => b.status === 'in_progress');
  }, [broadcasts]);

  return {
    broadcasts,
    loading,
    error,
    refreshBroadcasts,
    getBroadcastById,
    getActiveBroadcasts
  };
};