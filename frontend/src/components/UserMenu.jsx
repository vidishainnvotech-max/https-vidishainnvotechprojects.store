import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { isSignedIn, me } from "../api/student";
import { setToken } from "../api/client";

import "../styles/user-menu.css";

export const BACK_GUARD_KEY = "auth:backGuard";

function UserMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const [signedIn, setSignedIn] = useState(() => isSignedIn());
  const [user, setUser] = useState(null);

  // Load the user's name
  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;

    me()
      .then((data) => {
        if (!cancelled) setUser(data?.user ?? data?.data ?? data);
      })
      .catch((err) => {
        if (!cancelled && err?.response?.status === 401) {
          setToken("");
          setSignedIn(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Browser Back past the login point = auto logout
  useEffect(() => {
    if (!signedIn) return undefined;

    const onPopState = () => {
      const guard = Number(sessionStorage.getItem(BACK_GUARD_KEY));
      const idx = window.history.state?.idx;

      if (guard && typeof idx === "number" && idx < guard) {
        sessionStorage.removeItem(BACK_GUARD_KEY);
        setToken("");
        window.location.reload(); // page comes back as guest
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [signedIn]);

  const handleLogout = () => {
    sessionStorage.removeItem(BACK_GUARD_KEY);
    setToken("");
    setUser(null);
    setSignedIn(false);
    navigate("/", { replace: true });
  };

  if (!signedIn) {
    return (
      <div className="user-menu">
        <Link
          to="/login"
          className="btn btn-secondary btn-sm"
          state={{
            from: {
              pathname: location.pathname,
              search: location.search,
              hash: location.hash,
            },
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  const displayName =
    user?.name || user?.full_name || user?.email?.split("@")[0] || "Account";

  return (
    <div className="user-menu">
      <Link to="/student" className="user-menu__who" title="My Software">
        <span className="user-menu__avatar" aria-hidden="true">
          {displayName.trim().charAt(0).toUpperCase()}
        </span>
        <span className="user-menu__name">{displayName}</span>
      </Link>

      <button type="button" className="user-menu__logout" onClick={handleLogout}>
        <LogOut size={15} aria-hidden="true" />
        Logout
      </button>
    </div>
  );
}

export default UserMenu;
