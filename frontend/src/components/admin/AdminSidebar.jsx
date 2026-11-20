import {
  ExternalLink,
  FileText,
  FolderKanban,
  Gift,
  Lightbulb,
  LogOut,
  Tags,
  Users,
  Layers,
  GitBranch,
  LayoutDashboard,
  KeyRound,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { setToken } from "../../api/client";
import { logout } from "../../api/student";
import BrandLogo from "../common/BrandLogo";

function AdminSidebar({ open = false, onClose }) {
  const navigate = useNavigate();

  const navSections = [
    {
      label: "Workspace",
      items: [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
        { to: "/admin/shipments", label: "IoT Shipments", icon: Truck },
        { to: "/admin/users", label: "Users & Groups", icon: Users },
      ],
    },
    {
      label: "Catalog Management",
      items: [
        { to: "/admin/projects", label: "Software", icon: FolderKanban },
        { to: "/admin/stages", label: "Software Stages", icon: Layers },
        { to: "/admin/categories", label: "Categories", icon: Tags },
        { to: "/admin/documentation", label: "Documentation", icon: FileText },
      ],
    },
    {
      label: "Growth & Engagement",
      items: [
        { to: "/admin/referrals", label: "Referrals", icon: GitBranch },
        { to: "/admin/coupons", label: "Coupons", icon: Gift },
        { to: "/admin/ideas", label: "Ideas Inbox", icon: Lightbulb },
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Continue clearing the local session if logout fails.
    } finally {
      sessionStorage.removeItem("auth:backGuard");
      setToken(null);
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="admin-sidebar__overlay"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside
        className={`admin-sidebar${open ? " is-open" : ""}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar__brand">
          <NavLink
            to="/admin"
            className="admin-sidebar__brand-link"
            onClick={onClose}
          >
            <BrandLogo
              markClassName="admin-sidebar__brand-icon"
              copyClassName="admin-sidebar__brand-copy"
              nameTag="strong"
              subtitle="Administration"
            />
          </NavLink>
        </div>

        <div className="admin-sidebar__section" data-lenis-prevent>
          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            {navSections
              .flatMap(({ items }) => items)
              .map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/admin"}
                  className={({ isActive }) =>
                    `admin-sidebar__link${isActive ? " is-active" : ""}`
                  }
                  onClick={onClose}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
          </nav>
        </div>

        <div className="admin-sidebar__spacer" />

        <div className="admin-sidebar__footer">
          <NavLink
            to="/admin/api-keys"
            className={({ isActive }) =>
              `admin-sidebar__link${isActive ? " is-active" : ""}`
            }
            onClick={onClose}
          >
            <KeyRound size={17} aria-hidden="true" />
            <span>API Keys</span>
          </NavLink>

          <a
            href="/"
            className="admin-sidebar__link admin-sidebar__link--muted"
          >
            <ExternalLink size={17} aria-hidden="true" />
            <span>View website</span>
          </a>

          <button
            type="button"
            className="admin-sidebar__logout"
            onClick={handleLogout}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;
