import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid } from "lucide-react";

import Reveal from "../Reveal";

function CtaSection({ onExploreCategories }) {
  return (
    <section className="home-cta">
      <Reveal className="container home-cta__container">
        <div>
          <p>Ready to start?</p>

          <h2>Pick a category and start building today.</h2>

          <span>
            Browse the full software catalog, pick the domain that fits your
            branch, and get everything you need to finish before your review.
          </span>
        </div>

        <div className="home-cta__actions">
          <button
            type="button"
            className="btn btn-light"
            onClick={onExploreCategories}
          >
            Explore categories
            <LayoutGrid size={16} />
          </button>

          <Link to="/pricing" className="btn btn-outline-light">
            View pricing
            <ArrowRight size={16} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

export default CtaSection;
