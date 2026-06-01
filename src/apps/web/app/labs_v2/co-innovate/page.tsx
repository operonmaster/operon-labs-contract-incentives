import Link from "next/link";

import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsV2Nav } from "../../../components/labs-site/LabsV2Nav";
import { coInnovateOffer, coInnovateSteps } from "../../../components/labs-site/labs-v2-content";

export default function LabsV2CoInnovatePage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsV2Nav activeId="co-innovate" />

      <LabsHero compact eyebrow="Co-Innovate" title="Bring a workflow. Leave with a proof.">
        <p>
          Operon Labs runs as an executive co-innovation track. You bring an operating problem under board pressure; we
          build an inspectable proof model of it with you — using the same identity, consent, evidence, and policy
          primitives Operon runs in production.
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

      <section className="labs-proof-cta" aria-labelledby="labs-v2-coinnovate-cta-heading">
        <div>
          <span className="label">Apply to co-innovate</span>
          <h2 id="labs-v2-coinnovate-cta-heading">
            Have a workflow you need to prove before you bet a contract on it?
          </h2>
          <p>Bring it to Labs. We will turn it into a proof you can inspect, measure, and govern.</p>
        </div>
        <div className="labs-proof-actions">
          <a className="primary-button" href="mailto:partners@operon.cloud">
            Bring a workflow
          </a>
          <Link className="primary-button secondary-button" href="/labs_v2/proofs">
            See current proofs
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
