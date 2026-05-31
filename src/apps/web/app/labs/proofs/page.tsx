import Link from "next/link";

import { demoScenarios } from "../../../components/demo-catalog";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { proofCards, proofMethodSteps } from "../../../components/labs-site/labs-site-content";

function scenarioStatus(slug: string) {
  return demoScenarios.find((scenario) => scenario.slug === slug)?.status ?? "active";
}

export default function ProofsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="proofs" />

      <LabsHero compact eyebrow="Proofs" title="Proofs you can inspect.">
        <p>
          Each proof starts with a healthcare operations claim, then makes the actors, evidence, policies, controls,
          settlement path, and audit trail visible.
        </p>
      </LabsHero>

      <LabsProductFrame title="Proof model method" meta="Actor to audit">
        <ol className="labs-proof-method-list">
          {proofMethodSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </LabsProductFrame>

      <section className="labs-proof-proof-grid" aria-label="Current Labs proofs">
        {proofCards.map((proof) => (
          <Link className="labs-proof-proof-card" href={proof.route} key={proof.slug}>
            <span className="eyebrow">{scenarioStatus(proof.slug)}</span>
            <h2>{proof.title}</h2>
            <p>{proof.executiveQuestion}</p>
            <p>{proof.whatIsProven}</p>
            <em>{proof.controlSurface}</em>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
