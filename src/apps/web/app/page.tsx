import Link from "next/link";
import { demoScenarios } from "../components/demo-catalog";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">Operon Labs</span>
        <h1>Contract incentives for measurable healthcare operations quality</h1>
        <p>
          Business workflows submit synthetic evidence, deterministic policies decide whether
          incentives are earned, and Hedera executes testnet payments only after explicit approval.
        </p>
      </section>

      <section className="grid" aria-label="Demo workflows">
        {demoScenarios.map((scenario) => (
          <Link className="card" href={`/${scenario.slug}`} key={scenario.slug}>
            <span className="eyebrow">{scenario.submitter}</span>
            <h2>{scenario.title}</h2>
            <p>{scenario.purpose}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
