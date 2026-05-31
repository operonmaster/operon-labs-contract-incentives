import Link from "next/link";

import { LabsHero, LabsPageShell, LabsProductFrame } from "../../components/labs-ui";
import { LabsSiteNav } from "../../components/labs-site/LabsSiteNav";
import { labsPortalCards, platformSpine, proofMethodSteps } from "../../components/labs-site/labs-site-content";

export default function LabsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="labs" />

      <LabsHero eyebrow="Operon Labs" title="Proof studio for healthcare operations.">
        <p>
          Operon Labs turns identity, consent, evidence, incentives, and instant settlement into working proof models
          for clinical operations leaders.
        </p>
        <div className="labs-proof-actions" aria-label="Labs homepage actions">
          <Link className="primary-button" href="/labs/proofs">
            View proof portfolio
          </Link>
          <Link className="primary-button secondary-button" href="/labs/themes">
            Explore themes
          </Link>
        </div>
      </LabsHero>

      <LabsProductFrame title="From pilot activity to operational proof" meta="Proof system">
        <section className="labs-proof-feature">
          <div>
            <span className="label">Operating thesis</span>
            <h2>Healthcare innovation needs proof systems, not more pilot activity.</h2>
            <p>
              Labs makes the operating claim inspectable: who acted, under what authority, what evidence exists, what
              policy applied, what value moved, and what can be audited later.
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

      <LabsProductFrame title="Featured proof model" meta="Policy-bound rewards">
        <section className="labs-proof-feature">
          <div>
            <span className="label">Controlled settlement</span>
            <h2>Policy-bound clinical operations rewards</h2>
            <p>
              A working proof model for evidence packets, SLA policies, human approval, controlled settlement, and
              audit-ready incentive records.
            </p>
          </div>
          <Link className="primary-button" href="/labs/proofs">
            Open proof
          </Link>
        </section>
      </LabsProductFrame>

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
