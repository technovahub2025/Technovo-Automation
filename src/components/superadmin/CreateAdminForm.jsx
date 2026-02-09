import React from 'react';

const CreateAdminForm = ({ onSuccess }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Create Admin</h2>
            <p className="text-gray-500">Form placeholder</p>
            <button
                onClick={onSuccess}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                Simulate Create
            </button>
        </div>
    );
};

export default CreateAdminForm;
