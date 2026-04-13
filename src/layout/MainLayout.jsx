import React, { useState, useEffect, useContext } from 'react';
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./MainLayout.css";
import { AuthContext } from "../pages/authcontext";
import { stripAppRouteBase } from "../utils/appRouteBase";

const MainLayout = () => {
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [lastBulkMessageItem, setLastBulkMessageItem] = useState('/broadcast-dashboard');
  const [trialCountdown, setTrialCountdown] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = stripAppRouteBase(location.pathname);
  const { user } = useContext(AuthContext);
  const subscriptionStatus = String(user?.subscriptionStatus || "").toLowerCase();
  const workspaceAccessState = String(user?.workspaceAccessState || "").toLowerCase();
  const isExpired = workspaceAccessState === "expired_readonly" || subscriptionStatus === "expired";
  const isTrialing = workspaceAccessState === "trialing" || subscriptionStatus === "trialing";
  const trialEnd = user?.trialEnd ? new Date(user.trialEnd) : null;
  const trialUsage = user?.trialUsage || {};
  const trialLimits = user?.trialLimits || {};
  const documentStatus = String(user?.documentStatus || "").toLowerCase();
  // Track last active bulk message item when navigating to bulk message routes
  useEffect(() => {
    const bulkMessageRoutes = [
      '/broadcast-dashboard',
      '/broadcast',
      '/broadcast/new',
      '/broadcast/new/template',
      '/broadcast/new/message',
      '/templates',
      '/contacts',
      '/crm/pipeline',
      '/crm/tasks'
    ];
    const isInboxRoute = currentPath.startsWith('/inbox');
    if (bulkMessageRoutes.includes(currentPath) || isInboxRoute) {
      setLastBulkMessageItem(currentPath);
    }
  }, [currentPath]);

  useEffect(() => {
    if (!isTrialing || !trialEnd || Number.isNaN(trialEnd.getTime())) {
      setTrialCountdown("");
      return undefined;
    }

    const formatCountdown = (targetDate) => {
      const diffMs = Math.max(0, targetDate.getTime() - Date.now());
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    };

    setTrialCountdown(formatCountdown(trialEnd));
    const intervalId = window.setInterval(() => {
      setTrialCountdown(formatCountdown(trialEnd));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isTrialing, trialEnd]);

  const isFullPageRoute = false;
  // Show header on dashboard and broadcast dashboard pages
  const shouldShowHeader = !isFullPageRoute && (currentPath === '/' || currentPath === '/broadcast-dashboard');
  const openEmbeddedPricing = (event) => {
    event?.preventDefault?.();
    if (currentPath === "/") {
      window.dispatchEvent(new Event("nexion:open-pricing"));
      return;
    }
    navigate("/", { state: { openPricing: true } });
  };

  return (
    <div className="main-layout">
      {!isFullPageRoute && (
        <Sidebar 
          expandedPanel={expandedPanel} 
          setExpandedPanel={setExpandedPanel}
          lastBulkMessageItem={lastBulkMessageItem}
          setLastBulkMessageItem={setLastBulkMessageItem}
        />
      )}
      <div className={`main-content ${expandedPanel ? 'content-shifted' : ''} ${isFullPageRoute ? 'full-page' : ''}`}>
        {shouldShowHeader && <Header />}
        {isExpired && (
          <div className="plan-expired-banner">
            <div>
              <strong>Read-only mode.</strong> Your plan has expired. Analytics and history stay available, but actions are blocked until you upgrade.
            </div>
            <button type="button" onClick={openEmbeddedPricing} className="plan-expired-cta">
              Upgrade Now
            </button>
          </div>
        )}
        {workspaceAccessState === "paid_pending_documents" && (
          <div className="plan-expired-banner plan-state-banner">
            <div>
              <strong>Documents pending.</strong> Upload your verification files to continue workspace activation.
            </div>
            <button type="button" onClick={() => navigate("/register-docs")} className="plan-expired-cta">
              Complete Documents
            </button>
          </div>
        )}
        {workspaceAccessState === "paid_pending_review" && (
          <div className="plan-expired-banner plan-state-banner">
            <div>
              <strong>Verification in review.</strong> Your documents are submitted. You can browse in read-only mode until approval is complete.
            </div>
          </div>
        )}
        {workspaceAccessState === "documents_rejected" && (
          <div className="plan-expired-banner plan-state-banner plan-state-banner--warning">
            <div>
              <strong>Documents rejected.</strong> Please re-upload the requested documents to unlock actions.
            </div>
            <button type="button" onClick={() => navigate("/register-docs")} className="plan-expired-cta">
              Complete Documents
            </button>
          </div>
        )}
        {isTrialing && (
          <div className="plan-expired-banner">
            <div>
              <strong>3-Day Trial Active</strong>
              {" | Ends " + (trialEnd ? trialEnd.toLocaleString() : "soon")}
              {trialCountdown ? " | Time Left: " + trialCountdown : ""}
              {" - Unlock the full experience"}
            </div>
            <button type="button" onClick={openEmbeddedPricing} className="plan-expired-cta">
              View Plans
            </button>
          </div>
        )}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
