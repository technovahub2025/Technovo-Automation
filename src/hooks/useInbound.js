/**
 * Enhanced Custom React Hook for Inbound Call Management
 * Features: Retry logic, better error handling, socket integration
 */
import { useState, useCallback, useEffect } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';

export const useInbound = () => {
    const [analytics, setAnalytics] = useState(null);
    const [queueStatus, setQueueStatus] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Enhanced analytics fetch with retry mechanism
    const refreshAnalytics = useCallback(async (period = 'today', retryCount = 0) => {
        try {
            setLoading(true);
            setError(null);

            console.log(`🔄 Fetching inbound analytics for period: ${period}`);
            const response = await apiService.getInboundAnalytics(period);
            
            console.log('📥 Analytics response:', response.data);
            setAnalytics(response.data);
            
            // Emit socket event to notify other clients
            const socket = socketService.connect();
            if (socket && socketService.isConnected()) {
                socket.emit('analytics_refreshed', {
                    period,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (err) {
            console.error('❌ Failed to refresh analytics:', err);
            
            // Retry logic for network errors
            if (retryCount < 2 && (err.code === 'NETWORK_ERROR' || err.code === 'ECONNABORTED')) {
                console.log(`🔄 Retrying analytics fetch (${retryCount + 1}/3)...`);
                setTimeout(() => refreshAnalytics(period, retryCount + 1), 1000 * (retryCount + 1));
                return;
            }
            
            const errorMessage = err.response?.data?.error || err.message || 'Failed to load analytics';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Enhanced queue status fetch with better error handling
    const refreshQueueStatus = useCallback(async (retryCount = 0) => {
        try {
            setError(null);

            console.log('🔄 Fetching queue status...');
            const response = await apiService.getQueueStatus();
            
            console.log('📥 Queue status response:', response.data);
            setQueueStatus(response.data);
            
            // Emit socket event to notify other clients
            const socket = socketService.connect();
            if (socket && socketService.isConnected()) {
                socket.emit('queue_status_refreshed', {
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (err) {
            console.error('❌ Failed to refresh queue status:', err);
            
            // Retry logic for network errors
            if (retryCount < 2 && (err.code === 'NETWORK_ERROR' || err.code === 'ECONNABORTED')) {
                console.log(`🔄 Retrying queue status fetch (${retryCount + 1}/3)...`);
                setTimeout(() => refreshQueueStatus(retryCount + 1), 1000 * (retryCount + 1));
                return;
            }
            
            const errorMessage = err.response?.data?.error || err.message || 'Failed to load queue status';
            setError(errorMessage);
        }
    }, []);

    // Combined refresh with better error handling
    const refreshInbound = useCallback(async (period = 'today') => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔄 Refreshing all inbound data...');
            
            // Fetch both analytics and queue status in parallel
            const [analyticsRes, queueRes] = await Promise.allSettled([
                apiService.getInboundAnalytics(period),
                apiService.getQueueStatus()
            ]);

            // Handle analytics result
            if (analyticsRes.status === 'fulfilled') {
                console.log('✅ Analytics fetched successfully');
                setAnalytics(analyticsRes.value.data);
            } else {
                console.error('❌ Analytics fetch failed:', analyticsRes.reason);
                const errorMessage = analyticsRes.reason?.response?.data?.error || 
                                  analyticsRes.reason?.message || 
                                  'Failed to load analytics';
                setError(errorMessage);
            }

            // Handle queue status result
            if (queueRes.status === 'fulfilled') {
                console.log('✅ Queue status fetched successfully');
                setQueueStatus(queueRes.value.data);
            } else {
                console.error('❌ Queue status fetch failed:', queueRes.reason);
                const errorMessage = queueRes.reason?.response?.data?.error || 
                                  queueRes.reason?.message || 
                                  'Failed to load queue status';
                setError(prev => prev ? `${prev}; ${errorMessage}` : errorMessage);
            }

            // Emit combined refresh event
            const socket = socketService.connect();
            if (socket && socketService.isConnected()) {
                socket.emit('inbound_data_refreshed', {
                    period,
                    timestamp: new Date().toISOString(),
                    analyticsFetched: analyticsRes.status === 'fulfilled',
                    queueStatusFetched: queueRes.status === 'fulfilled'
                });
            }

        } catch (err) {
            console.error('❌ Failed to refresh inbound data:', err);
            setError(err.response?.data?.error || err.message || 'Failed to refresh data');
        } finally {
            setLoading(false);
        }
    }, []);

    // Socket connection monitoring and event listeners
    useEffect(() => {
        const socket = socketService.connect();
        
        const updateSocketConnectionStatus = () => {
            const isConnected = socketService.isConnected();
            setSocketConnected(isConnected);
            console.log(`🔌 Inbound Socket connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
        };

        // Initial status check
        updateSocketConnectionStatus();

        // Listen for connection events
        if (socket) {
            socket.on('connect', updateSocketConnectionStatus);
            socket.on('disconnect', updateSocketConnectionStatus);
            
            // Listen for real-time updates from other clients
            socket.on('analytics_updated', (data) => {
                console.log('📢 Analytics updated via socket:', data);
                refreshAnalytics(); // Refresh to get latest data
            });

            socket.on('queue_status_updated', (data) => {
                console.log('📢 Queue status updated via socket:', data);
                refreshQueueStatus(); // Refresh to get latest data
            });

            socket.on('inbound_data_updated', (data) => {
                console.log('📢 Inbound data updated via socket:', data);
                refreshInbound(); // Refresh all data
            });
        }

        return () => {
            if (socket) {
                socket.off('connect', updateSocketConnectionStatus);
                socket.off('disconnect', updateSocketConnectionStatus);
                socket.off('analytics_updated');
                socket.off('queue_status_updated');
                socket.off('inbound_data_updated');
            }
        };
    }, [refreshAnalytics, refreshQueueStatus, refreshInbound]);

    return {
        analytics,
        queueStatus,
        loading,
        error,
        socketConnected,
        refreshAnalytics,
        refreshQueueStatus,
        refreshInbound,
        setError
    };
};
