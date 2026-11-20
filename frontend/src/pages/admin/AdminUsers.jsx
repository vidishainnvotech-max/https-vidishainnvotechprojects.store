import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, Users, UserCheck, UsersRound } from "lucide-react";

import apiClient from "../../api/client";
import { me } from "../../api/student";
import { useToastOn } from "../../components/Toast";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString();
}

function getGroupMemberCount(user) {
  const group = user?.group;
  const candidates = [
    group?.members_count,
    group?.members_count,
    group?.members?.length,
    group?.group_members?.length,
    user?.group_members_count,
  ];

  const count = candidates.find(
    (value) => value !== null && value !== undefined && Number.isFinite(Number(value))
  );

  return count === undefined ? null : Number(count);
}

function getGroupNumber(user) {
  return (
    user?.group?.group_number ??
    user?.group?.number ??
    user?.group?.id ??
    user?.group_id ??
    null
  );
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

  useToastOn(errorStatus === 401 || errorStatus === 403 ? "" : error, "error", setError);

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
        <main className="container admin-page">
          <div className="student-state">Checking access...</div>
        </main>
      </div>
    );
  }

  if (access === "unauth") {
    return (
      <div className="student-page">
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
      <main className="container admin-page">
      <header className="admin-header">
        <div>
          <span className="student-dashboard__eyebrow">Admin</span>
          <h1>Users</h1>
          <p className="admin-header__desc">Search accounts, review access and export the user list.</p>
        </div>

        <div className="admin-users-toolbar">
          <div className="admin-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, email, mobile or college"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search users"
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm admin-export-button"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={15} aria-hidden="true" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </header>

      <section className="admin-summary-grid" aria-label="Summary">
        <article className="admin-summary-card">
          <div className="admin-summary-card__icon">
            <UserCheck size={20} aria-hidden="true" />
          </div>
          <div className="admin-summary-card__content">
            <span>Total users</span>
            <strong>{meta?.total ?? users.filter((user) => user.role === "student").length}</strong>
          </div>
        </article>

        <article className="admin-summary-card">
          <div className="admin-summary-card__icon">
            <UsersRound size={20} aria-hidden="true" />
          </div>
          <div className="admin-summary-card__content">
            <span>Groups</span>
            <strong>{new Set(users.map(getGroupNumber).filter(Boolean)).size}</strong>
          </div>
        </article>
      </section>

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
          <p>{search ? `Nothing matches "${search}". Try a different name, email or ID.` : "Registered users will appear here."}</p>
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
            {search ? ` · matching "${search}"` : ""}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table admin-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>College</th>
                  <th>Group</th>
                  <th>Joined</th>
                  <th>
                    <span className="admin-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.filter((user) => user.role === "student").map((user) => {
                  const memberCount = getGroupMemberCount(user);
                  const groupNumber = getGroupNumber(user);
                  const college =
                    user?.group?.college?.name ??
                    user?.college?.name ??
                    user?.college_id ??
                    "—";

                  return (
                    <tr key={user.id}>
                      <td data-label="User" className="cell-name">
                        {user.name || "—"}
                      </td>

                      <td data-label="Email" className="cell-email">
                        {user.email || "—"}
                      </td>

                      <td data-label="Mobile">{user.mobile ?? "—"}</td>

                      <td
                        data-label="College"
                        className="cell-college"
                        title={String(college)}
                      >
                        {college}
                      </td>

                      <td data-label="Group">
                        {groupNumber ? (
                          <span
                            className="group-chip"
                            title={`${memberCount ?? 0} members`}
                          >
                            <span className="group-chip__id">Group {groupNumber}</span>
                            <span className="group-chip__count">
                              <Users size={12} aria-hidden="true" />
                              {memberCount ?? 0}
                            </span>
                          </span>
                        ) : (
                          <span className="admin-muted">—</span>
                        )}
                      </td>

                      <td data-label="Joined">{formatDate(user.created_at)}</td>

                      <td data-label="Actions" className="admin-table__action">
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
