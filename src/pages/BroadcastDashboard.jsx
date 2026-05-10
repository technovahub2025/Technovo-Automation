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
const BROADCAST_DASHBOARD_CACHE_NAMESPACE = 'broadcast-dashboard';

const sanitizeDashboardAnalytics = (analytics = {}) => {
    if (!analytics || typeof analytics !== 'object') return {};
    try {
        return JSON.parse(JSON.stringify(analytics));
    } catch {
        return {};
    }
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
    const sent = Number(analytics?.messagesSent || 0);
    const delivered = Number(analytics?.messagesDelivered || 0);
    const read = Number(analytics?.messagesRead || 0);
    const failed = Number(analytics?.messagesFailed || 0);
    return sent > 0 || delivered > 0 || read > 0 || failed > 0;
};

const buildFallbackAnalytics = async () => {
    try {
        const conversations = await whatsappService.getConversations();
        if (!Array.isArray(conversations) || conversations.length === 0) {
            return createEmptyAnalytics();
        }

        const conversationIds = conversations
            .map((conversation) => conversation?._id)
            .filter(Boolean)
            .slice(0, 200);

        if (conversationIds.length === 0) {
            return {
                ...createEmptyAnalytics(),
                totalConversations: conversations.length,
                activeConversations: conversations.filter((conversation) => conversation?.status === 'active').length
            };
        }

        const messageLists = await Promise.all(
            conversationIds.map((conversationId) => whatsappService.getMessages(conversationId))
        );
        const allMessages = messageLists.flat().filter(Boolean);
        const outboundMessages = allMessages.filter((message) => {
            const status = String(message?.status || '').toLowerCase();
            return message?.sender === 'agent' || ['sent', 'delivered', 'read', 'failed'].includes(status);
        });
        const inboundMessages = allMessages.filter((message) => {
            const status = String(message?.status || '').toLowerCase();
            return message?.sender === 'contact' || status === 'received';
        });

        const now = new Date();
        const startOfWindow = new Date();
        startOfWindow.setDate(startOfWindow.getDate() - 6);
        startOfWindow.setHours(0, 0, 0, 0);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyMap = new Map();
        const dailyConversationSets = new Map();
        for (let i = 6; i >= 0; i -= 1) {
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - i);
            const key = day.toISOString().slice(0, 10);
            dailyMap.set(key, { date: dayNames[day.getDay()], sent: 0, delivered: 0, read: 0, conversations: 0 });
            dailyConversationSets.set(key, new Set());
        }

        outboundMessages.forEach((message) => {
            const timestamp = new Date(message?.timestamp || message?.createdAt || 0);
            if (Number.isNaN(timestamp.getTime()) || timestamp < startOfWindow) return;
            const key = timestamp.toISOString().slice(0, 10);
            const bucket = dailyMap.get(key);
            if (!bucket) return;

            bucket.sent += 1;
            const status = String(message?.status || '').toLowerCase();
            if (status === 'delivered' || status === 'read') {
                bucket.delivered += 1;
            }
            if (status === 'read') {
                bucket.read += 1;
            }
            if (message?.conversationId) {
                dailyConversationSets.get(key)?.add(String(message.conversationId));
            }
        });

        const dailyTrends = Array.from(dailyMap.entries()).map(([key, value]) => ({
            ...value,
            conversations: dailyConversationSets.get(key)?.size || 0
        }));

        const hourlyMap = new Map();
        const hourlyConversationSets = new Map();
        for (let i = 11; i >= 0; i -= 1) {
            const hour = new Date(now);
            hour.setMinutes(0, 0, 0);
            hour.setHours(hour.getHours() - i);
            const key = hour.toISOString().slice(0, 13);
            hourlyMap.set(key, { hour: hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }), messages: 0, conversations: 0 });
            hourlyConversationSets.set(key, new Set());
        }

        outboundMessages.forEach((message) => {
            const timestamp = new Date(message?.timestamp || message?.createdAt || 0);
            if (Number.isNaN(timestamp.getTime())) return;
            timestamp.setMinutes(0, 0, 0);
            const key = timestamp.toISOString().slice(0, 13);
            const bucket = hourlyMap.get(key);
            if (!bucket) return;

            bucket.messages += 1;
            if (message?.conversationId) {
                hourlyConversationSets.get(key)?.add(String(message.conversationId));
            }
        });

        const hourlyActivity = Array.from(hourlyMap.entries()).map(([key, value]) => ({
            ...value,
            conversations: hourlyConversationSets.get(key)?.size || 0
        }));

        const messageTypeCounts = {
            text: 0,
            image: 0,
            video: 0,
            audio: 0,
            document: 0
        };
        outboundMessages.forEach((message) => {
            const mediaType = String(message?.mediaType || 'text').toLowerCase();
            if (Object.prototype.hasOwnProperty.call(messageTypeCounts, mediaType)) {
                messageTypeCounts[mediaType] += 1;
            } else {
                messageTypeCounts.text += 1;
            }
        });

        const messagesSent = outboundMessages.length;
        const messagesDelivered = outboundMessages.filter((message) => {
            const status = String(message?.status || '').toLowerCase();
            return status === 'delivered' || status === 'read';
        }).length;
        const messagesRead = outboundMessages.filter((message) => String(message?.status || '').toLowerCase() === 'read').length;
        const messagesFailed = outboundMessages.filter((message) => String(message?.status || '').toLowerCase() === 'failed').length;
        const messagesReceived = inboundMessages.filter((message) => {
            const timestamp = new Date(message?.timestamp || message?.createdAt || 0);
            return !Number.isNaN(timestamp.getTime()) && timestamp >= startOfWindow;
        }).length;

        const deliveryRate = messagesSent > 0 ? `${((messagesDelivered / messagesSent) * 100).toFixed(1)}%` : '0.0%';
        const readRate = messagesSent > 0 ? `${((messagesRead / messagesSent) * 100).toFixed(1)}%` : '0.0%';
        const peakHour = hourlyActivity.reduce(
            (max, item) => (item.messages > max.messages ? item : max),
            { hour: 'N/A', messages: 0 }
        ).hour;
        const bestDay = dailyTrends.reduce(
            (max, item) => (item.sent > max.sent ? item : max),
            { date: 'N/A', sent: 0 }
        ).date;

        return {
            totalConversations: conversations.length,
            activeConversations: conversations.filter((conversation) => conversation?.status === 'active').length,
            messagesSent,
            messagesDelivered,
            messagesRead,
            messagesFailed,
            messagesReceived,
            avgResponseTime: 'N/A',
            responseRate: messagesSent > 0 ? Math.round((messagesRead / messagesSent) * 100) : 0,
            customerSatisfaction: 0,
            sentGrowth: '0',
            deliveredGrowth: '0',
            readRateGrowth: '0',
            failedGrowth: '0',
            dailyTrends,
            hourlyActivity,
            messageTypes: [
                { name: 'Text Messages', value: messageTypeCounts.text, color: '#3b82f6' },
                { name: 'Image Messages', value: messageTypeCounts.image, color: '#2563eb' },
                { name: 'Video Messages', value: messageTypeCounts.video, color: '#f59e0b' },
                {
                    name: 'Document/Audio',
                    value: messageTypeCounts.document + messageTypeCounts.audio,
                    color: '#8b5cf6'
                }
            ],
            performanceMetrics: {
                avgDeliveryTime: 'N/A',
                avgReadTime: 'N/A',
                peakHour,
                bestDay,
                deliveryRate,
                readRate
            }
        };
    } catch (error) {
        console.error('Failed to build fallback dashboard analytics:', error);
        return createEmptyAnalytics();
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
            let nextAnalytics = analyticsData || {};
            if (!isMeaningfulAnalytics(nextAnalytics)) {
                const fallbackAnalytics = await buildFallbackAnalytics();
                if (isMeaningfulAnalytics(fallbackAnalytics)) {
                    nextAnalytics = fallbackAnalytics;
                }
            }
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
