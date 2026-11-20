
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AdminSidebar from "../components/admin/AdminSidebar";
import AdminTopbar from "../components/admin/AdminTopbar";

import "../styles/admin.css";
import "../styles/admin-layout.css";
import "../styles/admin-theme.css";
import "../styles/admin-user-details.css";

function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile sidebar after navigating to another page.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Apply the admin layout styling while this layout is mounted.
  useEffect(() => {
    document.body.classList.add("admin-shell-active");

    return () => {
      document.body.classList.remove("admin-shell-active");
    };
  }, []);

  return (
    <div className="admin-shell">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="admin-shell__main">
        <AdminTopbar
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="admin-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
