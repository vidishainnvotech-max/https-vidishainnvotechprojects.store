import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "../Reveal";

const PLANS = [
  { name: "4 Installments", price: "₹3,750", note: "× 4", desc: "Unlock one software stage after every verified payment." },
  { name: "2 Installments", price: "₹7,000", note: "× 2", desc: "Get 20% + 50%, then unlock 75% + 100%.", popular: true },
  { name: "One-time", price: "₹13,000", note: "once", desc: "Get all 4 stages, black book, both reports, and complete software source." },
];
const FEATURES = ["Complete source code", "Software documentation", "Video learning access"];

function PlansSection() {
  return (
    <section id="plans" className="pl">
      <div className="container">
        <Reveal className="pl__head">
          <p className="home-eyebrow">Flexible plans</p>
          <h2>A payment pace that fits your semester.</h2>
          <p>Choose how quickly you want to unlock your software. No hidden pricing and no stage skipping.</p>
        </Reveal>

        <div className="pl__grid">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} className="reveal-fill" delay={i * 0.1}>
              <article className={`pl-card${p.popular ? " pl-card--pop" : ""}`}>
                {p.popular && <span className="pl-card__badge">Most chosen</span>}
                <h3>{p.name}</h3>
                <p className="pl-card__price">{p.price} <small>{p.note}</small></p>
                <p className="pl-card__desc">{p.desc}</p>
                <ul>
                  {FEATURES.map((f) => (
                    <li key={f}><span><Check size={12} aria-hidden="true" /></span>{f}</li>
                  ))}
                </ul>
                <Link to="/pricing" className={`btn ${p.popular ? "btn-primary" : "btn-secondary"}`}>
                  Choose this plan <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="pl__note">Semester 1 report bundle available as a ₹2,000 add-on.</p>
      </div>
    </section>
  );
}

export default PlansSection;
