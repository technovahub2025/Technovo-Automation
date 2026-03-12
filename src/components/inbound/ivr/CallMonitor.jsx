import React, { useState, useEffect, useCallback } from 'react';
import useSocket from '../../../hooks/useSocket';
import apiService from '../../../services/api';
import './CallMonitor.css';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'busy', 'no-answer', 'no_answer', 'canceled', 'cancelled', 'opted_out']);

const CallMonitor = () => {
    const [activeCalls, setActiveCalls] = useState([]);
    const [workflowStats, setWorkflowStats] = useState({
        totalCalls: 0,
        successRate: 0,
        avgDuration: 0,
        completedCalls: 0
    });
    const { socket } = useSocket();
    const normalizeActiveCall = useCallback((call = {}, index = 0) => ({
        id: String(call.callSid || call.call_sid || call.callId || call._id || `active-${index}`),
        phoneNumber: call.phoneNumber || call?.phone || call?.contact?.phone || '-',
        status: String(call.status || 'initiated').toLowerCase(),
        source: String(call.source || (call.broadcastId ? 'broadcast' : (call.direction || 'inbound'))),
        startTime: call.startTime || call.createdAt || call.timestamp || Date.now(),
        createdAt: call.createdAt || call.startTime || call.timestamp || Date.now()
    }), []);

    const upsertLiveCall = useCallback((callPayload = {}) => {
        const normalized = normalizeActiveCall(callPayload);
        if (!normalized.id || normalized.id === 'active-0') return;
        if (TERMINAL_STATUSES.has(normalized.status)) {
            setActiveCalls((prev) => prev.filter((item) => item.id !== normalized.id));
            return;
        }

        setActiveCalls((prev) => {
            const idx = prev.findIndex((item) => item.id === normalized.id);
            if (idx === -1) return [normalized, ...prev].slice(0, 100);
            const next = [...prev];
            next[idx] = { ...next[idx], ...normalized };
            return next;
        });
    }, [normalizeActiveCall]);

    const removeLiveCall = useCallback((callPayload = {}) => {
        const normalized = normalizeActiveCall(callPayload);
        if (!normalized.id) return;
        setActiveCalls((prev) => prev.filter((item) => item.id !== normalized.id));
    }, [normalizeActiveCall]);

    const fetchActiveCalls = useCallback(async () => {
        try {
            const response = await apiService.getActiveCalls();
            const calls = Array.isArray(response?.data?.calls) ? response.data.calls : [];
            setActiveCalls(
                calls.map((call, index) => normalizeActiveCall(call, index))
            );
        } catch (error) {
            console.error('Failed to fetch active calls:', error);
        }
    }, [normalizeActiveCall]);

    const formatSource = (source) => {
        const normalized = String(source || '').toLowerCase();
        if (normalized === 'broadcast') return 'Voice Broadcast';
        if (normalized === 'outbound_quick_call') return 'Outbound Quick Call';
        if (normalized === 'outbound') return 'Outbound';
        if (normalized === 'ivr') return 'IVR';
        if (normalized === 'inbound') return 'Inbound';
        return source || 'Unknown';
    };

    useEffect(() => {
        if (!socket) return;
        fetchActiveCalls();
        const intervalId = setInterval(fetchActiveCalls, 5000);

        // Listen for workflow call events
        socket.on('workflow_call_started', (data = {}) => {
            upsertLiveCall({
                callSid: data.callSid,
                phoneNumber: data.phoneNumber,
                status: 'initiated',
                source: data.workflowId ? 'ivr' : 'inbound',
                startTime: data.timestamp
            });
        });

        socket.on('workflow_call_node', (data = {}) => {
            upsertLiveCall({
                callSid: data.callSid,
                status: 'in-progress',
                source: data.workflowId ? 'ivr' : 'inbound',
                startTime: data.timestamp
            });
        });

        socket.on('workflow_call_completed', (data = {}) => {
            removeLiveCall({
                callSid: data.callSid,
                status: 'completed'
            });
            setWorkflowStats(prev => ({
                ...prev,
                completedCalls: prev.completedCalls + 1,
                totalCalls: prev.totalCalls + 1
            }));
        });
        socket.on('outbound_call_update', (data = {}) => {
            const payload = {
                callSid: data.callSid,
                callId: data.callId,
                phone: data.phone,
                status: data.status,
                source: 'broadcast',
                startTime: data.timestamp
            };
            if (TERMINAL_STATUSES.has(String(data.status || '').toLowerCase())) {
                removeLiveCall(payload);
            } else {
                upsertLiveCall(payload);
            }
            fetchActiveCalls();
        });
        socket.on('call_status_update', (data = {}) => {
            const executionDirection = String(data?.execution?.direction || '').toLowerCase();
            const executionRouting = String(data?.execution?.routing || '').toLowerCase();
            const inferredSource = executionDirection === 'outbound'
                ? 'outbound'
                : executionDirection === 'outbound-local'
                    ? 'outbound_quick_call'
                    : (executionRouting && executionRouting !== 'default')
                        ? 'ivr'
                        : 'inbound';
            const payload = {
                callSid: data.callSid,
                status: data.status,
                source: inferredSource,
                startTime: data?.execution?.startTime || data?.execution?.createdAt || Date.now()
            };
            if (TERMINAL_STATUSES.has(String(data.status || '').toLowerCase())) {
                removeLiveCall(payload);
            } else {
                upsertLiveCall(payload);
            }
            fetchActiveCalls();
        });

        socket.on('workflow_stats_update', (data) => {
            setWorkflowStats(prev => ({ ...prev, ...data }));
        });

        socket.on('ivr_workflow_update', (data) => {
            // Handle generic updates if needed
            console.log('IVR Workflow update:', data);
        });

        return () => {
            clearInterval(intervalId);
            socket.off('workflow_call_started');
            socket.off('workflow_call_node');
            socket.off('workflow_call_completed');
            socket.off('outbound_call_update');
            socket.off('call_status_update');
            socket.off('workflow_stats_update');
            socket.off('ivr_workflow_update');
        };
    }, [socket, fetchActiveCalls, upsertLiveCall, removeLiveCall]);

    return (
        <div className="call-monitor">
            <div className="monitor-header">
                <h3>📞 Live Call Monitoring</h3>
                <span className="live-indicator">LIVE</span>
            </div>

            <div className="monitor-grid">
                {/* Active Calls Section */}
                {activeCalls.length > 0 && (
                    <div className="active-calls-section">
                        <div className="section-header">
                            <h4>Active Calls ({activeCalls.length})</h4>
                        </div>
                        <div className="calls-list">
                            {activeCalls.map(call => (
                                <div key={call.id} className="call-monitor-card">
                                    <div className="call-header">
                                        <span className="call-id">#{String(call.id).substring(0, 8)}...</span>
                                        <span className="industry-tag">{formatSource(call.source)}</span>
                                    </div>
                                    <div className="call-details">
                                        <div className="detail-item">
                                            <span className="label">Phone:</span>
                                            <span className="value">{call.phoneNumber}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Status:</span>
                                            <span className="value">{call.status}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Started:</span>
                                            <span className="value">
                                                {new Date(call.startTime || call.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Duration:</span>
                                            <span className="value">
                                                {Math.max(0, Math.floor((Date.now() - new Date(call.startTime || call.createdAt)) / 1000))}s
                                            </span>
                                        </div>
                                    </div>
                                    <div className="call-progress-bar">
                                        <div className="progress-fill" style={{ width: '40%' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Statistics Section */}
                <div className="stats-section">
                    <div className="section-header">
                        <h4>📊 Workflow Performance</h4>
                    </div>
                    <div className="stats-cards">
                        <div className="stat-card">
                            <span className="stat-label">Total Calls</span>
                            <span className="stat-value">{workflowStats.totalCalls}</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Success Rate</span>
                            <span className="stat-value">{workflowStats.successRate}%</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Avg Duration</span>
                            <span className="stat-value">{workflowStats.avgDuration}s</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Completed</span>
                            <span className="stat-value">{workflowStats.completedCalls}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallMonitor;

