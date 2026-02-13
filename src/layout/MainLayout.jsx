import React, { useState, useEffect } from 'react';
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet, useLocation } from "react-router-dom";
import "./MainLayout.css";

const MainLayout = () => {
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [lastBulkMessageItem, setLastBulkMessageItem] = useState('/broadcast-dashboard');
  const location = useLocation();

  // Track last active bulk message item when navigating to bulk message routes
  useEffect(() => {
    const bulkMessageRoutes = ['/broadcast-dashboard', '/inbox', '/broadcast', '/templates', '/contacts'];
    if (bulkMessageRoutes.includes(location.pathname)) {
      setLastBulkMessageItem(location.pathname);
    }
  }, [location.pathname]);

  // Show header on dashboard and broadcast dashboard pages
  const shouldShowHeader = location.pathname === '/' || location.pathname === '/broadcast-dashboard';

  return (
    <div className="main-layout">
      <Sidebar 
        expandedPanel={expandedPanel} 
        setExpandedPanel={setExpandedPanel}
        lastBulkMessageItem={lastBulkMessageItem}
        setLastBulkMessageItem={setLastBulkMessageItem}
      />
      <div className={`main-content ${expandedPanel ? 'content-shifted' : ''}`}>
        {shouldShowHeader && <Header />}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
