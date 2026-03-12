import React, { useState, useEffect } from 'react';
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet, useLocation } from "react-router-dom";
import "./MainLayout.css";

const MainLayout = () => {
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [lastBulkMessageItem, setLastBulkMessageItem] = useState('/broadcast-dashboard');
  const location = useLocation();
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const currentPath = normalizedBase && location.pathname.startsWith(normalizedBase)
    ? (location.pathname.slice(normalizedBase.length) || '/')
    : location.pathname;

  // Track last active bulk message item when navigating to bulk message routes
  useEffect(() => {
    const bulkMessageRoutes = ['/broadcast-dashboard', '/broadcast', '/broadcast/new', '/broadcast/new/template', '/broadcast/new/message', '/templates', '/contacts'];
    const isInboxRoute = currentPath.startsWith('/inbox');
    if (bulkMessageRoutes.includes(currentPath) || isInboxRoute) {
      setLastBulkMessageItem(currentPath);
    }
  }, [currentPath]);

  // Show header on dashboard and broadcast dashboard pages
  const shouldShowHeader = currentPath === '/' || currentPath === '/broadcast-dashboard';

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
