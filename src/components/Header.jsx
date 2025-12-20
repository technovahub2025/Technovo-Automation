import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import './Header.css';

const Header = () => {
    return (
        <header className="header">
            <div className="header-left">
                <h2 className="page-title">Dashboard</h2>
            </div>

            <div className="header-right">
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search..." />
                </div>

                <button className="icon-button">
                    <Bell size={20} />
                    <span className="notification-dot"></span>
                </button>

                <div className="user-profile">
                    <div className="avatar">VI</div>
                    <span className="user-name">Vidhyavathi</span>
                    <ChevronDown size={16} />
                </div>
            </div>
        </header>
    );
};

export default Header;
