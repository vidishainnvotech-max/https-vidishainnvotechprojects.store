
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getMyProjects, STAGE_STEPS } from "../api/student";
import apiClient from "../api/client";

import StudentHeader from "../components/student/StudentHeader";
import { softwareLabel } from "../utils/visibleText";
import Reveal from "../components/Reveal";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  FolderOpen,
  Gauge,
  Layers,
  LockKeyhole,
  RefreshCw,
  Rocket,
  Trophy,
  Users,
  Building2,
  MapPin,
  Phone,
  MessageCircle,
  UserRound,
  Sprout,
  Cpu,
  Code2,
} from "lucide-react";

function CountUp({ value, suffix = "" }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let id;

    const tick = (t) => {
      const p = Math.min((t - start) / 900, 1);

      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));

      if (p < 1) {
        id = requestAnimationFrame(tick);
      }
    };

    id = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(id);
  }, [value]);

  return (
    <>
      {n}
      {suffix}
    </>
  );
}

function getProjectAccessPercent(project) {
  const rawPercent =
    project?.access_percent ?? project?.highest_stage ?? 0;

  const percent = Number(rawPercent);

  if (!Number.isFinite(percent)) {
    return 0;
  }

  return Math.min(100, Math.max(0, percent));
}

function statusTone(value = "") {
  const v = String(value).toLowerCase();
  if (["paid", "success", "completed", "confirmed", "delivered"].includes(v)) return "ok";
  if (["failed", "cancelled", "canceled", "refunded", "rejected"].includes(v)) return "bad";
  return "warn";
}

function getProjectState(percent) {
  if (percent >= 100) return { label: "Fully unlocked", tone: "ok" };
  if (percent > 0) return { label: "In progress", tone: "info" };
  return { label: "Not started", tone: "idle" };
}

const CATEGORY_META = [
  { test: /iot|internet|sensor|agri/i, icon: Sprout, accent: "green" },
  { test: /app|mobile|android|rfid/i, icon: Cpu, accent: "blue" },
  { test: /python|data|ml|\bai\b/i, icon: Code2, accent: "amber" },
];

function getCategoryMeta(name = "") {
  return (
    CATEGORY_META.find((m) => m.test.test(name)) || {
      icon: Layers,
      accent: "violet",
    }
  );
}

function StudentDashboard() {
  const [projects, setProjects] = useState([]);
  const [group, setGroup] = useState(null);

  const [loading, setLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(true);

  const [error, setError] = useState("");
  const [groupError, setGroupError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setGroupLoading(true);

        setError("");
        setGroupError("");

        const [projectsResult, meResult] = await Promise.allSettled([
          getMyProjects(),
          apiClient.get("/me"),
        ]);

        if (!mounted) {
          return;
        }

        if (projectsResult.status === "fulfilled") {
          const response = projectsResult.value;

          const projectPayload =
            response?.data?.data ??
            response?.data?.projects ??
            response?.data ??
            response;

          setProjects(Array.isArray(projectPayload) ? projectPayload : []);
        } else {
          setError(
            projectsResult.reason?.response?.data?.message ||
              "Unable to load your software.",
          );
        }

        if (meResult.status === "fulfilled") {
          const response = meResult.value;

          setGroup(
            response?.data?.user?.group ??
              response?.data?.group ??
              response?.user?.group ??
              response?.group ??
              null,
          );
        } else {
          setGroupError("Unable to load your group information.");
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.response?.data?.message ||
              "Unable to load your dashboard.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setGroupLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = {
    total: projects.length,

    unlocked: projects.filter(
      (project) => getProjectAccessPercent(project) >= 100,
    ).length,

    active: projects.filter((project) => {
      const percent = getProjectAccessPercent(project);
      return percent > 0 && percent < 100;
    }).length,

    avg: projects.length
      ? Math.round(
          projects.reduce(
            (total, project) =>
              total + getProjectAccessPercent(project),
            0,
          ) / projects.length,
        )
      : 0,
  };

  const members = Array.isArray(group?.members) ? group.members : [];

  const groupCollege =
    group?.college?.name ||
    group?.college_name ||
    "College not available";

  const groupSize =
    Number(group?.member_count) || members.length || 0;

  return (
    <div className="student-page">
      <StudentHeader />

      <main className="container student-dashboard page-enter">
        <section className="student-dashboard__hero">
          <span className="student-dashboard__eyebrow">User workspace</span>
          <h1>Your software</h1>
          <p>Track your access and unlock the next stage.</p>
        </section>

        {!groupLoading && group && (
          <Reveal className="reveal-fill">
            <section
              className="student-group-card"
              aria-labelledby="student-group-title"
            >
              <div className="student-group-card__header">
                <div>
                  <span className="student-group-card__eyebrow">
                    Group information
                  </span>

                  <h2 id="student-group-title">My Group</h2>


                </div>

                <span className="student-group-card__count">
                  <Users size={17} aria-hidden="true" />
                  {groupSize} {groupSize === 1 ? "Member" : "Members"}
                </span>
              </div>

              <div className="student-group-meta">
                <div className="student-group-meta__item">
                  <span className="student-group-meta__icon">
                    <Building2 size={17} aria-hidden="true" />
                  </span>

                  <div>
                    <span>College</span>
                    <strong>{groupCollege}</strong>
                  </div>
                </div>

                <div className="student-group-meta__item">
                  <span className="student-group-meta__icon">
                    <MapPin size={17} aria-hidden="true" />
                  </span>

                  <div>
                    <span>Pincode</span>
                    <strong>{group?.pincode || "—"}</strong>
                  </div>
                </div>

                <div className="student-group-meta__item">
                  <span className="student-group-meta__icon">
                    <MessageCircle size={17} aria-hidden="true" />
                  </span>

                  <div>
                    <span>WhatsApp</span>
                    <strong>{group?.whatsapp || "—"}</strong>
                  </div>
                </div>

                <div className="student-group-meta__item">
                  <span className="student-group-meta__icon">
                    <UserRound size={17} aria-hidden="true" />
                  </span>

                  <div>
                    <span>Main guide</span>
                    <strong>{group?.guide_name || "—"}</strong>

                    {group?.guide_mobile && (
                      <small>
                        <Phone size={12} aria-hidden="true" />
                        {group.guide_mobile}
                      </small>
                    )}
                  </div>
                </div>

                {(group?.second_guide_name ||
                  group?.second_guide_mobile) && (
                  <div className="student-group-meta__item">
                    <span className="student-group-meta__icon">
                      <UserRound size={17} aria-hidden="true" />
                    </span>

                    <div>
                      <span>Second guide</span>
                      <strong>{group?.second_guide_name || "—"}</strong>

                      {group?.second_guide_mobile && (
                        <small>
                          <Phone size={12} aria-hidden="true" />
                          {group.second_guide_mobile}
                        </small>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="student-group-members">
                <div className="student-group-members__header">
                  <div>
                    <span className="student-group-members__eyebrow">
                      Registered members
                    </span>

                    <h3>Software team</h3>
                  </div>

                  <span>
                    {members.length}{" "}
                    {members.length === 1 ? "member" : "members"}
                  </span>
                </div>

                {members.length > 0 ? (
                  <div className="student-group-members__grid">
                    {members.map((member, index) => (
                      <div
                        key={member.id || `${member.email}-${index}`}
                        className={`student-group-member${
                          member.is_leader ? " is-leader" : ""
                        }`}
                      >
                        <div className="student-group-member__avatar">
                          <UserRound size={18} aria-hidden="true" />
                        </div>

                        <div className="student-group-member__body">
                          <div className="student-group-member__name">
                            <strong>{member.name}</strong>

                            {member.is_leader && (
                              <span className="student-group-member__badge">
                                <Check size={11} aria-hidden="true" />
                                Team Lead
                              </span>
                            )}
                          </div>

                          <small>{member.email}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="student-group-members__empty">
                    Group member details are not available yet.
                  </div>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {!groupLoading && groupError && (
          <div
            className="student-state student-state--error student-group-error"
            role="alert"
          >
            <AlertTriangle size={16} aria-hidden="true" />
            {groupError}
          </div>
        )}

        {(loading || groupLoading) && (
          <div aria-busy="true" aria-label="Loading dashboard">
            {groupLoading && <div className="skeleton sx-skel-group" />}
            {loading && (
              <>
                <div className="stat-grid">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton sx-skel-stat" />
                  ))}
                </div>
                <div className="student-project-grid">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton skeleton--card sx-skel-card" />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && error && (
          <div className="error-state" role="alert">
            <span className="error-state__icon">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>

            <h3>We couldn't load your software</h3>
            <p>{error}</p>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__icon">
              <FolderOpen size={24} aria-hidden="true" />
            </span>

            <h3>No software assigned yet</h3>

            <p>
              Once you choose a plan or an admin assigns a software, it will
              appear here with your unlocked stages.
            </p>

            <Link to="/projects" className="btn btn-primary btn-sm">
              Browse software
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <Reveal className="reveal-fill">
            <div className="sx-summary">
              {[
                { label: "Software", node: <CountUp value={stats.total} />, icon: Layers },
                {
                  label: "Fully unlocked",
                  node: (<><CountUp value={stats.unlocked} /> / {stats.total}</>),
                  icon: Trophy,
                },
                { label: "In progress", node: <CountUp value={stats.active} />, icon: Rocket },
                { label: "Avg. access", node: <CountUp value={stats.avg} suffix="%" />, icon: Gauge },
              ].map(({ label, node, icon: Icon }) => (
                <div className="sx-summary__item" key={label}>
                  <span className="sx-summary__icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{node}</strong>
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            <div className="sx-section-head">
              <span>Your software</span>
              <h2>Explore software</h2>
            </div>

            <section className="student-project-grid">
              {projects.map((project, index) => {
                const highestStage = getProjectAccessPercent(project);
                const unlockedCount = STAGE_STEPS.filter((p) => highestStage >= p).length;
                const fullyUnlocked = highestStage >= 100;
                const nextStage = STAGE_STEPS.find((p) => highestStage < p);
                const state = getProjectState(highestStage);
                const categoryName = softwareLabel(project.category?.name, "Software").replace(/^\(|\)$/g, "");
                const { icon: CatIcon, accent } = getCategoryMeta(categoryName);

                const paymentStatus = project.payment_status ?? project.order?.payment_status;
                const orderStatus = project.order_status ?? project.order?.status;

                return (
                  <Reveal
                    as="article"
                    className={`student-project-card sx-card sx-card--${accent}${fullyUnlocked ? " is-complete" : ""}`}
                    key={project.id}
                    delay={Math.min(index, 5) * 0.07}
                  >
                    <div className="student-project-card__content">
                      <div className="sx-card-head">
                        <span className="sx-card-icon">
                          <CatIcon size={20} aria-hidden="true" />
                        </span>
                        <span className={`sx-badge sx-badge--${state.tone}`}>
                          {fullyUnlocked ? <Check size={12} aria-hidden="true" /> : <span className="sx-badge__dot" aria-hidden="true" />}
                          {fullyUnlocked ? "Unlocked" : state.label}
                        </span>
                      </div>

                      <span className="student-project-card__category">{categoryName}</span>
                      <h3>{project.title}</h3>
                      <p>{project.abstract || "Software details and resources are available inside."}</p>

                      {(paymentStatus || orderStatus) && (
                        <div className="sx-meta">
                          {paymentStatus && (
                            <span className={`sx-chip sx-chip--${statusTone(paymentStatus)}`}>
                              Payment: <b>{paymentStatus}</b>
                            </span>
                          )}
                          {orderStatus && (
                            <span className={`sx-chip sx-chip--${statusTone(orderStatus)}`}>
                              Order: <b>{orderStatus}</b>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="sx-access__head">
                        <span>Access progress</span>
                        <strong>{highestStage}%</strong>
                      </div>

                      <ol className="sx-seg" aria-label="Stage access">
                        {STAGE_STEPS.map((percent, i) => {
                          const unlocked = highestStage >= percent;
                          const isNext = percent === nextStage;
                          return (
                            <li
                              key={percent}
                              className={`sx-seg__item${unlocked ? " is-on" : isNext ? " is-next" : ""}`}
                              style={{ "--i": i }}
                            >
                              <span className="sx-seg__bar" />
                              <span className="sx-seg__label">
                                {unlocked ? <Check size={11} aria-hidden="true" /> : isNext ? null : <LockKeyhole size={10} aria-hidden="true" />}
                                {percent}%
                              </span>
                              <span className="sr-only">{unlocked ? "unlocked" : isNext ? "next" : "locked"}</span>
                            </li>
                          );
                        })}
                      </ol>

                      <div className="sx-foot">
                        <span>{unlockedCount}/{STAGE_STEPS.length} stages unlocked</span>
                        {fullyUnlocked ? (
                          <span className="sx-foot__done">
                            <Check size={13} aria-hidden="true" /> Complete
                          </span>
                        ) : (
                          <span className="sx-foot__next">Next: {nextStage}%</span>
                        )}
                      </div>
                    </div>

                    {String(orderStatus || "").toLowerCase() === "partial" && (
                      <Link
                        to={`/student/projects/${project.id}`}
                        className="student-project-card__action"
                        aria-label={`Continue payment for ${project.title}`}
                      >
                        Continue Payment
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )}

                    <Link
                      to={`/student/projects/${project.id}`}
                      className="student-project-card__action"
                      aria-label={`Open ${project.title}`}
                    >
                      Open software
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </Reveal>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;
