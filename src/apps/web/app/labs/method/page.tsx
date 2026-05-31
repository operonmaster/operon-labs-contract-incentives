import Link from "next/link";

import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { methodSteps } from "../../../components/labs-site/labs-site-content";

export default function MethodPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="method" />

      <LabsHero compact eyebrow="Method" title="How Labs turns workflows into proof.">
        <p>
          Labs starts with executive-pressure workflows and turns them into inspectable proof models with visible
          assumptions, controls, and audit trails.
        </p>
      </LabsHero>

      <section className="labs-proof-process-list" aria-label="Operon Labs proof method">
        {methodSteps.map((step, index) => (
          <article className="labs-proof-process-step" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-proof-cta" aria-labelledby="labs-method-cta-heading">
        <div>
          <span className="label">Build with Labs</span>
          <h2 id="labs-method-cta-heading">Bring a workflow, policy, consent problem, or trust gap.</h2>
          <p>We will turn it into a proof model that can be inspected, measured, and debated.</p>
        </div>
        <div className="labs-proof-actions">
          <a className="primary-button" href="mailto:partners@operon.cloud">
            Discuss a proof model
          </a>
          <Link className="primary-button secondary-button" href="/labs/proofs">
            View proof portfolio
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
