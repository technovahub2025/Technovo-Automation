import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  LogIn
} from 'lucide-react';
import logo from '../../src/assets/logo.png';
import './Sidebar.css';

const Sidebar = ({ expandedPanel, setExpandedPanel }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);

    // Use prop state instead of local
    const openMenu = expandedPanel;

    // Responsive state
    const [isMobile, setIsMobile] = useState(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

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
            setIsMobile(width <= 1024);
            
            // Handle mobile overlay behavior
            if (width <= 1024) {
                if (!wasMobile && openMenu) {
                    // Switch to overlay mode
                    setIsOverlayOpen(true);
                }
            } else {
                // Desktop mode - close overlay
                setIsOverlayOpen(false);
            }
        };

        // Initial check
        checkScreenSize();

        // Add resize listener
        window.addEventListener('resize', checkScreenSize);

        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize);
    }, [openMenu, isMobile]);

    const isLoggedIn = !!user;
    const userName = user?.username || user?.name || "Guest";
    const userRole = user?.role || "guest";

    const API_URL = import.meta.env.VITE_API_ADMIN_URL;

    const getInitials = (name) => {
        if (!name || name === "Guest") return "GU";
        const words = name.split(" ");
        if (words.length === 1) return name.substring(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    };

    const handleLogout = async () => {
        const token = localStorage.getItem("token");

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

    const toggleOverlay = () => {
        setIsOverlayOpen(!isOverlayOpen);
        if (isOverlayOpen) {
            setOpenMenu(null);
        }
    };

    // Helper function to check if a route is currently active
    const isRouteActive = (route) => {
        return location.pathname === route;
    };

    return (
        <div className="sidebar-container">
            {/* Dark Left Panel with Icons */}
            <aside className="sidebar-dark">
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
                    <div
                        className={`icon-item ${openMenu === 'bulkMessage' || isRouteActive('/broadcastdashboard') ? 'active' : ''}`}
                        onClick={() => {
                            toggleMenu('bulkMessage');
                            navigate('/broadcastdashboard');
                        }}
                        title="Bulk Message"
                    >
                        <MessageCircle size={24} />
                        <span className="icon-label">Bulk Message</span>
                    </div>

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
                                className={`icon-item ${isRouteActive('/missedcalls') ? 'active' : ''}`}
                                onClick={() => {
                                    setOpenMenu(null); // Close any open panel
                                    navigate('/missedcalls');
                                }}
                                title="Missed Calls"
                            >
                                <PhoneMissed size={24} />
                                <span className="icon-label">Missed</span>
                            </div>

                            <div
                                className={`icon-item ${isRouteActive('/email-automation') ? 'active' : ''}`}
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
                        onClick={() => {
                            toggleMenu('settings');
                            navigate('/settings');
                        }}
                        title="Manage"
                    >
                        <Settings size={24} />
                        <span className="icon-label">Manage</span>
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
            {openMenu && (
                <div className={`sidebar-expand-panel ${isMobile && isOverlayOpen ? 'open' : ''}`}>
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
                                    to="/broadcastdashboard"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onClick={() => isMobile && toggleOverlay()}
                                >
                                    <LayoutDashboard size={20} />
                                    <span>Broadcast Dashboard</span>
                                </NavLink>
                                <NavLink
                                    to="/inbox"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onClick={() => isMobile && toggleOverlay()}
                                >
                                    <MessageSquare size={20} />
                                    <span>Team Inbox</span>
                                </NavLink>

                                <NavLink
                                    to="/broadcast"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onClick={() => isMobile && toggleOverlay()}
                                >
                                    <Radio size={20} />
                                    <span>Broadcast</span>
                                </NavLink>

                                <NavLink
                                    to="/templates"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onClick={() => isMobile && toggleOverlay()}
                                >
                                    <FileText size={20} />
                                    <span>Templates</span>
                                </NavLink>

                                <NavLink
                                    to="/contacts"
                                    className={({ isActive }) => `panel-item ${isActive ? 'active' : ''}`}
                                    onClick={() => isMobile && toggleOverlay()}
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

            {/* Mobile Toggle Button */}
            {isMobile && openMenu && (
                <button 
                    className="sidebar-toggle-btn" 
                    onClick={toggleOverlay}
                >
                    {isOverlayOpen ? <X size={16} /> : <Menu size={16} />}
                    <span>{isOverlayOpen ? 'Close' : 'Menu'}</span>
                </button>
            )}
        </div>
    );
};