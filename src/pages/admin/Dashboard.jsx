import React from 'react';
import Sidebar from '../../components/Sidebar';

const AdminDashboard = () => {
    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 p-8">
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p>Welcome, Admin.</p>
            </div>
        </div>
    );
};

export default AdminDashboard;
