import { NavLink } from "react-router-dom";

function NavItem({ link, onClick }) {
  if (link.to) {
    return (
      <NavLink
        to={link.to}
        end={link.end}
        onClick={onClick}
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        {link.label}
      </NavLink>
    );
  }

  return (
    <a href={link.href || "#"} onClick={onClick}>
      {link.label}
    </a>
  );
}

export default NavItem;
