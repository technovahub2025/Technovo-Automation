import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet } from "react-router-dom";
import "./MainLayout.css";

const MainLayout = ({ children }) => {
    return (
        <div className="main-layout">
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
