import { Link } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";

import ProjectCard from "../ProjectCard";
import Reveal from "../Reveal";

const SKELETON_COUNT = 4;

function FeaturedProjects({
  projects,
  total,
  loading,
  query,
  activeCategory,
  onClear,
}) {
  const searchQuery = (query ?? "").trim();
  const categorySlug = activeCategory ?? "";
  const hasFilters = Boolean(searchQuery || categorySlug);

  return (
    <section id="projects" className="home-section home-section--muted">
      <div className="container">
        <Reveal className="home-section-heading">
          <div>
            <p className="home-eyebrow">Featured software</p>

            <h2>Start with a software you can finish</h2>

            <p>
              {loading
                ? "Loading the latest software..."
                : hasFilters
                  ? `${total} ${total === 1 ? "result matches" : "results match"} your filters.`
                  : `${total} software available.`}
            </p>
          </div>

          <Link to="/projects" className="home-section-link">
            View all software
            <ArrowRight size={15} />
          </Link>
        </Reveal>

        {hasFilters && (
          <div className="home-filter-status">
            <p>
              Showing {total} matching software
              {searchQuery ? ` for "${searchQuery}"` : ""}
              {categorySlug ? ` in "${categorySlug}"` : ""}.
            </p>

            <button type="button" onClick={onClear}>
              Clear filters
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="home-project-grid home-project-grid--featured">
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <div className="home-skeleton-card" key={index}>
                <div className="home-skeleton home-skeleton--image" />
                <div className="home-skeleton home-skeleton--line" />
                <div className="home-skeleton home-skeleton--line short" />
                <div className="home-skeleton home-skeleton--line" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="home-empty">
            <Search size={25} />

            <h3>No software found</h3>

            <p>Try another search term or remove the selected filters.</p>

            <button type="button" className="btn btn-secondary" onClick={onClear}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="home-project-grid home-project-grid--featured">
              {projects.map((project, index) => (
                <Reveal key={project.id ?? project.slug} className="reveal-fill" delay={Math.min(index, 3) * 0.08}>
                  <ProjectCard project={project} index={index} featured />
                </Reveal>
              ))}
            </div>
            {!loading && total > projects.length && (
              <div className="home-view-all">
                <Link to="/projects" className="btn btn-secondary">
                  View all {total} software
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default FeaturedProjects;
