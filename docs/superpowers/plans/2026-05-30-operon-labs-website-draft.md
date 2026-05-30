# Operon Labs Website Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/labs` as a polished draft sub-page that positions Operon Labs as applied R&D for verifiable healthcare operations.

**Architecture:** Add a static Next.js app route that reuses the existing Labs UI primitives and `demoScenarios`. Add one rendering test for the route and narrow CSS classes for the Labs-specific hierarchy, research-domain cards, prototype method, and CTA.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Vitest, `react-dom/server`, existing Labs CSS primitives.

---

## File Structure

- Create: `src/apps/web/app/labs/page.test.tsx`
  - Route rendering test for the new `/labs` page.
- Create: `src/apps/web/app/labs/page.tsx`
  - Static Labs website draft page using existing design primitives.
- Modify: `src/apps/web/app/styles.css`
  - Add route-specific `.labs-draft-*` classes only.

## Task 1: Route Rendering Test

**Files:**
- Create: `src/apps/web/app/labs/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/apps/web/app/labs/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("frames Operon Labs as broader than the current incentive demos", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("Applied R&amp;D for verifiable healthcare operations");
    expect(markup).toContain("Operon Labs turns healthcare trust infrastructure into working clinical-ops experiments.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity");
    expect(markup).toContain("Verifiable Consent");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Payments");
    expect(markup).toContain("Clinical Ops Agents");
    expect(markup).toContain("Provider Documentation Completeness");
    expect(markup).toContain("Delegate UM SLA Bonus");
    expect(markup).toContain("Specialty Rx Fulfillment SLA");
    expect(markup).toContain("Appeals Packet Quality");
    expect(markup).toContain("href=\"/\"");
    expect(markup).toContain("href=\"mailto:partners@operon.cloud\"");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx
```

Expected: FAIL because `src/apps/web/app/labs/page.tsx` does not exist yet.

## Task 2: `/labs` Page Implementation

**Files:**
- Create: `src/apps/web/app/labs/page.tsx`
- Modify: `src/apps/web/app/styles.css`
- Test: `src/apps/web/app/labs/page.test.tsx`

- [ ] **Step 1: Create the route page**

Create `src/apps/web/app/labs/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Add route-specific CSS**

Append this CSS to `src/apps/web/app/styles.css` near the other route-specific sections:

```css
.labs-draft-page {
  max-width: 1180px;
}

.labs-draft-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.labs-draft-intro-grid,
.labs-draft-layer-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
}

.labs-draft-panel {
  margin-top: 0;
}

.labs-draft-panel h2,
.labs-draft-section-heading h2,
.labs-draft-cta h2 {
  color: var(--op-ink);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.12;
  margin: 0;
}

.labs-draft-question-list {
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.labs-draft-question-list li {
  border-bottom: 1px solid var(--op-line-soft);
  color: var(--op-ink-2);
  font-family: var(--op-font-mono), ui-monospace, monospace;
  font-size: 12px;
  padding: 0 0 8px;
}

.labs-draft-question-list li:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.labs-draft-section {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.labs-draft-section-heading {
  display: grid;
  gap: 10px;
  max-width: 860px;
}

.labs-draft-section-heading p,
.labs-draft-cta p {
  color: var(--op-muted);
  line-height: 1.55;
  margin: 0;
}

.labs-draft-domain-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.labs-draft-domain-card {
  min-height: 154px;
}

.labs-draft-domain-card p,
.labs-draft-experiment-card p {
  margin: 0;
}

.labs-draft-platform {
  background: rgba(10, 15, 31, 0.38);
  border: 1px solid var(--op-line);
  border-radius: 8px;
  padding: 18px;
}

.labs-draft-layer-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.labs-draft-layer {
  border: 1px solid var(--op-line);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.labs-draft-layer strong {
  color: var(--op-blue-2);
}

.labs-draft-layer span {
  color: var(--op-muted);
  line-height: 1.45;
}

.labs-draft-pattern-list {
  counter-reset: labs-pattern;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.labs-draft-pattern-list li {
  align-items: center;
  background: rgba(10, 15, 31, 0.56);
  border: 1px solid var(--op-line);
  border-radius: 8px;
  display: flex;
  gap: 12px;
  min-height: 66px;
  padding: 12px;
}

.labs-draft-pattern-list span {
  color: var(--op-muted-2);
  font-family: var(--op-font-mono), ui-monospace, monospace;
  font-size: 12px;
}

.labs-draft-pattern-list strong {
  color: var(--op-ink-2);
  font-size: 14px;
  font-weight: 600;
}

.labs-draft-cta {
  align-items: center;
  background: rgba(5, 8, 22, 0.72);
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 8px;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 18px;
  padding: 20px;
}

@media (max-width: 860px) {
  .labs-draft-intro-grid,
  .labs-draft-layer-grid,
  .labs-draft-cta {
    grid-template-columns: 1fr;
  }

  .labs-draft-domain-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .labs-draft-domain-grid {
    grid-template-columns: 1fr;
  }

  .labs-draft-panel h2,
  .labs-draft-section-heading h2,
  .labs-draft-cta h2 {
    font-size: 24px;
  }
}
```

- [ ] **Step 3: Run the route test to verify it passes**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx
```

Expected: PASS for `LabsPage`.

## Task 3: Full Verification and Browser Review

**Files:**
- Verify: `src/apps/web/app/labs/page.tsx`
- Verify: `src/apps/web/app/labs/page.test.tsx`
- Verify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Start the app**

Run:

```bash
npm --workspace @operon-labs/web run dev -- -H 127.0.0.1 -p 3210
```

Expected: Next.js starts and serves the app at `http://127.0.0.1:3210`.

- [ ] **Step 3: Verify `/labs` in browser**

Open `/labs` in the browser and check:

- hero headline fits without overlap on desktop
- research-domain cards render in a balanced grid
- current experiment cards link to existing routes
- CTA buttons fit on mobile width
- no text overlaps or horizontal overflow at desktop or mobile viewport sizes

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/apps/web/app/labs/page.tsx src/apps/web/app/labs/page.test.tsx src/apps/web/app/styles.css docs/superpowers/plans/2026-05-30-operon-labs-website-draft.md
git commit -m "feat: add Operon Labs website draft page"
```

Expected: commit includes only the `/labs` page, its test, route CSS, and this plan.
