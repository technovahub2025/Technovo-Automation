import React, { useContext, useEffect, useRef, useState } from "react";
import { Search, Bell, BellOff, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { whatsappService } from "../services/whatsappService";
import { crmService } from "../services/crmService";
import socketService from "../services/socketService";
import { AuthContext } from "../pages/authcontext";
import {
  TEAM_INBOX_NOTIFICATION_MODES,
  getTeamInboxNotificationMode,
  setTeamInboxNotificationMode,
  TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT
} from "../pages/teamInbox/teamInboxNotificationUtils";
import "./Header.css";

const NOTIFICATION_MODE_OPTIONS = [
  {
    value: TEAM_INBOX_NOTIFICATION_MODES.NOTIFICATION,
    label: "Notification",
    icon: Bell,
    showDot: true
  },
  {
    value: TEAM_INBOX_NOTIFICATION_MODES.SILENT,
    label: "Notification Silent",
    icon: VolumeX
  },
  {
    value: TEAM_INBOX_NOTIFICATION_MODES.OFF,
    label: "Notification Off",
    icon: BellOff
  }
];

const NOTIFICATION_MODE_HELP_TEXT = {
  [TEAM_INBOX_NOTIFICATION_MODES.NOTIFICATION]:
    "System notifications appear normally with sound.",
  [TEAM_INBOX_NOTIFICATION_MODES.SILENT]:
    "System notifications appear silently without sound.",
  [TEAM_INBOX_NOTIFICATION_MODES.OFF]:
    "System notifications are turned off for Team Inbox."
};

const Header = () => {
  const navigate = useNavigate();
  const { user, refreshFromBackend } = useContext(AuthContext);
  const [showNotificationBox, setShowNotificationBox] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [docNotifications, setDocNotifications] = useState([]);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [crmOwnerNotifications, setCrmOwnerNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationMode, setNotificationModeState] = useState(() =>
    getTeamInboxNotificationMode()
  );
  const notificationRef = useRef(null);
  const closeTimerRef = useRef(null);
  const shownCrmNotificationIdsRef = useRef(new Set());
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  const storedUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
  const isRealName = (value) => {
    const name = String(value || "").trim();
    return Boolean(name) && !/^\+?\d+$/.test(name);
  };
  const resolveContactName = (conversation, contactNameMap) => {
    const conversationName = String(conversation?.contactName || "").trim();
    if (isRealName(conversationName)) return conversationName;

    const phone = normalizePhone(conversation?.contactPhone);
    if (phone && contactNameMap.has(phone)) return contactNameMap.get(phone);

    if (phone.length > 10) {
      const last10 = phone.slice(-10);
      if (contactNameMap.has(last10)) return contactNameMap.get(last10);
    }

    return conversation?.contactPhone || conversationName || "Unknown";
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target)) {
        setShowNotificationBox(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleNotificationModePreferenceChange = (event) => {
      setNotificationModeState(String(event?.detail?.mode || getTeamInboxNotificationMode()));
    };

    window.addEventListener(
      TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
      handleNotificationModePreferenceChange
    );

    return () => {
      window.removeEventListener(
        TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
        handleNotificationModePreferenceChange
      );
    };
  }, []);

  useEffect(() => {
    socketService.connect(import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_SOCKET_URL);
    const refreshNotifications = async () => {
      await refreshFromBackend();
    };

    socketService.on("documents.updated", refreshNotifications);
    socketService.on("workspace.access.updated", refreshNotifications);

    return () => {
      socketService.off("documents.updated", refreshNotifications);
      socketService.off("workspace.access.updated", refreshNotifications);
    };
  }, [refreshFromBackend]);

  useEffect(() => {
    const toCount = (value) => {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    };

    const loadNotifications = async () => {
      try {
        const requests = [
          whatsappService.getConversations(),
          whatsappService.getContacts(),
          crmService.getOwnerNotifications({ status: "unread", limit: 12 })
        ];
        if (API_URL && token) {
          requests.push(
            axios.get(`${API_URL}/api/meta-documents?status=rejected`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        }

        const results = await Promise.all(requests);
        const conversations = results[0];
        const contacts = results[1];
        const crmNotificationsResult = results[2];
        const rejectedDocs = results[3]?.data?.data || [];

        const contactNameMap = new Map();
        (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
          const contactName = String(contact?.name || "").trim();
          if (!isRealName(contactName)) return;

          const phone = normalizePhone(contact?.phone || contact?.contactPhone);
          if (!phone) return;
          contactNameMap.set(phone, contactName);
          if (phone.length > 10) contactNameMap.set(phone.slice(-10), contactName);
        });

        const sorted = [...(Array.isArray(conversations) ? conversations : [])].sort((a, b) => {
          const aTime = new Date(a?.lastMessageTime || 0).getTime();
          const bTime = new Date(b?.lastMessageTime || 0).getTime();
          return bTime - aTime;
        });

        const totalUnread = sorted.reduce(
          (sum, conv) =>
            sum +
            toCount(
              conv?.unreadCount ??
                conv?.unread_count ??
                conv?.unreadMessages ??
                0
            ),
          0
        );
        setUnreadCount(totalUnread);

        const unreadOnly = sorted.filter(
          (conv) =>
            toCount(
              conv?.unreadCount ??
                conv?.unread_count ??
                conv?.unreadMessages ??
                0
            ) > 0
        );

        const unreadTop = unreadOnly.slice(0, 5);
        const mapped = await Promise.all(
          unreadTop.map(async (conv) => {
            const unread = toCount(
              conv?.unreadCount ?? conv?.unread_count ?? conv?.unreadMessages ?? 0
            );
            const fallbackMessage = unread > 1 ? `${unread} unread messages` : "1 unread message";
            const baseItem = {
              id: conv?._id || `${conv?.contactPhone || "unknown"}-${conv?.lastMessageTime || ""}`,
              conversationId: conv?._id || null,
              name: resolveContactName(conv, contactNameMap),
              message: fallbackMessage,
              unread,
              time: conv?.lastMessageTime || null
            };

            if (!conv?._id) return baseItem;

            try {
              const messages = await whatsappService.getMessages(conv._id);
              const latestUnread = [...(Array.isArray(messages) ? messages : [])]
                .filter(
                  (msg) =>
                    String(msg?.sender || "").toLowerCase() === "contact" &&
                    String(msg?.status || "").toLowerCase() === "received"
                )
                .sort(
                  (a, b) =>
                    new Date(b?.timestamp || b?.createdAt || 0).getTime() -
                    new Date(a?.timestamp || a?.createdAt || 0).getTime()
                )[0];

              if (!latestUnread) return baseItem;

              return {
                ...baseItem,
                message: latestUnread?.text || fallbackMessage,
                time: latestUnread?.timestamp || latestUnread?.createdAt || baseItem.time
              };
            } catch {
              return baseItem;
            }
          })
        );
        setNotifications(mapped);

        const ownerAlerts = Array.isArray(crmNotificationsResult?.data)
          ? crmNotificationsResult.data.map((item) => ({
              id: item?._id || "",
              title: item?.contact?.name || item?.contact?.phone || "Assigned lead",
              message:
                item?.recommendedTemplate
                  ? `Recommended template: ${item.recommendedTemplate}`
                  : "A CRM automation alert needs your attention.",
              time: item?.createdAt || null,
              contactId: item?.contact?._id || "",
              phone: item?.contact?.phone || "",
              automationRule: item?.automationRule || ""
            }))
          : [];
        setCrmOwnerNotifications(ownerAlerts);

        const docAlerts = (Array.isArray(rejectedDocs) ? rejectedDocs : []).map((doc) => ({
          id: doc._id || `${doc.docType}-${doc.createdAt || ""}`,
          docType: doc.docType || "Document",
          message:
            "Document rejected. Please reupload or contact support at technovahubcarrer@gmail.com.",
          time: doc.updatedAt || doc.createdAt || null
        }));
        setDocNotifications(docAlerts);

        const normalizedWorkspaceAccessState = String(
          storedUser?.workspaceAccessState || storedUser?.subscriptionStatus || ""
        ).toLowerCase();
        const normalizedDocumentStatus = String(storedUser?.documentStatus || "").toLowerCase();
        const approvalNotifications = [];

        if (
          storedUser &&
          storedUser?.role !== "superadmin" &&
          normalizedWorkspaceAccessState === "active" &&
          normalizedDocumentStatus === "approved"
        ) {
          approvalNotifications.push({
            id: `documents-approved-${storedUser?.companyId || storedUser?.email || storedUser?.username || "user"}`,
            title: "Documents Approved",
            message: "Your documents have been approved by the superadmin. Your workspace is now fully active.",
            time: new Date().toISOString(),
            persistent: true
          });
        }

        const adminNoticeKey = storedUser?.email
          ? `adminApprovedNotified:${storedUser.email.toLowerCase()}`
          : storedUser?.username
            ? `adminApprovedNotified:${storedUser.username.toLowerCase()}`
            : "adminApprovedNotified";
        const shouldShowAdminNotice =
          storedUser?.role === "admin" && !localStorage.getItem(adminNoticeKey);
        setSystemNotifications(
          [
            ...approvalNotifications,
            ...(shouldShowAdminNotice
              ? [
                  {
                    id: `admin-approved-${storedUser?.email || storedUser?.username || "user"}`,
                    title: "Account Approved",
                    message:
                      "Your verification is complete and your admin access is now active.",
                    time: new Date().toISOString()
                  }
                ]
              : [])
          ]
        );

        if (
          notificationMode !== TEAM_INBOX_NOTIFICATION_MODES.OFF &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          window.Notification?.permission === "granted"
        ) {
          ownerAlerts.forEach((item) => {
            if (!item.id || shownCrmNotificationIdsRef.current.has(item.id)) return;
            shownCrmNotificationIdsRef.current.add(item.id);
            try {
              const notification = new window.Notification(item.title, {
                body: item.message,
                tag: `crm-owner-alert:${item.id}`,
                renotify: true,
                silent: notificationMode === TEAM_INBOX_NOTIFICATION_MODES.SILENT
              });
              notification.onclick = () => {
                window.focus?.();
                navigate("/crm/ops");
                notification.close();
              };
              window.setTimeout(() => notification.close(), 8000);
            } catch {
              // ignore browser notification failures
            }
          });
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
        setNotifications([]);
        setUnreadCount(0);
        setDocNotifications([]);
        setSystemNotifications([]);
        setCrmOwnerNotifications([]);
      }
    };

    loadNotifications();
    const timerId = setInterval(loadNotifications, 20000);
    return () => clearInterval(timerId);
  }, [API_URL, token, storedUser]);

  const formatNotificationTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const openNotificationBox = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowNotificationBox(true);
    if (systemNotifications.some((item) => !item.persistent) && storedUser) {
      const adminNoticeKey = storedUser?.email
        ? `adminApprovedNotified:${storedUser.email.toLowerCase()}`
        : storedUser?.username
          ? `adminApprovedNotified:${storedUser.username.toLowerCase()}`
          : "adminApprovedNotified";
      try {
        localStorage.setItem(adminNoticeKey, "1");
      } catch {
        // ignore storage issues
      }
      setSystemNotifications((prev) => prev.filter((item) => item.persistent));
    }
  };

  const closeNotificationBoxWithDelay = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setShowNotificationBox(false);
    }, 220);
  };

  const handleNotificationClick = (item) => {
    if (!item?.conversationId) return;
    setShowNotificationBox(false);
    navigate(`/inbox/${item.conversationId}`);
  };

  const handleNotificationModeChange = (mode) => {
    setNotificationModeState(setTeamInboxNotificationMode(mode));
  };

  const handleCrmOwnerNotificationClick = async (item) => {
    if (item?.id) {
      await crmService.markOwnerNotificationRead(item.id);
      setCrmOwnerNotifications((previous) => previous.filter((entry) => entry.id !== item.id));
    }
    setShowNotificationBox(false);
    navigate("/crm/ops");
  };

  const handleSystemNotificationClick = () => {
    const hasDismissableSystemNotice = systemNotifications.some((item) => !item.persistent);
    if (storedUser) {
      const adminNoticeKey = storedUser?.email
        ? `adminApprovedNotified:${storedUser.email.toLowerCase()}`
        : storedUser?.username
          ? `adminApprovedNotified:${storedUser.username.toLowerCase()}`
          : "adminApprovedNotified";
      try {
        localStorage.setItem(adminNoticeKey, "1");
      } catch {
        // ignore storage issues
      }
    }
    if (hasDismissableSystemNotice) {
      setSystemNotifications((prev) => prev.filter((item) => item.persistent));
    }
    setShowNotificationBox(false);
  };

  const totalNotifications =
    unreadCount + docNotifications.length + systemNotifications.length + crmOwnerNotifications.length;
  const notificationModeIndex = Math.max(
    0,
    NOTIFICATION_MODE_OPTIONS.findIndex((option) => option.value === notificationMode)
  );
  const notificationModeHelp =
    NOTIFICATION_MODE_HELP_TEXT[notificationMode] ||
    NOTIFICATION_MODE_HELP_TEXT[TEAM_INBOX_NOTIFICATION_MODES.SILENT];


  return (
    <header className="header">
      <div className="header-left">
        <h2 className="page-title">Dashboard</h2>
      </div>

      <div className="header-right">
        <button
          type="button"
          className="register-btn"
          onClick={() => navigate("/register-docs")}
        >
          Register Docs
        </button>

        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

        <div
          className="notification-wrap"
          ref={notificationRef}
        >
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowNotificationBox((prev) => !prev)}
          >
            <Bell size={20} />
            {totalNotifications > 0 ? (
              <span className="notification-count">{totalNotifications > 99 ? "99+" : totalNotifications}</span>
            ) : (
              <span className="notification-dot"></span>
            )}
          </button>

          {showNotificationBox && (
            <div className="notification-box">
              <div className="notification-box-header">
                <div className="notification-box-title">Notifications</div>
                <div className="notification-settings-panel">
                  <span className="notification-settings-label">Notification mode</span>
                  <span className="notification-settings-help">{notificationModeHelp}</span>
                  <div className="notification-mode-selector">
                    <div
                      className="notification-mode-track"
                      role="radiogroup"
                      aria-label="Team Inbox notification mode"
                      style={{ "--notification-mode-index": notificationModeIndex }}
                    >
                      <span className="notification-mode-thumb" aria-hidden="true" />
                      {NOTIFICATION_MODE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = notificationMode === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            aria-label={option.label}
                            className={`notification-mode-option ${
                              isActive ? "is-active" : ""
                            }`}
                            onClick={() => handleNotificationModeChange(option.value)}
                          >
                            <span
                              className={`notification-mode-option-icon ${
                                option.showDot ? "has-status-dot" : ""
                              }`}
                              aria-hidden="true"
                            >
                              <Icon size={22} strokeWidth={2.2} />
                              {option.showDot ? (
                                <span className="notification-mode-option-dot" />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="notification-mode-labels" aria-hidden="true">
                      {NOTIFICATION_MODE_OPTIONS.map((option) => (
                        <span
                          key={option.value}
                          className={`notification-mode-label ${
                            notificationMode === option.value ? "is-active" : ""
                          }`}
                        >
                          {option.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {docNotifications.length === 0 &&
              notifications.length === 0 &&
              crmOwnerNotifications.length === 0 &&
              systemNotifications.length === 0 ? (
                <div className="notification-box-item muted">
                  <span>No unread messages</span>
                </div>
              ) : (
                <>
                  {crmOwnerNotifications.length > 0 && (
                    <div className="notification-box-section">CRM Owner Alerts</div>
                  )}
                  {crmOwnerNotifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="notification-box-item"
                      onClick={() => handleCrmOwnerNotificationClick(item)}
                    >
                      <span className="notification-mini-dot active"></span>
                      <div className="notification-content">
                        <div className="notification-top-row">
                          <strong>{item.title}</strong>
                          <span>{formatNotificationTime(item.time)}</span>
                        </div>
                        <div className="notification-message">{item.message}</div>
                      </div>
                    </button>
                  ))}

                  {systemNotifications.length > 0 && (
                    <div className="notification-box-section">Account Updates</div>
                  )}
                  {systemNotifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="notification-box-item"
                      onClick={handleSystemNotificationClick}
                    >
                      <span className="notification-mini-dot active"></span>
                      <div className="notification-content">
                        <div className="notification-top-row">
                          <strong>{item.title}</strong>
                          <span>{formatNotificationTime(item.time)}</span>
                        </div>
                        <div className="notification-message">{item.message}</div>
                      </div>
                    </button>
                  ))}

                  {docNotifications.length > 0 && (
                    <div className="notification-box-section">Document Alerts</div>
                  )}
                  {docNotifications.map((item) => (
                    <div key={item.id} className="notification-box-item">
                      <span className="notification-mini-dot active"></span>
                      <div className="notification-content">
                        <div className="notification-top-row">
                          <strong>{item.docType}</strong>
                          <span>{formatNotificationTime(item.time)}</span>
                        </div>
                        <div className="notification-message">
                          {item.message}
                        </div>
                      </div>
                    </div>
                  ))}

                  {notifications.length > 0 && (
                    <div className="notification-box-section">Unread Messages</div>
                  )}
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="notification-box-item"
                      onClick={() => handleNotificationClick(item)}
                    >
                      <span className={`notification-mini-dot ${item.unread > 0 ? "active" : ""}`}></span>
                      <div className="notification-content">
                        <div className="notification-top-row">
                          <strong>{item.name}</strong>
                          <span>{formatNotificationTime(item.time)}</span>
                        </div>
                        <div className="notification-message">{item.message}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </header>
  );
};

export default Header;
