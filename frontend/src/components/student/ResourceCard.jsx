import { FileText, LockKeyhole, PlayCircle, Presentation } from "lucide-react";

const ICONS = { video: PlayCircle, ppt: Presentation };

function ResourceCard({ title, type, unlocked = false, onAction, loading = false }) {
  const actionLabel =
    type === "video" ? "Watch Video" : type === "ppt" ? "Download PPT" : "Download";
  const Icon = unlocked ? ICONS[type] || FileText : LockKeyhole;

  return (
    <div className={`student-resource-card ${unlocked ? "is-unlocked" : "is-locked"}`}>
      <span className="student-resource-card__icon" aria-hidden="true">
        <Icon size={18} />
      </span>

      <div className="student-resource-card__content">
        <h4>{title}</h4>
        <span className="student-resource-card__status">{unlocked ? "Unlocked" : "Locked"}</span>
      </div>

      <button
        type="button"
        className={`student-resource-card__action btn btn-sm ${unlocked ? "btn-primary" : "btn-secondary"}`}
        disabled={!unlocked || loading}
        onClick={unlocked ? onAction : undefined}
        aria-label={unlocked ? `${actionLabel}: ${title}` : `${title} (locked)`}
      >
        {loading ? "Loading..." : actionLabel}
      </button>
    </div>
  );
}

export default ResourceCard;
