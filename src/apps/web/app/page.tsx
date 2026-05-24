import Link from "next/link";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../components/labs-ui";
import { demoScenarios } from "../components/demo-catalog";

export default function HomePage() {
  return (
    <LabsPageShell className="home-page">
      <LabsHero eyebrow="Operon Labs" title={<>Contract incentives for measurable healthcare operations <em>quality.</em></>}>
        <p>
          Business workflows submit synthetic evidence, deterministic policies decide whether
          incentives are earned, and Hedera executes testnet payments inside explicit policy controls.
        </p>
      </LabsHero>

      <LabsProductFrame title="Operon Labs demo catalog" meta="Hackathon build">
        <section className="grid" aria-label="Demo workflows">
          {demoScenarios.map((scenario) => (
            <Link className="card" href={`/${scenario.slug}`} key={scenario.slug}>
              <span className="eyebrow">{scenario.submitter}</span>
              <h2>{scenario.title}</h2>
              <p>{scenario.purpose}</p>
            </Link>
          ))}
        </section>
      </LabsProductFrame>
    </LabsPageShell>
  );
}
