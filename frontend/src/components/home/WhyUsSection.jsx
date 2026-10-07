import {
  ArrowRight,
  FolderCheck,
  Presentation,
  Route,
  Trophy,
} from "lucide-react";

const BENEFITS = [
  {
    title: "Complete project kits",
    description:
      "Source code, circuit diagrams, report and documentation delivered together so nothing is left pending before your review.",
    icon: FolderCheck,
    wide: true,
  },
  {
    title: "Guided stages",
    description:
      "Clear milestones keep your project moving from idea to submission.",
    icon: Route,
    wide: false,
  },
  {
    title: "Presentation support",
    description:
      "Slide decks and explanations that help you answer any question confidently.",
    icon: Presentation,
    wide: false,
  },
  {
    title: "Skills that place you",
    description:
      "IoT, AI and embedded experience that you can speak about in interviews, backed by projects you actually understand end to end.",
    icon: Trophy,
    wide: true,
  },
];

function WhyUsSection() {
  return (
    <section id="why-us" className="home-section home-section--muted">
      <div className="container">
        <div className="home-section-heading">
          <div>
            <p className="home-eyebrow">Why us</p>

            <h2>Built for students who want more than a file</h2>

            <p>
              Everything is designed around one goal: you should be able to
              explain, demo and defend your project.
            </p>
          </div>
        </div>

        <div className="home-benefits-grid">
          {BENEFITS.map((benefit, index) => {
            const Icon = benefit.icon;

            return (
              <article
                key={benefit.title}
                className={
                  benefit.wide
                    ? "home-benefit-card home-benefit-wide"
                    : "home-benefit-card"
                }
              >
                <span className="home-benefit-card__number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="home-benefit-card__icon">
                  <Icon size={21} />
                </span>

                <h3>{benefit.title}</h3>

                <p>{benefit.description}</p>

                <ArrowRight className="home-benefit-card__arrow" size={17} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default WhyUsSection;
