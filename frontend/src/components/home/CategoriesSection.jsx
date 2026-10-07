import {
  ArrowRight,
  Bot,
  Cpu,
  Code2,
  Radio,
  Sprout,
  Zap,
} from "lucide-react";

const CATEGORY_ICONS = [Cpu, Bot, Radio, Sprout, Code2, Zap];

function CategoriesSection({ categories, counts, active, onSelect }) {
  return (
    <section id="categories" className="home-section">
      <div className="container">
        <div className="home-section-heading">
          <div>
            <p className="home-eyebrow">Categories</p>

            <h2>Find your engineering domain</h2>

            <p>
              Pick a category to filter the catalog and see only the projects
              that match your interest.
            </p>
          </div>
        </div>

        <div className="home-category-grid">
          {categories.map((category, index) => {
            const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
            const count = counts[category.slug] ?? 0;

            return (
              <button
                key={category.id ?? category.slug}
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
                    <h3>{category.name}</h3>
                    <span>
                      {count} {count === 1 ? "project" : "projects"}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CategoriesSection;
