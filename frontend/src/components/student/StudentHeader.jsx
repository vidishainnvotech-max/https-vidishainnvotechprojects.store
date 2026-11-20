import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CheckCheck,
  CircleCheckBig,
  CreditCard,
  FolderKanban,
  Gift,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  PackageCheck,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

import apiClient, { setToken } from "../../api/client";
import { logout, me } from "../../api/student";
import BrandLogo from "../common/BrandLogo";
import useDocumentScrollLock from "../../hooks/useDocumentScrollLock";
import "../../styles/admin-topbar-notifications.css";
import "./student-header.css";

let cachedUser = null;

const studentLinks = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/student/orders", label: "My Orders", icon: ShoppingBag },
  { to: "/student/documentation", label: "Documentation", icon: BookOpen },
  { to: "/student/referrals", label: "Referrals & Rewards", icon: Gift },
  { to: "/student/ideas", label: "Suggest Your Idea", icon: Lightbulb },
];

const pageTitle = (pathname) => {
  if (/^\/student\/orders\/[^/]+/.test(pathname)) return "Order details";
  if (pathname.startsWith("/student/orders")) return "My Orders";
  if (pathname.startsWith("/student/documentation")) return "Documentation";
  if (pathname.startsWith("/student/referrals")) return "Referrals & Rewards";
  if (pathname.startsWith("/student/ideas")) return "Suggest Your Idea";
  if (pathname.startsWith("/student/projects")) return "Software workspace";
  return "Dashboard";
};

function StudentHeader() {
  const [user, setUser] = useState(cachedUser);
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const notificationsRef = useRef(null);
  const notificationPanelRef = useRef(null);
  const [notificationPosition, setNotificationPosition] = useState({ top: 76, right: 16 });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add("student-shell-active");
    return () => {
      document.body.classList.remove("student-shell-active", "student-nav-open");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("student-nav-open", open);
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("student-nav-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const response = await me();
        if (mounted) {
          const payload = response?.data ?? response;
          const next = payload?.user ?? payload ?? null;
          cachedUser = next;
          setUser(next);
        }
      } catch {
        cachedUser = null;
        setToken(null);
        navigate("/", { replace: true });
      }
    };

    loadUser();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationError("");
    try {
      const response = await apiClient.get("/student/notifications");
      setNotifications(response.data?.data ?? []);
      setUnreadCount(Number(response.data?.unread_count ?? 0));
    } catch (requestError) {
      setNotificationError(requestError.response?.data?.message || "Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0);
    const refreshTimer = window.setInterval(loadNotifications, 60000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshTimer);
    };
  }, [loadNotifications]);

  useDocumentScrollLock(notificationsOpen);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  const toggleNotifications = () => {
    const next = !notificationsOpen;
    if (next && notificationsRef.current) {
      const rect = notificationsRef.current.getBoundingClientRect();
      setNotificationPosition({
        top: Math.round(rect.bottom + 10),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
      loadNotifications();
    }
    setNotificationsOpen(next);
  };

  const markRead = async (notification) => {
    if (notification.read_at) return;
    try {
      await apiClient.patch(`/student/notifications/${notification.id}/read`);
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setNotificationError(requestError.response?.data?.message || "Unable to update notification.");
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.patch("/student/notifications/read-all");
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (requestError) {
      setNotificationError(requestError.response?.data?.message || "Unable to mark notifications as read.");
    }
  };

  const handleNotificationClick = (notification) => {
    markRead(notification);
    if (notification.url?.startsWith("/student/")) {
      navigate(notification.url);
      setNotificationsOpen(false);
    }
  };

  const notificationTime = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const notificationIcon = (type) => ({
    payment: CreditCard,
    installment: CreditCard,
    shipment: PackageCheck,
    completed: CircleCheckBig,
    order: ShoppingBag,
  }[type] || Bell);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear the local session even when the server is unavailable.
    } finally {
      cachedUser = null;
      sessionStorage.removeItem("auth:backGuard");
      setToken(null);
      navigate("/", { replace: true });
    }
  };

  const displayName = user?.name || user?.email || "User";
  const secondaryText = user?.email && user?.name ? user.email : "User account";
  const initial = displayName.trim().charAt(0).toUpperCase();
  const currentTitle = useMemo(() => pageTitle(location.pathname), [location.pathname]);

  return (
    <header className="sh">
      {open && (
        <button
          type="button"
          className="sh-overlay"
          aria-label="Close user navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`sh-sidebar${open ? " is-open" : ""}`} aria-label="User navigation">
        <div className="sh-sidebar__brand">
          <Link to="/student" className="sh-brand" onClick={() => setOpen(false)}>
            <BrandLogo
              markClassName="sh-brand__icon"
              copyClassName="sh-brand__copy"
              nameTag="strong"
              subtitle="User workspace"
            />
          </Link>
          <button type="button" className="sh-sidebar__close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="sh-sidebar__profile">
          <span className="sh-user__avatar">{initial}</span>
          <span>
            <strong>{displayName}</strong>
            <small>{secondaryText}</small>
          </span>
        </div>

        <div className="sh-sidebar__section">
          <span className="sh-sidebar__label">Workspace</span>
          <nav className="sh-sidebar__nav">
            {studentLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `sh-link${isActive ? " is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sh-sidebar__spacer" />

        <div className="sh-sidebar__footer">
          <Link to="/projects" className="sh-link sh-link--browse" onClick={() => setOpen(false)}>
            <FolderKanban size={18} aria-hidden="true" />
            <span>Browse software</span>
          </Link>
          <button type="button" className="sh-out" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="sh-topbar">
        <div className="sh-topbar__context">
          <button
            type="button"
            className="sh-menu"
            onClick={() => setOpen(true)}
            aria-label="Open user navigation"
            aria-expanded={open}
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <div>
            <span>User workspace</span>
            <strong>{currentTitle}</strong>
          </div>
        </div>

        <div className="sh-topbar__actions">
          <div className="admin-notifications sh-notifications" ref={notificationsRef}>
            <button
              type="button"
              className="sh-notifications__trigger admin-notifications__trigger"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={toggleNotifications}
            >
              <Bell size={19} aria-hidden="true" />
              {unreadCount > 0 && <span className="admin-notifications__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
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
                className="admin-notifications__panel sh-notifications__panel ui-scroll-dialog"
                aria-label="User notifications"
                role="dialog"
                aria-modal="true"
                style={{
                  "--notification-top": `${notificationPosition.top}px`,
                  "--notification-right": `${notificationPosition.right}px`,
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="admin-notifications__header">
                  <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
                  <button type="button" className="admin-notifications__read-all" onClick={markAllRead} disabled={unreadCount === 0}>
                    <CheckCheck size={15} /> Mark all read
                  </button>
                </div>
                {notificationError && <p className="admin-notifications__error" role="alert">{notificationError}</p>}
                {notificationsLoading ? (
                  <p className="admin-notifications__empty">Loading notifications…</p>
                ) : notifications.length === 0 ? (
                  <div className="admin-notifications__empty"><Bell size={22} /><strong>You’re all caught up</strong><span>Your order and payment updates will appear here.</span></div>
                ) : (
                  <div className="admin-notifications__list ui-scroll-dialog__body" data-scroll-lock-allow>
                    {notifications.map((notification) => {
                      const NotificationIcon = notificationIcon(notification.type);
                      return (
                        <button key={notification.id} type="button" className={`admin-notifications__item${notification.read_at ? "" : " is-unread"}`} onClick={() => handleNotificationClick(notification)}>
                          <span className="admin-notifications__item-icon"><NotificationIcon size={17} /></span>
                          <span className="admin-notifications__copy">
                            <span className="admin-notifications__item-top"><strong>{notification.title}</strong>{!notification.read_at && <i>New</i>}</span>
                            <span>{notification.message}</span>
                            <small>{notificationTime(notification.occurred_at || notification.created_at)}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button type="button" className="admin-notifications__refresh" onClick={loadNotifications} disabled={notificationsLoading}>Refresh notifications</button>
              </section>
              </div>,
              document.body,
            )}
          </div>

          <div className="sh-topbar__user" title={displayName}>
            <span className="sh-topbar__user-icon"><UserRound size={17} aria-hidden="true" /></span>
            <span className="sh-topbar__user-copy">
              <strong>{displayName}</strong>
              <small>User</small>
            </span>
            <span className="sh-user__avatar">{initial}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default StudentHeader;
