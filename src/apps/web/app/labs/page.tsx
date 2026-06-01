import Link from "next/link";

import { LabsHero, LabsPageShell, LabsProductFrame } from "../../components/labs-ui";
import { LabsSiteNav } from "../../components/labs-site/LabsSiteNav";
import { coInnovateOffer, operatingModelSpine } from "../../components/labs-site/labs-site-content";

const labsHomeProcessSteps = [
  {
    title: "Frame the workflow",
    body: "Start with the pressure point, the actors, and the decision your team needs to make."
  },
  {
    title: "Model the controls",
    body: "Turn authority, consent, evidence, policy, incentives, and value flow into an inspectable operating model."
  },
  {
    title: "Validate with stakeholders",
    body: "Use the model to align operations, technology, compliance, vendors, and business owners around what should run."
  },
  {
    title: "Translate to implementation",
    body: "Decide what becomes a partner implementation, a product primitive, or a reusable internal pattern."
  }
] as const;

const delegateUmDemoSpine = [
  { label: "Workflow", value: "Delegated review" },
  { label: "Authority", value: "Assigned reviewer" },
  { label: "Evidence", value: "SLA + rationale" },
  { label: "Policy", value: "No outcome bias" },
  { label: "Value", value: "Quality incentive" },
  { label: "Path", value: "Working demo" }
] as const;

export default function LabsPage() {
  return (
    <LabsPageShell className="labs-proof-page labs-home-page">
      <LabsSiteNav activeId="overview" />

      <LabsHero eyebrow="Healthcare operations innovation studio" title="Innovation Studio for Healthcare Operations">
        <p>
          Bring a healthcare operations workflow under pressure. Operon Labs turns it into a working model your team can
          inspect, govern, and take toward implementation.
        </p>
        <div className="labs-proof-actions" aria-label="Labs homepage actions">
          <Link className="primary-button" href="/labs/book-a-call">
            Book a Call
          </Link>
          <Link className="primary-button secondary-button" href="/labs/initiatives">
            Explore initiatives
          </Link>
        </div>
      </LabsHero>

      <section className="labs-home-snapshot-grid" aria-label="Labs operating context">
        <LabsProductFrame className="labs-home-compact-frame" title="The gap Labs closes" meta="Ideas to implementation">
          <section className="labs-home-compact-feature">
            <span className="label">Operating model gap</span>
            <h2>Healthcare innovation breaks when the operating model is unclear.</h2>
            <p>
              AI agents, delegated work, consent flows, rewards, and vendor automation all create the same question:
              what can run, who can act, what evidence proves it, which policy governs it, and how value moves. Labs
              turns that ambiguity into an inspectable model.
            </p>
            <ol className="labs-home-mini-sequence" aria-label="Operating model sequence">
              {operatingModelSpine.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </section>
        </LabsProductFrame>

        <LabsProductFrame className="labs-home-compact-frame" title="Featured initiative" meta="Delegated UM quality">
          <section className="labs-home-compact-feature">
            <span className="label">Working demo</span>
            <h2>See how delegated UM quality becomes a governed operating model.</h2>
            <p>
              The demo turns delegated review quality into an inspectable workflow: timeliness, rationale completeness,
              audit readiness, policy exclusions, and controlled incentive logic are visible end to end.
            </p>
            <ol className="labs-home-mini-sequence labs-home-demo-sequence" aria-label="Delegated UM demo model spine">
              {delegateUmDemoSpine.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ol>
            <Link className="primary-button secondary-button" href="/delegate-um">
              View working demo
            </Link>
          </section>
        </LabsProductFrame>
      </section>

      <section className="labs-home-coinnovate" aria-labelledby="labs-coinnovate-heading">
        <div className="labs-home-section-header">
          <span className="label">Co-innovate with Labs</span>
          <h2 id="labs-coinnovate-heading">Bring a workflow. Leave with a working model.</h2>
          <p>
            Labs runs as an executive innovation track. You bring the operating pressure; we build the model with you
            using Operon&apos;s identity, consent, evidence, policy, incentive, and settlement primitives.
          </p>
        </div>

        <div className="labs-home-offer-grid" aria-label="Co-innovation inputs and outputs">
          {coInnovateOffer.map((offer) => (
            <article className="labs-proof-teaser labs-home-offer-card" key={offer.title}>
              <span className="label">{offer.label}</span>
              <h3>{offer.title}</h3>
              <p>{offer.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="labs-home-process-section" aria-labelledby="labs-process-heading">
        <div className="labs-home-section-header">
          <span className="label">How Labs works</span>
          <h2 id="labs-process-heading">From operating pressure to implementation path</h2>
          <p>
            Labs is not a workshop artifact generator. We use the workflow you bring as the intake surface, then turn it
            into a model your team can validate, govern, and decide how to implement.
          </p>
        </div>

        <div className="labs-home-process-strip" aria-label="Labs engagement path">
          {labsHomeProcessSteps.map((step, index) => (
            <article className="labs-proof-process-step labs-home-process-step" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="labs-proof-cta labs-home-final-cta" aria-labelledby="labs-final-heading">
        <div>
          <span className="label">Next step</span>
          <h2 id="labs-final-heading">Have a workflow you need to validate before you bet a contract on it?</h2>
          <p>Bring it to Labs. We will turn it into a working model you can inspect, measure, govern, and share.</p>
        </div>
        <div className="labs-proof-actions">
          <Link className="primary-button" href="/labs/book-a-call">
            Book a Call
          </Link>
          <Link className="primary-button secondary-button" href="/labs/initiatives">
            See current initiatives
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
