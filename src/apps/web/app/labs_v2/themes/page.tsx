import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsV2Nav } from "../../../components/labs-site/LabsV2Nav";
import { labsV2Themes } from "../../../components/labs-site/labs-v2-content";

export default function LabsV2ThemesPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsV2Nav activeId="themes" />

      <LabsHero compact eyebrow="Themes" title="The questions we think decide the next decade of operations.">
        <p>
          Each theme is a position, not a glossary entry — the operating claim Labs is building toward, and the reason
          the proofs look the way they do.
        </p>
      </LabsHero>

      <section className="labs-proof-theme-grid" aria-label="Operon Labs themes">
        {labsV2Themes.map((theme) => (
          <article className="labs-proof-theme-card" key={theme.label}>
            <LabsBadge variant="neutral">{theme.label}</LabsBadge>
            <h2>{theme.claim}</h2>
            <p>{theme.body}</p>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
