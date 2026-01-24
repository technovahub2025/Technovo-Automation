import React, { useState, useEffect } from "react";
import { Search, Bell } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Header.css";

const Header = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token); 
  }, [location.pathname]);

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="page-title">Dashboard</h2>
      </div>

      <div className="header-right">
        {/* Search bar - always visible */}
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

        {/* Notification icon - always visible */}
        <button className="icon-button">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

       
        
      </div>
    </header>
  );
};

export default Header;
