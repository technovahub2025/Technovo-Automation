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
    ChevronLeft,
    ChevronRight,
    Menu,
    X
} from 'lucide-react';
import logo from '../../src/assets/logo.png';
import './Sidebar.css';

const Sidebar = ({ expandedPanel, setExpandedPanel, lastBulkMessageItem, setLastBulkMessageItem }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);

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
            localStorage.getItem("token");

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
        return location.pathname === route;
    };

    const isBulkRouteActive =
        isRouteActive('/broadcast-dashboard') ||
        isRouteActive('/broadcast') ||
        isRouteActive('/templates') ||
        isRouteActive('/contacts') ||
        location.pathname.startsWith('/inbox');

    const isMissedCallsRouteActive = location.pathname.startsWith('/missedcalls');

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
                    if (!isMobile && (openMenu === 'bulkMessage' || openMenu === 'settings')) {
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
                    {userRole === "superadmin" && (
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

                    {/* Bulk Message Icon - Opens submenu */}
                    {isLoggedIn && (
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
                                if (openMenu === 'bulkMessage') {
                                    if (isMobile) setIsOverlayOpen(true);
                                    // If already open, navigate to last active item
                                    navigate(lastBulkMessageItem);
                                } else {
                                    // If closed, open and navigate to last active item
                                    if (!isMobile) {
                                        openDesktopFlyout('bulkMessage', e);
                                    } else {
                                        setOpenMenu('bulkMessage');
                                        setIsOverlayOpen(true);
                                    }
                                    navigate(lastBulkMessageItem);
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
                    {(userRole === "admin" || userRole === "superadmin") && (
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

                    <div
                        className={`icon-item ${isRouteActive('/voice-automation') ? 'active' : ''}`}
                        onMouseEnter={() => {
                            if (!isMobile) {
                                setOpenMenu(null);
                            }
                        }}
                        onClick={() => {
                            setOpenMenu(null); // Close any open panel
                            navigate('/voice-automation');
                                }}
                                title="Voice Automation"
                            >
                                <Phone size={24} />
                                <span className="icon-label">Voice</span>
                            </div>

                    <div
                        className={`icon-item ${isMissedCallsRouteActive ? 'active' : ''}`}
                        onMouseEnter={() => {
                            if (!isMobile) {
                                setOpenMenu(null);
                            }
                        }}
                        onClick={() => {
                            setOpenMenu(null); // Close any open panel
                            navigate('/missedcalls/overview');
                                }}
                                title="Missed Calls"
                            >
                                <PhoneMissed size={24} />
                                <span className="icon-label">Missed</span>
                            </div>

                    <div
                        className={`icon-item ${isRouteActive('/email-automation') ? 'active' : ''}`}
                        onMouseEnter={() => {
                            if (!isMobile) {
                                setOpenMenu(null);
                            }
                        }}
                        onClick={() => {
                            setOpenMenu(null); // Close any open panel
                            navigate('/email-automation');
                                }}
                                title="Email Automation"
                            >
                                <Mail size={24} />
                                <span className="icon-label">Email</span>
                            </div>
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
                                    className={() => `panel-item ${location.pathname.startsWith('/inbox') ? 'active' : ''}`}
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

