import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Ban,
  Check,
  GraduationCap,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

import apiClient from "../../api/client";
import { me } from "../../api/student";
import AdminUserManage from "../../components/admin/AdminUserManage";
import { useToastOn } from "../../components/Toast";

const STAGES = [20, 50, 75, 100];

function apiErrorMessage(error, fallback) {
  const data = error?.response?.data;

  if (data?.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors)[0];

    if (Array.isArray(first) && first[0]) {
      return first[0];
    }
  }

  return data?.message || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function normalizeUserPayload(response) {
  const payload = response?.data?.data ?? response?.data ?? null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

function normalizeGroup(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const group = user.group ?? null;

  if (!group || typeof group !== "object") {
    return null;
  }

  const members = Array.isArray(group.members) ? group.members : [];

  return {
    ...group,
    members,
    member_count:
      group.member_count !== null && group.member_count !== undefined
        ? Number(group.member_count)
        : members.length,
  };
}

function getLeader(group, user) {
  if (!group) {
    return null;
  }

  const members = Array.isArray(group.members) ? group.members : [];

  const explicitLeader = members.find((member) => member?.is_leader === true);

  if (explicitLeader) {
    return explicitLeader;
  }

  if (user?.email) {
    const matchingMember = members.find(
      (member) =>
        String(member?.email || "").toLowerCase() ===
        String(user.email).toLowerCase(),
    );

    if (matchingMember) {
      return matchingMember;
    }
  }

  return null;
}

function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);

  const [access, setAccess] = useState("checking");

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [projects, setProjects] = useState([]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedStage, setSelectedStage] = useState("20");

  const [action, setAction] = useState("");
  const [flash, setFlash] = useState("");
  const [actionError, setActionError] = useState("");

  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useToastOn(flash, "success", setFlash);
  useToastOn(actionError, "error", setActionError);

  /*
   * ---------------------------------------------------------------
   * Verify current logged-in user is an administrator.
   * ---------------------------------------------------------------
   */
  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      try {
        const response = await me();

        if (cancelled) {
          return;
        }

        const current = response?.user ?? response?.data ?? response ?? null;

        setAccess(current?.role === "admin" ? "ok" : "denied");
      } catch (err) {
        if (cancelled) {
          return;
        }

        setAccess(err?.response?.status === 401 ? "unauth" : "denied");
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ---------------------------------------------------------------
   * Load selected user.
   *
   * The backend is expected to return:
   *
   * user
   * ├── group
   * │   ├── college
   * │   └── members
   * └── user_access
   *     └── project
   * ---------------------------------------------------------------
   */
  useEffect(() => {
    if (access !== "ok") {
      return undefined;
    }

    let cancelled = false;

    const loadUser = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.get(`/admin/users/${id}`);

        if (cancelled) {
          return;
        }

        const payload = normalizeUserPayload(response);

        if (!payload) {
          throw new Error("The server returned an invalid user response.");
        }

        setUser(payload);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setUser(null);

        setError(apiErrorMessage(err, "Unable to load this user."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [access, id, reloadKey]);

  /*
   * ---------------------------------------------------------------
   * Load projects for admin access management.
   * ---------------------------------------------------------------
   */
  useEffect(() => {
    if (access !== "ok") {
      return undefined;
    }

    let cancelled = false;

    const loadProjects = async () => {
      try {
        const response = await apiClient.get("/admin/projects");

        if (cancelled) {
          return;
        }

        const payload = response?.data;

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        setProjects(list);
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [access]);

  /*
   * ---------------------------------------------------------------
   * User access.
   * ---------------------------------------------------------------
   */
  const accessRows = Array.isArray(user?.user_access) ? user.user_access : [];

  /*
   * ---------------------------------------------------------------
   * Group information - Phase 10.
   * ---------------------------------------------------------------
   */
  const group = useMemo(() => normalizeGroup(user), [user]);

  const groupMembers = useMemo(
    () => (Array.isArray(group?.members) ? group.members : []),
    [group],
  );

  const groupMemberCount = group
    ? Number(group.member_count ?? groupMembers.length)
    : 0;

  const leader = useMemo(() => getLeader(group, user), [group, user]);

  /*
   * ---------------------------------------------------------------
   * Group project access by project.
   * ---------------------------------------------------------------
   */
  const groupedProjects = useMemo(() => {
    return accessRows.reduce((groups, row) => {
      if (!row?.project) {
        return groups;
      }

      const projectId = row.project.id;

      if (!groups[projectId]) {
        groups[projectId] = {
          project: row.project,
          stages: [],
        };
      }

      const stage = Number(row.stage_percent);

      if (STAGES.includes(stage) && !groups[projectId].stages.includes(stage)) {
        groups[projectId].stages.push(stage);
      }

      return groups;
    }, {});
  }, [accessRows]);

  const grouped = Object.values(groupedProjects);

  /*
   * Automatically select the only project.
   */
  useEffect(() => {
    if (!selectedProjectId && grouped.length === 1) {
      setSelectedProjectId(String(grouped[0].project.id));
    }
  }, [grouped, selectedProjectId]);

  /*
   * ---------------------------------------------------------------
   * Refresh selected user after an admin access change.
   * ---------------------------------------------------------------
   */
  const refreshUser = async () => {
    try {
      const response = await apiClient.get(`/admin/users/${id}`);

      const payload = normalizeUserPayload(response);

      if (payload) {
        setUser(payload);
      }

      setError("");
    } catch {
      // Keep the existing page data if silent refresh fails.
    }
  };

  /*
   * ---------------------------------------------------------------
   * Selected access row for revoke operation.
   * ---------------------------------------------------------------
   */
  const revokeRow = accessRows.find(
    (row) =>
      Number(row?.project?.id) === Number(selectedProjectId) &&
      Number(row?.stage_percent) === Number(selectedStage),
  );

  const busy = action !== "";

  const revokeSet = STAGES.filter((stage) => stage >= Number(selectedStage));

  /*
   * ---------------------------------------------------------------
   * Grant project access.
   * ---------------------------------------------------------------
   */
  const handleGrantProject = async () => {
    if (!selectedProjectId) {
      return;
    }

    setAction("grant-software");
    setFlash("");
    setActionError("");

    try {
      const response = await apiClient.post("/admin/grant-access", {
        user_id: Number(id),
        project_id: Number(selectedProjectId),
      });

      setFlash(
        response?.data?.created
          ? "20% software access granted."
          : "Already granted — this user already has 20% access for this software.",
      );

      await refreshUser();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Unable to grant software access."));
    } finally {
      setAction("");
    }
  };

  /*
   * ---------------------------------------------------------------
   * Grant stage access.
   * ---------------------------------------------------------------
   */
  const handleGrantStage = async () => {
    if (!selectedProjectId) {
      return;
    }

    setAction("grant-stage");
    setFlash("");
    setActionError("");

    try {
      const response = await apiClient.post("/admin/grant-stage-access", {
        user_id: Number(id),
        project_id: Number(selectedProjectId),
        stage_percent: Number(selectedStage),
      });

      const granted = response?.data?.data?.access ?? [];

      const stageList = Array.isArray(granted)
        ? granted
            .map((row) => Number(row.stage_percent))
            .filter((stage) => STAGES.includes(stage))
        : [];

      setFlash(
        stageList.length
          ? `Stage access granted — now: ${stageList
              .map((stage) => `${stage}%`)
              .join(", ")}.`
          : `Stage ${selectedStage}% access granted successfully.`,
      );

      await refreshUser();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Unable to grant stage access."));
    } finally {
      setAction("");
    }
  };

  /*
   * ---------------------------------------------------------------
   * Revoke selected stage and all higher stages.
   * ---------------------------------------------------------------
   */
  const handleRevoke = async () => {
    if (!revokeRow) {
      return;
    }

    setAction("revoke");
    setFlash("");
    setActionError("");

    try {
      const response = await apiClient.delete(`/admin/access/${revokeRow.id}`);

      const higher = response?.data?.data?.higher_stages_revoked ?? [];

      const higherStages = Array.isArray(higher) ? higher.map(Number) : [];

      setFlash(
        `${revokeRow.stage_percent}% access revoked.` +
          (higherStages.length
            ? ` Higher stages also removed: ${higherStages
                .map((stage) => `${stage}%`)
                .join(", ")}.`
            : ""),
      );

      await refreshUser();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Unable to revoke access."));
    } finally {
      setAction("");
    }
  };

  /*
   * ---------------------------------------------------------------
   * Access states.
   * ---------------------------------------------------------------
   */
  if (access === "checking") {
    return (
      <div className="student-page admin-content-page">
        <main className="admin-page">
          <div className="admin-loading-card">
            <div className="admin-loading-card__icon">
              <Users size={22} aria-hidden="true" />
            </div>

            <div>
              <strong>Checking administrator access</strong>

              <p>Please wait while we verify your session.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (access === "unauth") {
    return (
      <div className="student-page admin-content-page">
        <main className="admin-page">
          <div className="admin-state-card admin-state-card--error">
            <div className="admin-state-card__icon">
              <UserRound size={22} aria-hidden="true" />
            </div>

            <div>
              <h2>Session expired</h2>

              <p>
                Your administrator session has expired. Please sign in again.
              </p>

              <Link to="/login" className="btn btn-primary">
                Sign in
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="student-page admin-content-page">
        <main className="admin-page">
          <div className="admin-state-card admin-state-card--error">
            <div className="admin-state-card__icon">
              <UserRound size={22} aria-hidden="true" />
            </div>

            <div>
              <h2>Admin access required</h2>

              <p>
                You do not have permission to access the administration area.
              </p>

              <Link to="/student" className="btn btn-secondary">
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="student-page admin-content-page">
      <main className="admin-page">
        <Link to="/admin/users" className="student-back-link">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Users
        </Link>

        {loading && (
          <div
            className="admin-details-loading"
            aria-busy="true"
            aria-label="Loading user details"
          >
            <div className="skeleton admin-details-skeleton--hero" />

            <div className="admin-details-skeleton-grid">
              <div className="skeleton admin-details-skeleton--card" />
              <div className="skeleton admin-details-skeleton--card" />
              <div className="skeleton admin-details-skeleton--card" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="admin-state-card admin-state-card--error">
            <div className="admin-state-card__icon">
              <UserRound size={22} aria-hidden="true" />
            </div>

            <div>
              <h2>Unable to load user</h2>

              <p>{error}</p>

              <Link to="/admin/users" className="btn btn-secondary">
                Back to Users
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && user && (
          <>
            {/* =====================================================
                USER HERO
                ===================================================== */}
            <header className="admin-user-hero">
              <div className="admin-user-hero__identity">
                <span
                  className="admin-avatar admin-avatar--lg"
                  aria-hidden="true"
                >
                  {(user.name || "?").charAt(0).toUpperCase()}
                </span>

                <div>
                  <span className="student-dashboard__eyebrow">
                    Administration · User
                  </span>

                  <h1>{user.name}</h1>

                  <p>{user.email}</p>
                </div>
              </div>

              <div className="admin-user-hero__side">
                <span className={`admin-role ${user.role === "admin" ? "admin-role--admin" : "admin-role--student"}`}>
                  {user.role === "student" ? "User" : user.role || "User"}
                </span>
                {user.role !== "admin" && (
                  <AdminUserManage
                    user={user}
                    onChanged={() => setReloadKey((k) => k + 1)}
                    onDeleted={() => navigate("/admin/users")}
                    onFlash={(msg, type) => (type === "error" ? setActionError(msg) : setFlash(msg))}
                  />
                )}
              </div>
            </header>

            {/* =====================================================
                ACCOUNT OVERVIEW
                ===================================================== */}
            <section className="admin-profile">
              <div className="admin-profile__item">
                <span>Email</span>

                <strong className="admin-email">{user.email || "—"}</strong>
              </div>

              <div className="admin-profile__item">
                <span>Mobile</span>

                <strong>{user.mobile || "—"}</strong>
              </div>

              <div className="admin-profile__item">
                <span>College ID</span>

                <strong>{user.college_id || "—"}</strong>
              </div>

              <div className="admin-profile__item">
                <span>Group ID</span>

                <strong>
                  {group?.id
                    ? `#${group.id}`
                    : user.group_id
                      ? `#${user.group_id}`
                      : "—"}
                </strong>
              </div>

              <div className="admin-profile__item">
                <span>Registered</span>

                <strong>{formatDateTime(user.created_at)}</strong>
              </div>
            </section>

            {/* =====================================================
                PHASE 10 — GROUP INFORMATION
                ===================================================== */}
            {group ? (
              <section className="admin-group-section">
                <div className="admin-section-heading">
                  <div>
                    <span className="admin-section-heading__eyebrow">
                      Phase 10
                    </span>

                    <h2>Group information</h2>

                    <p>
                      Registration, college, guide and member information for
                      this software group.
                    </p>
                  </div>

                  <div className="admin-group-heading-meta">
                    <span className="admin-group-count">
                      {groupMemberCount}{" "}
                      {groupMemberCount === 1 ? "member" : "members"}
                    </span>

                    {leader && (
                      <span className="admin-group-leader-status">
                        <Check size={13} aria-hidden="true" />
                        Team Lead assigned
                      </span>
                    )}
                  </div>
                </div>

                <div className="admin-group-overview">
                  <div className="admin-group-info">
                    <span>Group ID</span>

                    <strong>#{group.id}</strong>
                  </div>

                  <div className="admin-group-info">
                    <span>
                      <GraduationCap size={13} aria-hidden="true" />
                      College
                    </span>

                    <strong>{group.college?.name || "—"}</strong>
                  </div>

                  <div className="admin-group-info">
                    <span>
                      <MapPin size={13} aria-hidden="true" />
                      Pincode
                    </span>

                    <strong>{group.pincode || "—"}</strong>
                  </div>

                  <div className="admin-group-info">
                    <span>
                      <MessageCircle size={13} aria-hidden="true" />
                      WhatsApp
                    </span>

                    <strong>{group.whatsapp || "—"}</strong>
                  </div>

                  <div className="admin-group-info">
                    <span>Main guide</span>

                    <strong>{group.guide_name || "—"}</strong>

                    <small>{group.guide_mobile || "—"}</small>
                  </div>

                  <div className="admin-group-info">
                    <span>Second guide</span>

                    <strong>{group.second_guide_name || "Not provided"}</strong>

                    <small>{group.second_guide_mobile || "—"}</small>
                  </div>
                </div>

                {/* =================================================
                    GROUP MEMBERS
                    ================================================= */}
                <div className="admin-members-card">
                  <div className="admin-members-card__header">
                    <div>
                      <div className="admin-members-card__title-row">
                        <h3>Group members</h3>

                        <span>{groupMembers.length} registered</span>
                      </div>

                      <p>All members registered under this group.</p>
                    </div>
                  </div>

                  {groupMembers.length === 0 ? (
                    <div className="admin-members-empty">
                      <Users size={22} aria-hidden="true" />

                      <span>No group members found.</span>
                    </div>
                  ) : (
                    <div className="admin-members-list">
                      {groupMembers.map((member) => {
                        const isLeader =
                          member?.is_leader === true ||
                          String(member?.email || "").toLowerCase() ===
                            String(user.email || "").toLowerCase();

                        return (
                          <article
                            key={member.id}
                            className={`admin-member-row${
                              isLeader ? " admin-member-row--leader" : ""
                            }`}
                          >
                            <div className="admin-member-avatar">
                              {(member.name || "?").charAt(0).toUpperCase()}
                            </div>

                            <div className="admin-member-main">
                              <div className="admin-member-name">
                                <strong>
                                  {member.name || "Unnamed member"}
                                </strong>

                                {isLeader && (
                                  <span className="admin-leader-badge">
                                    Team Lead
                                  </span>
                                )}
                              </div>

                              <span className="admin-member-email">
                                <Mail size={13} aria-hidden="true" />

                                {member.email || "—"}
                              </span>
                            </div>

                            <div className="admin-member-meta">
                              <span>
                                <strong>User ID</strong>

                                <span>
                                  <GraduationCap size={13} aria-hidden="true" />

                                  {member.student_id || "—"}
                                </span>
                              </span>

                              <span>
                                <strong>Mobile</strong>

                                <span>
                                  <Phone size={13} aria-hidden="true" />

                                  {member.mobile || "—"}
                                </span>
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section className="admin-no-group-card">
                <div className="admin-no-group-card__icon">
                  <Users size={20} aria-hidden="true" />
                </div>

                <div>
                  <h3>No group information</h3>

                  <p>
                    This account is not currently associated with a Phase 10
                    group.
                  </p>
                </div>
              </section>
            )}

            {/* =====================================================
                PROJECT ACCESS
                ===================================================== */}
            <section className="admin-section">
              <div className="admin-section-heading admin-section-heading--access">
                <div>
                  <span className="admin-section-heading__eyebrow">
                    Access management
                  </span>

                  <h2>Software access</h2>

                  <p>
                    Grant, review and revoke software stage access for this user.
                  </p>
                </div>
              </div>

              <div className="admin-panels">
                {/* Grant */}
                <div className="admin-panel">
                  <div className="admin-panel__title">
                    <div>
                      <h3>Grant access</h3>

                      <p>Select a software and optionally unlock its stages.</p>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor="grant-project">
                      Software
                    </label>

                    <select
                      id="grant-project"
                      className="select"
                      value={selectedProjectId}
                      onChange={(event) => {
                        setSelectedProjectId(event.target.value);
                        setConfirmRevoke(false);
                        setFlash("");
                        setActionError("");
                      }}
                      disabled={busy}
                    >
                      <option value="">Select software</option>

                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor="grant-stage">
                      Stage
                    </label>

                    <select
                      id="grant-stage"
                      className="select"
                      value={selectedStage}
                      onChange={(event) => {
                        setSelectedStage(event.target.value);
                        setConfirmRevoke(false);
                        setFlash("");
                        setActionError("");
                      }}
                      disabled={busy}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}%
                        </option>
                      ))}
                    </select>

                    <span className="field__hint">
                      Granting a stage is cumulative.
                    </span>
                  </div>

                  <div className="admin-panel__actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleGrantProject}
                      disabled={busy || !selectedProjectId}
                    >
                      {action === "grant-software"
                        ? "Granting..."
                        : "Grant software (20%)"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleGrantStage}
                      disabled={busy || !selectedProjectId}
                    >
                      {action === "grant-stage"
                        ? "Granting..."
                        : `Grant stage ${selectedStage}%`}
                    </button>
                  </div>
                </div>

                {/* Revoke */}
                <div className="admin-panel admin-panel--danger">
                  <div className="admin-panel__title">
                    <div>
                      <h3>Revoke access</h3>

                      <p>Remove the selected stage and every higher stage.</p>
                    </div>
                  </div>

                  {!confirmRevoke ? (
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={() => setConfirmRevoke(true)}
                      disabled={busy || !revokeRow}
                    >
                      <Ban size={15} aria-hidden="true" />
                      Revoke {selectedStage}% and higher
                    </button>
                  ) : (
                    <div
                      className="admin-confirm"
                      role="alertdialog"
                      aria-label="Confirm revoke"
                    >
                      <p>
                        This will remove{" "}
                        <strong>
                          {revokeSet.map((stage) => `${stage}%`).join(", ")}
                        </strong>{" "}
                        from this user for the selected software.
                      </p>

                      <div className="admin-panel__actions">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={async () => {
                            await handleRevoke();
                            setConfirmRevoke(false);
                          }}
                        >
                          {action === "revoke"
                            ? "Revoking..."
                            : "Confirm revoke"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setConfirmRevoke(false)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!revokeRow && selectedProjectId && (
                    <span className="field__hint">
                      This user doesn't have {selectedStage}% access for that
                      software.
                    </span>
                  )}
                </div>
              </div>

              {/* =================================================
                  CURRENT PROJECT ACCESS
                  ================================================= */}
              {grouped.length === 0 ? (
                <div className="admin-no-access-card">
                  <div className="admin-no-access-card__icon">
                    <LockKeyhole size={20} aria-hidden="true" />
                  </div>

                  <div>
                    <h3>No software access yet</h3>

                    <p>
                      Use the controls above to grant this user access to a
                      software.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="admin-access-grid">
                  {grouped.map((entry) => {
                    const highestStage = Math.max(...entry.stages, 0);

                    const unlockedCount = STAGES.filter((stage) =>
                      entry.stages.includes(stage),
                    ).length;

                    return (
                      <article
                        key={entry.project.id}
                        className="admin-access-card"
                      >
                        <div className="admin-access-card__head">
                          <div>
                            <h3>{entry.project.title || "Untitled software"}</h3>

                            <span>{entry.project.slug || "—"}</span>
                          </div>

                          <strong>{highestStage}%</strong>
                        </div>

                        <div
                          className="progress"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={highestStage}
                          aria-label="Highest unlocked stage"
                        >
                          <span
                            style={{
                              width: `${highestStage}%`,
                            }}
                          />
                        </div>

                        <div
                          className="admin-access-card__stages"
                          aria-label={`${unlockedCount} of ${STAGES.length} stages unlocked`}
                        >
                          {STAGES.map((stage) => {
                            const granted = entry.stages.includes(stage);

                            return (
                              <span
                                key={stage}
                                className={`admin-stage-pill ${
                                  granted ? "is-on" : "is-off"
                                }`}
                                title={
                                  granted
                                    ? `${stage}% unlocked`
                                    : `${stage}% locked`
                                }
                              >
                                {granted ? (
                                  <Check size={12} aria-hidden="true" />
                                ) : (
                                  <LockKeyhole size={11} aria-hidden="true" />
                                )}
                                {stage}%
                              </span>
                            );
                          })}
                        </div>

                        <div className="admin-access-card__meta">
                          {unlockedCount} of {STAGES.length} stages unlocked
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminUserDetails;
