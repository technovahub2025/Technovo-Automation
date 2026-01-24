import React from 'react';

const AdminsList = ({ refreshTrigger }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Admins List</h2>
            <p className="text-gray-500">List placeholder (Trigger: {refreshTrigger})</p>
        </div>
    );
};

export default AdminsList;
