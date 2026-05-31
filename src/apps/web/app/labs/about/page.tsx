import Link from "next/link";

import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { aboutSteps } from "../../../components/labs-site/labs-site-content";

export default function AboutPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="about" />

      <LabsHero compact eyebrow="About Labs" title="How Operon Labs works.">
        <p>
          Labs turns workflow friction into working prototypes with visible assumptions, policy-safe evidence, and
          inspectable controls.
        </p>
      </LabsHero>

      <section className="labs-magazine-process-list" aria-label="Operon Labs process">
        {aboutSteps.map((step, index) => (
          <article className="labs-magazine-process-step" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-magazine-cta" aria-labelledby="labs-about-cta-heading">
        <div>
          <span className="label">Build with Labs</span>
          <h2 id="labs-about-cta-heading">Bring a workflow, policy, consent problem, or trust gap.</h2>
          <p>We will turn it into a prototype that can be inspected, measured, and debated.</p>
        </div>
        <div className="labs-magazine-actions">
          <a className="primary-button" href="mailto:partners@operon.cloud">
            Discuss a workflow prototype
          </a>
          <Link className="primary-button secondary-button" href="/labs/experiments">
            Explore experiments
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
