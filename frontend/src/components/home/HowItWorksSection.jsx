import { Check, Layers, PlayCircle, ShieldCheck } from "lucide-react";

const STAGES = [
  { percentage: "20%", title: "Foundation", description: "Architecture, requirements and starter code." },
  { percentage: "50%", title: "Core build", description: "Working modules with guided implementation." },
  { percentage: "75%", title: "Integration", description: "Complete features, testing and refinements." },
  { percentage: "100%", title: "Final launch", description: "Full code, documentation and presentation." },
];

const PERKS = [
  { icon: ShieldCheck, title: "Secure unlocks", text: "Files open automatically as each installment is completed." },
  { icon: PlayCircle, title: "Learn by watching", text: "Follow video guidance at every stage." },
  { icon: Layers, title: "Everything included", text: "Videos, PPTs, documents and kit details in one place." },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="hx">
      <div className="container">
        <p className="hx__eyebrow">A smarter way to build</p>
        <h2>Progress you can see.<br />Unlock as you go.</h2>
        <p className="hx__lead">
          Each completed installment unlocks the next set of project files, so
          your project moves from idea to final demo in clear stages.
        </p>

        <ol className="hx__steps">
          {STAGES.map((stage) => (
            <li className="hx__step" key={stage.title}>
              <span className="hx__node">
                <b>{stage.percentage}</b>
                <Check size={12} aria-hidden="true" />
              </span>
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
            </li>
          ))}
        </ol>

        <ul className="hx__perks">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={18} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default HowItWorksSection;
