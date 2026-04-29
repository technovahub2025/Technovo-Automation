import React, { useState, useEffect, useCallback } from 'react';
import { Send, CheckCircle, Eye, AlertCircle, Plus, TrendingUp } from 'lucide-react';
import StatCard from '../components/StatCard';
import RecentChats from '../components/RecentChats';
import MessageAnalytics from '../components/MessageAnalytics';
import { whatsappService } from '../services/whatsappService';
import webSocketService from '../services/websocketService';
import { startLoadingTimeoutGuard } from '../utils/loadingGuard';
import {
    readSidebarPageCache,
    resolveCacheUserId,
    writeSidebarPageCache
} from '../utils/sidebarPageCache';
import './Dashboard.css';
import { toAppPath } from '../utils/appRouteBase';

const DASHBOARD_LOADING_TIMEOUT_MS = 8000;
const BROADCAST_DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;
const BROADCAST_DASHBOARD_CACHE_NAMESPACE = 'broadcast-dashboard';

const sanitizeDashboardAnalytics = (analytics = {}) => {
    if (!analytics || typeof analytics !== 'object') return {};
    try {
        return JSON.parse(JSON.stringify(analytics));
    } catch {
        return {};
    }
};

const BroadcastDashboard = () => {
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
    const refreshTimerRef = useRef(null);
    const currentUserId = resolveCacheUserId();

    const persistDashboardCache = useCallback((nextAnalytics) => {
        writeSidebarPageCache(
            BROADCAST_DASHBOARD_CACHE_NAMESPACE,
            { analytics: sanitizeDashboardAnalytics(nextAnalytics) },
            {
                currentUserId,
                ttlMs: BROADCAST_DASHBOARD_CACHE_TTL_MS
            }
        );
    }, [currentUserId]);

    const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
        const releaseLoadingGuard = startLoadingTimeoutGuard(
            () => {
                if (silent) setRefreshing(false);
                else setLoading(false);
            },
            DASHBOARD_LOADING_TIMEOUT_MS
        );
        try {
            if (silent) setRefreshing(true);
            else setLoading(true);

            const analyticsData = await whatsappService.getAnalytics();
            const nextAnalytics = analyticsData || {};
            setAnalytics(nextAnalytics);
            persistDashboardCache(nextAnalytics);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            releaseLoadingGuard();
            setLoading(false);
            setRefreshing(false);
        }
    }, [persistDashboardCache]);

    useEffect(() => {
        const cachedDashboard = readSidebarPageCache(BROADCAST_DASHBOARD_CACHE_NAMESPACE, {
            currentUserId,
            allowStale: true
        });

        if (cachedDashboard?.data?.analytics) {
            setAnalytics(cachedDashboard.data.analytics);
            setLoading(false);
            loadDashboardData({ silent: true });
            return;
        }

        loadDashboardData();
    }, [currentUserId, loadDashboardData]);

    useEffect(() => {
        if (!showDetailedAnalytics) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setShowDetailedAnalytics(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showDetailedAnalytics]);

    const refreshData = async () => {
        await loadDashboardData({ silent: true });
    };

    useEffect(() => {
        const scheduleRefresh = () => {
            if (refreshTimerRef.current) {
                window.clearTimeout(refreshTimerRef.current);
            }
            refreshTimerRef.current = window.setTimeout(() => {
                loadDashboardData({ silent: true });
            }, 150);
        };

        const socket = webSocketService.connect(currentUserId || 'broadcast-dashboard');
        if (!socket) return undefined;

        const handleRealtimeUpdate = () => scheduleRefresh();
        webSocketService.on('broadcast_created', handleRealtimeUpdate);
        webSocketService.on('broadcast_updated', handleRealtimeUpdate);
        webSocketService.on('broadcast_deleted', handleRealtimeUpdate);
        webSocketService.on('broadcast_stats_updated', handleRealtimeUpdate);

        return () => {
            webSocketService.off('broadcast_created', handleRealtimeUpdate);
            webSocketService.off('broadcast_updated', handleRealtimeUpdate);
            webSocketService.off('broadcast_deleted', handleRealtimeUpdate);
            webSocketService.off('broadcast_stats_updated', handleRealtimeUpdate);
            if (refreshTimerRef.current) {
                window.clearTimeout(refreshTimerRef.current);
            }
        };
    }, [currentUserId, loadDashboardData]);

    const getMessageSentCount = () => {
        return analytics.messagesSent || 0;
    };

    const getDeliveredCount = () => {
        return analytics.messagesDelivered || 0;
    };

    const getReadRate = () => {
        const total = analytics.messagesSent || 0;
        const read = analytics.messagesRead || 0;
        if (total === 0) return '0%';
        return `${Math.round((read / total) * 100)}%`;
    };

    const getReadCount = () => {
        return analytics.messagesRead || 0;
    };

    const getFailedCount = () => {
        return analytics.messagesFailed || 0;
    };

    const getSuccessRate = () => {
        const total = analytics.messagesSent || 0;
        const failed = analytics.messagesFailed || 0;
        if (total === 0) return '0%';
        const success = total - failed;
        return `${Math.round((success / total) * 100)}%`;
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toLocaleString();
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="dashboard">
                <div className="welcome-banner">
                    <div>
                        <h1>Broadcast Dashboard</h1>
                        <p>Here's what's happening with your WhatsApp platform today.</p>
                    </div>
                    <button className="primary-btn dashboard-new-broadcast-btn" onClick={() => { window.location.href = toAppPath('/broadcast'); }}>
                        <Plus size={18} />
                        New Broadcast
                    </button>
                </div>

                <div className="stats-grid">
                    <StatCard
                        title="Message Sent"
                        value={formatNumber(getMessageSentCount())}
                        change={analytics.sentGrowth || '0'}
                        isPositive={true}
                        icon={Send}
                        color="#25D366"
                    />
                    <StatCard
                        title="Delivered"
                        value={formatNumber(getDeliveredCount())}
                        change={analytics.deliveredGrowth || '0'}
                        isPositive={true}
                        icon={CheckCircle}
                        color="#34B7F1"
                    />
                    <StatCard
                        title="Read"
                        value={formatNumber(getReadCount())}
                        change={analytics.readRateGrowth || '0'}
                        isPositive={true}
                        icon={Eye}
                        color="#2563eb"
                    />
                    <StatCard
                        title="Failed"
                        value={formatNumber(getFailedCount())}
                        change={analytics.failedGrowth || '0'}
                        isPositive={false}
                        icon={AlertCircle}
                        color="#ef4444"
                    />
                </div>

                <div className="dashboard-content-grid">
                    <div className="main-chart-area">
                        <div className="widget-card">
                            <h3>Performance Metrics</h3>
                            <div className="dashboard-metrics-grid">
                                <div className="dashboard-metric-item">
                                    <div className="dashboard-metric-label">Avg Response Time</div>
                                    <div className="dashboard-metric-value">{analytics.avgResponseTime || 'N/A'}</div>
                                </div>
                                <div className="dashboard-metric-item">
                                    <div className="dashboard-metric-label">Response Rate</div>
                                    <div className="dashboard-metric-value">{analytics.responseRate || 0}%</div>
                                </div>
                                <div className="dashboard-metric-item">
                                    <div className="dashboard-metric-label">Customer Satisfaction</div>
                                    <div className="dashboard-metric-value">{analytics.customerSatisfaction || 0}/5</div>
                                </div>
                            </div>
                        </div>
                        <RecentChats />
                    </div>

                    <div className="side-widgets">
                        <div className="widget-card">
                            <div className="widget-header">
                                <h3>Message Analytics</h3>
                                <button
                                    className="view-all-btn"
                                    onClick={() => setShowDetailedAnalytics(true)}
                                >
                                    Show More
                                </button>
                            </div>

                            <div className="activity-stats">
                                <div className="activity-item">
                                    <Send size={16} />
                                    <span>Sent: {formatNumber(getMessageSentCount())} messages</span>
                                </div>
                                <div className="activity-item">
                                    <CheckCircle size={16} />
                                    <span>Delivered: {formatNumber(getDeliveredCount())} messages</span>
                                </div>
                                <div className="activity-item">
                                    <Eye size={16} />
                                    <span>Read: {formatNumber(getReadCount())} messages</span>
                                </div>
                                <div className="activity-item">
                                    <AlertCircle size={16} />
                                    <span>Failed: {formatNumber(getFailedCount())} messages</span>
                                </div>
                                <div className="activity-item">
                                    <TrendingUp size={16} />
                                    <span>Success Rate: {getSuccessRate()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="widget-card">
                            <h3>System Status</h3>
                            <div className="status-item">
                                <span className="dot online"></span>
                                <span>WhatsApp API Connected</span>
                            </div>
                            <div className="status-item">
                                <span className="dot online"></span>
                                <span>Webhook Active</span>
                            </div>
                            <div className="status-item">
                                <span className="dot online"></span>
                                <span>Database Connected</span>
                            </div>
                        </div>

                        <div className="widget-card">
                            <h3>Quick Actions</h3>
                            <button className="dashboard-action-btn" onClick={refreshData} disabled={refreshing}>
                                {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
                            </button>
                            <button className="dashboard-action-btn" onClick={() => { window.location.href = toAppPath('/inbox'); }}>
                                View All Conversations
                            </button>
                            <button className="dashboard-action-btn" onClick={() => { window.location.href = toAppPath('/broadcast'); }}>
                                Create Broadcast
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showDetailedAnalytics && (
                <div
                    className="dashboard-modal-overlay"
                    onClick={() => setShowDetailedAnalytics(false)}
                    role="presentation"
                >
                    <div
                        className="dashboard-modal-content"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Detailed message analytics"
                    >
                        <button
                            className="dashboard-modal-close"
                            onClick={() => setShowDetailedAnalytics(false)}
                            aria-label="Close analytics popup"
                        >
                            &times;
                        </button>
                        <MessageAnalytics overviewData={analytics} />
                    </div>
                </div>
            )}
        </>
    );
};

export default BroadcastDashboard;

