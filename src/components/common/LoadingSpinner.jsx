import React from 'react';

const LoadingSpinner = ({ size = "medium" }) => {
    const sizeClasses = {
        small: "w-4 h-4",
        medium: "w-8 h-8",
        large: "w-12 h-12"
    };

    return (
        <div className={`spinner-border animate-spin inline-block rounded-full border-4 border-t-transparent border-blue-600 ${sizeClasses[size]}`} role="status">
            <span className="visually-hidden">Loading...</span>
        </div>
    );
};

export default LoadingSpinner;
