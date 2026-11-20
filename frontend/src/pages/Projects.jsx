import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import Header from "../components/Header";
import { getCategories } from "../api/categories";
import { getProjects } from "../api/projects";
import { getProjectImage } from "../utils/projectImages";
import { softwareLabel } from "../utils/visibleText";
import "./projects-page.css";

const PROJECT_TYPES = [
  { value: "", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "diploma_mini", label: "Small Software" },
];

const getList = (p) =>
  Array.isArray(p) ? p : p?.data || p?.projects || p?.categories || [];

const inr = (v) => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 0) return null;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const category = searchParams.get("category") || "";
  const type = searchParams.get("type") || "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, c] = await Promise.all([getProjects(), getCategories()]);
      setProjects(getList(p));
      setCategories(getList(c));
    } catch {
      setError("Unable to load software. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((searchParams.get("search") || "") !== search.trim()) setParam("search", search.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (type && (p.project_type || "standard") !== type) return false;
      if (category && p.category?.slug !== category) return false;
      if (!q) return true;
      return [p.title, p.abstract, p.category?.name, p.project_type, p.level, p.is_iot ? "iot" : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [projects, search, category, type]);

  const hasFilters = Boolean(search.trim() || category || type);
  const clear = () => {
    setSearch("");
    setSearchParams({}, { replace: true });
  };

  return (
    <>
      <Header />
      <main className="pj">
        <section className="pj-hero">
          <span className="pj-blob pj-blob--a" aria-hidden="true" />
          <span className="pj-blob pj-blob--b" aria-hidden="true" />
          <span className="pj-blob pj-blob--c" aria-hidden="true" />

          <div className="pj-hero__inner">
            <span className="pj-eyebrow">
              <Sparkles size={14} aria-hidden="true" /> Software catalog
            </span>
            <h1>
              Build something <span>you're proud of.</span>
            </h1>
            <p>Pick a ready-to-learn Software and unlock it stage by stage.</p>

            <div className="pj-stats">
              <div>
                <strong>{projects.length || "—"}</strong>
                <span>Software</span>
              </div>
              <div>
                <strong>{categories.length || "—"}</strong>
                <span>Categories</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>Source code</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pj-bar">
          <div className="pj-bar__inner">
            <div className="pj-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, technology or level"
                aria-label="Search software"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="pj-seg" role="group" aria-label="Software type">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.value || "all"}
                  type="button"
                  className={type === t.value ? "is-on" : ""}
                  onClick={() => setParam("type", t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="pj-chips" role="group" aria-label="Categories">
              <button type="button" className={!category ? "is-on" : ""} onClick={() => setParam("category", "")}>
                All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={category === c.slug ? "is-on" : ""}
                  onClick={() => setParam("category", c.slug)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="pj-list">
          <div className="pj-list__head">
            <h2>
              {loading ? "Loading software…" : `${filtered.length} software`}
            </h2>
            {hasFilters && (
              <button type="button" className="pj-clear" onClick={clear}>
                <X size={14} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>

          {loading && (
            <div className="pj-grid" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="pj-skel" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="error-state" role="alert">
              <span className="error-state__icon">
                <AlertTriangle size={24} aria-hidden="true" />
              </span>
              <h3>We couldn't load the software</h3>
              <p>{error}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                <RefreshCw size={15} aria-hidden="true" /> Try again
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="pj-empty">
              <Search size={28} aria-hidden="true" />
              <h3>No software found</h3>
              <p>Try another search or remove a filter.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
                Clear filters
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="pj-grid">
              {filtered.map((project, i) => (
                <ProjectCard key={project.id ?? project.slug ?? i} project={project} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ProjectCard({ project, index }) {
  const [failed, setFailed] = useState(false);
  const src = (project.image_url || project.imageUrl) && !failed
    ? project.image_url || project.imageUrl
    : getProjectImage();

  const isMini = project.project_type === "diploma_mini";
  const cut = inr(project.cut_price);
  const offer = inr(project.offer_price);
  const showPrice = isMini && (cut || offer);
  const hasDiscount = cut && offer && Number(project.offer_price) < Number(project.cut_price);
  const level = project.level ? softwareLabel(String(project.level).replaceAll("_", " ")) : "";

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
  };
  const onLeave = (e) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="pj-card"
      style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-label={`View ${project.title || "software"}`}
    >
      <div className="pj-card__media">
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
        <span className="pj-card__shade" />
        <span className="pj-tag pj-tag--cat">
          <Cpu size={12} aria-hidden="true" /> {softwareLabel(project.category?.name, "Software")}
        </span>
        <span className={`pj-tag pj-tag--type${isMini ? " is-mini" : ""}`}>
          {isMini ? "Small Software" : "Standard"}
        </span>
        {project.is_iot && <span className="pj-tag pj-tag--iot">IoT</span>}
      </div>

      <div className="pj-card__body">
        <h3>{project.title || "Untitled software"}</h3>
        {project.abstract && <p>{project.abstract}</p>}

        <div className="pj-card__meta">
          {level && (
            <span className="pj-level">
              <Layers size={13} aria-hidden="true" /> {level}
            </span>
          )}
          {showPrice && (
            <span className="pj-price">
              {hasDiscount && <s>{cut}</s>}
              <strong>{offer || cut}</strong>
            </span>
          )}
        </div>

        <span className="pj-card__cta">
          View software <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export default Projects;
