import { Link } from "react-router-dom";

function formatPrice(value) {
  const number = Number(value);

  if (Number.isNaN(number)) return `₹${value}`;

  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PlanCard({ plan }) {
  const installments = plan.installments;
  const unlockMap = Array.isArray(plan.unlock_map) ? plan.unlock_map : [];

  return (
    <article className="plan-card" aria-label={`${plan.name} plan`}>
      <div>
        <p className="plan-card__label">Plan</p>

        <h3>{plan.name}</h3>

        {plan.description && (
          <p className="plan-card__description">{plan.description}</p>
        )}

        <p className="plan-card__price">{formatPrice(plan.price)}</p>

        {Number(installments) > 1 && (
          <p className="plan-card__meta">
            {installments} installments
          </p>
        )}

        {unlockMap.length > 0 && (
          <p className="plan-card__meta">
            Unlocks up to {Math.max(...unlockMap)}% of project stages
          </p>
        )}
      </div>

      <Link
        to="/login"
        className="btn btn-secondary"
        aria-label={`Get access to the ${plan.name} plan`}
      >
        Sign in to get access
      </Link>
    </article>
  );
}

export default PlanCard;