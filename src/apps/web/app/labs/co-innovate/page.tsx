import Link from "next/link";

import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { coInnovateOffer, coInnovateSteps } from "../../../components/labs-site/labs-site-content";

export default function CoInnovatePage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="co-innovate" />

      <LabsHero compact eyebrow="Co-Innovate" title="Bring a workflow. Leave with a proof.">
        <p>
          Operon Labs runs as an executive proof-studio track. You bring an operating problem under pressure; we build an
          inspectable proof model with you using Operon&apos;s identity, consent, evidence, policy, incentive, and
          settlement primitives.
        </p>
      </LabsHero>

      <section className="labs-proof-teaser-grid" aria-label="What you leave with">
        {coInnovateOffer.map((offer) => (
          <article className="labs-proof-teaser" key={offer.title}>
            <span className="label">What you leave with</span>
            <h2>{offer.title}</h2>
            <p>{offer.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-proof-process-list" aria-label="How co-innovation works">
        {coInnovateSteps.map((step, index) => (
          <article className="labs-proof-process-step" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-proof-cta" aria-labelledby="labs-coinnovate-cta-heading">
        <div>
          <span className="label">Apply to co-innovate</span>
          <h2 id="labs-coinnovate-cta-heading">Have a workflow you need to prove before you bet a contract on it?</h2>
          <p>Bring it to Labs. We will turn it into a proof model you can inspect, measure, and govern.</p>
        </div>
        <div className="labs-proof-actions">
          <a className="primary-button" href="mailto:partners@operon.cloud">
            Bring a workflow
          </a>
          <Link className="primary-button secondary-button" href="/labs/proofs">
            See current proofs
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
