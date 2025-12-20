import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Radio, Users, Settings, Zap, LogOut, FileText } from 'lucide-react';
import './Sidebar.css';

const SidebarItem = ({ icon: Icon, label, to }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
    >
        <Icon size={20} />
        <span>{label}</span>
    </NavLink>
);

const Sidebar = () => {
    return (
        <aside className="sidebar">
            <div className="logo-container">
                <div className="logo-icon">T</div>
                <span className="logo-text">Technovo Hub</span>
            </div>

            <nav className="nav-menu">
                <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" />
                <SidebarItem icon={MessageSquare} label="Team Inbox" to="/inbox" />
                <SidebarItem icon={Radio} label="Broadcasts" to="/broadcast" />
                <SidebarItem icon={FileText} label="Templates" to="/templates" />
                <SidebarItem icon={Users} label="Contacts" to="/contacts" />
                <SidebarItem icon={Zap} label="Automation" to="/automation" />
            </nav>

            <div className="sidebar-footer">
                {/* Settings/Logout usually don't need routing in this demo context, or can point to placeholders */}
                <div className="sidebar-item">
                    <Settings size={20} />
                    <span>Settings</span>
                </div>
                <div className="sidebar-item">
                    <LogOut size={20} />
                    <span>Logout</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
