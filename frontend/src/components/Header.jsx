import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { brand } from "../config/brand";
import { scrollToId } from "../utils/catalog";
import BrandLogo from "./common/BrandLogo";
import UserMenu from "./UserMenu";

const ROUTE_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Software", to: "/projects" },
  { label: "Pricing", to: "/pricing" },
];

function Header({
  links = ROUTE_LINKS,
  variant = "public", // "public" | "student" | "admin"
  userLabel,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  const handleNavClick = (link) => (event) => {
    if (link.href?.startsWith("#")) {
      event.preventDefault();
      scrollToId(link.href.slice(1));
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

  const roleLabel = variant === "admin" ? "Admin" : "User";

  const actions = (
    <>
      {variant !== "public" && userLabel && <span className="vh-user">{userLabel}</span>}
      {variant !== "public" && onSignOut && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onSignOut(); close(); }}>
          Sign out
        </button>
      )}
    </>
  );

  return (
    <header className={`vh vh--${variant}${scrolled ? " is-scrolled" : ""}`}>
      <div className="vh__bar">
        <Link to="/" className="vh-brand" aria-label={`${brand.name} home`} onClick={close}>
          <BrandLogo markClassName="vh-brand__icon" nameClassName="vh-brand__text" />
          {variant !== "public" && <span className="vh-badge">{roleLabel}</span>}
        </Link>

        <nav className="vh__nav" aria-label="Main navigation">{links.map(renderLink)}</nav>
        <UserMenu />
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
        <nav className="vh-mobile vh-mobile--open" aria-label="Mobile navigation">
          {links.map(renderLink)}
          <div className="vh-mobile__actions">{actions}</div>
        </nav>
      )}
    </header>
  );
}

export default Header;
