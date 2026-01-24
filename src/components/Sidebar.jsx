import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from "axios";
import { AuthContext } from '../pages/authcontext';
import {
  LayoutDashboard,
  MessageSquare,
  Radio,          // ✅ Broadcast icon
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

const SidebarItem = ({ icon: Icon, label, to, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </NavLink>
);

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  const isLoggedIn = !!user;
  const userName = user?.username || user?.name || "Guest";
  const userRole = user?.role || "guest";

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
          "http://localhost:8000/api/nexion/logout",
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {}
    }
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">
          <img src={logo} alt="Logo" />
        </div>
        <span className="logo-text">Technovo Hub</span>
      </div>

      <nav className="nav-menu">

        {/* USER */}
        {userRole === "user" && (
          <>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
            <SidebarItem icon={MessageSquare} label="Team Inbox" to="/inbox" />
            <SidebarItem icon={FileText} label="Templates" to="/templates" />
            <SidebarItem icon={Users} label="Contacts" to="/contacts" />
          </>
        )}

        {/* ADMIN */}
        {userRole === "admin" && (
          <>
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
            <SidebarItem icon={Radio} label="Broadcast" to="/broadcast" />
            <SidebarItem icon={MessageSquare} label="Team Inbox" to="/inbox" />
            <SidebarItem icon={FileText} label="Templates" to="/templates" />
            <SidebarItem icon={Users} label="Contacts" to="/contacts" />
            <SidebarItem icon={Zap} label="Automation" to="/automation" />
            <SidebarItem icon={Phone} label="Voice Automation" to="/voice-automation" />
            <SidebarItem icon={PhoneMissed} label="MissedCalls" to="/missedcalls" />
            <SidebarItem icon={Mail} label="Email Automation" to="/email-automation" />
          </>
        )}

        {/* SUPER ADMIN */}
        {userRole === "superadmin" && (
          <>
            <SidebarItem icon={LayoutDashboard} label="Admin" to="/admin" />
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
            <SidebarItem icon={Radio} label="Broadcast" to="/broadcast" />
            <SidebarItem icon={MessageSquare} label="Team Inbox" to="/inbox" />
            <SidebarItem icon={FileText} label="Templates" to="/templates" />
            <SidebarItem icon={Users} label="Contacts" to="/contacts" />
            <SidebarItem icon={Zap} label="Automation" to="/automation" />
            <SidebarItem icon={Phone} label="Voice Automation" to="/voice-automation" />
            <SidebarItem icon={PhoneMissed} label="MissedCalls" to="/missedcalls" />
            <SidebarItem icon={Mail} label="Email Automation" to="/email-automation" />
          </>
        )}

      </nav>

      <div className="sidebar-footer">
        {isLoggedIn ? (
          <>
            <div className="user-profile logged-in">
              <div className="avatar">{getInitials(userName)}</div>
              <span className="user-name">{userName}</span>
            </div>

            <div className="sidebar-item" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </div>
          </>
        ) : (
          <div className="sidebar-item" onClick={() => navigate("/login")}>
            <LogIn size={20} />
            <span>Login</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
