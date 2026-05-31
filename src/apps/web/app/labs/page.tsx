import Link from "next/link";

import { LabsHero, LabsPageShell, LabsProductFrame } from "../../components/labs-ui";
import { LabsSiteNav } from "../../components/labs-site/LabsSiteNav";
import { labsPortalCards, platformSpine, proofMethodSteps } from "../../components/labs-site/labs-site-content";

export default function LabsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="overview" />

      <LabsHero eyebrow="Operon Labs · Proof Studio" title="Where healthcare operations become provable.">
        <p>
          Operon Labs helps healthcare leaders turn high-pressure workflows into inspectable proof models: who acted,
          what evidence exists, what policy applied, what value moved, and what can be audited.
        </p>
        <div className="labs-proof-actions" aria-label="Labs homepage actions">
          <Link className="primary-button" href="/labs/co-innovate">
            Co-innovate with Labs
          </Link>
          <Link className="primary-button secondary-button" href="/labs/proofs">
            See the proofs
          </Link>
        </div>
      </LabsHero>

      <LabsProductFrame title="The gap Labs closes" meta="Proof over promises">
        <section className="labs-proof-feature">
          <div>
            <span className="label">Operating tension</span>
            <h2>Proof beats pilot activity.</h2>
            <p>
              Leaders are investing in AI, vendors, delegated workflows, rewards, and automation. Labs turns the hard
              question into a proof system: what happened, who had authority, which policy applied, and why value should
              move.
            </p>
          </div>
          <ol className="labs-proof-method-list" aria-label="Proof system sequence">
            {proofMethodSteps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </section>
      </LabsProductFrame>

      <LabsProductFrame title="Featured proof" meta="Delegated UM quality">
        <section className="labs-proof-feature">
          <div>
            <span className="label">Working proof model</span>
            <h2>Score delegated review quality without paying for outcomes.</h2>
            <p>
              Timeliness, rationale completeness, and audit readiness are measured and rewarded, while approvals,
              denials, savings, and utilization stay explicitly out of scope.
            </p>
          </div>
          <Link className="primary-button" href="/delegate-um">
            Open proof
          </Link>
        </section>
      </LabsProductFrame>

      <section className="labs-proof-cta" aria-labelledby="labs-coinnovate-heading">
        <div>
          <span className="label">Co-innovate with Labs</span>
          <h2 id="labs-coinnovate-heading">Bring a workflow. Leave with a proof.</h2>
          <p>
            Bring an operating problem under pressure. Labs will turn it into an inspectable proof model your teams can
            evaluate, govern, and act on.
          </p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs/co-innovate">
            See how it works
          </Link>
          <a className="primary-button secondary-button" href="mailto:partners@operon.cloud">
            Bring a workflow
          </a>
        </div>
      </section>

      <section className="labs-proof-teaser-grid" aria-label="Operon platform spine">
        {platformSpine.map((item) => (
          <article className="labs-proof-teaser" key={item.product}>
            <span className="label">{item.role}</span>
            <h2>{item.product}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-proof-portal-grid" aria-label="Explore Operon Labs">
        {labsPortalCards.map((card) => (
          <Link className="labs-proof-portal" href={card.href} key={card.title}>
            <span>{card.kicker}</span>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
