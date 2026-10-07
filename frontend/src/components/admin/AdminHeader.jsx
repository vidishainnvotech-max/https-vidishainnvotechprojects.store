import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";

import { setToken } from "../../api/client";
import { logout } from "../../api/student";
import { brand } from "../../config/brand";

function AdminHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // local session is cleared anyway
    } finally {
      setToken(null);
      navigate("/", { replace: true });
    }
  };

  const links = (
    <NavLink to="/admin/users" className={({ isActive }) => `vh-link${isActive ? " is-active" : ""}`} onClick={() => setOpen(false)}>Users</NavLink>
  );

  const actions = (
    <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
      <LogOut size={15} aria-hidden="true" />
      Sign Out
    </button>
  );

  return (
    <header className="vh vh--admin">
      <div className="vh__bar">
        <Link to="/admin/users" className="vh-brand" onClick={() => setOpen(false)}>
          <span className="vh-brand__icon"><ShieldCheck size={20} aria-hidden="true" /></span>
          <span className="vh-brand__text">{brand.name}</span>
          <span className="vh-badge">Admin</span>
        </Link>

        <nav className="vh__nav" aria-label="Admin navigation">{links}</nav>
        <div className="vh__actions">{actions}</div>

        <button type="button" className="vh-menu" onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav className="vh-mobile rise" aria-label="Admin mobile navigation">
          {links}
          <div className="vh-mobile__actions">{actions}</div>
        </nav>
      )}
    </header>
  );
}

export default AdminHeader;
