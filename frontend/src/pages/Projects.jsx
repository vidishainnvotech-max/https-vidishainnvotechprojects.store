import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CircuitBoard,
  Code2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { getCategories } from "../api/categories";
import { getProjects } from "../api/projects";

import aiCropImage from "../assets/project-ai-crop.jpg";
import agricultureImage from "../assets/project-agriculture.jpg";
import roverImage from "../assets/project-rover.jpg";
import portalImage from "../assets/project-portal.jpg";

function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const searchFromUrl = searchParams.get("search") || "";
  const selectedCategory = searchParams.get("category") || "";

  const [search, setSearch] = useState(searchFromUrl);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [projectData, categoryData] = await Promise.all([
          getProjects(),
          getCategories(),
        ]);

        if (cancelled) return;

        setProjects(Array.isArray(projectData) ? projectData : []);

        setCategories(Array.isArray(categoryData) ? categoryData : []);
      } catch (err) {
        console.error("Projects loading failed:", err);

        if (!cancelled) setError("Unable to load projects.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesCategory =
        !selectedCategory || project.category?.slug === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        project.title,
        project.abstract,
        project.category?.name,
        project.category?.slug,
        project.is_iot ? "iot" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [projects, selectedCategory, search]);

  const hasActiveFilters = Boolean(search.trim() || selectedCategory);

  const activeCategoryName =
    categories.find((category) => category.slug === selectedCategory)?.name ||
    selectedCategory;

  const filterSummary = hasActiveFilters
    ? search.trim()
      ? activeCategoryName
        ? `Searching for "${search.trim()}" in ${activeCategoryName}`
        : `Searching for "${search.trim()}"`
      : `Filtered by ${activeCategoryName}`
    : "";

  const updateFilters = (nextSearch, nextCategory) => {
    const params = {};

    if (nextSearch.trim()) {
      params.search = nextSearch.trim();
    }

    if (nextCategory) {
      params.category = nextCategory;
    }

    setSearchParams(params);
  };

  const handleSearch = (event) => {
    event.preventDefault();

    updateFilters(search, selectedCategory);
  };

  const handleCategoryChange = (event) => {
    updateFilters(search, event.target.value);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchParams({});
  };

  if (loading) {
    return (
      <main className="projects-page" aria-busy="true">
        <section className="projects-hero">
          <div className="container">
            <div className="skeleton skeleton--text" style={{ width: 180 }} />
            <div className="skeleton" style={{ height: 44, width: "min(520px, 90%)", marginTop: 12 }} />
          </div>
        </section>
        <section className="projects-catalog">
          <div className="container">
            <div className="projects-new-grid">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--card" />)}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="projects-page">
        <div className="container">
          <div className="error-state" role="alert">
            <span className="error-state__icon"><AlertTriangle size={24} aria-hidden="true" /></span>
            <h3>We couldn't load the projects</h3>
            <p>Please check your connection and try again.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="projects-page">
      <section className="projects-hero">
        <div className="projects-hero__glow" />

        <div className="container">
          <div className="projects-hero__content">
            <div className="projects-hero__eyebrow">
              <Sparkles size={15} />
              Explore the project catalog
            </div>

            <h1>
              Find the right project
              <span> for your journey.</span>
            </h1>

            <p>
              Explore engineering projects by category, technology and practical
              learning goals.
            </p>
          </div>
        </div>
      </section>

      <section className="projects-controls">
        <div className="container">
          <div className="projects-filter-card">
            <div className="projects-filter-card__top">
              <div>
                <div className="projects-filter-title">
                  <SlidersHorizontal size={17} />

                  <span>Find a project</span>
                </div>

                <p>Search the catalog or filter projects by category.</p>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="projects-clear"
                  onClick={clearFilters}
                  aria-label="Clear all filters"
                >
                  <X size={15} />
                  Clear filters
                </button>
              )}
            </div>

            <form className="projects-filter-form" onSubmit={handleSearch}>
              <div className="projects-search">
                <Search size={19} />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects..."
                  aria-label="Search projects"
                />
              </div>

              <div className="projects-category-select">
                <label htmlFor="project-category">Category</label>

                <select
                  id="project-category"
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  aria-label="Filter projects by category"
                >
                  <option value="">All categories</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary">
                Search
                <Search size={16} />
              </button>
            </form>

            {categories.length > 0 && (
              <div className="projects-category-pills" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className={!selectedCategory ? "active" : ""}
                  aria-pressed={!selectedCategory}
                  onClick={() => updateFilters(search, "")}
                >
                  All
                </button>

                {categories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={
                      selectedCategory === category.slug ? "active" : ""
                    }
                    aria-pressed={selectedCategory === category.slug}
                    onClick={() => updateFilters(search, category.slug)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="projects-catalog">
        <div className="container">
          <div className="projects-catalog__header">
            <div>
              <p className="home-eyebrow">Project catalog</p>

              <h2>
                {filteredProjects.length}{" "}
                {filteredProjects.length === 1 ? "project" : "projects"}{" "}
                available
              </h2>
            </div>

            {filterSummary && (
              <p className="projects-active-filter" role="status">
                {filterSummary}.
              </p>
            )}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty__icon">
                <Search size={25} />
              </div>

              <h2>No projects found</h2>

              <p>Try another search term or remove the selected filters.</p>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="projects-new-grid">
              {filteredProjects.map((project, index) => (
                <ProjectCatalogCard
                  key={project.id}
                  project={project}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProjectCatalogCard({ project, index }) {
  const images = [aiCropImage, agricultureImage, roverImage, portalImage];

  const icons = [Bot, CircuitBoard, Zap, Code2];

  const Icon = icons[index % icons.length];

  return (
    <article className="projects-new-card">
      <div className="projects-new-card__image">
        <img src={images[index % images.length]} alt="" />

        <div className="projects-new-card__overlay" />

        <div className="projects-new-card__category">
          <Icon size={13} />

          {project.category?.name || "Engineering"}
        </div>

        {project.is_iot && <span className="projects-new-card__iot">IoT</span>}
      </div>

      <div className="projects-new-card__body">
        <h3>{project.title}</h3>

        <p>
          {project.abstract ||
            "Explore this engineering project and discover its implementation, stages and resources."}
        </p>

        <div className="projects-new-card__bottom">
          <div>
            <small>Project resources</small>

            <strong>View project</strong>
          </div>

          <Link
            to={`/projects/${project.slug}`}
            className="projects-new-card__arrow"
            aria-label={`View ${project.title}`}
          >
            View project
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default Projects;