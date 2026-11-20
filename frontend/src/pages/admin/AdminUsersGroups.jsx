import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Search, Users, UserCheck, UsersRound, UserRound } from "lucide-react";

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

function getProjectName(group) {
  return (
    group?.project?.name ||
    group?.project?.title ||
    group?.project_name ||
    group?.allocated_project?.name ||
    group?.projects?.[0]?.name ||
    "NA"
  );
}

function AdminUsersGroups() {
  const [tab, setTab] = useState("users");
  const [access, setAccess] = useState("checking");

  const [users, setUsers] = useState([]);
  const [usersMeta, setUsersMeta] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [usersErrorStatus, setUsersErrorStatus] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupsMeta, setGroupsMeta] = useState(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  const navigate = useNavigate();

  useToastOn(usersErrorStatus === 401 || usersErrorStatus === 403 ? "" : usersError, "error", setUsersError);
  useToastOn(groupsError, "error", setGroupsError);

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
      setUsersLoading(true);
      setUsersError("");
      setUsersErrorStatus(null);

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
        setUsersMeta(paginator);
      } catch (err) {
        if (cancelled) return;

        setUsers([]);
        setUsersMeta(null);
        setUsersErrorStatus(err?.response?.status ?? null);
        setUsersError(
          err?.response?.data?.message ||
            (err?.response?.status === 401
              ? "Your session has expired."
              : err?.response?.status === 403
                ? "Admin access required."
                : "Unable to load users."),
        );
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [access, page, search]);

  useEffect(() => {
    if (access !== "ok") return undefined;

    let cancelled = false;

    const loadGroups = async () => {
      setGroupsLoading(true);
      setGroupsError("");

      try {
        const response = await apiClient.get("/admin/groups", {
          params: {
            page,
            ...(search ? { search } : {}),
          },
        });

        if (cancelled) return;

        const result = response?.data?.data ?? response?.data ?? null;

        setGroups(result?.data ?? []);
        setGroupsMeta(result);
      } catch (err) {
        if (cancelled) return;

        setGroups([]);
        setGroupsMeta(null);
        setGroupsError(
          err?.response?.data?.message ||
            "Unable to load groups. Check your admin access and API configuration.",
        );
      } finally {
        if (!cancelled) {
          setGroupsLoading(false);
        }
      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, [access, page, search]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setUsersError("");
      setUsersErrorStatus(null);

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
      setUsersError("Unable to export users.");
    } finally {
      setExporting(false);
    }
  };

  const handleViewGroup = async (group) => {
    const members = Array.isArray(group?.members) ? group.members : [];
    const leader = members.find((m) => m?.is_leader === true) ?? members[0];
    if (!leader) return;

    const directId = leader.user_id ?? leader.user?.id;
    if (directId) {
      navigate(`/admin/users/${directId}`);
      return;
    }

    const email = (leader.email || "").toLowerCase();
    const key = email || leader.mobile || leader.name;
    if (!key) return;

    setOpeningId(group.id);
    try {
      const res = await apiClient.get("/admin/users", { params: { search: key } });
      const paginator = res?.data?.data ?? res?.data;
      const list = paginator?.data ?? [];
      const match =
        list.find((u) => (u.email || "").toLowerCase() === email) ??
        list.find((u) => u.role === "student");

      if (match) navigate(`/admin/users/${match.id}`);
    } finally {
      setOpeningId(null);
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

  const memberTotal = groups.reduce(
    (sum, group) => sum + Number(group.member_count ?? group.members?.length ?? 0),
    0,
  );

  const loading = tab === "users" ? usersLoading : groupsLoading;
  const error = tab === "users" ? usersError : groupsError;
  const errorStatus = tab === "users" ? usersErrorStatus : null;

  return (
    <div className="student-page">
      <main className="container admin-page">
        <header className="admin-header">
          <div>
            <span className="student-dashboard__eyebrow">Admin</span>
            <h1>Users & Groups</h1>
            <p className="admin-header__desc">Search accounts, review access and export the user list.</p>
          </div>

          <div className="admin-users-toolbar">
            <div className="admin-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder={tab === "users" ? "Search by name, email, mobile or college" : "Search group, college, member, email or user ID"}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label={tab === "users" ? "Search users" : "Search groups"}
              />
            </div>

            {tab === "users" && (
              <button
                type="button"
                className="btn btn-secondary btn-sm admin-export-button"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download size={15} aria-hidden="true" />
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            )}
          </div>
        </header>

        <div className="admin-tabs" role="tablist" aria-label="Manage users and groups">
          <button
            type="button"
            role="tab"
            className={tab === "users" ? "is-active" : ""}
            aria-selected={tab === "users"}
            onClick={() => setTab("users")}
          >
            <Users size={15} aria-hidden="true" />
            <span>Users</span>
          </button>

          <button
            type="button"
            role="tab"
            className={tab === "groups" ? "is-active" : ""}
            aria-selected={tab === "groups"}
            onClick={() => setTab("groups")}
          >
            <UserRound size={15} aria-hidden="true" />
            <span>Groups</span>
          </button>
        </div>

        {tab === "users" && (
          <>
            <section className="admin-summary-grid" aria-label="Summary">
              <article className="admin-summary-card">
                <div className="admin-summary-card__icon">
                  <UserCheck size={20} aria-hidden="true" />
                </div>
                <div className="admin-summary-card__content">
                  <span>Total users</span>
                  <strong>{usersMeta?.total ?? users.filter((user) => user.role === "student").length}</strong>
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
                  {usersMeta
                    ? `Showing ${usersMeta.from ?? 0}–${usersMeta.to ?? 0} of ${
                        usersMeta.total ?? 0
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

                {usersMeta && usersMeta.total > 0 && (
                  <div className="admin-pagination">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={usersMeta.current_page <= 1 || loading}
                      aria-label="Previous page"
                      onClick={() => setPage(usersMeta.current_page - 1)}
                    >
                      Previous
                    </button>

                    <span role="status">
                      Page {usersMeta.current_page} of {usersMeta.last_page} ·{" "}
                      {usersMeta.total} users
                    </span>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={usersMeta.current_page >= usersMeta.last_page || loading}
                      aria-label="Next page"
                      onClick={() => setPage(usersMeta.current_page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "groups" && (
          <>
            <section className="admin-summary-grid" aria-label="Summary">
              <article className="admin-summary-card">
                <div className="admin-summary-card__icon">
                  <UsersRound size={20} aria-hidden="true" />
                </div>
                <div className="admin-summary-card__content">
                  <span>Total groups</span>
                  <strong>{groupsMeta?.total ?? groups.length}</strong>
                </div>
              </article>

              <article className="admin-summary-card">
                <div className="admin-summary-card__icon">
                  <UserCheck size={20} aria-hidden="true" />
                </div>
                <div className="admin-summary-card__content">
                  <span>Members on this page</span>
                  <strong>{memberTotal}</strong>
                </div>
              </article>
            </section>

            {groupsError && (
              <div className="student-state student-state--error" role="alert">
                {groupsError}
              </div>
            )}

            {loading && (
              <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 52 }} />
                ))}
              </div>
            )}

            {!loading && !groupsError && groups.length === 0 && (
              <div className="empty-state">
                <span className="empty-state__icon">
                  <Users size={24} aria-hidden="true" />
                </span>
                <h3>{search ? "No matching groups" : "No groups yet"}</h3>
                <p>
                  {search
                    ? `Nothing matches "${search}". Try a different group, college or member.`
                    : "Registered groups will appear here."}
                </p>
                {search && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSearchInput("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}

            {!loading && groups.length > 0 && (
              <>
                <div className="admin-result-count" role="status">
                  {groupsMeta
                    ? `Showing ${groupsMeta.from ?? 0}–${groupsMeta.to ?? 0} of ${groupsMeta.total ?? 0} groups`
                    : `${groups.length} groups`}
                  {search ? ` · matching "${search}"` : ""}
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-users-table">
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>College</th>
                        <th>Members</th>
                        <th>Guide</th>
                        <th>Software</th>
                        <th>
                          <span className="admin-visually-hidden">Actions</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {groups.map((group) => {
                        const college = group.college?.name || "—";
                        const memberCount =
                          group.member_count ?? group.members?.length ?? 0;
                        return (
                          <tr key={group.id}>
                            <td data-label="Group">
                              <span className="group-chip">
                                <span className="group-chip__id">Group {group.id}</span>
                              </span>
                            </td>

                            <td
                              data-label="College"
                              className="cell-college"
                              title={college}
                            >
                              {college}
                            </td>

                            <td data-label="Members">
                              <span className="group-chip">
                                <span className="group-chip__count" style={{ border: 0, paddingLeft: 0 }}>
                                  <Users size={12} aria-hidden="true" />
                                  {memberCount}
                                </span>
                              </span>
                            </td>

                            <td data-label="Guide">
                              <div className="cell-stack">
                                <strong>{group.guide_name || "—"}</strong>
                                {group.guide_mobile && <small>{group.guide_mobile}</small>}
                              </div>
                            </td>

                            <td data-label="Software">
                              <strong>{getProjectName(group)}</strong>
                            </td>

                            <td data-label="Actions" className="admin-table__action">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={openingId === group.id || !group.members?.length}
                                onClick={() => handleViewGroup(group)}
                              >
                                {openingId === group.id ? "Opening..." : "View"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {groupsMeta && groupsMeta.total > 0 && (
                  <div className="admin-pagination">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={groupsMeta.current_page <= 1 || loading}
                      aria-label="Previous page"
                      onClick={() => setPage(groupsMeta.current_page - 1)}
                    >
                      Previous
                    </button>

                    <span role="status">
                      Page {groupsMeta.current_page} of {groupsMeta.last_page} · {groupsMeta.total} groups
                    </span>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={groupsMeta.current_page >= groupsMeta.last_page || loading}
                      aria-label="Next page"
                      onClick={() => setPage(groupsMeta.current_page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AdminUsersGroups;
