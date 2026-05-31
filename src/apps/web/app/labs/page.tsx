import Link from "next/link";

import { LabsHero, LabsPageShell, LabsProductFrame } from "../../components/labs-ui";
import { LabsSiteNav } from "../../components/labs-site/LabsSiteNav";
import { fieldNotes, labsPortalCards } from "../../components/labs-site/labs-site-content";

const homepageTeasers = fieldNotes.slice(0, 2);

export default function LabsPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="labs" />

      <LabsHero eyebrow="Operon Labs" title="The lab for verifiable healthcare operations.">
        <p>
          Operon Labs prototypes trust, consent, identity, and value-flow systems for the workflows that decide care.
        </p>
        <div className="labs-magazine-actions" aria-label="Labs homepage actions">
          <Link className="primary-button" href="/labs/experiments">
            Explore experiments
          </Link>
          <Link className="primary-button secondary-button" href="/labs/notes">
            Read field notes
          </Link>
        </div>
      </LabsHero>

      <LabsProductFrame title="Featured experiment" meta="Policy-triggered rewards">
        <section className="labs-magazine-feature">
          <div>
            <span className="label">Working testbed</span>
            <h2>Policy-triggered rewards for clinical operations</h2>
            <p>
              A working testbed for evidence packets, SLA policies, human approval, and programmable settlement.
            </p>
          </div>
          <Link className="primary-button" href="/labs/experiments">
            View experiment
          </Link>
        </section>
      </LabsProductFrame>

      <section className="labs-magazine-teaser-grid" aria-label="Latest Labs teasers">
        {homepageTeasers.map((note) => (
          <Link className="labs-magazine-teaser" href="/labs/notes" key={note.title}>
            <span className="label">{note.label}</span>
            <h2>{note.title}</h2>
            <p>{note.body}</p>
          </Link>
        ))}
      </section>

      <section className="labs-magazine-portal-grid" aria-label="Explore Operon Labs">
        {labsPortalCards.map((card) => (
          <Link className="labs-magazine-portal" href={card.href} key={card.title}>
            <span>{card.kicker}</span>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
