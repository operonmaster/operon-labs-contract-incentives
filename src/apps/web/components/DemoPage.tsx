import Link from "next/link";
import { evaluateDemoScenario } from "@operon-labs/incentive-agent";
import { createAuditRecord } from "@operon-labs/audit-log";
import { getScenario } from "./demo-catalog";
import { LabsHero, LabsPageShell, LabsPanel, LabsProductFrame } from "./labs-ui";

export function DemoPage({ slug }: Readonly<{ slug: string }>) {
  const scenario = getScenario(slug);
  const evaluation = evaluateDemoScenario(scenario.evaluationType);
  const audit = createAuditRecord({
    request: evaluation.request,
    result: evaluation.result,
    transactionId: null
  });

  return (
    <LabsPageShell>
      <Link className="back" href="/">
        Back to demos
      </Link>

      <LabsHero eyebrow="Contract incentive workflow" title={scenario.title}>
        <p>{scenario.purpose}</p>
      </LabsHero>

      <LabsProductFrame title="Synthetic evidence" meta="Policy input">
        <pre className="mono">{JSON.stringify(evaluation.request, null, 2)}</pre>
      </LabsProductFrame>

      <LabsPanel>
        <h2>Policy decision</h2>
        <span className={`status ${evaluation.result.decision}`}>{evaluation.result.decision}</span>
        <ul>
          <li>Policy: {evaluation.result.policyId}</li>
          <li>Amount: {evaluation.result.amount} {evaluation.result.currency}</li>
          <li>Recipient wallet: {evaluation.result.walletId ?? "blocked"}</li>
          <li>Reason codes: {evaluation.result.reasonCodes.length === 0 ? "none" : evaluation.result.reasonCodes.join(", ")}</li>
        </ul>
      </LabsPanel>

      <LabsProductFrame title="Audit record" meta="Immutable trace">
        <pre className="mono">{JSON.stringify(audit, null, 2)}</pre>
      </LabsProductFrame>
    </LabsPageShell>
  );
}
