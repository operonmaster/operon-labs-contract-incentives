import Link from "next/link";

import { demoScenarios } from "../../components/demo-catalog";
import { LabsBadge, LabsHero, LabsPageShell, LabsPanel, LabsProductFrame } from "../../components/labs-ui";

const researchDomains = [
  {
    title: "Trust & Evidence",
    body: "Signed workflow events, proof packets, immutable audit trails, and accountable AI actions."
  },
  {
    title: "Digital Identity",
    body: "Verifiable identities for patients, providers, health plans, systems, vendors, and software agents."
  },
  {
    title: "Verifiable Consent",
    body: "Patient permissions, enterprise delegation, access scopes, revocation, and auditable consent evidence."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for quality, timeliness, completeness, coordination, and evidence readiness."
  },
  {
    title: "Instant Payments",
    body: "Programmable settlement, micropayments, reward rails, and controlled value flows."
  },
  {
    title: "Clinical Ops Agents",
    body: "Standards-aware workflow prototypes across prior authorization, pharmacy, appeals, and other regulated operations."
  }
];

const trustQuestions = [
  "Who acted?",
  "What changed?",
  "Was the actor authorized?",
  "Did consent or delegation exist?",
  "What evidence supports the workflow claim?",
  "What policy applied?",
  "What reward or payment should move next?"
];

const prototypePattern = [
  "Regulated workflow",
  "Trust claim",
  "Actor identity or authority model",
  "Policy or consent constraint",
  "Policy-safe evidence packet",
  "Execution or settlement path",
  "Human-readable audit trail"
];

const platformLayers = [
  {
    name: "ID.Operon",
    summary: "establishes who can act."
  },
  {
    name: "Trust.Operon",
    summary: "proves what happened."
  },
  {
    name: "Pulse.Operon",
    summary: "connects measurable work to incentives, rewards, and value flow."
  }
];

export default function LabsPage() {
  return (
    <LabsPageShell className="labs-draft-page">
      <LabsHero eyebrow="Operon Labs" title="Applied R&D for verifiable healthcare operations">
        <p>
          Operon Labs turns healthcare trust infrastructure into working clinical-ops experiments. We prototype how
          digital identity, verifiable evidence, patient consent, policy incentives, and instant value flows can make
          regulated healthcare workflows more accountable, measurable, and programmable.
        </p>
        <div className="labs-draft-actions" aria-label="Labs page actions">
          <a className="primary-button" href="#current-experiments">
            Explore current experiments
          </a>
          <Link className="primary-button secondary-button" href="/">
            Demo catalog
          </Link>
        </div>
      </LabsHero>

      <LabsProductFrame title="Operon Labs research surface" meta="Draft website direction">
        <section className="labs-draft-intro-grid" aria-labelledby="labs-why-heading">
          <LabsPanel className="labs-draft-panel">
            <span className="label">Why Labs exists</span>
            <h2 id="labs-why-heading">The trust layer has to become inspectable.</h2>
            <p>
              Healthcare operations are becoming API-mediated and AI-assisted, but many trust questions still live in
              manual review, screenshots, email trails, disconnected logs, and after-the-fact reconciliation.
            </p>
          </LabsPanel>

          <LabsPanel className="labs-draft-panel labs-draft-question-panel">
            <span className="label">Operational questions</span>
            <ul className="labs-draft-question-list">
              {trustQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </LabsPanel>
        </section>

        <section className="labs-draft-section" aria-labelledby="research-domains-heading">
          <div className="labs-draft-section-heading">
            <span className="label">Research domains</span>
            <h2 id="research-domains-heading">A broader agenda than incentive workflows.</h2>
            <p>
              The current demos are evidence that the approach can work. The Labs agenda is larger: identity, proof,
              consent, incentives, settlement, and standards-aware agents.
            </p>
          </div>
          <div className="labs-draft-domain-grid">
            {researchDomains.map((domain) => (
              <article className="card labs-draft-domain-card" key={domain.title}>
                <LabsBadge variant="info">{domain.title}</LabsBadge>
                <p>{domain.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="labs-draft-section labs-draft-platform" aria-labelledby="platform-continuity-heading">
          <div className="labs-draft-section-heading">
            <span className="label">Platform continuity</span>
            <h2 id="platform-continuity-heading">Labs pressure-tests the Operon trust fabric.</h2>
            <p>
              Operon Labs should feel more experimental than the corporate site, but it should still inherit the same
              architecture: identity establishes authority, proof captures evidence, and Pulse connects performance to
              programmable value flow.
            </p>
          </div>
          <div className="labs-draft-layer-grid">
            {platformLayers.map((layer) => (
              <div className="labs-draft-layer" key={layer.name}>
                <strong>{layer.name}</strong>
                <span>{layer.summary}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="labs-draft-section" aria-labelledby="prototype-pattern-heading">
          <div className="labs-draft-section-heading">
            <span className="label">Prototype pattern</span>
            <h2 id="prototype-pattern-heading">Each experiment needs a workflow, a trust claim, and an execution path.</h2>
          </div>
          <ol className="labs-draft-pattern-list">
            {prototypePattern.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="labs-draft-section" id="current-experiments" aria-labelledby="current-experiments-heading">
          <div className="labs-draft-section-heading">
            <span className="label">Current experiments</span>
            <h2 id="current-experiments-heading">Working prototypes, not permanent pillars.</h2>
            <p>
              These demos prove the repeatable model against clinical operations workflows: submit synthetic evidence,
              evaluate a deterministic policy, expose audit evidence, and execute controlled settlement.
            </p>
          </div>
          <div className="grid">
            {demoScenarios.map((scenario) => (
              <Link className="card labs-draft-experiment-card" href={`/${scenario.slug}`} key={scenario.slug}>
                <span className="eyebrow">{scenario.submitter}</span>
                <h2>{scenario.title}</h2>
                <p>{scenario.purpose}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="labs-draft-cta" aria-labelledby="labs-cta-heading">
          <div>
            <span className="label">Build with Labs</span>
            <h2 id="labs-cta-heading">Bring a workflow, policy, consent problem, or trust gap.</h2>
            <p>
              Labs turns it into a working prototype that can be inspected, measured, and debated before it becomes a
              platform roadmap commitment.
            </p>
          </div>
          <div className="labs-draft-actions">
            <a className="primary-button" href="#current-experiments">
              Explore experiments
            </a>
            <a className="primary-button secondary-button" href="mailto:partners@operon.cloud">
              Discuss a workflow prototype
            </a>
          </div>
        </section>
      </LabsProductFrame>
    </LabsPageShell>
  );
}
