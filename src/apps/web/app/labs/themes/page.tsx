import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { researchThemes } from "../../../components/labs-site/labs-site-content";

export default function ThemesPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="themes" />

      <LabsHero compact eyebrow="Themes" title="The claims behind trust-native healthcare operations.">
        <p>
          Each theme is a position, not a glossary entry. It states the operating claim Labs is building toward and the
          reason the proof models look the way they do.
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
    </LabsPageShell>
  );
}
