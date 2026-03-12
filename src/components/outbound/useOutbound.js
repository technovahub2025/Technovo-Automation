/**
 * Custom React Hook for Outbound Call Management
 * Follows the pattern established by useBroadcast
 */
import { useState, useCallback } from 'react';
import apiService from '../services/api';

export const useOutbound = () => {
    const [callHistory, setCallHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refreshCallHistory = useCallback(async (params = { limit: 20, direction: 'outbound-local' }) => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getCallHistory(params);
            setCallHistory(response.data?.data || response.data?.calls || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load call history');
            console.error('Refresh call history error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        callHistory,
        loading,
        error,
        refreshCallHistory
    };
};

