import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, Users } from "lucide-react";

import apiClient from "../../api/client";
import { me } from "../../api/student";
import AdminHeader from "../../components/admin/AdminHeader";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString();
}

function AdminUsers() {
  const [access, setAccess] = useState("checking");
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      try {
        const response = await me();

        if (cancelled) return;

        const user = response?.user ?? response?.data ?? null;

        setAccess(user?.role === "admin" ? "ok" : "denied");
      } catch (err) {
        if (cancelled) return;

        setAccess(err?.response?.status === 401 ? "unauth" : "denied");
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (access !== "ok") return undefined;

    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      setError("");
      setErrorStatus(null);

      try {
        const response = await apiClient.get("/admin/users", {
          params: {
            page,
            ...(search ? { search } : {}),
          },
        });

        if (cancelled) return;

        const paginator = response?.data?.data ?? response?.data ?? null;

        setUsers(paginator?.data ?? []);
        setMeta(paginator);
      } catch (err) {
        if (cancelled) return;

        setUsers([]);
        setMeta(null);
        setErrorStatus(err?.response?.status ?? null);
        setError(
          err?.response?.data?.message ||
            (err?.response?.status === 401
              ? "Your session has expired."
              : err?.response?.status === 403
                ? "Admin access required."
                : "Unable to load users."),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [access, page, search]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");
      setErrorStatus(null);

      const response = await apiClient.get("/admin/users/export", {
        params: search ? { search } : {},
        responseType: "blob",
      });

      const disposition = response.headers?.["content-disposition"] ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || "users-export.csv";

      const url = window.URL.createObjectURL(
        new Blob([response.data]),
      );
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      setError("Unable to export users.");
    } finally {
      setExporting(false);
    }
  };

  if (access === "checking") {
    return (
      <div className="student-page">
        <AdminHeader />

        <main className="container admin-page">
          <div className="student-state">Checking access...</div>
        </main>
      </div>
    );
  }

  if (access === "unauth") {
    return (
      <div className="student-page">
        <AdminHeader />

        <main className="container admin-page">
          <div className="student-state student-state--error">
            Your session has expired.
          </div>

          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="student-page">
        <AdminHeader />

        <main className="container admin-page">
          <div className="student-state student-state--error">
            Admin access required.
          </div>

          <Link to="/student" className="btn btn-secondary">
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="student-page">
      <AdminHeader />

      <main className="container admin-page">
      <header className="admin-header">
        <div>
          <span className="student-dashboard__eyebrow">Admin</span>
          <h1>Users</h1>
          <p className="admin-header__desc">Search accounts, review access and export the user list.</p>
        </div>

        <div className="admin-header__actions">
          <div className="admin-search">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search name, email, mobile, college ID"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search users"
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={15} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </header>

      {meta && meta.total > 0 && (
        <div className="stat-grid">
          <div className="stat-tile"><span className="stat-tile__label">Total users</span><span className="stat-tile__value">{meta.total}</span></div>
          <div className="stat-tile"><span className="stat-tile__label">On this page</span><span className="stat-tile__value">{users.length}</span></div>
          <div className="stat-tile"><span className="stat-tile__label">Page</span><span className="stat-tile__value">{meta.current_page}/{meta.last_page}</span></div>
        </div>
      )}

      {error && (
        <div className="student-state student-state--error" role="alert">
          {error}

          {errorStatus === 401 && (
            <div className="admin-error-action">
              <Link to="/login" className="btn btn-primary">
                Sign in
              </Link>
            </div>
          )}

          {errorStatus === 403 && (
            <div className="admin-error-action">
              <Link to="/student" className="btn btn-secondary">
                Back to dashboard
              </Link>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon"><Users size={24} aria-hidden="true" /></span>
          <h3>{search ? "No matching users" : "No users yet"}</h3>
          <p>{search ? `Nothing matches “${search}”. Try a different name, email or ID.` : "Registered users will appear here."}</p>
          {search && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearchInput("")}>Clear search</button>}
        </div>
      )}

      {!loading && users.length > 0 && (
        <>
          <div className="admin-result-count" role="status">
            {meta
              ? `Showing ${meta.from ?? 0}–${meta.to ?? 0} of ${
                  meta.total ?? 0
                } users`
              : `${users.length} users`}
            {search ? ` · matching “${search}”` : ""}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>College ID</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>
                    <span className="admin-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Name">
                      <span className="admin-user">
                        <span className="admin-avatar" aria-hidden="true">{(user.name || "?").charAt(0).toUpperCase()}</span>
                        {user.name}
                      </span>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Mobile">{user.mobile ?? "—"}</td>
                    <td data-label="College ID">{user.college_id ?? "—"}</td>
                    <td data-label="Role">
                      <span className={`admin-role ${user.role === "admin" ? "admin-role--admin" : "admin-role--student"}`}>
                        {user.role}
                      </span>
                    </td>
                    <td data-label="Created">{formatDate(user.created_at)}</td>
                    <td className="admin-table__action">
                      <Link to={`/admin/users/${user.id}`} className="btn btn-secondary btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.total > 0 && (
            <div className="admin-pagination">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={meta.current_page <= 1 || loading}
                aria-label="Previous page"
                onClick={() => setPage(meta.current_page - 1)}
              >
                Previous
              </button>

              <span role="status">
                Page {meta.current_page} of {meta.last_page} ·{" "}
                {meta.total} users
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={meta.current_page >= meta.last_page || loading}
                aria-label="Next page"
                onClick={() => setPage(meta.current_page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      </main>
    </div>
  );
}

export default AdminUsers;
