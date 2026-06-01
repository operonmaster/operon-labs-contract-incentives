import Link from "next/link";

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
          value flow collide with implementation realities.
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

      <section className="labs-proof-cta" aria-labelledby="labs-signals-cta-heading">
        <div>
          <span className="label">Explore with Labs</span>
          <h2 id="labs-signals-cta-heading">Working on one of these questions?</h2>
          <p>
            Bring the signal, operating pressure, or innovation thesis your team needs to evaluate against real workflows.
          </p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs/book-a-call">
            Book a Call
          </Link>
          <Link className="primary-button secondary-button" href="/labs/themes">
            Explore themes
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
