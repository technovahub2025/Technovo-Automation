import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../pages/authcontext';
import LoadingSpinner from '../common/LoadingSpinner';
import {
    resolveAgentWorkspaceState,
    resolveWorkspaceSettingsAccessState
} from '../../utils/agentAccess';
import { stripAppRouteBase } from '../../utils/appRouteBase';

const hasFeatureAccess = (user, requiredFeature) => {
    if (!requiredFeature) return true;
    if (user?.role === 'superadmin') return true;
    if (requiredFeature === 'userManagement') {
        return resolveWorkspaceSettingsAccessState(user);
    }

    const featureFlags = user?.featureFlags || {};
    if (Array.isArray(requiredFeature)) {
        return requiredFeature.some((feature) => Boolean(featureFlags?.[feature]));
    }

    return Boolean(featureFlags?.[requiredFeature]);
};

const ProtectedRoute = ({ children, requiredRole, requiredFeature, requireAuth = true }) => {
    const context = useContext(AuthContext);
    const location = useLocation();

    if (!context) {
        console.error("AuthContext is undefined. Ensure AuthProvider wraps the app.");
        return <Navigate to="/login" replace />;
    }

    const { user } = context;
    const currentPath = stripAppRouteBase(location.pathname);
    const isAuthenticated = !!user;
    const isAgentWorkspace = resolveAgentWorkspaceState(user);
    const isAgentRestricted = isAgentWorkspace && user?.role !== 'superadmin';
    const agentAllowedRoutes = [
        { path: '/inbox', nested: true },
        { path: '/bulk-messages', nested: true },
        { path: '/broadcast-dashboard', nested: false },
        { path: '/broadcast', nested: true },
        { path: '/templates', nested: false },
        { path: '/contacts', nested: false },
        { path: '/crm', nested: true },
        { path: '/meta-ads', nested: true },
        { path: '/ads-manager', nested: false },
        { path: '/insights', nested: false },
        { path: '/meta-connect', nested: false }
    ];
    const isAgentAllowedRoute = isAgentRestricted &&
        agentAllowedRoutes.some(({ path, nested }) =>
            currentPath === path || (nested && currentPath.startsWith(`${path}/`))
        );

    if (requireAuth && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (isAgentRestricted && !isAgentAllowedRoute) {
        return <Navigate to="/inbox" replace />;
    }

    if (isAgentAllowedRoute) {
        return children;
    }

    if (requiredRole && isAuthenticated) {
        if (requiredRole === 'superadmin' && user?.role !== 'superadmin') {
            return <Navigate to={isAgentRestricted ? '/inbox' : '/'} replace />;
        }

        if (requiredRole === 'admin' && !['admin', 'superadmin'].includes(user?.role)) {
            return <Navigate to={isAgentRestricted ? '/inbox' : '/'} replace />;
        }
    }

    if (requireAuth && isAuthenticated && requiredFeature && !hasFeatureAccess(user, requiredFeature)) {
        return <Navigate to={isAgentRestricted ? '/inbox' : '/'} replace />;
    }

    return children;
};

export default ProtectedRoute;
