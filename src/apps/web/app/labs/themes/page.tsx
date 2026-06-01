import Link from "next/link";

import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { researchThemes } from "../../../components/labs-site/labs-site-content";

export default function ThemesPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="themes" />

      <LabsHero compact eyebrow="Themes" title="Innovation themes for healthcare operations.">
        <p>
          Each theme is a position on the operating models healthcare teams need next: AI-enabled workflows,
          incentives, identity, consent, value movement, and visibility into what happened.
        </p>
      </LabsHero>

      <section className="labs-proof-theme-grid" aria-label="Operon Labs research themes">
        {researchThemes.map((theme) => (
          <article className="labs-proof-theme-card" key={theme.title}>
            <LabsBadge variant="neutral">{theme.title}</LabsBadge>
            <h2>{theme.executiveClaim}</h2>
            <p>{theme.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-proof-cta" aria-labelledby="labs-themes-cta-heading">
        <div>
          <span className="label">Explore with Labs</span>
          <h2 id="labs-themes-cta-heading">Working on one of these questions?</h2>
          <p>
            Talk through the healthcare operations theme your team is trying to turn into a governed implementation.
          </p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs/book-a-call">
            Book a Call
          </Link>
          <Link className="primary-button secondary-button" href="/labs/initiatives">
            Explore initiatives
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
