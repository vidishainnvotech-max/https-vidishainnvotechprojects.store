import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";

import { formatPrice } from "../utils/catalog";
import { getProjectImage } from "../utils/projectImages";

const FALLBACK_ABSTRACT =
  "Explore this engineering project and discover its complete implementation details.";

function ProjectCard({ project, index = 0, featured = false }) {
  const hasPrice = project.price != null && project.price !== "";

  const categoryName = project.category?.name || "";

  return (
    <article className="home-project-card">
      <div className="home-project-card__image">
        <img
          src={getProjectImage(project.id ?? index)}
          alt=""
          width={1200}
          height={800}
          loading="lazy"
        />
        <div className="home-project-card__image-overlay" />

        {featured && (
          <span className="home-project-card__badge">
            <Star size={12} aria-hidden="true" /> Featured
          </span>
        )}
      </div>

      <div className="home-project-card__body">
        {categoryName && (
          <p className="home-project-card__eyebrow">{categoryName}</p>
        )}

        <h3>{project.title}</h3>

        <p>{project.abstract?.trim() || FALLBACK_ABSTRACT}</p>

        {project.is_iot && (
          <div className="home-project-card__tags">
            <span className="home-project-card__iot" title="IoT project">
              IoT
            </span>
          </div>
        )}

        <div className="home-project-card__footer">
          <div>
            <small>{hasPrice ? "Starts at" : "Project"}</small>
            <strong>
              {hasPrice ? formatPrice(project.price) : "View details"}
            </strong>
          </div>

          <Link
            to={`/projects/${project.slug}`}
            className="home-project-card__arrow"
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

export default ProjectCard;