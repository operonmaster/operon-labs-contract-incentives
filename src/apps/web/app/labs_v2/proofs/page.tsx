import Link from "next/link";

import { demoScenarios } from "../../../components/demo-catalog";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../../../components/labs-ui";
import { LabsV2Nav } from "../../../components/labs-site/LabsV2Nav";
import { labsV2Proofs, proofSequence } from "../../../components/labs-site/labs-v2-content";

function scenarioStatus(slug: string) {
  return demoScenarios.find((scenario) => scenario.slug === slug)?.status ?? "active";
}

export default function LabsV2ProofsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsV2Nav activeId="proofs" />

      <LabsHero compact eyebrow="Proofs" title="A proof states a claim you can inspect.">
        <p>
          Not a demo of a feature — a working model of an operating claim. Each one names the executive question, shows
          exactly what it proves, and exposes the controls that keep it honest.
        </p>
      </LabsHero>

      <LabsProductFrame title="What makes it a proof" meta="Actor to audit">
        <ol className="labs-proof-method-list">
          {proofSequence.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </LabsProductFrame>

      <section className="labs-proof-proof-grid" aria-label="Operon Labs proofs">
        {labsV2Proofs.map((proof) => (
          <Link className="labs-proof-proof-card" href={proof.route} key={proof.slug}>
            <span className="eyebrow">{scenarioStatus(proof.slug)}</span>
            <h2>{proof.executiveQuestion}</h2>
            <p>
              <strong>{proof.title}.</strong> {proof.whatItProves}
            </p>
            <em>{proof.controlSurface}</em>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
