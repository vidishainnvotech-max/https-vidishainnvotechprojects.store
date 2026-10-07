import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getMyProjects, STAGE_STEPS } from "../api/student";
import StudentHeader from "../components/student/StudentHeader";
import { AlertTriangle, ArrowRight, Check, FolderOpen, LockKeyhole, RefreshCw } from "lucide-react";

function StudentDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadProjects = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getMyProjects();

        if (!mounted) return;

        setProjects(Array.isArray(response?.data) ? response.data : []);
      } catch (err) {
        if (!mounted) return;

        setError(
          err?.response?.data?.message || "Unable to load your projects.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = {
    total: projects.length,
    unlocked: projects.filter((p) => Number(p.highest_stage) >= 100).length,
    active: projects.filter((p) => {
      const s = Number(p.highest_stage) || 0;
      return s > 0 && s < 100;
    }).length,
    avg: projects.length
      ? Math.round(projects.reduce((n, p) => n + (Number(p.highest_stage) || 0), 0) / projects.length)
      : 0,
  };

  return (
    <div className="student-page">
      <StudentHeader />

      <main className="container student-dashboard">
        <section className="student-dashboard__hero">
          <span className="student-dashboard__eyebrow">Student Dashboard</span>
          <h1>Welcome back</h1>
          <p>Pick up where you left off. Each stage unlocks as your installments are completed.</p>
        </section>

        {loading && (
          <div className="student-project-grid" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--card" />)}
          </div>
        )}

        {!loading && error && (
          <div className="error-state" role="alert">
            <span className="error-state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
            <h3>We couldn't load your projects</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon"><FolderOpen size={24} aria-hidden="true" /></span>
            <h3>No projects assigned yet</h3>
            <p>Once you choose a plan or an admin assigns a project, it will appear here with your unlocked stages.</p>
            <Link to="/projects" className="btn btn-primary btn-sm">
              Browse projects <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="stat-grid">
            <div className="stat-tile"><span className="stat-tile__label">Projects</span><span className="stat-tile__value">{stats.total}</span></div>
            <div className="stat-tile"><span className="stat-tile__label">In progress</span><span className="stat-tile__value">{stats.active}</span></div>
            <div className="stat-tile"><span className="stat-tile__label">Fully unlocked</span><span className="stat-tile__value">{stats.unlocked}</span></div>
            <div className="stat-tile"><span className="stat-tile__label">Avg. access</span><span className="stat-tile__value">{stats.avg}%</span></div>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <section className="student-project-grid">
            {projects.map((project) => {
              const highestStage = Number(project.highest_stage) || 0;

              const unlockedCount = STAGE_STEPS.filter(
                (percent) => highestStage >= percent,
              ).length;

              const fullyUnlocked = highestStage >= 100;

              return (
                <article className="student-project-card" key={project.id}>
                  <div className="student-project-card__content">
                    <span className="student-project-card__category">
                      {project.category?.name || "Project"}
                    </span>

                    <h3>{project.title}</h3>

                    {project.abstract && <p>{project.abstract}</p>}

                    <div className="student-project-card__progress">
                      <div className="student-project-card__progress-header">
                        <span>Access Progress</span>
                        <strong>{highestStage}%</strong>
                      </div>

                      <div
                        className="student-project-card__progress-track"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={highestStage}
                        aria-label="Access progress"
                      >
                        <div
                          className="student-project-card__progress-fill"
                          style={{ width: `${highestStage}%` }}
                        />
                      </div>

                      {fullyUnlocked && (
                        <div className="student-project-card__complete">
                          <Check size={14} aria-hidden="true" /> Project fully unlocked
                        </div>
                      )}
                    </div>

                    <div className="student-project-card__stages">
                      {STAGE_STEPS.map((percent) => {
                        const unlocked = highestStage >= percent;

                        return (
                          <span
                            key={percent}
                            className={`admin-stage-pill ${
                              unlocked ? "is-on" : "is-off"
                            }`}
                            title={unlocked ? "Unlocked" : "Locked"}
                          >
                            {unlocked ? <Check size={12} aria-hidden="true" /> : <LockKeyhole size={11} aria-hidden="true" />}
                            {percent}%
                          </span>
                        );
                      })}

                      <span className="student-project-card__stages-text">
                        {unlockedCount} of {STAGE_STEPS.length} stages unlocked
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/student/projects/${project.id}`}
                    className="student-project-card__action"
                    aria-label={`Open ${project.title}`}
                  >
                    Open Project <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;
