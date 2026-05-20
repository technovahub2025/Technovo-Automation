import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    clearSidebarPageCache,
    writeSidebarPageCache
} from '../utils/sidebarPageCache';
import './Dashboard.css';
import { toAppPath } from '../utils/appRouteBase';

const DASHBOARD_LOADING_TIMEOUT_MS = 8000;
const BROADCAST_DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;
const BROADCAST_DASHBOARD_FALLBACK_COOLDOWN_MS = 30 * 1000;
const BROADCAST_DASHBOARD_CACHE_NAMESPACE = 'broadcast-dashboard';

const sanitizeDashboardAnalytics = (analytics = {}) => {
    if (!analytics || typeof analytics !== 'object') return {};
    try {
        return JSON.parse(JSON.stringify(analytics));
    } catch {
        return {};
    }
};

const getBroadcastMetricValue = (broadcast = {}, key) => {
    const directValue = Number(broadcast?.[key]);
    if (Number.isFinite(directValue)) {
        return directValue;
    }
    const nestedStats = broadcast?.stats && typeof broadcast.stats === 'object'
        ? broadcast.stats
        : {};
    const nestedValue = Number(nestedStats?.[key] || nestedStats?.[`${key}Count`] || 0);
    return Number.isFinite(nestedValue) ? nestedValue : 0;
};

const getBroadcastSentCount = (broadcast = {}) => {
    const statsSent = getBroadcastMetricValue(broadcast, 'sent');
    return statsSent;
};

const aggregateBroadcastMetrics = (broadcasts = []) => {
    const totals = Array.isArray(broadcasts) ? broadcasts.reduce(
        (accumulator, broadcast) => {
            accumulator.messagesSent += getBroadcastSentCount(broadcast);
            accumulator.messagesDelivered += getBroadcastMetricValue(broadcast, 'delivered');
            accumulator.messagesRead += getBroadcastMetricValue(broadcast, 'read');
            accumulator.messagesFailed += getBroadcastMetricValue(broadcast, 'failed');
            accumulator.messagesReplied += getBroadcastMetricValue(broadcast, 'replied');
            return accumulator;
        },
        {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesRead: 0,
            messagesFailed: 0,
            messagesReplied: 0
        }
    ) : {
        messagesSent: 0,
        messagesDelivered: 0,
        messagesRead: 0,
        messagesFailed: 0,
        messagesReplied: 0
    };

    const deliveryRate =
        totals.messagesSent > 0
            ? (totals.messagesDelivered / totals.messagesSent) * 100
            : 0;
    const readRate =
        totals.messagesSent > 0
            ? (totals.messagesRead / totals.messagesSent) * 100
            : 0;
    const failureRate =
        totals.messagesSent > 0
            ? (totals.messagesFailed / totals.messagesSent) * 100
            : 0;

    return {
        ...totals,
        performanceMetrics: {
            deliveryRate: `${deliveryRate.toFixed(1)}%`,
            readRate: `${readRate.toFixed(1)}%`,
            avgDeliveryTime: 'N/A',
            avgReadTime: 'N/A',
            peakHour: 'N/A',
            bestDay: 'N/A'
        },
        responseRate: Number(readRate.toFixed(1)),
        customerSatisfaction: 0,
        failedGrowth: '0',
        sentGrowth: '0',
        deliveredGrowth: '0',
        readRateGrowth: '0',
        failureRate
    };
};

const createEmptyAnalytics = () => ({
    totalConversations: 0,
    activeConversations: 0,
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    messagesFailed: 0,
    messagesReceived: 0,
    avgResponseTime: 'N/A',
    responseRate: 0,
    customerSatisfaction: 0,
    sentGrowth: '0',
    deliveredGrowth: '0',
    readRateGrowth: '0',
    failedGrowth: '0',
    dailyTrends: [],
    hourlyActivity: [],
    messageTypes: [],
    performanceMetrics: {
        avgDeliveryTime: 'N/A',
        avgReadTime: 'N/A',
        peakHour: 'N/A',
        bestDay: 'N/A',
        deliveryRate: '0.0%',
        readRate: '0.0%'
    }
});

const isMeaningfulAnalytics = (analytics = {}) => {
    const source = analytics?.overview && typeof analytics.overview === 'object'
        ? analytics.overview
        : analytics;
    const sent = Number(source?.messagesSent || 0);
    const delivered = Number(source?.messagesDelivered || 0);
    const read = Number(source?.messagesRead || 0);
    const failed = Number(source?.messagesFailed || source?.failedMessages || 0);
    return sent > 0 || delivered > 0 || read > 0 || failed > 0;
};

const normalizeDashboardAnalytics = (raw = {}, broadcastMetrics = {}) => {
    const source = raw?.overview && typeof raw.overview === 'object'
        ? raw.overview
        : raw;
    const performanceMetrics =
        raw?.performanceMetrics && typeof raw.performanceMetrics === 'object'
            ? raw.performanceMetrics
            : {};
    const growth =
        raw?.growth && typeof raw.growth === 'object'
            ? raw.growth
            : {};

    return {
        ...createEmptyAnalytics(),
        ...raw,
        ...source,
        messagesSent: Number(
            broadcastMetrics?.messagesSent ??
            source?.messagesSent ??
            source?.sentMessages ??
            0
        ),
        messagesDelivered: Number(
            broadcastMetrics?.messagesDelivered ??
            source?.messagesDelivered ??
            0
        ),
        messagesRead: Number(
            broadcastMetrics?.messagesRead ??
            source?.messagesRead ??
            0
        ),
        messagesFailed: Number(
            broadcastMetrics?.messagesFailed ??
            source?.messagesFailed ??
            source?.failedMessages ??
            0
        ),
        activeConversations: Number(source?.activeConversations || 0),
        totalConversations: Number(source?.totalConversations || 0),
        messagesReceived: Number(source?.messagesReceived || 0),
        avgResponseTime: source?.avgResponseTime || raw?.avgResponseTime || 'N/A',
        responseRate: Number(source?.responseRate || raw?.responseRate || 0),
        customerSatisfaction: Number(source?.customerSatisfaction || raw?.customerSatisfaction || 0),
        sentGrowth: String(growth?.sentGrowth ?? raw?.sentGrowth ?? '0'),
        deliveredGrowth: String(growth?.deliveredGrowth ?? raw?.deliveredGrowth ?? '0'),
        readRateGrowth: String(growth?.readRateGrowth ?? raw?.readRateGrowth ?? '0'),
        failedGrowth: String(growth?.failedGrowth ?? raw?.failedGrowth ?? '0'),
        dailyTrends: Array.isArray(raw?.dailyTrends) ? raw.dailyTrends : [],
        hourlyActivity: Array.isArray(raw?.hourlyActivity) ? raw.hourlyActivity : [],
        messageTypes: Array.isArray(raw?.messageTypes) ? raw.messageTypes : [],
        performanceMetrics: {
            ...createEmptyAnalytics().performanceMetrics,
            ...performanceMetrics,
            avgDeliveryTime: performanceMetrics.avgDeliveryTime || source?.avgDeliveryTime || 'N/A',
            avgReadTime: performanceMetrics.avgReadTime || source?.avgReadTime || 'N/A',
            peakHour: performanceMetrics.peakHour || source?.peakHour || 'N/A',
            bestDay: performanceMetrics.bestDay || source?.bestDay || 'N/A',
            deliveryRate:
                performanceMetrics.deliveryRate ||
                broadcastMetrics?.performanceMetrics?.deliveryRate ||
                `${Number(source?.responseRate || 0)}%`,
            readRate:
                performanceMetrics.readRate ||
                broadcastMetrics?.performanceMetrics?.readRate ||
                `${Number(source?.readRate || 0)}%`
        }
    };
};

const BroadcastDashboard = () => {
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);
    const refreshTimerRef = useRef(null);
    const dashboardLoadInFlightRef = useRef(false);
    const fallbackFailureAtRef = useRef(0);
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
        if (dashboardLoadInFlightRef.current) {
            return;
        }
        dashboardLoadInFlightRef.current = true;
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

            const [analyticsResult, broadcastsResult] = await Promise.allSettled([
                whatsappService.getAnalytics(),
                whatsappService.getBroadcasts()
            ]);
            const analyticsData =
                analyticsResult.status === 'fulfilled' ? analyticsResult.value : {};
            const broadcastsData =
                broadcastsResult.status === 'fulfilled' && Array.isArray(broadcastsResult.value)
                    ? broadcastsResult.value
                    : [];
            const broadcastMetrics = aggregateBroadcastMetrics(broadcastsData);
            let nextAnalytics = normalizeDashboardAnalytics(analyticsData || {}, broadcastMetrics);
            const fallbackCooldownActive =
                Date.now() - Number(fallbackFailureAtRef.current || 0) < BROADCAST_DASHBOARD_FALLBACK_COOLDOWN_MS;
            if (!isMeaningfulAnalytics(nextAnalytics)) {
                if (silent) {
                    return;
                }
                if (fallbackCooldownActive) {
                    nextAnalytics = normalizeDashboardAnalytics(createEmptyAnalytics(), broadcastMetrics);
                } else {
                    fallbackFailureAtRef.current = Date.now();
                    nextAnalytics = normalizeDashboardAnalytics(createEmptyAnalytics(), broadcastMetrics);
                }
            }
            setAnalytics(nextAnalytics);
            persistDashboardCache(nextAnalytics);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            releaseLoadingGuard();
            dashboardLoadInFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, [persistDashboardCache]);

    useEffect(() => {
        const cachedDashboard = readSidebarPageCache(BROADCAST_DASHBOARD_CACHE_NAMESPACE, {
            currentUserId,
            allowStale: true
        });

        const cachedAnalytics = cachedDashboard?.data?.analytics;
        if (isMeaningfulAnalytics(cachedAnalytics)) {
            setAnalytics(cachedAnalytics);
            setLoading(false);
            loadDashboardData({ silent: true });
            return;
        }

        if (cachedDashboard?.key) {
            clearSidebarPageCache(BROADCAST_DASHBOARD_CACHE_NAMESPACE, { currentUserId });
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
        if (socket && typeof socket.catch === 'function') {
            socket.catch((error) => {
                console.warn(
                    'Broadcast dashboard WebSocket connect failed:',
                    error?.message || error,
                );
            });
        }
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

    const getAnalyticsSource = () => {
        if (analytics?.overview && typeof analytics.overview === 'object') {
            return analytics.overview;
        }
        return analytics || {};
    };

    const getMessageSentCount = () => {
        const source = getAnalyticsSource();
        return Number(source.messagesSent || 0);
    };

    const getDeliveredCount = () => {
        const source = getAnalyticsSource();
        return Number(source.messagesDelivered || 0);
    };

    const getReadCount = () => {
        const source = getAnalyticsSource();
        return Number(source.messagesRead || 0);
    };

    const getFailedCount = () => {
        const source = getAnalyticsSource();
        return Number(source.messagesFailed || source.failedMessages || 0);
    };

    const getSuccessRate = () => {
        const source = getAnalyticsSource();
        const total = Number(source.messagesSent || 0);
        const failed = Number(source.messagesFailed || source.failedMessages || 0);
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
                                    <div className="dashboard-metric-value">{getAnalyticsSource().avgResponseTime || 'N/A'}</div>
                                </div>
                                <div className="dashboard-metric-item">
                                    <div className="dashboard-metric-label">Response Rate</div>
                                    <div className="dashboard-metric-value">{getAnalyticsSource().responseRate || 0}%</div>
                                </div>
                                <div className="dashboard-metric-item">
                                    <div className="dashboard-metric-label">Customer Satisfaction</div>
                                    <div className="dashboard-metric-value">{getAnalyticsSource().customerSatisfaction || 0}/5</div>
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
