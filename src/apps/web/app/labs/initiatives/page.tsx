import Link from "next/link";

import { demoScenarios } from "../../../components/demo-catalog";
import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { initiativeCards } from "../../../components/labs-site/labs-site-content";

function scenarioStatus(slug: string) {
  return demoScenarios.find((scenario) => scenario.slug === slug)?.status ?? "active";
}

export default function InitiativesPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="initiatives" />

      <LabsHero compact eyebrow="Initiatives" title="Healthcare operations initiatives in motion.">
        <p>
          Each initiative starts with a real workflow constraint and turns it into a working model for coordination,
          automation, incentives, and implementation.
        </p>
      </LabsHero>

      <section className="labs-proof-proof-grid" aria-label="Current Labs initiatives">
        {initiativeCards.map((initiative) => (
          <Link className="labs-proof-proof-card" href={initiative.route} key={initiative.slug}>
            <span className="eyebrow">{scenarioStatus(initiative.slug)}</span>
            <h2>{initiative.title}</h2>
            <p>{initiative.executiveQuestion}</p>
            <p>{initiative.modelFocus}</p>
            <em>{initiative.operatingControls}</em>
          </Link>
        ))}
      </section>

      <section className="labs-proof-cta" aria-labelledby="labs-initiatives-cta-heading">
        <div>
          <span className="label">Bring a workflow</span>
          <h2 id="labs-initiatives-cta-heading">Have a workflow like this?</h2>
          <p>
            Bring the operating constraint, partner model, or incentive question you want to move toward implementation.
          </p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs/book-a-call">
            Book a Call
          </Link>
          <Link className="primary-button secondary-button" href="/labs/co-innovate">
            See how it works
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
