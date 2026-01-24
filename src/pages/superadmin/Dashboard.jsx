import React from 'react';
import Sidebar from '../../components/Sidebar';

const SuperadminDashboard = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 p-8">
                <h1 className="text-2xl font-bold">Superadmin Dashboard</h1>
                <p>Welcome, Superadmin.</p>
            </div>
        </div>
    );
};

export default SuperadminDashboard;
