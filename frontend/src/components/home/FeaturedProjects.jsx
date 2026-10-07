import { Link } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";

import ProjectCard from "../ProjectCard";

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
        <div className="home-section-heading">
          <div>
            <p className="home-eyebrow">Featured projects</p>

            <h2>Start with a project you can finish</h2>

            <p>
              {loading
                ? "Loading the latest projects..."
                : hasFilters
                  ? `${total} ${total === 1 ? "result matches" : "results match"} your filters.`
                  : `${total} ${total === 1 ? "project" : "projects"} available.`}
            </p>
          </div>

          <Link to="/projects" className="home-section-link">
            View all projects
            <ArrowRight size={15} />
          </Link>
        </div>

        {hasFilters && (
          <div className="home-filter-status">
            <p>
              Showing {total} matching {total === 1 ? "project" : "projects"}
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
          <div className="home-project-grid">
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

            <h3>No projects found</h3>

            <p>Try another search term or remove the selected filters.</p>

            <button type="button" className="btn btn-secondary" onClick={onClear}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="home-project-grid">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id ?? project.slug}
                project={project}
                index={index}
                featured
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default FeaturedProjects;