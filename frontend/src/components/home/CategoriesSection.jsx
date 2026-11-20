import {
  ArrowRight,
  Bot,
  Cpu,
  Code2,
  Radio,
  Sprout,
  Zap,
} from "lucide-react";

import Reveal from "../Reveal";
import { softwareLabel } from "../../utils/visibleText";

const CATEGORY_ICONS = [Cpu, Bot, Radio, Sprout, Code2, Zap];

function CategoriesSection({ categories, counts, active, onSelect }) {
  return (
    <section id="categories" className="home-section">
      <div className="container">
        <Reveal className="home-section-heading">
          <div>
            <p className="home-eyebrow">Categories</p>

            <h2>Find your software domain</h2>

            <p>
              Pick a category to filter the catalog and see only the software
              that match your interest.
            </p>
          </div>
        </Reveal>

        <div className="home-category-grid">
          {categories.map((category, index) => {
            const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
            const count = counts[category.slug] ?? 0;

            return (
              <Reveal key={category.id ?? category.slug} className="reveal-fill" delay={Math.min(index, 5) * 0.06}>
                <button
                  type="button"
                  className={
                    active === category.slug
                      ? "home-category-card active"
                      : "home-category-card"
                  }
                  aria-pressed={active === category.slug}
                  onClick={() => onSelect(category)}
                >
                  <span className="home-category-card__icon">
                    <Icon size={20} />
                  </span>

                  <div className="home-category-card__bottom">
                    <div>
                      <h3>{softwareLabel(category.name, "Software")}</h3>
                      <span>
                        {count} software
                      </span>
                    </div>

                    <div className="home-category-card__status">
                      {active === category.slug && (
                        <span className="home-category-card__selected">
                          Selected
                        </span>
                      )}

                      <ArrowRight className="home-card-arrow" size={17} />
                    </div>
                  </div>
                </button>
              </Reveal>
            );
          })}
          {categories.length < 3 && <div className="home-soon">More categories coming soon</div>}
        </div>
      </div>
    </section>
  );
}

export default CategoriesSection;
