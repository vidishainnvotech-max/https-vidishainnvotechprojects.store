import { Link } from "react-router-dom";

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "Price unavailable";

  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getUnlockRules(unlockMap) {
  if (!unlockMap || typeof unlockMap !== "object") return [];

  const entries = Array.isArray(unlockMap)
    ? unlockMap.map((rule, index) => [String(index + 1), rule])
    : Object.entries(unlockMap).sort(
        ([a], [b]) => Number(a) - Number(b)
      );

  return entries.map(([installment, rule]) => {
    if (typeof rule === "number" || typeof rule === "string") {
      const stage = Number(rule);

      return {
        installment,
        stages: Number.isFinite(stage) ? [stage] : [],
        bundles: [],
      };
    }

    if (!rule || typeof rule !== "object") {
      return { installment, stages: [], bundles: [] };
    }

    const stages = Array.isArray(rule.stages)
      ? rule.stages.map(Number).filter(Number.isFinite)
      : [];

    const bundles = Array.isArray(rule.bundles)
      ? rule.bundles.filter((bundle) => typeof bundle === "string")
      : [];

    return { installment, stages, bundles };
  });
}

function PlanCard({ plan }) {
  const code = String(plan.code || "").toUpperCase();
  const installments = Number(plan.installments);
  const price = Number(plan.price);
  const hasValidPrice = Number.isFinite(price) && price >= 0;
  const isAddon = code === "ADDON";
  const isD100 = code === "D100";
  const isTestPlan = code.endsWith("-TEST") || code.includes("TEST");
  const isOneTime = Number.isFinite(installments) && installments === 1;

  const unlockRules = getUnlockRules(plan.unlock_map);
  const installmentAmount =
    hasValidPrice && Number.isInteger(installments) && installments > 0
      ? Math.floor(Math.round(price * 100) / installments) / 100
      : null;

  const displayedInstallmentAmount =
    installmentAmount === null
      ? null
      : installments > 1
        ? `${formatPrice(installmentAmount)} × ${installments} installments`
        : "One-time payment";

  const maxStage = unlockRules.reduce(
    (highest, rule) => Math.max(highest, ...rule.stages, 0),
    0
  );

  const isUnavailable = isD100 || isTestPlan || !hasValidPrice;

  return (
    <article className="plan-card" aria-label={`${plan.name} plan`}>
      <div>
        <p className="plan-card__label">
          {isAddon ? "Optional add-on" : isTestPlan ? "Development plan" : "Plan"}
        </p>

        <h3>{plan.name}</h3>

        {plan.description && (
          <p className="plan-card__description">{plan.description}</p>
        )}

        <p className="plan-card__price">
          {hasValidPrice ? formatPrice(price) : "Price not confirmed"}
        </p>

        {isAddon ? (
          <p className="plan-card__meta">
            Separate document add-on. Availability depends on software configuration.
          </p>
        ) : (
          <>
            {displayedInstallmentAmount && (
              <p className="plan-card__meta">{displayedInstallmentAmount}</p>
            )}

            {maxStage > 0 && (
              <p className="plan-card__meta">
                Unlocks up to {maxStage}% of software stages
              </p>
            )}

            {unlockRules.length > 0 && (
              <div className="plan-card__meta">
                <p>Unlock roadmap</p>
                <ul>
                  {unlockRules.map((rule) => (
                    <li key={rule.installment}>
                      {installments > 1
                        ? `Payment ${rule.installment}: `
                        : "Payment: "}
                      {rule.stages.length > 0
                        ? `${rule.stages.join("% + ")}%`
                        : "No stage unlock"}
                      {rule.bundles.length > 0
                        ? ` · Documents: ${rule.bundles.join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {isUnavailable ? (
        <p className="plan-card__meta" role="status">
          {isTestPlan
            ? "This plan is for development/testing and is not available for public purchase."
            : isD100
              ? "This plan is unavailable until its price is confirmed."
              : "This plan is not available until its price is configured."}
        </p>
      ) : (
        <Link
          to="/login"
          className="btn btn-secondary"
          aria-label={`Sign in to get access to the ${plan.name} plan`}
        >
          Sign in to get access
        </Link>
      )}
    </article>
  );
}

export default PlanCard;
