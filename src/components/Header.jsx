import React, { useEffect, useRef, useState } from "react";
import { Search, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { whatsappService } from "../services/whatsappService";
import "./Header.css";

const Header = () => {
  const navigate = useNavigate();
  const [showNotificationBox, setShowNotificationBox] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const closeTimerRef = useRef(null);

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
    const toCount = (value) => {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    };

    const loadNotifications = async () => {
      try {
        const [conversations, contacts] = await Promise.all([
          whatsappService.getConversations(),
          whatsappService.getContacts()
        ]);

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
      } catch (error) {
        console.error("Failed to load notifications:", error);
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadNotifications();
    const timerId = setInterval(loadNotifications, 20000);
    return () => clearInterval(timerId);
  }, []);

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

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="page-title">Dashboard</h2>
      </div>

      <div className="header-right">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

        <div
          className="notification-wrap"
          ref={notificationRef}
          onMouseEnter={openNotificationBox}
          onMouseLeave={closeNotificationBoxWithDelay}
        >
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowNotificationBox((prev) => !prev)}
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
            ) : (
              <span className="notification-dot"></span>
            )}
          </button>

          {showNotificationBox && (
            <div className="notification-box">
              <div className="notification-box-title">Notifications</div>
              {notifications.length === 0 ? (
                <div className="notification-box-item muted">
                  <span>No unread messages</span>
                </div>
              ) : (
                notifications.map((item) => (
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
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
