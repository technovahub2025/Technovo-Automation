import React, { useContext, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from "axios";
import { AuthContext } from '../pages/authcontext';
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

const Sidebar = ({ expandedPanel, setExpandedPanel, lastBulkMessageItem, setLastBulkMessageItem }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const currentPath = normalizedBase && location.pathname.startsWith(normalizedBase)
        ? (location.pathname.slice(normalizedBase.length) || '/')
        : location.pathname;

    // Use prop state instead of local
    const openMenu = expandedPanel;

    // Responsive state
    const [isMobile, setIsMobile] = useState(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [isCompactMobile, setIsCompactMobile] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [flyoutTop, setFlyoutTop] = useState(120);
    const closeTimerRef = useRef(null);

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
    const canUseEmailAutomation = isSuperAdmin || Boolean(featureFlags.workflowAutomation);
    const canUseAdsManager = isSuperAdmin || (Boolean(featureFlags.adsManager) && canViewAnalytics);

    useEffect(() => {
        if (!isLoggedIn && openMenu === 'bulkMessage') {
            setOpenMenu(null);
        }
    }, [isLoggedIn, openMenu]);

    const API_URL = import.meta.env.VITE_API_ADMIN_URL;

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

    // Helper function to check if a route is currently active
    const isRouteActive = (route) => {
        return currentPath === route;
    };

    const isBulkRouteActive =
        isRouteActive('/broadcast-dashboard') ||
        isRouteActive('/broadcast') ||
        isRouteActive('/templates') ||
        isRouteActive('/contacts') ||
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
                        onClick={() => {
                            setOpenMenu(null); // Close any open panel
                            navigate('/');
                        }}
                        title="Dashboard"
                    >
                        <LayoutDashboard size={24} />
                        <span className="icon-label">Dashboard</span>
                    </div>

                    {canUseMetaAds && (
                        <div
                            className={`icon-item ${isMetaAdsRouteActive ? 'active' : ''} ${openMenu === 'metaAds' ? 'expanded' : ''}`}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    cancelDesktopFlyoutClose();
                                    openDesktopFlyout('metaAds', e);
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
                                if (!isMobile) {
                                    openDesktopFlyout('metaAds', e);
                                } else {
                                    toggleMenu('metaAds');
                                    setIsOverlayOpen(true);
                                }
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

                    {/* Bulk Message Icon - Opens submenu */}
                    {isLoggedIn && canUseBroadcast && (
                        <div
                            className={`icon-item ${isBulkRouteActive ? 'active' : ''} ${openMenu === 'bulkMessage' ? 'expanded' : ''}`}
                            onMouseEnter={(e) => {
                                if (!isMobile) {
                                    cancelDesktopFlyoutClose();
                                    openDesktopFlyout('bulkMessage', e);
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
                                {(isSuperAdmin || featureFlags.broadcastDashboard) && (
                                    <NavLink
                                        to="/broadcast-dashboard"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
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
                                )}
                                {(isSuperAdmin || featureFlags.teamInbox) && (
                                    <NavLink
                                        to="/inbox"
                                        className={() => `panel-item ${currentPath.startsWith('/inbox') ? 'active' : ''}`}
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
                                )}
                                {(isSuperAdmin || featureFlags.broadcastMessaging) && (
                                    <NavLink
                                        to="/broadcast"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
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
                                )}
                                {(isSuperAdmin || featureFlags.templates) && (
                                    <NavLink
                                        to="/templates"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
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
                                )}
                                {(isSuperAdmin || featureFlags.contacts) && (
                                    <NavLink
                                        to="/contacts"
                                        className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
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
                                )}
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
        </div>
    );
};

export default Sidebar;
