import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { researchThemes } from "../../../components/labs-site/labs-site-content";

export default function ThemesPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="themes" />

      <LabsHero compact eyebrow="Themes" title="Themes for trust-native healthcare operations.">
        <p>
          The broader agenda behind the proof portfolio: evidence, authority, consent, rewards, settlement, and
          AI-ready operations.
        </p>
      </LabsHero>

      <section className="labs-proof-theme-grid" aria-label="Operon Labs research themes">
        {researchThemes.map((theme) => (
          <article className="labs-proof-theme-card" key={theme.title}>
            <LabsBadge variant="info">{theme.title}</LabsBadge>
            <p>{theme.body}</p>
            <p>{theme.executiveClaim}</p>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
