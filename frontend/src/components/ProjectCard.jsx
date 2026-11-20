import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";

import { formatPrice } from "../utils/catalog";
import { getProjectImage } from "../utils/projectImages";
import { softwareLabel } from "../utils/visibleText";

const FALLBACK_ABSTRACT =
  "Explore this Software and discover its complete implementation details.";

function ProjectCard({ project, index = 0, featured = false }) {
  const [imageFailed, setImageFailed] = useState(false);

  const hasPrice = project.price != null && project.price !== "";
  const categoryName = softwareLabel(project.category?.name);

  const uploadedImage = project.image_url || project.imageUrl || "";
  const fallbackImage = getProjectImage(project.id ?? index);

  const imageSrc =
    uploadedImage && !imageFailed ? uploadedImage : fallbackImage;

  return (
    <article className="home-project-card lift">
      <div className="home-project-card__image">
        <img
          src={imageSrc}
          alt={project.title || "Software image"}
          width={1200}
          height={750}
          loading="lazy"
          onError={() => {
            if (!imageFailed) setImageFailed(true);
          }}
        />

        <div className="home-project-card__image-overlay" />

        {featured && (
          <span className="home-project-card__badge">
            <Star size={11} aria-hidden="true" /> Featured
          </span>
        )}

        {project.is_iot && (
          <span className="home-project-card__iot-tag">IoT</span>
        )}
      </div>

      <div className="home-project-card__body">
        {categoryName && (
          <p className="home-project-card__eyebrow">{categoryName}</p>
        )}

        <h3>{project.title}</h3>

        <p>{project.abstract?.trim() || FALLBACK_ABSTRACT}</p>

        <div className="home-project-card__footer">
          {hasPrice && (
            <div>
              <small>Starts at</small>
              <strong>{formatPrice(project.price)}</strong>
            </div>
          )}

          <Link
            to={`/projects/${project.slug}`}
            className="home-project-card__arrow"
            aria-label={`View ${project.title}`}
          >
            View software
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ProjectCard;
