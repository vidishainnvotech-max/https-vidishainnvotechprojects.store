import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, RefreshCw, ShieldCheck, Tag } from "lucide-react";

import Header from "../components/Header";
import { getPlans } from "../api/plans";
import "./pricing-page.css";

const FEATURES = ["Complete source code", "Software documentation", "Video learning access"];

const num = (...v) => {
  for (const x of v) {
    const n = Number(x);
    if (x != null && x !== "" && !Number.isNaN(n) && n > 0) return n;
  }
  return 0;
};
const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function getInfo(plan) {
  const code = String(plan.code || "").toUpperCase();
  const count = num(plan.installments, plan.installment_count, plan.installments_count, code.replace(/\D/g, ""), 1);
  const total = num(plan.price, plan.amount, plan.total_amount, plan.total_price, plan.total);
  const each = count > 1 ? Math.round(total / count) : total;
  const title = count === 1 ? "One-time" : `${count} Installments`;
  const hint =
    count === 1
      ? "Pay once, unlock everything"
      : count === 2
      ? "Two payments, faster unlock"
      : "Unlock a stage per payment";
  return { code, count, total, each, title, hint, popular: count === 2 };
}

function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addon, setAddon] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlans();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          const code = (p) => String(p.code || "").toUpperCase();
          setAddon(list.find((p) => code(p) === "ADDON") || null);
          setPlans(
            list.filter(
              (p) =>
                !code(p).includes("TEST") &&
                code(p) !== "D100" &&
                code(p) !== "ADDON" &&
                Number(p.price) > 0
            )
          );
        }
      } catch {
        if (!cancelled) setError("Unable to load plans.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = [...plans].sort((a, b) => getInfo(b).count - getInfo(a).count);

  return (
    <>
      <Header />
      <main className="pp">
        <span className="pp__blob pp__blob--a" aria-hidden="true" />
        <span className="pp__blob pp__blob--b" aria-hidden="true" />

        <div className="pp__inner">
          <header className="pp__head">
            <span className="pp__eyebrow">Pricing</span>
            <h1>
              Simple, <span>staged</span> pricing
            </h1>
            <p>Pick a plan and unlock your software stage by stage.</p>
          </header>

          {loading && (
            <div className="pp__grid" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 330, borderRadius: 20 }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="error-state" role="alert">
              <span className="error-state__icon">
                <AlertTriangle size={24} aria-hidden="true" />
              </span>
              <h3>We couldn't load the plans</h3>
              <p>Please check your connection and try again.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
                <RefreshCw size={15} aria-hidden="true" /> Try again
              </button>
            </div>
          )}

          {!loading && !error && sorted.length === 0 && (
            <div className="empty-state">
              <span className="empty-state__icon">
                <Tag size={24} aria-hidden="true" />
              </span>
              <h3>No plans available</h3>
              <p>Pricing plans will appear here when they are published.</p>
            </div>
          )}

          {!loading && !error && sorted.length > 0 && (
            <div className="pp__grid">
              {sorted.map((plan, i) => {
                const p = getInfo(plan);
                return (
                  <article
                    key={plan.id}
                    className={`pp-card${p.popular ? " pp-card--pop" : ""}`}
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    {p.popular && <span className="pp-card__tag">Most chosen</span>}
                    <h2 className="pp-card__title">{p.title}</h2>
                    <p className="pp-card__hint">{p.hint}</p>

                    <div className="pp-card__price">
                      <strong>{inr(p.each)}</strong>
                      <span>{p.count > 1 ? `× ${p.count}` : "once"}</span>
                    </div>
                    {p.count > 1 && <small className="pp-card__total">Total {inr(p.total)}</small>}

                    <ul className="pp-card__list">
                      {FEATURES.map((f) => (
                        <li key={f}>
                          <Check size={14} aria-hidden="true" /> {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to="/login"
                      state={{ plan: plan.code }}
                      className={`btn ${p.popular ? "btn-primary" : "btn-secondary"} pp-card__cta`}
                    >
                      Choose plan <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          <p className="pp__note">
            <ShieldCheck size={15} aria-hidden="true" /> Test mode: no real charge is made.
            {addon && ` Report bundle add-on: ${inr(Number(addon.price) || 0)}.`}{" "}
            <Link to="/projects">Browse software</Link>
          </p>
        </div>
      </main>
    </>
  );
}

export default Pricing;
