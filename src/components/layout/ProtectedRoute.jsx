import React from 'react';
import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../pages/authcontext';
import LoadingSpinner from '../common/LoadingSpinner';

const ProtectedRoute = ({ children, requiredRole, requireAuth = true }) => {
    const context = useContext(AuthContext);

    if (!context) {
        console.error("AuthContext is undefined. Ensure AuthProvider wraps the app.");
        return <Navigate to="/login" replace />;
    }

    const { user } = context;
    const isAuthenticated = !!user;

    if (requireAuth && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && isAuthenticated) {
        if (requiredRole === 'superadmin' && user?.role !== 'superadmin') {
            return <Navigate to="/" replace />;
        }

        if (requiredRole === 'admin' && !['admin', 'superadmin'].includes(user?.role)) {
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
