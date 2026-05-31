import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { briefs } from "../../../components/labs-site/labs-site-content";

export default function BriefsPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsSiteNav activeId="briefs" />

      <LabsHero compact eyebrow="Briefs" title="Briefs from the healthcare proof layer.">
        <p>
          Short executive reads on operational proof, consent, rewards, settlement, and the trust systems behind
          healthcare innovation.
        </p>
      </LabsHero>

      <section className="labs-proof-brief-grid" aria-label="Operon Labs briefs">
        {briefs.map((brief) => (
          <article className="labs-proof-brief-card" key={brief.title}>
            <LabsBadge variant="neutral">{brief.label}</LabsBadge>
            <h2>{brief.title}</h2>
            <p>{brief.body}</p>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
