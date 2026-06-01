import Link from "next/link";

import { LabsHero, LabsPageShell, LabsProductFrame } from "../../components/labs-ui";
import { LabsV2Nav } from "../../components/labs-site/LabsV2Nav";
import { labsV2PortalCards, labsV2Stat } from "../../components/labs-site/labs-v2-content";

export default function LabsV2OverviewPage() {
  return (
    <LabsPageShell className="labs-proof-page">
      <LabsV2Nav activeId="overview" />

      <LabsHero eyebrow="Operon Labs · Proof studio" title="The proving ground for AI in healthcare operations.">
        <p>
          For the leaders who have to answer one question — is the AI, the vendor, the delegated team actually doing
          what the contract assumes? Labs turns that question into working proof models you can inspect, govern, and
          deploy.
        </p>
        <div className="labs-proof-actions" aria-label="Labs homepage actions">
          <Link className="primary-button" href="/labs_v2/proofs">
            See the proofs
          </Link>
          <Link className="primary-button secondary-button" href="/labs_v2/co-innovate">
            Co-innovate with Labs
          </Link>
        </div>
      </LabsHero>

      <LabsProductFrame title="The gap Labs closes" meta="Proof over promises">
        <section className="labs-proof-feature">
          <div>
            <span className="label">The number that runs the room</span>
            <h2>{labsV2Stat.big}</h2>
            <p>{labsV2Stat.body}</p>
          </div>
          <Link className="primary-button" href="/labs_v2/proofs">
            See the proofs
          </Link>
        </section>
      </LabsProductFrame>

      <LabsProductFrame title="Featured proof" meta="Delegated UM quality">
        <section className="labs-proof-feature">
          <div>
            <span className="label">Working proof model</span>
            <h2>Score a delegated vendor&apos;s review quality — without paying for outcomes.</h2>
            <p>
              A live proof model: timeliness, rationale completeness, and audit readiness are measured and rewarded,
              with approvals, denials, savings, and utilization explicitly out of scope.
            </p>
          </div>
          <Link className="primary-button" href="/delegate-um">
            Open the proof
          </Link>
        </section>
      </LabsProductFrame>

      <section className="labs-proof-cta" aria-labelledby="labs-v2-coinnovate-heading">
        <div>
          <span className="label">Co-innovate with Labs</span>
          <h2 id="labs-v2-coinnovate-heading">Bring a workflow. Leave with a proof.</h2>
          <p>
            An executive co-innovation track: bring an operating problem under board pressure, and leave with an
            inspectable proof model your teams can act on.
          </p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs_v2/co-innovate">
            See how co-innovation works
          </Link>
          <a className="primary-button secondary-button" href="mailto:partners@operon.cloud">
            Bring a workflow
          </a>
        </div>
      </section>

      <section className="labs-proof-portal-grid" aria-label="Explore Operon Labs">
        {labsV2PortalCards.map((card) => (
          <Link className="labs-proof-portal" href={card.href} key={card.title}>
            <span>{card.kicker}</span>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
