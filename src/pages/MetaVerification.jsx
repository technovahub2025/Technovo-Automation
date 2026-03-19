import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./MetaVerification.css";
import "../styles/theme.css";

const MetaVerification = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [openUserId, setOpenUserId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollYRef = useRef(0);
  const [registeredAdmins, setRegisteredAdmins] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("registeredAdmins") || "[]");
    } catch {
      return [];
    }
  });

  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  const isSuperAdmin = storedUser?.role === "superadmin";

  const loadDocuments = async () => {
    if (!API_URL) {
      setError("API not configured");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const endpoint = isSuperAdmin ? "/api/admin/meta-documents" : "/api/meta-documents";
    try {
      const res = await axios.get(`${API_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setDocuments(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (docId, status) => {
    if (!API_URL) return;
    setActionLoading(docId);
    scrollYRef.current = window.scrollY;
    try {
      await axios.post(
        `${API_URL}/api/meta-documents/${docId}/approve`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setDocuments((prev) =>
        prev.map((doc) => (doc._id === docId ? { ...doc, status } : doc))
      );
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollYRef.current, behavior: "auto" });
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update document.");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const groupedUsers = documents.reduce((acc, doc) => {
    const userKey = doc.userId?._id || doc.userId || "unknown";
    if (!acc[userKey]) {
      acc[userKey] = {
        userId: userKey,
        username: doc.userId?.username || doc.username || "-",
        email: doc.userId?.email || doc.email || "-",
        companyName: doc.companyId?.name || doc.companyName || "-",
        docs: []
      };
    }
    acc[userKey].docs.push(doc);
    return acc;
  }, {});

  const userCards = Object.values(groupedUsers).filter((group) => {
    const hasIdentity =
      group.username && group.username !== "-" && group.email && group.email !== "-";
    return hasIdentity && group.docs.length > 0;
  });

  const readyForAdmin = userCards.filter(
    (group) => group.docs.length > 0 && group.docs.every((d) => d.status === "approved")
  );
  const readyForAdminVisible = readyForAdmin.filter(
    (group) => !registeredAdmins.includes(group.userId)
  );
  const historyUsers = readyForAdmin.filter((group) =>
    registeredAdmins.includes(group.userId)
  );

  const queueUsers = userCards.filter((group) => !registeredAdmins.includes(group.userId));

  const handleSendToAdmin = (userInfo) => {
    const tempPassword = `Nx@${Math.random().toString(36).slice(-8)}`;
    localStorage.setItem(
      "pendingAdminRegistration",
      JSON.stringify({
        username: userInfo.username,
        email: userInfo.email,
        password: tempPassword
      })
    );
    const nextRegistered = Array.from(new Set([...registeredAdmins, userInfo.userId]));
    setRegisteredAdmins(nextRegistered);
    localStorage.setItem("registeredAdmins", JSON.stringify(nextRegistered));
    navigate("/admin");
  };

  return (
    <div className="nx-page meta-page">
      <header className="nx-page__header">
        <h1 className="nx-title">Document Approvals</h1>
        <p className="nx-subtitle">
          Review newly registered users and approve their verification documents.
        </p>
      </header>

      <div className="meta-status">
        <span className="status-pill pending">Pending</span>
        <p>Review newly submitted documents from registered users.</p>
      </div>

      {isSuperAdmin && (
        <div className="meta-ready">
          <div className="meta-ready__header">
            <div>
              <h2>Ready For Admin Registration</h2>
              <p>All documents approved. Send these users to Admin Setup.</p>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowHistory((prev) => !prev)}
              disabled={historyUsers.length === 0}
            >
              {showHistory ? "Hide History" : "History"}
            </button>
          </div>
          {readyForAdminVisible.length === 0 ? (
            <div className="meta-empty">No users ready yet.</div>
          ) : (
            <div className="meta-ready__grid">
              {readyForAdminVisible.map((userInfo) => (
                <div key={userInfo.userId} className="meta-ready__card">
                  <div>
                    <div className="meta-doc__title">{userInfo.username}</div>
                    <span className="meta-muted">{userInfo.email}</span>
                    <span className="meta-muted">{userInfo.companyName}</span>
                  </div>
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => handleSendToAdmin(userInfo)}
                  >
                    Register Admin
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && showHistory && historyUsers.length > 0 && (
        <div className="meta-history" id="verification-history">
          <h2>Verification History</h2>
          <p>Verified users that have been registered as admins.</p>
          <div className="meta-ready__grid">
            {historyUsers.map((userInfo) => (
              <div key={userInfo.userId} className="meta-ready__card">
                <div>
                  <div className="meta-doc__title">{userInfo.username}</div>
                  <span className="meta-muted">{userInfo.email}</span>
                  <span className="meta-muted">{userInfo.companyName}</span>
                </div>
                <span className="status-pill approved">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="meta-review">
        <div className="meta-review__header">
          <h2>Verification Queue</h2>
          <p>Open a user to review documents and approve or reject each item.</p>
        </div>
        {loading ? (
          <div className="meta-empty">Loading documents...</div>
        ) : error ? (
          <div className="meta-empty">{error}</div>
        ) : queueUsers.length === 0 ? (
          <div className="meta-empty">No documents submitted yet.</div>
        ) : (
          <div className="meta-cards">
            {queueUsers.map((userInfo) => {
              const allApproved = userInfo.docs.every((doc) => doc.status === "approved");
              const isOpen = openUserId === userInfo.userId;
              return (
                <div key={userInfo.userId} className="meta-user-card">
                  <div className="meta-user-card__header">
                    <div>
                      <div className="meta-doc__title">{userInfo.username}</div>
                      <span className="meta-muted">{userInfo.email}</span>
                      <span className="meta-muted">{userInfo.companyName}</span>
                    </div>
                    <div className="meta-user-card__actions">
                      <span className={`status-pill ${allApproved ? "approved" : "pending"}`}>
                        {allApproved ? "Verified" : "Pending"}
                      </span>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setOpenUserId(isOpen ? null : userInfo.userId)}
                      >
                        {isOpen ? "Close" : "Open"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="meta-user-card__body">
                      {userInfo.docs.map((doc) => (
                        <div key={doc._id} className="meta-doc-row">
                          <div>
                            <div className="meta-doc__title">{doc.docType}</div>
                            <a href={doc.url} target="_blank" rel="noreferrer">
                              View file
                            </a>
                          </div>
                          <span className={`status-pill ${doc.status || "pending"}`}>
                            {doc.status || "pending"}
                          </span>
                          <span className="meta-time">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "--"}
                          </span>
                          <div className="meta-actions">
                            <button
                              type="button"
                              className="approve-btn"
                              onClick={() => updateStatus(doc._id, "approved")}
                              disabled={actionLoading === doc._id}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="reject-btn"
                              onClick={() => updateStatus(doc._id, "rejected")}
                              disabled={actionLoading === doc._id}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaVerification;
