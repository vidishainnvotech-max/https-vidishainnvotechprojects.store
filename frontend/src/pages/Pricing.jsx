import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getPlans } from "../api/plans";
import PlanCard from "../components/PlanCard";

function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        const data = await getPlans();

        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Unable to load plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="container">
        <p className="state">Loading plans...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <p className="state state-error">{error}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1>Pricing</h1>
          <p>Choose the plan that matches your project needs.</p>
        </div>

        {plans.length === 0 ? (
          <div className="state-empty state-empty--large">
            <h2>No plans available</h2>

            <p>Pricing plans will appear here when they are published.</p>
          </div>
        ) : (
          <div className="plan-grid">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}

        <p className="state-note">
          Payments launch later. Sign in to get access, or{" "}
          <Link to="/projects">browse projects</Link> while you decide.
        </p>
      </div>
    </main>
  );
}

export default Pricing;