import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from "axios";
import { AuthContext } from '../pages/authcontext';
import { whatsappService } from '../services/whatsappService';
import { googleCalendarService } from '../services/googleCalendarService';
import { resolveApiBaseUrl } from '../services/apiBaseUrl';
import {
    buildGoogleOAuthTrustedOrigins,
    isGoogleOAuthEventOriginTrusted,
    isOAuthPopupOpen,
    resolveGoogleOAuthEvent
} from '../utils/googleOAuthEvents';
import {
    LayoutDashboard,
    MessageSquare,
    Radio,
    Users,
    Zap,
    LogOut,
    FileText,
    Phone,
    PhoneMissed,
    Mail,
    LogIn,
    MessageCircle,
    Settings,
    CalendarDays,
    Megaphone,
    BarChart3,
    Facebook,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    PhoneIncoming,
    PhoneOutgoing,
    LineChart
} from 'lucide-react';
import logo from '../../src/assets/logo.png';
import './Sidebar.css';
import { stripAppRouteBase } from '../utils/appRouteBase';

const ROUTE_PREFETCHERS = {
    '/': () => import('../pages/Dashboard'),
    '/broadcast-dashboard': () => import('../pages/BroadcastDashboard'),
    '/inbox': () => import('../pages/TeamInbox'),
    '/broadcast': () => import('../pages/Broadcast'),
    '/templates': () => import('../pages/Templates'),
    '/contacts': () => import('../pages/Contacts'),
    '/crm/pipeline': () => import('../pages/CrmPipeline'),
    '/crm/tasks': () => import('../pages/CrmTasks'),
    '/ads-manager': () => import('../pages/campaignmanagement'),
    '/insights': () => import('../pages/Insights'),
    '/meta-connect': () => import('../pages/MetaConnect'),
    '/whatsapp-workflow': () => import('../pages/WhatsAppWorkflow'),
    '/voice-automation': () => import('../components/inbound/InboundCalls'),
    '/voice-automation/inbound': () => import('../components/inbound/InboundCalls'),
    '/voice-automation/outbound': () => import('../components/outbound/OutboundCall'),
    '/voice-automation/outbound/schedules': () => import('../components/outbound/OutboundSchedules'),
    '/voice-automation/history': () => import('../components/inbound/ivr/CallAnalytics'),
    '/missedcalls/overview': () => import('../pages/MissedCallsOverviewPage'),
    '/email-automation': () => import('../pages/EmailAutomation'),
};

const defaultGoogleCalendarStatus = {
    connected: false,
    hasBackendGoogleAuth: false,
    source: 'none',
    envMode: 'none',
    profile: {
        email: '',
        name: '',
        picture: ''
    },
    connectionMeta: {
        connectedAt: null,
        expiresAt: null,
        hasRefreshToken: false
    }
};

const Sidebar = ({ expandedPanel, setExpandedPanel, lastBulkMessageItem, setLastBulkMessageItem }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const currentPath = stripAppRouteBase(location.pathname);

    // Use prop state instead of local
    const openMenu = expandedPanel;

    // Responsive state
    const [isMobile, setIsMobile] = useState(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [isCompactMobile, setIsCompactMobile] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [flyoutTop, setFlyoutTop] = useState(120);
    const [showLeadScoringModal, setShowLeadScoringModal] = useState(false);
    const [leadScoringLoading, setLeadScoringLoading] = useState(false);
    const [leadScoringSaving, setLeadScoringSaving] = useState(false);
    const [leadScoringMessage, setLeadScoringMessage] = useState('');
    const [leadScoringMessageTone, setLeadScoringMessageTone] = useState('info');
    const [leadScoringForm, setLeadScoringForm] = useState({
        isEnabled: true,
        readScore: '2',
        replyScore: '5',
        keywordRules: [{ keyword: '', score: '1' }]
    });
    const [showGoogleCalendarModal, setShowGoogleCalendarModal] = useState(false);
    const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false);
    const [googleCalendarConnecting, setGoogleCalendarConnecting] = useState(false);
    const [googleCalendarDisconnecting, setGoogleCalendarDisconnecting] = useState(false);
    const [googleCalendarMessage, setGoogleCalendarMessage] = useState('');
    const [googleCalendarMessageTone, setGoogleCalendarMessageTone] = useState('info');
    const [googleCalendarStatus, setGoogleCalendarStatus] = useState(defaultGoogleCalendarStatus);
    const closeTimerRef = useRef(null);
    const prefetchedRoutesRef = useRef(new Set());
    const googleOAuthPopupRef = useRef(null);

    // Wrapper to handle closing logic if needed
    const setOpenMenu = (menuName) => {
        if (setExpandedPanel) {
            setExpandedPanel(menuName);
        }
    };

    // Check screen size and handle responsive behavior
    useEffect(() => {
        const checkScreenSize = () => {
            const width = window.innerWidth;
            const wasMobile = isMobile;
            const wasCompactMobile = isCompactMobile;
            const mobile = width <= 1024;
            const compactMobile = width <= 1024;

            setIsMobile(mobile);
            setIsCompactMobile(compactMobile);
            
            // Handle mobile overlay behavior
            if (mobile) {
                if (!wasMobile && openMenu) {
                    // Switch to overlay mode
                    setIsOverlayOpen(true);
                }
            } else {
                // Desktop mode - close overlay
                setIsOverlayOpen(false);
                setIsMobileSidebarOpen(false);
            }

            // Compact mobile: collapse only when entering compact mode
            if (!wasCompactMobile && compactMobile) {
                setIsMobileSidebarOpen(false);
                setIsOverlayOpen(false);
                if (openMenu && setExpandedPanel) {
                    setExpandedPanel(null);
                }
            }
        };

        // Initial check
        checkScreenSize();

        // Add resize listener
        window.addEventListener('resize', checkScreenSize);

        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize);
    }, [openMenu, isMobile, isCompactMobile, setExpandedPanel]);

    const isLoggedIn = !!user;
    const userName = user?.username || user?.name || "Guest";
    const userRole = user?.role || "guest";
    const isSuperAdmin = userRole === "superadmin";
    const subscriptionStatus = String(user?.subscriptionStatus || '').toLowerCase();
    const workspaceAccessState = String(user?.workspaceAccessState || '').toLowerCase();
    const featureFlags = user?.featureFlags || {};
    const canViewAnalytics = user?.canViewAnalytics !== false;
    const canUseMetaAds = isSuperAdmin || Boolean(featureFlags.adsManager || featureFlags.analytics || featureFlags.metaConnect);
    const canUseBroadcast = isSuperAdmin || Boolean(
        featureFlags.broadcastDashboard ||
        featureFlags.teamInbox ||
        featureFlags.broadcastMessaging ||
        featureFlags.templates ||
        featureFlags.contacts
    );
    const canUseVoiceAutomation = isSuperAdmin || Boolean(
        featureFlags.voiceCampaign ||
        featureFlags.inboundAutomation ||
        featureFlags.outboundVoice ||
        featureFlags.callAnalytics
    );
    const canUseMissedCalls = isSuperAdmin || Boolean(featureFlags.missedCall);
    const canUseEmailAutomation = isSuperAdmin || Boolean(featureFlags.workflowAutomation || featureFlags.analytics);
    const canUseWhatsAppWorkflow = isSuperAdmin || Boolean(
        featureFlags.workflowAutomation || featureFlags.teamInbox || featureFlags.broadcastMessaging
    );
    const canUseAdsManager = isSuperAdmin || (Boolean(featureFlags.adsManager) && canViewAnalytics);

    useEffect(() => {
        if (!isLoggedIn && openMenu === 'bulkMessage') {
            setOpenMenu(null);
        }
    }, [isLoggedIn, openMenu]);

    const API_URL = import.meta.env.VITE_API_ADMIN_URL;

    const toSafeNonNegativeNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return fallback;
        return parsed;
    };

    const normalizeKeywordRulesForForm = (rules = []) => {
        const normalized = Array.isArray(rules)
            ? rules
                .map((rule) => ({
                    keyword: String(rule?.keyword || '').trim(),
                    score: String(toSafeNonNegativeNumber(rule?.score, 1))
                }))
                .filter((rule) => rule.keyword)
            : [];

        return normalized.length > 0 ? normalized : [{ keyword: '', score: '1' }];
    };

    const buildLeadScoringFormFromSettings = (settings = {}) => ({
        isEnabled: settings?.isEnabled !== false,
        readScore: String(toSafeNonNegativeNumber(settings?.readScore, 2)),
        replyScore: String(toSafeNonNegativeNumber(settings?.replyScore, 5)),
        keywordRules: normalizeKeywordRulesForForm(settings?.keywordRules || [])
    });

    const getInitials = (name) => {
        if (!name || name === "Guest") return "GU";
        const words = name.split(" ");
        if (words.length === 1) return name.substring(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    };

    const handleLogout = async () => {
        const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
        const token =
            localStorage.getItem(tokenKey) ||
            localStorage.getItem("authToken") ||
            localStorage.getItem(tokenKey) || localStorage.getItem("authToken");

        if (token) {
            try {
                await axios.post(
                    `${API_URL}/api/nexion/logout`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (err) {
                console.log("Logout API failed:", err?.message);
            }
        }

        logout();
        navigate("/login", { replace: true });
    };

    const loadLeadScoringSettings = async () => {
        try {
            setLeadScoringLoading(true);
            setLeadScoringMessage('');
            const result = await whatsappService.getLeadScoringSettings();
            if (result?.success === false) {
                throw new Error(result?.error || 'Failed to load lead scoring settings');
            }
            const settings = result?.data || result || {};
            setLeadScoringForm(buildLeadScoringFormFromSettings(settings));
            if (result?.fallback) {
                setLeadScoringMessage('Backend endpoint is not available yet. Showing default values.');
                setLeadScoringMessageTone('error');
            }
        } catch (error) {
            setLeadScoringMessage(error?.message || 'Failed to load lead scoring settings');
            setLeadScoringMessageTone('error');
        } finally {
            setLeadScoringLoading(false);
        }
    };

    const openLeadScoringModal = async () => {
        setOpenMenu(null);
        if (isMobile) {
            setIsOverlayOpen(false);
            if (isCompactMobile) {
                setIsMobileSidebarOpen(false);
            }
        }
        setShowLeadScoringModal(true);
        await loadLeadScoringSettings();
    };

    const closeLeadScoringModal = () => {
        if (leadScoringSaving) return;
        setShowLeadScoringModal(false);
        setLeadScoringMessage('');
        setLeadScoringMessageTone('info');
    };

    const updateLeadScoringField = (field, value) => {
        setLeadScoringForm((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const updateLeadKeywordRule = (index, field, value) => {
        setLeadScoringForm((prev) => ({
            ...prev,
            keywordRules: prev.keywordRules.map((rule, ruleIndex) =>
                ruleIndex === index
                    ? { ...rule, [field]: value }
                    : rule
            )
        }));
    };

    const addLeadKeywordRule = () => {
        setLeadScoringForm((prev) => ({
            ...prev,
            keywordRules: [...prev.keywordRules, { keyword: '', score: '1' }]
        }));
    };

    const removeLeadKeywordRule = (index) => {
        setLeadScoringForm((prev) => {
            const remainingRules = prev.keywordRules.filter((_, ruleIndex) => ruleIndex !== index);
            return {
                ...prev,
                keywordRules: remainingRules.length > 0 ? remainingRules : [{ keyword: '', score: '1' }]
            };
        });
    };

    const saveLeadScoringSettings = async () => {
        try {
            setLeadScoringSaving(true);
            setLeadScoringMessage('');

            const payload = {
                isEnabled: Boolean(leadScoringForm.isEnabled),
                readScore: toSafeNonNegativeNumber(leadScoringForm.readScore, 0),
                replyScore: toSafeNonNegativeNumber(leadScoringForm.replyScore, 0),
                keywordRules: (leadScoringForm.keywordRules || [])
                    .map((rule) => ({
                        keyword: String(rule?.keyword || '').trim(),
                        score: toSafeNonNegativeNumber(rule?.score, 1)
                    }))
                    .filter((rule) => rule.keyword)
            };

            const result = await whatsappService.updateLeadScoringSettings(payload);
            if (result?.success === false) {
                throw new Error(result?.error || 'Failed to update lead scoring settings');
            }

            setLeadScoringForm(buildLeadScoringFormFromSettings(result?.data || payload));
            setLeadScoringMessage('Lead scoring settings saved successfully.');
            setLeadScoringMessageTone('success');
        } catch (error) {
            setLeadScoringMessage(error?.message || 'Failed to update lead scoring settings');
            setLeadScoringMessageTone('error');
        } finally {
            setLeadScoringSaving(false);
        }
    };

    const loadGoogleCalendarStatus = async () => {
        try {
            setGoogleCalendarLoading(true);
            setGoogleCalendarMessage('');
            const result = await googleCalendarService.getAuthStatus();
            if (result?.success === false) {
                throw new Error(result?.error || 'Failed to load Google Calendar status');
            }
            setGoogleCalendarStatus({
                ...defaultGoogleCalendarStatus,
                ...(result?.data || {})
            });
        } catch (error) {
            setGoogleCalendarStatus(defaultGoogleCalendarStatus);
            setGoogleCalendarMessage(error?.message || 'Failed to load Google Calendar status.');
            setGoogleCalendarMessageTone('error');
        } finally {
            setGoogleCalendarLoading(false);
        }
    };

    const openGoogleCalendarModal = async () => {
        setOpenMenu(null);
        if (isMobile) {
            setIsOverlayOpen(false);
            if (isCompactMobile) {
                setIsMobileSidebarOpen(false);
            }
        }
        setShowGoogleCalendarModal(true);
        await loadGoogleCalendarStatus();
    };

    const closeGoogleCalendarModal = () => {
        if (googleCalendarConnecting || googleCalendarDisconnecting) return;
        setShowGoogleCalendarModal(false);
        setGoogleCalendarMessage('');
        setGoogleCalendarMessageTone('info');
    };

    const handleGoogleCalendarConnect = async () => {
        try {
            setGoogleCalendarConnecting(true);
            setGoogleCalendarMessage('');
            const result = await googleCalendarService.getConnectAuthUrl(window.location.origin);
            if (result?.success === false || !result?.authUrl) {
                throw new Error(result?.error || 'Failed to start Google OAuth.');
            }

            googleOAuthPopupRef.current = window.open(
                result.authUrl,
                'google-calendar-oauth',
                'width=760,height=780,menubar=no,toolbar=no,status=no'
            );

            if (!googleOAuthPopupRef.current) {
                throw new Error('Popup was blocked. Allow popups for this site and try again.');
            }
        } catch (error) {
            setGoogleCalendarConnecting(false);
            setGoogleCalendarMessage(error?.message || 'Unable to start Google OAuth.');
            setGoogleCalendarMessageTone('error');
        }
    };

    const handleGoogleCalendarDisconnect = async () => {
        try {
            setGoogleCalendarDisconnecting(true);
            setGoogleCalendarMessage('');
            const result = await googleCalendarService.disconnect();
            if (result?.success === false) {
                throw new Error(result?.error || 'Failed to disconnect Google Calendar.');
            }
            setGoogleCalendarMessage(result?.message || 'Google Calendar disconnected successfully.');
            setGoogleCalendarMessageTone('success');
            await loadGoogleCalendarStatus();
        } catch (error) {
            setGoogleCalendarMessage(error?.message || 'Failed to disconnect Google Calendar.');
            setGoogleCalendarMessageTone('error');
        } finally {
            setGoogleCalendarDisconnecting(false);
        }
    };

    useEffect(() => {
        const trustedOrigins = buildGoogleOAuthTrustedOrigins({
            windowOrigin: window.location.origin,
            apiBaseUrl: resolveApiBaseUrl()
        });

        const handleGoogleOAuthMessage = async (event) => {
            if (!isGoogleOAuthEventOriginTrusted(event?.origin, trustedOrigins)) {
                return;
            }

            const oauthEvent = resolveGoogleOAuthEvent(event?.data);
            if (oauthEvent.type === 'ignore') return;

            if (oauthEvent.type === 'success') {
                setGoogleCalendarConnecting(false);
                if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
                    googleOAuthPopupRef.current.close();
                }
                setGoogleCalendarMessage(oauthEvent.message);
                setGoogleCalendarMessageTone('success');
                await loadGoogleCalendarStatus();
            }

            if (oauthEvent.type === 'error') {
                setGoogleCalendarConnecting(false);
                if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
                    googleOAuthPopupRef.current.close();
                }
                setGoogleCalendarMessage(oauthEvent.message);
                setGoogleCalendarMessageTone('error');
            }
        };

        window.addEventListener('message', handleGoogleOAuthMessage);
        return () => {
            window.removeEventListener('message', handleGoogleOAuthMessage);
            if (isOAuthPopupOpen(googleOAuthPopupRef.current)) {
                googleOAuthPopupRef.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (!googleCalendarConnecting) return undefined;

        const watcher = setInterval(() => {
            if (!googleOAuthPopupRef.current) return;
            if (isOAuthPopupOpen(googleOAuthPopupRef.current)) return;
            setGoogleCalendarConnecting(false);
            googleOAuthPopupRef.current = null;
        }, 500);

        return () => clearInterval(watcher);
    }, [googleCalendarConnecting]);

    const toggleMenu = (menuName) => {
        if (isMobile) {
            if (isCompactMobile) {
                setIsMobileSidebarOpen(true);
            }
            // On mobile, toggle overlay
            if (openMenu === menuName && isOverlayOpen) {
                setIsOverlayOpen(false);
                setOpenMenu(null);
            } else {
                setOpenMenu(menuName);
                setIsOverlayOpen(true);
            }
        } else {
            // On desktop, normal toggle behavior
            setOpenMenu(openMenu === menuName ? null : menuName);
        }
    };

    const openDesktopFlyout = (menuName, event) => {
        if (isMobile) return;
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        if (event?.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            setFlyoutTop(Math.max(12, rect.top - 8));
        }
        setOpenMenu(menuName);
    };

    const scheduleDesktopFlyoutClose = () => {
        if (isMobile) return;
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = setTimeout(() => {
            setOpenMenu(null);
            closeTimerRef.current = null;
        }, 220);
    };

    const cancelDesktopFlyoutClose = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    const toggleOverlay = () => {
        setIsOverlayOpen(!isOverlayOpen);
        if (isOverlayOpen) {
            setOpenMenu(null);
        }
    };

    const closeCompactSidebar = () => {
        if (isCompactMobile) {
            setIsMobileSidebarOpen(false);
            setIsOverlayOpen(false);
            setOpenMenu(null);
        }
    };

    const closeMobileMenusAfterNavigate = () => {
        if (!isMobile) return;
        setIsOverlayOpen(false);
        setOpenMenu(null);
        if (isCompactMobile) {
            setIsMobileSidebarOpen(false);
        }
    };

    const prefetchRoute = useCallback((route) => {
        if (!route || isMobile) {
            return;
        }

        const normalizedRoute = route.startsWith('/inbox') ? '/inbox' : route;
        if (prefetchedRoutesRef.current.has(normalizedRoute)) {
            return;
        }

        const prefetcher = ROUTE_PREFETCHERS[normalizedRoute];
        if (!prefetcher) {
            return;
        }

        prefetchedRoutesRef.current.add(normalizedRoute);
        prefetcher().catch(() => {
            prefetchedRoutesRef.current.delete(normalizedRoute);
        });
    }, [isMobile]);

    useEffect(() => {
        if (isMobile || !canUseBroadcast) {
            return undefined;
        }

        const prefetchTeamInbox = () => {
            prefetchRoute('/inbox');
        };

        if (typeof window.requestIdleCallback === 'function') {
            const idleHandle = window.requestIdleCallback(prefetchTeamInbox, { timeout: 2000 });
            return () => window.cancelIdleCallback?.(idleHandle);
        }

        const timerId = window.setTimeout(prefetchTeamInbox, 1200);
        return () => window.clearTimeout(timerId);
    }, [canUseBroadcast, isMobile, prefetchRoute]);

    // Helper function to check if a route is currently active
    const isRouteActive = (route) => {
        return currentPath === route;
    };

    const isBulkRouteActive =
        isRouteActive('/broadcast-dashboard') ||
        isRouteActive('/broadcast') ||
        isRouteActive('/templates') ||
        isRouteActive('/contacts') ||
        currentPath.startsWith('/crm/') ||
        currentPath.startsWith('/inbox');
    const isVoiceRouteActive =
        isRouteActive('/voice-broadcast') ||
        currentPath.startsWith('/voice-automation/inbound') ||
        currentPath.startsWith('/voice-automation/outbound') ||
        currentPath.startsWith('/voice-automation/history');

    const isMissedCallsRouteActive = currentPath.startsWith('/missedcalls');
    const isMetaAdsRouteActive =
        isRouteActive('/ads-manager') ||
        isRouteActive('/insights') ||
        isRouteActive('/meta-connect');
    const getPreferredBulkRoute = () => {
        const preferredRoutes = [
            [featureFlags.broadcastDashboard, '/broadcast-dashboard'],
            [featureFlags.teamInbox, '/inbox'],
            [featureFlags.broadcastMessaging, '/broadcast'],
            [featureFlags.templates, '/templates'],
            [featureFlags.contacts, '/contacts']
        ];
        const selectedRoute = preferredRoutes.find(([enabled, route]) => isSuperAdmin || enabled)?.[1];
        return selectedRoute || '/broadcast-dashboard';
    };
    const isLeadScoringSettingsActive = showLeadScoringModal;
    const isGoogleCalendarSettingsActive = showGoogleCalendarModal;

    return (
        <div className={`sidebar-container ${isCompactMobile ? 'compact-mobile' : ''}`}>
            {isCompactMobile && (
                <>
                    <button
                        className="mobile-sidebar-toggle"
                        onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                        aria-label={isMobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        {isMobileSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                        <span className="mobile-toggle-arrow-fallback" aria-hidden="true">
                            {isMobileSidebarOpen ? '‹' : '›'}
                        </span>
                    </button>
                    {isMobileSidebarOpen && (
                        <div className="mobile-sidebar-backdrop" onClick={closeCompactSidebar} />
                    )}
                </>
            )}
            {/* Dark Left Panel with Icons */}
            <aside
                className={`sidebar-dark ${isCompactMobile ? (isMobileSidebarOpen ? 'open' : 'closed') : ''}`}
                onMouseLeave={() => {
                    if (!isMobile && (openMenu === 'bulkMessage' || openMenu === 'metaAds' || openMenu === 'voice' || openMenu === 'settings')) {
                        scheduleDesktopFlyoutClose();
                    }
                }}
                onMouseEnter={() => {
                    if (!isMobile) {
                        cancelDesktopFlyoutClose();
                    }
                }}
            >
                <div className="logo-icon-container">
                    <img src={logo} alt="Logo" />
                </div>

                <nav className="icon-menu">
                    {/* Admin Icon */}
                    {isSuperAdmin && (
                        <div
                            className={`icon-item ${isRouteActive('/admin') ? 'active' : ''}`}
                            onClick={() => {
                                setOpenMenu(null); // Close any open panel
                                navigate('/admin');
                            }}
                            title="Admin"
                        >
                            <LayoutDashboard size={24} />
                            <span className="icon-label">Admin</span>
                        </div>
                    )}
                  

                    {/* Dashboard Icon */}
                    <div
                        className={`icon-item ${isRouteActive('/') ? 'active' : ''}`}
                        onMouseEnter={() => prefetchRoute('/')}
                        onClick={() => {
                            setOpenMenu(null); // Close any open panel
                            navigate('/');
                        }}
                        title="Dashboard"
                    >
                        <LayoutDashboard size={24} />
                        <span className="icon-label">Dashboard</span>
                    </div>

                    {/* Bulk Message Icon - Opens submenu */}
                    {isLoggedIn && canUseBroadcast && (
                        <div
                            className={`icon-item ${isBulkRouteActive ? 'active' : ''} ${openMenu === 'bulkMessage' ? 'expanded' : ''}`}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    cancelDesktopFlyoutClose();
                                    openDesktopFlyout('bulkMessage', e);
                                    prefetchRoute(lastBulkMessageItem);
                                }
                            }}
                            onClick={(e) => {
                                if (isMobile) {
                                    if (openMenu === 'bulkMessage' && isOverlayOpen) {
                                        setIsOverlayOpen(false);
                                        setOpenMenu(null);
                                    } else {
                                        setOpenMenu('bulkMessage');
                                        setIsOverlayOpen(true);
                                        if (isCompactMobile) setIsMobileSidebarOpen(true);
                                    }
                                    return;
                                }
                                if (isCompactMobile) setIsMobileSidebarOpen(true);
                                const targetRoute = getPreferredBulkRoute();
                                if (openMenu === 'bulkMessage') {
                                    if (isMobile) setIsOverlayOpen(true);
                                    // If already open, navigate to last active item
                                    navigate(targetRoute === lastBulkMessageItem ? lastBulkMessageItem : targetRoute);
                                } else {
                                    // If closed, open and navigate to last active item
                                    if (!isMobile) {
                                        openDesktopFlyout('bulkMessage', e);
                                    } else {
                                        setOpenMenu('bulkMessage');
                                        setIsOverlayOpen(true);
                                    }
                                    navigate(targetRoute === lastBulkMessageItem ? lastBulkMessageItem : targetRoute);
                                }
                            }}
                            title="Bulk Message"
                        >
                            <MessageCircle size={24} />
                            <span className="icon-label icon-label-multiline">
                                <span>Bulk</span>
                                <span>Message</span>
                            </span>
                            <span className="submenu-arrow-indicator" aria-hidden="true">
                                {openMenu === 'bulkMessage' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                            </span>
                        </div>
                    )}

                    {canUseMetaAds && (
                        <div
                            className={`icon-item ${isMetaAdsRouteActive ? 'active' : ''} ${openMenu === 'metaAds' ? 'expanded' : ''}`}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    cancelDesktopFlyoutClose();
                                    openDesktopFlyout('metaAds', e);
                                    prefetchRoute('/ads-manager');
                                    prefetchRoute('/insights');
                                    prefetchRoute('/meta-connect');
                                }
                            }}
                            onClick={(e) => {
                                if (isMobile) {
                                    if (openMenu === 'metaAds' && isOverlayOpen) {
                                        setIsOverlayOpen(false);
                                        setOpenMenu(null);
                                    } else {
                                        setOpenMenu('metaAds');
                                        setIsOverlayOpen(true);
                                        if (isCompactMobile) setIsMobileSidebarOpen(true);
                                    }
                                    return;
                                }
                                if (isCompactMobile) setIsMobileSidebarOpen(true);
                                openDesktopFlyout('metaAds', e);
                            }}
                            title="Meta Ads"
                        >
                            <Megaphone size={24} />
                            <span className="icon-label icon-label-multiline">
                                <span>Meta</span>
                                <span>Ads</span>
                            </span>
                            <span className="submenu-arrow-indicator" aria-hidden="true">
                                {openMenu === 'metaAds' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                            </span>
                        </div>
                    )}

                    {/* Other Icons */}
                    {isLoggedIn && (
                        <>
                            {/* <div
                                className={`icon-item ${isRouteActive('/automation') ? 'active' : ''}`}
                                onClick={() => {
                                    setOpenMenu(null); // Close any open panel
                                    navigate('/automation');
                                }}
                                title="Automation"
                            >
                                <Zap size={24} />
                                <span className="icon-label">Automation</span>
                            </div> */}

                    {/* {canUseWhatsAppWorkflow && (
                        <div
                            className={`icon-item ${isRouteActive('/whatsapp-workflow') ? 'active' : ''}`}
                            onMouseEnter={() => {
                                if (!isMobile) {
                                    setOpenMenu(null);
                                }
                                prefetchRoute('/whatsapp-workflow');
                            }}
                            onClick={() => {
                                setOpenMenu(null);
                                navigate('/whatsapp-workflow');
                            }}
                            title="WhatsApp Workflow"
                        >
                            <MessageSquare size={24} />
                            <span className="icon-label icon-label-multiline">
                                <span>WhatsApp</span>
                                <span>Workflow</span>
                            </span>
                        </div>
                    )} */}

                    {canUseVoiceAutomation && (
                        <div
                            className={`icon-item ${isVoiceRouteActive ? 'active' : ''} ${openMenu === 'voice' ? 'expanded' : ''}`}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    cancelDesktopFlyoutClose();
                                    openDesktopFlyout('voice', e);
                                }
                            }}
                            onClick={(e) => {
                                if (isMobile) {
                                    if (openMenu === 'voice' && isOverlayOpen) {
                                        setIsOverlayOpen(false);
                                        setOpenMenu(null);
                                    } else {
                                        setOpenMenu('voice');
                                        setIsOverlayOpen(true);
                                        if (isCompactMobile) setIsMobileSidebarOpen(true);
                                    }
                                    return;
                                }
                                if (isCompactMobile) setIsMobileSidebarOpen(true);
                                openDesktopFlyout('voice', e);
                            }}
                            title="Voice"
                        >
                            <Phone size={24} />
                            <span className="icon-label">Voice</span>
                            <span className="submenu-arrow-indicator" aria-hidden="true">
                                {openMenu === 'voice' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                            </span>
                        </div>
                    )}

                    {canUseMissedCalls && (
                        <div
                            className={`icon-item ${isMissedCallsRouteActive ? 'active' : ''}`}
                            onMouseEnter={() => {
                                if (!isMobile) {
                                    setOpenMenu(null);
                                }
                                prefetchRoute('/missedcalls/overview');
                            }}
                            onClick={() => {
                                setOpenMenu(null);
                                navigate('/missedcalls/overview');
                            }}
                            title="Missed Calls"
                        >
                            <PhoneMissed size={24} />
                            <span className="icon-label">Missed</span>
                        </div>
                    )}

                    {canUseEmailAutomation && (
                        <div
                            className={`icon-item ${isRouteActive('/email-automation') ? 'active' : ''}`}
                            onMouseEnter={() => {
                                if (!isMobile) {
                                    setOpenMenu(null);
                                }
                                prefetchRoute('/email-automation');
                            }}
                            onClick={() => {
                                setOpenMenu(null);
                                navigate('/email-automation');
                            }}
                            title="Email Automation"
                        >
                            <Mail size={24} />
                            <span className="icon-label">Email</span>
                        </div>
                    )}
                        </>
                    )}


                    


                    

                    <div
                        className={`icon-item ${openMenu === 'settings' ? 'active' : ''}`}
                        onMouseEnter={(e) => {
                            if (!isMobile) {
                                cancelDesktopFlyoutClose();
                                openDesktopFlyout('settings', e);
                            }
                        }}
                        onClick={(e) => {
                            if (isMobile) {
                                if (openMenu === 'settings' && isOverlayOpen) {
                                    setIsOverlayOpen(false);
                                    setOpenMenu(null);
                                } else {
                                    setOpenMenu('settings');
                                    setIsOverlayOpen(true);
                                    if (isCompactMobile) setIsMobileSidebarOpen(true);
                                }
                                return;
                            }
                            if (isCompactMobile) setIsMobileSidebarOpen(true);
                            if (!isMobile) {
                                openDesktopFlyout('settings', e);
                            } else {
                                toggleMenu('settings');
                                setIsOverlayOpen(true);
                            }
                            navigate('/settings');
                        }}
                        title="Manage"
                    >
                        <Settings size={24} />
                        <span className="icon-label">Manage</span>
                        <span className="submenu-arrow-indicator" aria-hidden="true">
                            {openMenu === 'settings' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                        </span>
                    </div>
                </nav>

                <div className="sidebar-dark-footer">
                    {isLoggedIn ? (
                        <>
                            <div className="avatar-icon">{getInitials(userName)}</div>
                            <div className="icon-item logout-icon" onClick={handleLogout} title="Logout">
                                <LogOut size={24} />
                            </div>
                        </>
                    ) : (
                        <div className="icon-item" onClick={() => navigate("/login")} title="Login">
                            <LogIn size={24} />
                        </div>
                    )}
                </div>
            </aside>

            {/* White Expandable Panel */}
            {openMenu && (!isMobile || isOverlayOpen) && (
                <div
                    className={`sidebar-expand-panel ${!isMobile ? 'flyout' : ''} ${isMobile && isOverlayOpen ? 'open' : ''}`}
                    style={!isMobile ? { top: `${flyoutTop}px` } : undefined}
                    onMouseEnter={() => {
                        if (!isMobile) {
                            cancelDesktopFlyoutClose();
                        }
                    }}
                    onMouseLeave={() => {
                        if (!isMobile) {
                            scheduleDesktopFlyoutClose();
                        }
                    }}
                >
                    {openMenu === 'bulkMessage' && (
                        <>
                            <div className="panel-header">
                                <h3>Bulk Message</h3>
                                {isMobile && (
                                    <button 
                                        className="panel-close-btn" 
                                        onClick={toggleOverlay}
                                        title="Close menu"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                            <nav className="panel-menu">
                                <NavLink
                                    to="/broadcast-dashboard"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/broadcast-dashboard')}
                                    onFocus={() => prefetchRoute('/broadcast-dashboard')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/broadcast-dashboard');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <LayoutDashboard size={20} />
                                    <span>Broadcast Dashboard</span>
                                </NavLink>
                                <NavLink
                                    to="/inbox"
                                    className={() => `panel-item ${currentPath.startsWith('/inbox') ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/inbox')}
                                    onFocus={() => prefetchRoute('/inbox')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/inbox');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <MessageSquare size={20} />
                                    <span>Team Inbox</span>
                                </NavLink>
                                <NavLink
                                    to="/broadcast"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/broadcast')}
                                    onFocus={() => prefetchRoute('/broadcast')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/broadcast');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <Radio size={20} />
                                    <span>Broadcast</span>
                                </NavLink>

                                <NavLink
                                    to="/templates"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/templates')}
                                    onFocus={() => prefetchRoute('/templates')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/templates');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <FileText size={20} />
                                    <span>Templates</span>
                                </NavLink>

                                <NavLink
                                    to="/contacts"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/contacts')}
                                    onFocus={() => prefetchRoute('/contacts')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/contacts');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <Users size={20} />
                                    <span>Contacts</span>
                                </NavLink>

                                <div className="panel-submenu-heading">
                                    <BarChart3 size={16} />
                                    <span>CRM</span>
                                </div>

                                <NavLink
                                    to="/crm/pipeline"
                                    className={({ isActive }) => `panel-item panel-item-submenu ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/crm/pipeline')}
                                    onFocus={() => prefetchRoute('/crm/pipeline')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/crm/pipeline');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <Users size={20} />
                                    <span>CRM Pipeline</span>
                                </NavLink>

                                <NavLink
                                    to="/crm/tasks"
                                    className={({ isActive }) => `panel-item panel-item-submenu ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => prefetchRoute('/crm/tasks')}
                                    onFocus={() => prefetchRoute('/crm/tasks')}
                                    onClick={() => {
                                        setLastBulkMessageItem('/crm/tasks');
                                        closeMobileMenusAfterNavigate();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenu(null);
                                    }}
                                >
                                    <FileText size={20} />
                                    <span>CRM Tasks</span>
                                </NavLink>

                                <div className="panel-submenu-heading">
                                    <Settings size={16} />
                                    <span>Settings</span>
                                </div>

                                <button
                                    type="button"
                                    className={`panel-item panel-item-submenu panel-item-button ${isLeadScoringSettingsActive ? 'active' : ''}`}
                                    onClick={openLeadScoringModal}
                                >
                                    <BarChart3 size={20} />
                                    <span>Lead Scoring Settings</span>
                                </button>

                                <button
                                    type="button"
                                    className={`panel-item panel-item-submenu panel-item-button ${isGoogleCalendarSettingsActive ? 'active' : ''}`}
                                    onClick={openGoogleCalendarModal}
                                >
                                    <CalendarDays size={20} />
                                    <span>Google Calendar</span>
                                </button>
                            </nav>
                        </>
                    )}

                    {openMenu === 'metaAds' && canUseMetaAds && (
                        <>
                            <div className="panel-header">
                                <h3>Meta Ads</h3>
                                {isMobile && (
                                    <button
                                        className="panel-close-btn"
                                        onClick={toggleOverlay}
                                        title="Close menu"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                            <nav className="panel-menu">
                                {(isSuperAdmin || featureFlags.adsManager) && (
                                    <NavLink
                                        to="/ads-manager"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <Megaphone size={20} />
                                        <span>Ads Manager</span>
                                    </NavLink>
                                )}
                                {(isSuperAdmin || featureFlags.analytics) && (
                                    <NavLink
                                        to="/insights"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <BarChart3 size={20} />
                                        <span>Insights</span>
                                    </NavLink>
                                )}
                                {(isSuperAdmin || featureFlags.metaConnect) && (
                                    <NavLink
                                        to="/meta-connect"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <Facebook size={20} />
                                        <span>Connect Meta</span>
                                    </NavLink>
                                )}
                            </nav>
                        </>
                    )}

                    {openMenu === 'voice' && canUseVoiceAutomation && (
                        <>
                            <div className="panel-header">
                                <h3>Voice</h3>
                                {isMobile && (
                                    <button
                                        className="panel-close-btn"
                                        onClick={toggleOverlay}
                                        title="Close menu"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                            <nav className="panel-menu">
                                {(isSuperAdmin || featureFlags.voiceCampaign) && (
                                    <NavLink
                                        to="/voice-broadcast"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <Megaphone size={20} />
                                        <span>Voice Broadcast</span>
                                    </NavLink>
                                )}
                                {(isSuperAdmin || featureFlags.inboundAutomation) && (
                                    <NavLink
                                        to="/voice-automation/inbound"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <PhoneIncoming size={20} />
                                        <span>Inbound / IVR</span>
                                    </NavLink>
                                )}
                                {(isSuperAdmin || featureFlags.outboundVoice) && (
                                    <NavLink
                                        to="/voice-automation/outbound"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <PhoneOutgoing size={20} />
                                        <span>Outbound</span>
                                    </NavLink>
                                )}
                                {(isSuperAdmin || featureFlags.callAnalytics) && (
                                    <NavLink
                                        to="/voice-automation/history"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                        onClick={closeMobileMenusAfterNavigate}
                                    >
                                        <LineChart size={20} />
                                        <span>Call Analytics</span>
                                    </NavLink>
                                )}
                            </nav>
                        </>
                    )}

                    {openMenu === 'settings' && (
                        <>
                            <div className="panel-header">
                                <h3>Manage</h3>
                                {isMobile && (
                                    <button 
                                        className="panel-close-btn" 
                                        onClick={toggleOverlay}
                                        title="Close menu"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                            <nav className="panel-menu">
                                <div className="panel-item">
                                    <Settings size={20} />
                                    <span>Settings</span>
                                </div>
                                <div className="panel-item">
                                    <Users size={20} />
                                    <span>User Management</span>
                                </div>
                            </nav>
                        </>
           
                    )}
                </div>
            )}

            {showLeadScoringModal && (
                <div className="bulk-lead-scoring-overlay" onClick={closeLeadScoringModal}>
                    <div className="bulk-lead-scoring-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="bulk-lead-scoring-header">
                            <h3>Lead Scoring Settings</h3>
                            <button
                                className="bulk-lead-scoring-close-btn"
                                type="button"
                                onClick={closeLeadScoringModal}
                                disabled={leadScoringSaving}
                            >
                                Close
                            </button>
                        </div>

                        {leadScoringLoading ? (
                            <div className="bulk-lead-scoring-loading">Loading settings...</div>
                        ) : (
                            <>
                                <label className="bulk-lead-scoring-toggle">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(leadScoringForm.isEnabled)}
                                        onChange={(event) => updateLeadScoringField('isEnabled', event.target.checked)}
                                    />
                                    Enable lead scoring
                                </label>

                                <div className="bulk-lead-scoring-grid">
                                    <label className="bulk-lead-scoring-field">
                                        <span>Read Score</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={leadScoringForm.readScore}
                                            onChange={(event) => updateLeadScoringField('readScore', event.target.value)}
                                        />
                                    </label>

                                    <label className="bulk-lead-scoring-field">
                                        <span>Reply Score</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={leadScoringForm.replyScore}
                                            onChange={(event) => updateLeadScoringField('replyScore', event.target.value)}
                                        />
                                    </label>
                                </div>

                                <div className="bulk-lead-scoring-keywords-header">
                                    <h4>Keyword Rules</h4>
                                    <button
                                        type="button"
                                        className="bulk-lead-scoring-add-btn"
                                        onClick={addLeadKeywordRule}
                                    >
                                        Add Keyword
                                    </button>
                                </div>

                                <div className="bulk-lead-scoring-keyword-list">
                                    {leadScoringForm.keywordRules.map((rule, index) => (
                                        <div className="bulk-lead-scoring-keyword-row" key={`sidebar-keyword-rule-${index}`}>
                                            <input
                                                type="text"
                                                placeholder="Keyword"
                                                value={rule.keyword}
                                                onChange={(event) => updateLeadKeywordRule(index, 'keyword', event.target.value)}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={rule.score}
                                                onChange={(event) => updateLeadKeywordRule(index, 'score', event.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="bulk-lead-scoring-remove-btn"
                                                onClick={() => removeLeadKeywordRule(index)}
                                                disabled={leadScoringForm.keywordRules.length <= 1}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {leadScoringMessage && (
                                    <div className={`bulk-lead-scoring-feedback bulk-lead-scoring-feedback--${leadScoringMessageTone}`}>
                                        {leadScoringMessage}
                                    </div>
                                )}

                                <div className="bulk-lead-scoring-actions">
                                    <button
                                        type="button"
                                        className="bulk-lead-scoring-cancel-btn"
                                        onClick={closeLeadScoringModal}
                                        disabled={leadScoringSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="bulk-lead-scoring-save-btn"
                                        onClick={saveLeadScoringSettings}
                                        disabled={leadScoringSaving}
                                    >
                                        {leadScoringSaving ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showGoogleCalendarModal && (
                <div className="bulk-google-calendar-overlay" onClick={closeGoogleCalendarModal}>
                    <div className="bulk-google-calendar-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="bulk-google-calendar-header">
                            <h3>Google Calendar</h3>
                            <button
                                className="bulk-google-calendar-close-btn"
                                type="button"
                                onClick={closeGoogleCalendarModal}
                                disabled={googleCalendarConnecting || googleCalendarDisconnecting}
                            >
                                Close
                            </button>
                        </div>

                        {googleCalendarLoading ? (
                            <div className="bulk-google-calendar-loading">Loading Google Calendar status...</div>
                        ) : (
                            <>
                                <div className="bulk-google-calendar-status">
                                    <span
                                        className={`bulk-google-calendar-pill ${googleCalendarStatus.connected ? 'bulk-google-calendar-pill--connected' : 'bulk-google-calendar-pill--disconnected'}`}
                                    >
                                        {googleCalendarStatus.connected ? 'Connected' : 'Not Connected'}
                                    </span>
                                    <span className="bulk-google-calendar-source">
                                        Source: {googleCalendarStatus.source || 'none'}
                                    </span>
                                </div>

                                <div className="bulk-google-calendar-meta">
                                    <div className="bulk-google-calendar-meta-item">
                                        <span>Name</span>
                                        <strong>{googleCalendarStatus.profile?.name || '-'}</strong>
                                    </div>
                                    <div className="bulk-google-calendar-meta-item">
                                        <span>Email</span>
                                        <strong>{googleCalendarStatus.profile?.email || '-'}</strong>
                                    </div>
                                    <div className="bulk-google-calendar-meta-item">
                                        <span>Refresh Token</span>
                                        <strong>{googleCalendarStatus.connectionMeta?.hasRefreshToken ? 'Available' : 'Not available'}</strong>
                                    </div>
                                    <div className="bulk-google-calendar-meta-item">
                                        <span>Backend Env Fallback</span>
                                        <strong>{googleCalendarStatus.envMode && googleCalendarStatus.envMode !== 'none' ? 'Available' : 'Not configured'}</strong>
                                    </div>
                                </div>

                                {googleCalendarMessage && (
                                    <div className={`bulk-google-calendar-feedback bulk-google-calendar-feedback--${googleCalendarMessageTone}`}>
                                        {googleCalendarMessage}
                                    </div>
                                )}

                                <div className="bulk-google-calendar-actions">
                                    <button
                                        type="button"
                                        className="bulk-google-calendar-secondary-btn"
                                        onClick={loadGoogleCalendarStatus}
                                        disabled={googleCalendarLoading || googleCalendarConnecting || googleCalendarDisconnecting}
                                    >
                                        Refresh
                                    </button>
                                    <button
                                        type="button"
                                        className="bulk-google-calendar-primary-btn"
                                        onClick={handleGoogleCalendarConnect}
                                        disabled={googleCalendarConnecting || googleCalendarDisconnecting}
                                    >
                                        {googleCalendarConnecting
                                            ? 'Opening Google...'
                                            : googleCalendarStatus.connected
                                                ? 'Reconnect Google'
                                                : 'Connect Google'}
                                    </button>
                                    <button
                                        type="button"
                                        className="bulk-google-calendar-danger-btn"
                                        onClick={handleGoogleCalendarDisconnect}
                                        disabled={!googleCalendarStatus.connected || googleCalendarDisconnecting || googleCalendarConnecting}
                                    >
                                        {googleCalendarDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
