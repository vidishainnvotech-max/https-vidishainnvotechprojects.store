import { useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import heroImage from "../../assets/engineering-hero.jpg";

function formatCount(value) {
  const num = Number(value) || 0;

  if (num >= 1000) {
    const thousands = num / 1000;

    return `${Number.isInteger(thousands)
      ? thousands
      : thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }

  return num;
}

function HeroSection({ onSearch, counts }) {
  const [query, setQuery] = useState("");

  const totalProjects = counts?.totalProjects ?? 0;
  const totalCategories = counts?.totalCategories ?? 0;

  return (
    <section className="home-hero">
      <div className="home-hero__glow home-hero__glow--one" />
      <div className="home-hero__glow home-hero__glow--two" />
      <div className="home-hero__grid" />

      <div className="container home-hero__container">
        <div className="home-hero__content">
          <p className="home-hero__eyebrow">
            <Sparkles size={14} />
            Engineering project catalog
          </p>

          <h1>
            Build engineering projects
            <span> that stand out.</span>
          </h1>

          <p className="home-hero__description">
            Explore a curated catalog of IoT, AI and core engineering projects
            made for students who want practical experience and a confident
            final-year presentation.
          </p>

          <form
            className="home-search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch?.(query);
            }}
          >
            <Search size={19} className="home-search__icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, categories or technologies..."
              aria-label="Search projects"
            />
            <button type="submit" className="btn btn-primary">
              Search
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="home-hero__meta">
            <div>
              <strong>{formatCount(totalProjects)}</strong>
              <span>Projects to explore</span>
            </div>
            <div>
              <strong>{formatCount(totalCategories)}</strong>
              <span>Engineering categories</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Presentation ready</span>
            </div>
          </div>
        </div>

        <div className="home-hero__image">
          <div className="home-hero__image-frame">
            <img
              src={heroImage}
              alt="Engineering project"
              width={1200}
              height={1000}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;