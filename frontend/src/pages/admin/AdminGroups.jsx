import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, UsersRound, UserCheck } from "lucide-react";

import apiClient from "../../api/client";
import { useToastOn } from "../../components/Toast";

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

function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState(null);

  useToastOn(error, "error", setError);

  const handleView = async (group) => {
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
      const match = email
        ? list.find((u) => (u.email || "").toLowerCase() === email)
        : list.find(
            (u) =>
              (u.mobile || "") === (leader.mobile || "") &&
              (u.name || "") === (leader.name || "")
          );

      if (match) navigate(`/admin/users/${match.id}`);
    } finally {
      setOpeningId(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadGroups = async () => {
      setLoading(true);
      setError("");

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
        setMeta(result);
      } catch (err) {
        if (cancelled) return;

        setGroups([]);
        setMeta(null);
        setError(
          err?.response?.data?.message ||
            "Unable to load groups. Check your admin access and API configuration.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, [page, search]);

  const memberTotal = groups.reduce(
    (sum, group) => sum + Number(group.member_count ?? group.members?.length ?? 0),
    0,
  );

  return (
    <div className="student-page">
      <main className="container admin-page">
        <header className="admin-header">
          <div>
            <span className="student-dashboard__eyebrow">Admin</span>
            <h1>Groups</h1>
            <p className="admin-header__desc">
              Search software groups, review guides and open group details.
            </p>
          </div>

          <div className="admin-users-toolbar">
            <div className="admin-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search group, college, member, email or user ID"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                aria-label="Search groups"
              />
            </div>
          </div>
        </header>

        <section className="admin-summary-grid" aria-label="Summary">
          <article className="admin-summary-card">
            <div className="admin-summary-card__icon">
              <UsersRound size={20} aria-hidden="true" />
            </div>
            <div className="admin-summary-card__content">
              <span>Total groups</span>
              <strong>{meta?.total ?? groups.length}</strong>
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

        {loading && (
          <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Users size={24} aria-hidden="true" />
            </span>
            <h3>{search ? "No matching groups" : "No groups yet"}</h3>
            <p>
              {search
                ? `Nothing matches “${search}”. Try a different group, college or member.`
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
              {meta
                ? `Showing ${meta.from ?? 0}–${meta.to ?? 0} of ${meta.total ?? 0} groups`
                : `${groups.length} groups`}
              {search ? ` · matching “${search}”` : ""}
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
                            onClick={() => handleView(group)}
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
                  Page {meta.current_page} of {meta.last_page} · {meta.total} groups
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

export default AdminGroups;
