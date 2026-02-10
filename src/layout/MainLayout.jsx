import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './MainLayout.css';

const MainLayout = ({ children }) => {
    const [expandedPanel, setExpandedPanel] = useState(null);
    const location = useLocation();

    // Only show header on broadcast page
    const shouldShowHeader = location.pathname === '/';

    return (
        <div className="main-layout">
            <Sidebar expandedPanel={expandedPanel} setExpandedPanel={setExpandedPanel} />
            <div className={`main-content ${expandedPanel ? 'content-shifted' : ''}`}>
                {shouldShowHeader && <Header />}
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
