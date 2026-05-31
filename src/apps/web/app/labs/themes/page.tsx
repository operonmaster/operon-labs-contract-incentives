import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { researchThemes } from "../../../components/labs-site/labs-site-content";

export default function ThemesPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="themes" />

      <LabsHero compact eyebrow="Research themes" title="Research themes for trust-native healthcare operations.">
        <p>
          These themes hold the deeper taxonomy behind the Labs homepage: proof, identity, consent, incentives,
          payments, and standards-aware agents.
        </p>
      </LabsHero>

      <section className="labs-magazine-theme-grid" aria-label="Operon Labs research themes">
        {researchThemes.map((theme) => (
          <article className="labs-magazine-theme-card" key={theme.title}>
            <LabsBadge variant="info">{theme.title}</LabsBadge>
            <p>{theme.body}</p>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
