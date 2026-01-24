import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import CreateAdminForm from '../../components/superadmin/CreateAdminForm';
import AdminsList from '../../components/superadmin/AdminsList';

const AdminManagement = () => {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleAdminCreated = () => {
        // Trigger refresh of admins list
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />

            <div className="flex-1 overflow-auto">
                <div className="p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-800">Admin Management</h1>
                        <p className="text-gray-600 mt-2">Create and manage admin accounts for your platform</p>
                    </div>

                    {/* Two-Column Layout */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Left: Create Admin Form */}
                        <div>
                            <CreateAdminForm onSuccess={handleAdminCreated} />
                        </div>

                        {/* Right: Admins List */}
                        <div>
                            <AdminsList refreshTrigger={refreshTrigger} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminManagement;
