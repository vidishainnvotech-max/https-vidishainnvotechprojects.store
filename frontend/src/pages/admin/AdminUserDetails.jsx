import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Check, LockKeyhole } from "lucide-react";
import apiClient from "../../api/client";
import { me } from "../../api/student";
import AdminHeader from "../../components/admin/AdminHeader";

const STAGES = [20, 50, 75, 100];

function apiErrorMessage(err, fallback) {
  const data = err?.response?.data;

  if (data?.errors) {
    const first = Object.values(data.errors)[0];

    if (Array.isArray(first) && first[0]) {
      return first[0];
    }
  }

  return data?.message || fallback;
}

function AdminUserDetails() {
  const { id } = useParams();

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

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      try {
        const response = await me();

        if (cancelled) return;

        const current = response?.user ?? response?.data ?? null;

        setAccess(current?.role === "admin" ? "ok" : "denied");
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
    if (access !== "ok") return undefined;

    let cancelled = false;

    const loadUser = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.get(`/admin/users/${id}`);

        if (cancelled) return;

        setUser(response?.data?.data ?? response?.data ?? null);
      } catch (err) {
        if (cancelled) return;

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
  }, [access, id]);

  useEffect(() => {
    if (access !== "ok") return undefined;

    let cancelled = false;

    const loadProjects = async () => {
      try {
        const response = await apiClient.get("/admin/projects");

        if (cancelled) return;

        const payload = response?.data;

        setProjects(Array.isArray(payload) ? payload : (payload?.data ?? []));
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
   * Current user's project access.
   * This is calculated before the conditional returns so
   * it can safely be used by the hook below.
   */
  const accessRows = user?.user_access ?? [];

  const groupedProjects = accessRows.reduce((groups, row) => {
    if (!row?.project) return groups;

    const key = row.project.id;

    if (!groups[key]) {
      groups[key] = {
        project: row.project,
        stages: [],
      };
    }

    groups[key].stages.push(Number(row.stage_percent));

    return groups;
  }, {});

  const grouped = Object.values(groupedProjects);

  /*
   * If the user has access to only one project,
   * automatically select that project.
   *
   * This makes Revoke Access immediately usable
   * without requiring the admin to manually select
   * the same project again.
   */
  useEffect(() => {
    if (!selectedProjectId && grouped.length === 1) {
      setSelectedProjectId(String(grouped[0].project.id));
    }
  }, [user, selectedProjectId]);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get(`/admin/users/${id}`);

      setUser(response?.data?.data ?? response?.data ?? null);

      setError("");
    } catch {
      // Keep the current data on silent refresh failure.
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

  const revokeRow = accessRows.find(
    (row) =>
      Number(row?.project?.id) === Number(selectedProjectId) &&
      Number(row?.stage_percent) === Number(selectedStage),
  );

  const busy = action !== "";

  const revokeSet = STAGES.filter((stage) => stage >= Number(selectedStage));

  const handleGrantProject = async () => {
    if (!selectedProjectId) return;

    setAction("grant-project");
    setFlash("");
    setActionError("");

    try {
      const response = await apiClient.post("/admin/grant-access", {
        user_id: Number(id),
        project_id: Number(selectedProjectId),
      });

      setFlash(
        response?.data?.created
          ? "20% project access granted."
          : "Already granted — this user has 20% access for this project.",
      );

      await refreshUser();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Unable to grant access."));
    } finally {
      setAction("");
    }
  };

  const handleGrantStage = async () => {
    if (!selectedProjectId) return;

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

      setFlash(
        `Stage access granted — now: ${granted
          .map((row) => `${row.stage_percent}%`)
          .join(", ")}.`,
      );

      await refreshUser();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Unable to grant stage access."));
    } finally {
      setAction("");
    }
  };

  const handleRevoke = async () => {
    if (!revokeRow) return;

    setAction("revoke");
    setFlash("");
    setActionError("");

    try {
      const response = await apiClient.delete(`/admin/access/${revokeRow.id}`);

      const higher = response?.data?.data?.higher_stages_revoked ?? [];

      setFlash(
        `${revokeRow.stage_percent}% access revoked.` +
          (higher.length
            ? ` Higher stages also removed: ${higher
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

  return (
    <div className="student-page">
      <AdminHeader />

      <main className="container admin-page">
        <Link to="/admin/users" className="student-back-link">
          <ArrowLeft size={14} />
          Back to Users
        </Link>

        {loading && (
          <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
            <div className="skeleton" style={{ height: 72 }} />
            <div className="skeleton skeleton--card" />
          </div>
        )}

        {!loading && error && (
          <>
            <div className="student-state student-state--error" role="alert">
              {error}
            </div>

            <Link to="/admin/users" className="btn btn-secondary">
              Back to Users
            </Link>
          </>
        )}

        {!loading && !error && user && (
          <>
            <header className="admin-header">
              <div className="admin-user-head">
                <span className="admin-avatar admin-avatar--lg" aria-hidden="true">{(user.name || "?").charAt(0).toUpperCase()}</span>
                <div>
                  <span className="student-dashboard__eyebrow">Admin · User</span>
                  <h1>{user.name}</h1>
                </div>
              </div>

              <span
                className={`admin-role ${
                  user.role === "admin"
                    ? "admin-role--admin"
                    : "admin-role--student"
                }`}
              >
                {user.role}
              </span>
            </header>

            <section className="admin-profile">
              <div className="admin-profile__item">
                <span>Email</span>
                <strong>{user.email}</strong>
              </div>

              <div className="admin-profile__item">
                <span>Mobile</span>
                <strong>{user.mobile ?? "—"}</strong>
              </div>

              <div className="admin-profile__item">
                <span>College ID</span>
                <strong>{user.college_id ?? "—"}</strong>
              </div>

              <div className="admin-profile__item">
                <span>Registered</span>
                <strong>
                  {user.created_at
                    ? new Date(user.created_at).toLocaleString()
                    : "—"}
                </strong>
              </div>
            </section>

            <section className="admin-section">
              <h2>Project Access</h2>

              <div className="admin-panels">
                <div className="admin-panel">
                  <h3>Grant access</h3>

                  <div className="field">
                    <label className="field__label" htmlFor="grant-project">Project</label>
                    <select id="grant-project" className="select" value={selectedProjectId}
                      onChange={(event) => { setSelectedProjectId(event.target.value); setConfirmRevoke(false); }} disabled={busy}>
                      <option value="">Select project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor="grant-stage">Stage</label>
                    <select id="grant-stage" className="select" value={selectedStage}
                      onChange={(event) => { setSelectedStage(event.target.value); setConfirmRevoke(false); }} disabled={busy}>
                      {STAGES.map((stage) => <option key={stage} value={stage}>{stage}%</option>)}
                    </select>
                    <span className="field__hint">Granting a stage is cumulative.</span>
                  </div>

                  <div className="admin-panel__actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleGrantProject} disabled={busy || !selectedProjectId}>
                      {action === "grant-project" ? "Granting..." : "Grant project (20%)"}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleGrantStage} disabled={busy || !selectedProjectId}>
                      {action === "grant-stage" ? "Granting..." : `Grant stage ${selectedStage}%`}
                    </button>
                  </div>
                </div>

                <div className="admin-panel admin-panel--danger">
                  <h3>Revoke access</h3>
                  <p className="field__hint">
                    Uses the project and stage selected on the left. Revoking removes the selected stage and every higher stage.
                  </p>

                  {!confirmRevoke ? (
                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmRevoke(true)} disabled={busy || !revokeRow}>
                      <Ban size={15} aria-hidden="true" /> Revoke {selectedStage}% and higher
                    </button>
                  ) : (
                    <div className="admin-confirm" role="alertdialog" aria-label="Confirm revoke">
                      <p>This will remove <strong>{revokeSet.map((s) => `${s}%`).join(", ")}</strong> from this user for the selected project.</p>
                      <div className="admin-panel__actions">
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy}
                          onClick={async () => { await handleRevoke(); setConfirmRevoke(false); }}>
                          {action === "revoke" ? "Revoking..." : "Confirm revoke"}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmRevoke(false)} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {!revokeRow && selectedProjectId && (
                    <span className="field__hint">This user doesn't have {selectedStage}% access for that project.</span>
                  )}
                </div>
              </div>

              {flash && (
                <div className="admin-feedback" role="status" aria-live="polite">
                  <Check size={16} aria-hidden="true" /> {flash}
                </div>
              )}

              {actionError && (
                <div className="student-state student-state--error" role="alert">{actionError}</div>
              )}

              {grouped.length === 0 ? (
                <div className="student-state">No project access yet.</div>
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
                            <h3>{entry.project.title}</h3>

                            <span>{entry.project.slug}</span>
                          </div>

                          <strong>{highestStage}%</strong>
                        </div>

                        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={highestStage} aria-label="Highest unlocked stage">
                          <span style={{ width: `${highestStage}%` }} />
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
                                  {granted ? <Check size={12} aria-hidden="true" /> : <LockKeyhole size={11} aria-hidden="true" />}
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
