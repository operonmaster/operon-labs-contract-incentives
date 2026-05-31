import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { signals } from "../../../components/labs-site/labs-site-content";

export default function SignalsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="signals" />

      <LabsHero compact eyebrow="Signals" title="Forward intelligence for healthcare operations leaders.">
        <p>
          Short, opinionated reads on where clinical operations are going as AI, delegated vendors, incentives, and
          value flow collide with the need to prove what actually happened.
        </p>
      </LabsHero>

      <section className="labs-proof-brief-grid" aria-label="Operon Labs signals">
        {signals.map((signal) => (
          <article className="labs-proof-brief-card" key={signal.title}>
            <LabsBadge variant={signal.status === "Published" ? "info" : "neutral"}>{signal.label}</LabsBadge>
            <h2>{signal.title}</h2>
            <p>{signal.body}</p>
            <em>{signal.status}</em>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
