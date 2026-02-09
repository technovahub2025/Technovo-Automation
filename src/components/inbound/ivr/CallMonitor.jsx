import React, { useState, useEffect } from 'react';
import useSocket from '../../../hooks/useSocket';
import './CallMonitor.css';

const CallMonitor = () => {
    const [activeCalls, setActiveCalls] = useState([]);
    const [workflowStats, setWorkflowStats] = useState({
        totalCalls: 0,
        successRate: 0,
        avgDuration: 0,
        completedCalls: 0
    });
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Listen for workflow call events
        socket.on('workflow_call_started', (data) => {
            setActiveCalls(prev => [...prev, {
                id: data.callSid,
                industry: data.industry,
                workflowId: data.workflowId,
                status: 'active',
                currentNode: data.startNode,
                startTime: data.timestamp || Date.now()
            }]);
        });

        socket.on('workflow_call_node', (data) => {
            setActiveCalls(prev => prev.map(call =>
                call.id === data.callSid
                    ? { ...call, currentNode: data.nodeType, lastUpdate: data.timestamp || Date.now() }
                    : call
            ));
        });

        socket.on('workflow_call_completed', (data) => {
            setActiveCalls(prev => prev.filter(call => call.id !== data.callSid));
            setWorkflowStats(prev => ({
                ...prev,
                completedCalls: prev.completedCalls + 1,
                totalCalls: prev.totalCalls + 1
            }));
        });

        socket.on('workflow_stats_update', (data) => {
            setWorkflowStats(prev => ({ ...prev, ...data }));
        });

        socket.on('ivr_workflow_update', (data) => {
            // Handle generic updates if needed
            console.log('IVR Workflow update:', data);
        });

        return () => {
            socket.off('workflow_call_started');
            socket.off('workflow_call_node');
            socket.off('workflow_call_completed');
            socket.off('workflow_stats_update');
            socket.off('ivr_workflow_update');
        };
    }, [socket]);

    return (
        <div className="call-monitor">
            <div className="monitor-header">
                <h3>📞 Live Call Monitoring</h3>
                <span className="live-indicator">LIVE</span>
            </div>

            <div className="monitor-grid">
                {/* Active Calls Section */}
                <div className="active-calls-section">
                    <div className="section-header">
                        <h4>Active Calls ({activeCalls.length})</h4>
                    </div>
                    <div className="calls-list">
                        {activeCalls.length === 0 ? (
                            <div className="empty-calls">No active calls at the moment</div>
                        ) : (
                            activeCalls.map(call => (
                                <div key={call.id} className="call-monitor-card">
                                    <div className="call-header">
                                        <span className="call-id">#{call.id.substring(0, 8)}...</span>
                                        <span className="industry-tag">{call.industry || 'custom'}</span>
                                    </div>
                                    <div className="call-details">
                                        <div className="detail-item">
                                            <span className="label">Node:</span>
                                            <span className="value">{call.currentNode}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Duration:</span>
                                            <span className="value">
                                                {Math.floor((Date.now() - new Date(call.startTime)) / 1000)}s
                                            </span>
                                        </div>
                                    </div>
                                    <div className="call-progress-bar">
                                        <div className="progress-fill" style={{ width: '40%' }}></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

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
