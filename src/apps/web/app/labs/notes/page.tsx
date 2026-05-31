import { LabsBadge, LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { fieldNotes } from "../../../components/labs-site/labs-site-content";

export default function NotesPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="notes" />

      <LabsHero compact eyebrow="Field notes" title="Field notes from the trust layer.">
        <p>
          Short dispatches from prototypes: what we are learning about evidence, consent, rewards, and settlement as
          healthcare workflows become inspectable.
        </p>
      </LabsHero>

      <section className="labs-magazine-note-grid" aria-label="Operon Labs field notes">
        {fieldNotes.map((note) => (
          <article className="labs-magazine-note-card" key={note.title}>
            <LabsBadge variant="neutral">{note.label}</LabsBadge>
            <h2>{note.title}</h2>
            <p>{note.body}</p>
          </article>
        ))}
      </section>
    </LabsPageShell>
  );
}
