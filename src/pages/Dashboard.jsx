import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RegisterDocuments from "./RegisterDocuments";
import socketService from "../services/socketService";
import { AuthContext } from "./authcontext";

const resolveLandingUrl = () =>
  import.meta.env.VITE_LANDING_DASHBOARD_URL || "http://localhost:5174/nexion/landingpage/";

const getStoredToken = () => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  return (
    localStorage.getItem(tokenKey) ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem(tokenKey) ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
};

const Dashboard = () => {
  const iframeRef = useRef(null);
  const pendingOpenPricingRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshFromBackend } = useContext(AuthContext);
  const [viewMode, setViewMode] = useState("landing");
  const [documentsSubmitted, setDocumentsSubmitted] = useState(false);
  const landingUrl = useMemo(() => resolveLandingUrl(), []);
  const landingOrigin = useMemo(() => {
    try {
      return new URL(landingUrl, window.location.origin).origin;
    } catch (error) {
      return window.location.origin;
    }
  }, [landingUrl]);

  const workspaceAccessState = String(user?.workspaceAccessState || "").toLowerCase();
  const subscriptionStatus = String(user?.subscriptionStatus || "").toLowerCase();
  const isTrialing = workspaceAccessState === "trialing" || subscriptionStatus === "trialing";
  const showDocumentWarning = ["paid_pending_documents", "paid_pending_review", "documents_rejected"].includes(
    workspaceAccessState
  );
  const shouldAutoOpenPricing = Boolean(location.state?.openPricing);

  useEffect(() => {
    if (workspaceAccessState === "paid_pending_documents" || workspaceAccessState === "documents_rejected") {
      setDocumentsSubmitted(false);
    }
    if (workspaceAccessState === "paid_pending_review" || workspaceAccessState === "active") {
      setDocumentsSubmitted(true);
    }
    if (workspaceAccessState === "active" && viewMode === "documents") {
      setViewMode("landing");
    }
  }, [workspaceAccessState, viewMode]);

  useEffect(() => {
    const handleOpenPricing = () => {
      openPricing();
    };

    const syncEmbeddedContext = () => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow) return;
      frameWindow.postMessage(
        {
          type: "nexion-access-context",
          embedded: true,
          user: user || null
        },
        landingOrigin
      );
    };

    const handleMessage = async (event) => {
      if (event.origin !== landingOrigin) return;
      const data = event?.data || {};

      if (data.type === "nexion-ready") {
        syncEmbeddedContext();
        if (pendingOpenPricingRef.current) {
          pendingOpenPricingRef.current = false;
          window.setTimeout(() => {
            iframeRef.current?.contentWindow?.postMessage({ type: "nexion-open-pricing" }, landingOrigin);
          }, 120);
        }
        return;
      }

      if (data.type === "nexion-auth-request") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "nexion-auth-response",
            token: getStoredToken(),
            user: user || null
          },
          landingOrigin
        );
        return;
      }

      if (data.type === "nexion-open-pricing-request") {
        setViewMode("landing");
        iframeRef.current?.contentWindow?.postMessage({ type: "nexion-open-pricing" }, landingOrigin);
        return;
      }

      if (data.type === "nexion-payment-verified") {
        await refreshFromBackend();
        setDocumentsSubmitted(false);
        setViewMode("documents");
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("nexion:open-pricing", handleOpenPricing);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("nexion:open-pricing", handleOpenPricing);
    };
  }, [landingOrigin, refreshFromBackend, user]);

  useEffect(() => {
    if (!shouldAutoOpenPricing) return;
    const timeoutId = window.setTimeout(() => {
      openPricing();
      navigate(location.pathname, { replace: true, state: null });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, navigate, shouldAutoOpenPricing]);

  useEffect(() => {
    const socket = socketService.connect(import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_SOCKET_URL);
    const refreshSession = async () => {
      await refreshFromBackend();
    };

    socketService.on("payment.updated", refreshSession);
    socketService.on("documents.updated", refreshSession);
    socketService.on("workspace.access.updated", refreshSession);

    return () => {
      socketService.off("payment.updated", refreshSession);
      socketService.off("documents.updated", refreshSession);
      socketService.off("workspace.access.updated", refreshSession);
      if (!socketService.isConnected()) {
        socket?.disconnect?.();
      }
    };
  }, [refreshFromBackend]);

  const openPricing = () => {
    setViewMode("landing");
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      pendingOpenPricingRef.current = true;
      return;
    }
    pendingOpenPricingRef.current = true;
    frameWindow.postMessage({ type: "nexion-open-pricing" }, landingOrigin);
  };

  const openDocuments = () => {
    setViewMode("documents");
  };

  const handleDocumentsComplete = async () => {
    setDocumentsSubmitted(true);
    await refreshFromBackend();
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
      {viewMode === "documents" ? (
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            borderRadius: "20px",
            border: "1px solid #dbeafe",
            padding: "20px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "16px"
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: "#0f172a", fontSize: "24px" }}>Document Upload</h3>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("landing")}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#0f172a",
                padding: "10px 14px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Back to Dashboard
            </button>
          </div>
          <RegisterDocuments embedded onComplete={handleDocumentsComplete} onCancel={() => setViewMode("landing")} />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: isTrialing ? "74vh" : "85vh",
            borderRadius: "18px",
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)"
          }}
        >
          <iframe
            ref={iframeRef}
            src={landingUrl}
            title="Nexion Dashboard"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              backgroundColor: "white"
            }}
          />
        </div>
      )}

      {isTrialing && viewMode !== "documents" ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={openPricing}
            style={{
              border: "none",
              borderRadius: "999px",
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              color: "#ffffff",
              padding: "14px 22px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 14px 28px rgba(37, 99, 235, 0.22)"
            }}
          >
            Buy Now
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
