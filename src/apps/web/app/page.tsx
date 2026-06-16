import Link from "next/link";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../components/labs-ui";
import { demoScenarios } from "../components/demo-catalog";

export default function HomePage() {
  return (
    <LabsPageShell className="home-page">
      <LabsHero eyebrow="Operon Labs" title="Policy-driven incentives for measurable healthcare operations">
        <p>
          The demo use cases below show how healthcare teams can earn contract incentives only when policy-safe evidence
          proves quality, timeliness, completeness, and audit readiness.
        </p>
        <p>
          Business policies decide whether work qualifies. Payment policies enforce financial controls: approved
          recipients, caps, tokens, human-review rules, prohibited metrics, and audit-safe settlement.
        </p>
      </LabsHero>

      <LabsProductFrame title="Incentive use cases" meta="Evidence -> business policy -> payment control -> audit">
        <section className="grid" aria-label="Demo workflows">
          {demoScenarios.map((scenario) => (
            <Link className="card" href={`/${scenario.slug}`} key={scenario.slug}>
              <span className="eyebrow">{scenario.submitter}</span>
              <h2>{scenario.title}</h2>
              <p>{scenario.purpose}</p>
              {scenario.status === "dormant" ? <em>Dormant</em> : null}
            </Link>
          ))}
        </section>
        <p className="catalog-note">
          Built for the Hedera AI Agent Bounty Campaign using synthetic healthcare data and controlled settlement
          policies.
        </p>
      </LabsProductFrame>
    </LabsPageShell>
  );
}
