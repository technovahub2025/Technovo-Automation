import React, { useState } from 'react';
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet, useLocation } from "react-router-dom";
import "./MainLayout.css";

const MainLayout = () => {
  const [expandedPanel, setExpandedPanel] = useState(null);
  const location = useLocation();

  // Show header on dashboard and broadcast dashboard pages
  const shouldShowHeader = location.pathname === '/' || location.pathname === '/broadcast-dashboard';

  return (
    <div className="main-layout">
      <Sidebar expandedPanel={expandedPanel} setExpandedPanel={setExpandedPanel} />
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
