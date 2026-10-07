import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import { brand } from "../config/brand";
import NavItem from "./NavItem";

const DEFAULT_LINKS = [
  { label: "Home", to: "/", end: true },
  { label: "Projects", to: "/projects" },
  { label: "Pricing", to: "/pricing" },
];

function Footer({ links = DEFAULT_LINKS }) {
  return (
    <footer className="vf">
      <div className="vf__inner">
        <div className="vf__top">
          <div className="vf__about">
            <Link to="/" className="vf__brand">
              <span><GraduationCap size={19} aria-hidden="true" /></span>
              {brand.name}
            </Link>
            <p>
              Empowering engineering students across India with projects
              designed for real learning and confident presentation.
            </p>
          </div>

          <nav className="vf__col" aria-label="Explore">
            <h2>Explore</h2>
            {links.map((link) => (
              <NavItem key={link.label} link={link} />
            ))}
          </nav>

          <nav className="vf__col" aria-label="Account">
            <h2>Account</h2>
            <Link to="/login">Sign in</Link>
            <Link to="/login">Get started</Link>
          </nav>
        </div>

        <div className="vf__bottom">
          <span>&copy; {new Date().getFullYear()} {brand.name}. All rights reserved.</span>
          <span>Made for the next generation of engineers.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
