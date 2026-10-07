import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, Menu, X } from "lucide-react";

import { brand } from "../config/brand";
import { scrollToId } from "../utils/catalog";

const ROUTE_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Projects", to: "/projects" },
  { label: "Pricing", to: "/pricing" },
];

function Header({
  links = ROUTE_LINKS,
  showSignIn = false,
  onSignIn,
  variant = "public", // "public" | "student" | "admin"
  userLabel,
  onSignOut,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const handleNavClick = (link) => (event) => {
    if (link.href?.startsWith("#")) {
      event.preventDefault();
      scrollToId(link.href.slice(1));
    }

    close();
  };

  const handleSignIn = () => {
    if (typeof onSignIn === "function") {
      onSignIn();
    } else {
      navigate("/login");
    }

    close();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const renderLink = (link) =>
    link.to ? (
      <NavLink
        key={link.label}
        to={link.to}
        end={link.end}
        className={({ isActive }) => `vh-link${isActive ? " is-active" : ""}`}
        onClick={handleNavClick(link)}
      >
        {link.label}
      </NavLink>
    ) : (
      <a key={link.label} href={link.href} className="vh-link" onClick={handleNavClick(link)}>
        {link.label}
      </a>
    );

  const roleLabel = variant === "admin" ? "Admin" : "Student";

  const actions = (
    <>
      {variant !== "public" && userLabel && <span className="vh-user">{userLabel}</span>}
      {variant !== "public" && onSignOut && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onSignOut(); close(); }}>
          Sign out
        </button>
      )}
      {variant === "public" && showSignIn && (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignIn}>Sign in</button>
          <Link to="/login" className="btn btn-primary btn-sm" onClick={close}>Get started</Link>
        </>
      )}
    </>
  );

  const [first, ...rest] = brand.name.split(" ");

  return (
    <header className={`vh vh--${variant}`}>
      <div className="vh__bar">
        <Link to="/" className="vh-brand" aria-label={`${brand.name} home`} onClick={close}>
          <span className="vh-brand__icon"><GraduationCap size={20} aria-hidden="true" /></span>
          <span className="vh-brand__text">
            {first}
            {rest.length > 0 && <span> {rest.join(" ")}</span>}
          </span>
          {variant !== "public" && <span className="vh-badge">{roleLabel}</span>}
        </Link>

        <nav className="vh__nav" aria-label="Main navigation">{links.map(renderLink)}</nav>
        <div className="vh__actions">{actions}</div>

        <button
          type="button"
          className="vh-menu"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav className="vh-mobile rise" aria-label="Mobile navigation">
          {links.map(renderLink)}
          <div className="vh-mobile__actions">{actions}</div>
        </nav>
      )}
    </header>
  );
}

export default Header;