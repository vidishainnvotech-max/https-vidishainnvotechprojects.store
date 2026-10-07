import { Link } from "react-router-dom";

function ProjectAccessCard({ project }) {
  const highestStage = Number(project.highest_stage) || 0;

  return (
    <article className="student-project-card">
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

          <div className="student-project-card__progress-track">
            <div
              className="student-project-card__progress-fill"
              style={{ width: `${highestStage}%` }}
            />
          </div>
        </div>
      </div>

      <Link
        to={`/student/projects/${project.id}`}
        className="student-project-card__action"
      >
        View Project
      </Link>
    </article>
  );
}

export default ProjectAccessCard;
