import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Info, Menu, PackageCheck, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";
import { me } from "../../api/student";
import { brand } from "../../config/brand";
import useDocumentScrollLock from "../../hooks/useDocumentScrollLock";
import "../../styles/admin-topbar-notifications.css";

function AdminTopbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const panelRef = useRef(null);
  const notificationPanelRef = useRef(null);
  const [notificationPosition, setNotificationPosition] = useState({ top: 76, right: 16 });

  useEffect(() => {
    let cancelled = false;

    me()
      .then((data) => {
        if (!cancelled) setUser(data?.user ?? data?.data ?? data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useDocumentScrollLock(notificationsOpen);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    setNotificationError("");

    try {
      const response = await apiClient.get("/admin/notifications");
      if (response.data?.success) {
        setNotifications(response.data.data ?? []);
        setUnreadCount(Number(response.data.unread_count ?? 0));
      }
    } catch (error) {
      setNotificationError(
        error.response?.data?.message || "Could not load notifications."
      );
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const toggleNotifications = () => {
    const next = !notificationsOpen;
    if (next && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setNotificationPosition({
        top: Math.round(rect.bottom + 10),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
      loadNotifications();
    }
    setNotificationsOpen(next);
  };

  async function markRead(notification) {
    if (notification.read_at) return;

    try {
      await apiClient.patch(
        `/admin/notifications/${notification.id}/read`
      );

      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      setNotificationError(
        error.response?.data?.message || "Could not mark as read."
      );
    }
  }

  async function markAllRead() {
    try {
      await apiClient.patch("/admin/notifications/read-all");

      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      setNotificationError(
        error.response?.data?.message || "Could not mark all as read."
      );
    }
  }

  function handleNotificationClick(notification) {
    markRead(notification);
    if (notification.url) {
      const path = notification.url.startsWith("/")
        ? notification.url
        : `/${notification.url}`;
      navigate(path);
      setNotificationsOpen(false);
    }
  }

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const displayName =
    user?.name ||
    user?.full_name ||
    user?.email?.split("@")[0] ||
    "Administrator";

  const roleLabel =
    user?.role === "admin" ? "System Admin" : user?.role || "Admin";

  const notificationIcon = (notification) => {
    const text = `${notification.title || ""} ${notification.message || ""}`.toLowerCase();
    if (text.includes("shipment") || text.includes("pickup")) return PackageCheck;
    if (text.includes("order") || text.includes("payment")) return ShoppingBag;
    return Info;
  };

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__left">
        <button
          type="button"
          className="admin-topbar__menu"
          onClick={onMenuClick}
          aria-label="Open admin navigation"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="admin-topbar__context">
          <span className="admin-topbar__eyebrow">Admin workspace</span>
          <strong>{brand.name}</strong>
        </div>
      </div>

      <div className="admin-topbar__right">
        <div className="admin-notifications" ref={panelRef}>
          <button
            type="button"
            className="admin-topbar__icon admin-notifications__trigger"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={toggleNotifications}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="admin-notifications__badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && createPortal(
            <div
              className="ui-overlay ui-notification-layer"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setNotificationsOpen(false);
              }}
            >
            <section
              ref={notificationPanelRef}
              className="admin-notifications__panel ui-scroll-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Admin notifications"
              style={{
                "--notification-top": `${notificationPosition.top}px`,
                "--notification-right": `${notificationPosition.right}px`,
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="admin-notifications__header">
                <div>
                  <strong>Notifications</strong>
                  <span>{unreadCount} unread</span>
                </div>

                <button
                  type="button"
                  className="admin-notifications__read-all"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              </div>

              {notificationError && (
                <p className="admin-notifications__error" role="alert">
                  {notificationError}
                </p>
              )}

              {loadingNotifications ? (
                <p className="admin-notifications__empty">Loading...</p>
              ) : notifications.length === 0 ? (
                <div className="admin-notifications__empty">
                  <Bell size={22} />
                  <strong>You're all caught up</strong>
                  <span>No notifications yet.</span>
                </div>
              ) : (
                <div className="admin-notifications__list ui-scroll-dialog__body" data-scroll-lock-allow>
                  {notifications.map((notification) => (
                    (() => {
                      const NotificationIcon = notificationIcon(notification);
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          className={`admin-notifications__item${notification.read_at ? "" : " is-unread"}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <span className="admin-notifications__item-icon"><NotificationIcon size={17} /></span>
                          <span className="admin-notifications__copy">
                            <span className="admin-notifications__item-top"><strong>{notification.title}</strong>{!notification.read_at && <i>New</i>}</span>
                            <span>{notification.message}</span>
                            <small>{formatRelativeTime(notification.created_at)}</small>
                          </span>
                        </button>
                      );
                    })()
                  ))}
                </div>
              )}

              <button
                type="button"
                className="admin-notifications__refresh"
                onClick={loadNotifications}
                disabled={loadingNotifications}
              >
                Refresh notifications
              </button>
            </section>
            </div>,
            document.body,
          )}
        </div>

        <div className="admin-topbar__divider" />

        <div className="admin-topbar__profile">
          <span className="admin-topbar__avatar" aria-hidden="true">
            {displayName.trim().charAt(0).toUpperCase()}
          </span>

          <div className="admin-topbar__profile-copy">
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdminTopbar;
