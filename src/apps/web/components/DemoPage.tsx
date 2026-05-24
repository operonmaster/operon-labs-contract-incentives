import Link from "next/link";
import { evaluateDemoScenario } from "@operon-labs/incentive-agent";
import { createAuditRecord } from "@operon-labs/audit-log";
import { getScenario } from "./demo-catalog";

export function DemoPage({ slug }: Readonly<{ slug: string }>) {
  const scenario = getScenario(slug);
  const evaluation = evaluateDemoScenario(scenario.evaluationType);
  const audit = createAuditRecord({
    request: evaluation.request,
    result: evaluation.result,
    transactionId: null
  });

  return (
    <main>
      <Link className="back" href="/">
        Back to demos
      </Link>
      <section className="hero">
        <span className="eyebrow">Contract incentive workflow</span>
        <h1>{scenario.title}</h1>
        <p>{scenario.purpose}</p>
      </section>

      <section className="panel">
        <h2>Synthetic evidence</h2>
        <pre className="mono">{JSON.stringify(evaluation.request, null, 2)}</pre>
      </section>

      <section className="panel">
        <h2>Policy decision</h2>
        <span className={`status ${evaluation.result.decision}`}>{evaluation.result.decision}</span>
        <ul>
          <li>Policy: {evaluation.result.policyId}</li>
          <li>Amount: {evaluation.result.amount} {evaluation.result.currency}</li>
          <li>Recipient wallet: {evaluation.result.walletId ?? "blocked"}</li>
          <li>Reason codes: {evaluation.result.reasonCodes.length === 0 ? "none" : evaluation.result.reasonCodes.join(", ")}</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Audit record</h2>
        <pre className="mono">{JSON.stringify(audit, null, 2)}</pre>
      </section>
    </main>
  );
}
