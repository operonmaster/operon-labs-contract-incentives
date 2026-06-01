import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsV2Nav } from "../../../components/labs-site/LabsV2Nav";
import { labsV2Signals } from "../../../components/labs-site/labs-v2-content";

export default function LabsV2SignalsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsV2Nav activeId="signals" />

      <LabsHero compact eyebrow="Signals" title="Forward intelligence for operations leaders.">
        <p>
          Short, opinionated reads on where clinical operations are going — the patterns we keep seeing as AI, delegated
          vendors, and value-based contracts collide with the need to prove what actually happened.
        </p>
      </LabsHero>

      <section className="labs-proof-brief-grid" aria-label="Operon Labs signals">
        {labsV2Signals.map((signal) => (
          <article className="labs-proof-brief-card" key={signal.title}>
            <LabsBadge variant={signal.status === "Published" ? "info" : "neutral"}>{signal.kicker}</LabsBadge>
            <h2>{signal.title}</h2>
            <p>{signal.body}</p>
            <em>{signal.status}</em>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
