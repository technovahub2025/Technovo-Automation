import React from 'react';
import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../pages/authcontext';
import LoadingSpinner from '../common/LoadingSpinner';

const hasFeatureAccess = (user, requiredFeature) => {
    if (!requiredFeature) return true;
    if (user?.role === 'superadmin') return true;

    const featureFlags = user?.featureFlags || {};
    if (Array.isArray(requiredFeature)) {
        return requiredFeature.some((feature) => Boolean(featureFlags?.[feature]));
    }

    return Boolean(featureFlags?.[requiredFeature]);
};

const ProtectedRoute = ({ children, requiredRole, requiredFeature, requireAuth = true }) => {
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

    if (requireAuth && isAuthenticated && requiredFeature && !hasFeatureAccess(user, requiredFeature)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
