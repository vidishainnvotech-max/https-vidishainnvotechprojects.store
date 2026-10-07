import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";

import { setToken } from "../../api/client";
import { logout, me } from "../../api/student";
import { brand } from "../../config/brand";

function StudentHeader() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const response = await me();

        if (mounted) {
          const payload = response?.data ?? response;

          setUser(payload?.user ?? payload ?? null);
        }
      } catch {
        setToken(null);
        navigate("/", { replace: true });
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore network errors, the local session is cleared anyway
    } finally {
      setToken(null);
      navigate("/", { replace: true });
    }
  };

  const links = (
    <>
      <NavLink to="/student" end className={({ isActive }) => `vh-link${isActive ? " is-active" : ""}`} onClick={() => setOpen(false)}>Dashboard</NavLink>
      <Link to="/student" className="vh-link" onClick={() => setOpen(false)}>My Projects</Link>
    </>
  );

  const actions = (
    <>
      <span className="vh-user">{user?.name || user?.email || "Student"}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
        <LogOut size={15} aria-hidden="true" />
        Sign Out
      </button>
    </>
  );

  return (
    <header className="vh vh--student">
      <div className="vh__bar">
        <Link to="/student" className="vh-brand" onClick={() => setOpen(false)}>
          <span className="vh-brand__icon"><GraduationCap size={20} aria-hidden="true" /></span>
          <span className="vh-brand__text">{brand.name}</span>
          <span className="vh-badge">Student</span>
        </Link>

        <nav className="vh__nav" aria-label="Student navigation">{links}</nav>
        <div className="vh__actions">{actions}</div>

        <button type="button" className="vh-menu" onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav className="vh-mobile rise" aria-label="Student mobile navigation">
          {links}
          <div className="vh-mobile__actions">{actions}</div>
        </nav>
      )}
    </header>
  );
}

export default StudentHeader;
