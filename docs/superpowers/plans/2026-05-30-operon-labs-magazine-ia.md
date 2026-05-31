# Operon Labs Magazine IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overloaded `/labs` draft with a five-page Magazine Lab experience that uses `/labs` as a sparse editorial front door and moves depth into `/labs/experiments`, `/labs/themes`, `/labs/notes`, and `/labs/about`.

**Architecture:** Build a small shared Labs site module for static content and masthead navigation, then rewrite `/labs` and add four static App Router subpages. Use the existing Labs design primitives, `demoScenarios`, and route-scoped `.labs-magazine-*` CSS while removing the earlier `.labs-draft-*` implementation surface.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Vitest, `react-dom/server`, existing Labs UI primitives and global stylesheet.

---

## File Structure

- Create: `src/apps/web/components/labs-site/labs-site-content.ts`
  - Static content arrays for Labs nav, portal cards, research themes, field notes, about steps, experiment method, and experiment framing.
- Create: `src/apps/web/components/labs-site/LabsSiteNav.tsx`
  - Shared Labs masthead/navigation used by all Labs pages.
- Create: `src/apps/web/components/labs-site/labs-site-content.test.ts`
  - Verifies shared content coverage and links.
- Create: `src/apps/web/components/labs-site/LabsSiteNav.test.tsx`
  - Verifies the masthead renders all links and marks the active page.
- Modify: `src/apps/web/app/labs/page.tsx`
  - Rewrite as sparse Magazine Lab homepage.
- Modify: `src/apps/web/app/labs/page.test.tsx`
  - Replace old overloaded-page assertions with sparse-homepage assertions.
- Create: `src/apps/web/app/labs/experiments/page.tsx`
  - Experiments index linked to the four existing demos.
- Create: `src/apps/web/app/labs/experiments/page.test.tsx`
  - Verifies all current demos render as inspectable experiments.
- Create: `src/apps/web/app/labs/themes/page.tsx`
  - Deeper research-theme taxonomy page.
- Create: `src/apps/web/app/labs/themes/page.test.tsx`
  - Verifies all six themes render here, not on the homepage.
- Create: `src/apps/web/app/labs/notes/page.tsx`
  - Static editorial note teasers.
- Create: `src/apps/web/app/labs/notes/page.test.tsx`
  - Verifies the note teasers and labels.
- Create: `src/apps/web/app/labs/about/page.tsx`
  - Labs process and partner CTA page.
- Create: `src/apps/web/app/labs/about/page.test.tsx`
  - Verifies the four process steps and partner CTA.
- Modify: `src/apps/web/app/styles.css`
  - Remove `.labs-draft-*` styles and add `.labs-magazine-*` route-specific styles.
- Create: `src/apps/web/components/labs-site/labs-site-style.test.ts`
  - Verifies the stylesheet has the new namespace and no stale `.labs-draft-*` rules.

## Task 1: Shared Labs Content and Navigation

**Files:**
- Create: `src/apps/web/components/labs-site/labs-site-content.test.ts`
- Create: `src/apps/web/components/labs-site/LabsSiteNav.test.tsx`
- Create: `src/apps/web/components/labs-site/labs-site-content.ts`
- Create: `src/apps/web/components/labs-site/LabsSiteNav.tsx`

- [ ] **Step 1: Write failing shared content test**

Create `src/apps/web/components/labs-site/labs-site-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  aboutSteps,
  experimentFramingBySlug,
  experimentMethodSteps,
  fieldNotes,
  labsNavItems,
  labsPortalCards,
  researchThemes
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines the Magazine Lab navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/experiments",
      "/labs/themes",
      "/labs/notes",
      "/labs/about"
    ]);

    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/experiments",
      "/labs/notes",
      "/labs/themes"
    ]);
  });

  it("keeps heavy content off the homepage by storing it in subpage content arrays", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Trust & Evidence",
      "Digital Identity",
      "Verifiable Consent",
      "Incentives & Rewards",
      "Instant Payments",
      "Clinical Ops Agents"
    ]);
    expect(fieldNotes).toHaveLength(4);
    expect(aboutSteps.map((step) => step.title)).toEqual([
      "Bring a workflow",
      "Define the trust claim",
      "Build the evidence path",
      "Make it inspectable"
    ]);
    expect(experimentMethodSteps).toEqual([
      "Workflow friction",
      "Trust claim",
      "Evidence model",
      "Policy decision",
      "Controlled execution"
    ]);
  });

  it("frames every current experiment with a research question", () => {
    expect(experimentFramingBySlug).toMatchObject({
      "provider-documentation": "Can better upstream evidence reduce avoidable prior-auth friction?",
      "delegate-um": "Can delegated review quality be proven without relying on outcome incentives?",
      "specialty-rx": "Can post-authorization fulfillment be measured as a trust-preserving workflow?",
      appeals: "Can exception-path readiness be rewarded without touching appeal outcomes?"
    });
  });
});
```

- [ ] **Step 2: Write failing nav test**

Create `src/apps/web/components/labs-site/LabsSiteNav.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsSiteNav } from "./LabsSiteNav";

describe("LabsSiteNav", () => {
  it("renders a compact editorial masthead with all Labs links", () => {
    const markup = renderToStaticMarkup(<LabsSiteNav activeId="themes" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain('href="/labs"');
    expect(markup).toContain('href="/labs/experiments"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/notes"');
    expect(markup).toContain('href="/labs/about"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Demo catalog");
    expect(markup).toContain('aria-current="page"');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx
```

Expected: FAIL because `labs-site-content.ts` and `LabsSiteNav.tsx` do not exist.

- [ ] **Step 4: Implement shared content**

Create `src/apps/web/components/labs-site/labs-site-content.ts`:

```ts
export interface LabsNavItem {
  id: "labs" | "experiments" | "themes" | "notes" | "about";
  label: string;
  href: string;
}

export interface LabsPortalCard {
  title: string;
  href: string;
  kicker: string;
  body: string;
}

export interface ResearchTheme {
  title: string;
  body: string;
}

export interface FieldNote {
  label: "Field note" | "Pattern" | "Question";
  title: string;
  body: string;
}

export interface AboutStep {
  title: string;
  body: string;
}

export const labsNavItems: LabsNavItem[] = [
  { id: "labs", label: "Labs", href: "/labs" },
  { id: "experiments", label: "Experiments", href: "/labs/experiments" },
  { id: "themes", label: "Themes", href: "/labs/themes" },
  { id: "notes", label: "Notes", href: "/labs/notes" },
  { id: "about", label: "About", href: "/labs/about" }
];

export const labsPortalCards: LabsPortalCard[] = [
  {
    title: "Experiments",
    href: "/labs/experiments",
    kicker: "01",
    body: "Working demos people can inspect."
  },
  {
    title: "Field notes",
    href: "/labs/notes",
    kicker: "02",
    body: "Short learnings from prototypes."
  },
  {
    title: "Themes",
    href: "/labs/themes",
    kicker: "03",
    body: "Identity, consent, proof, payments."
  }
];

export const researchThemes: ResearchTheme[] = [
  {
    title: "Trust & Evidence",
    body: "Signed events, proof packets, audit trails, and AI accountability."
  },
  {
    title: "Digital Identity",
    body: "Verifiable identities for patients, providers, plans, vendors, systems, and agents."
  },
  {
    title: "Verifiable Consent",
    body: "Patient permissions, enterprise delegation, access scopes, and revocation evidence."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for quality, timeliness, completeness, and coordination."
  },
  {
    title: "Instant Payments",
    body: "Programmable settlement, micropayments, reward rails, and controlled value movement."
  },
  {
    title: "Clinical Ops Agents",
    body: "Standards-aware workflow prototypes across prior authorization, pharmacy, appeals, and future operations."
  }
];

export const fieldNotes: FieldNote[] = [
  {
    label: "Field note",
    title: "What counts as proof in a prior-auth workflow?",
    body: "A note on turning workflow metadata into policy-safe evidence."
  },
  {
    label: "Question",
    title: "Patient consent as executable infrastructure",
    body: "Why consent should behave like an active control, not a scanned artifact."
  },
  {
    label: "Pattern",
    title: "Rewards without outcome bias",
    body: "How to reward operational quality without tying incentives to clinical or financial outcomes."
  },
  {
    label: "Pattern",
    title: "When instant payment needs a human checkpoint",
    body: "A practical pattern for combining programmable settlement with explicit approval controls."
  }
];

export const aboutSteps: AboutStep[] = [
  {
    title: "Bring a workflow",
    body: "Partner or internal workflow friction enters as a concrete operating problem."
  },
  {
    title: "Define the trust claim",
    body: "The prototype states what must be proven, by whom, and under what authority."
  },
  {
    title: "Build the evidence path",
    body: "Synthetic demo-safe events, policies, and proof packets are modeled."
  },
  {
    title: "Make it inspectable",
    body: "The result is a working prototype with visible assumptions, controls, and open questions."
  }
];

export const experimentMethodSteps = [
  "Workflow friction",
  "Trust claim",
  "Evidence model",
  "Policy decision",
  "Controlled execution"
];

export const experimentFramingBySlug: Record<string, string> = {
  "provider-documentation": "Can better upstream evidence reduce avoidable prior-auth friction?",
  "delegate-um": "Can delegated review quality be proven without relying on outcome incentives?",
  "specialty-rx": "Can post-authorization fulfillment be measured as a trust-preserving workflow?",
  appeals: "Can exception-path readiness be rewarded without touching appeal outcomes?"
};
```

- [ ] **Step 5: Implement shared navigation**

Create `src/apps/web/components/labs-site/LabsSiteNav.tsx`:

```tsx
import Link from "next/link";

import { labsNavItems, type LabsNavItem } from "./labs-site-content";

export function LabsSiteNav({ activeId }: Readonly<{ activeId: LabsNavItem["id"] }>) {
  return (
    <nav className="labs-magazine-nav" aria-label="Operon Labs sections">
      <Link className="labs-magazine-brand" href="/labs">
        Operon Labs
      </Link>
      <div className="labs-magazine-nav-links">
        {labsNavItems.map((item) => (
          <Link aria-current={item.id === activeId ? "page" : undefined} href={item.href} key={item.id}>
            {item.label}
          </Link>
        ))}
      </div>
      <Link className="labs-magazine-demo-link" href="/">
        Demo catalog
      </Link>
    </nav>
  );
}
```

- [ ] **Step 6: Run tests to verify shared layer passes**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx
```

Expected: PASS.

## Task 2: Sparse `/labs` Magazine Homepage

**Files:**
- Modify: `src/apps/web/app/labs/page.test.tsx`
- Modify: `src/apps/web/app/labs/page.tsx`
- Test: `src/apps/web/app/labs/page.test.tsx`

- [ ] **Step 1: Replace homepage test with sparse-homepage expectations**

Replace `src/apps/web/app/labs/page.test.tsx` with:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("renders a sparse Magazine Lab front door", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("The lab for verifiable healthcare operations.");
    expect(markup).toContain("Operon Labs prototypes trust, consent, identity, and value-flow systems");
    expect(markup).toContain("Policy-triggered rewards for clinical operations");
    expect(markup).toContain("What counts as proof in a prior-auth workflow?");
    expect(markup).toContain("Patient consent as executable infrastructure");
    expect(markup).toContain('href="/labs/experiments"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/notes"');
    expect(markup).toContain('href="/labs/about"');
  });

  it("keeps heavy taxonomy off the homepage", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).not.toContain("Digital Identity");
    expect(markup).not.toContain("Verifiable Consent");
    expect(markup).not.toContain("Instant Payments");
    expect(markup).not.toContain("Clinical Ops Agents");
    expect(markup).not.toContain("Was the actor authorized?");
    expect(markup).not.toContain("Each experiment needs a workflow, a trust claim, and an execution path.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails against current overloaded homepage**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx
```

Expected: FAIL because the current `/labs` page still renders the old headline and heavy taxonomy.

- [ ] **Step 3: Replace homepage implementation**

Replace `src/apps/web/app/labs/page.tsx` with:

```tsx
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
```

- [ ] **Step 4: Run homepage test to verify it passes**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx
```

Expected: PASS.

## Task 3: Experiments Page

**Files:**
- Create: `src/apps/web/app/labs/experiments/page.test.tsx`
- Create: `src/apps/web/app/labs/experiments/page.tsx`

- [ ] **Step 1: Write failing experiments page test**

Create `src/apps/web/app/labs/experiments/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ExperimentsPage from "./page";

describe("ExperimentsPage", () => {
  it("renders the current demos as inspectable Labs experiments", () => {
    const markup = renderToStaticMarkup(<ExperimentsPage />);

    expect(markup).toContain("Experiments you can inspect.");
    expect(markup).toContain("Workflow friction");
    expect(markup).toContain("Trust claim");
    expect(markup).toContain("Evidence model");
    expect(markup).toContain("Policy decision");
    expect(markup).toContain("Controlled execution");
    expect(markup).toContain("Provider Documentation Completeness");
    expect(markup).toContain("Delegate UM SLA Bonus");
    expect(markup).toContain("Specialty Rx Fulfillment SLA");
    expect(markup).toContain("Appeals Packet Quality");
    expect(markup).toContain("Can better upstream evidence reduce avoidable prior-auth friction?");
    expect(markup).toContain("Can exception-path readiness be rewarded without touching appeal outcomes?");
    expect(markup).toContain('href="/provider-documentation"');
    expect(markup).toContain('href="/appeals"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/apps/web/app/labs/experiments/page.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement experiments page**

Create `src/apps/web/app/labs/experiments/page.tsx`:

```tsx
import Link from "next/link";

import { demoScenarios } from "../../../components/demo-catalog";
import { LabsHero, LabsPageShell, LabsProductFrame } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { experimentFramingBySlug, experimentMethodSteps } from "../../../components/labs-site/labs-site-content";

export default function ExperimentsPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="experiments" />

      <LabsHero compact eyebrow="Experiments" title="Experiments you can inspect.">
        <p>
          Each experiment starts with an operational trust gap, then turns it into a workflow, evidence packet, policy
          decision, and controlled execution path.
        </p>
      </LabsHero>

      <LabsProductFrame title="Experiment method" meta="Trust gap to working prototype">
        <ol className="labs-magazine-method-list">
          {experimentMethodSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </LabsProductFrame>

      <section className="labs-magazine-experiment-grid" aria-label="Current Labs experiments">
        {demoScenarios.map((scenario) => (
          <Link className="labs-magazine-experiment-card" href={`/${scenario.slug}`} key={scenario.slug}>
            <span className="eyebrow">{scenario.submitter}</span>
            <h2>{scenario.title}</h2>
            <p>{experimentFramingBySlug[scenario.slug] ?? scenario.purpose}</p>
            <em>{scenario.status}</em>
          </Link>
        ))}
      </section>
    </LabsPageShell>
  );
}
```

- [ ] **Step 4: Run experiments page test to verify it passes**

Run:

```bash
npm test -- src/apps/web/app/labs/experiments/page.test.tsx
```

Expected: PASS.

## Task 4: Themes Page

**Files:**
- Create: `src/apps/web/app/labs/themes/page.test.tsx`
- Create: `src/apps/web/app/labs/themes/page.tsx`

- [ ] **Step 1: Write failing themes page test**

Create `src/apps/web/app/labs/themes/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ThemesPage from "./page";

describe("ThemesPage", () => {
  it("renders the full Labs research taxonomy away from the homepage", () => {
    const markup = renderToStaticMarkup(<ThemesPage />);

    expect(markup).toContain("Research themes for trust-native healthcare operations.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity");
    expect(markup).toContain("Verifiable Consent");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Payments");
    expect(markup).toContain("Clinical Ops Agents");
    expect(markup).toContain("Signed events, proof packets, audit trails, and AI accountability.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/apps/web/app/labs/themes/page.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement themes page**

Create `src/apps/web/app/labs/themes/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Run themes page test to verify it passes**

Run:

```bash
npm test -- src/apps/web/app/labs/themes/page.test.tsx
```

Expected: PASS.

## Task 5: Notes and About Pages

**Files:**
- Create: `src/apps/web/app/labs/notes/page.test.tsx`
- Create: `src/apps/web/app/labs/notes/page.tsx`
- Create: `src/apps/web/app/labs/about/page.test.tsx`
- Create: `src/apps/web/app/labs/about/page.tsx`

- [ ] **Step 1: Write failing notes page test**

Create `src/apps/web/app/labs/notes/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotesPage from "./page";

describe("NotesPage", () => {
  it("renders static field-note teasers", () => {
    const markup = renderToStaticMarkup(<NotesPage />);

    expect(markup).toContain("Field notes from the trust layer.");
    expect(markup).toContain("What counts as proof in a prior-auth workflow?");
    expect(markup).toContain("Patient consent as executable infrastructure");
    expect(markup).toContain("Rewards without outcome bias");
    expect(markup).toContain("When instant payment needs a human checkpoint");
    expect(markup).toContain("A practical pattern for combining programmable settlement with explicit approval controls.");
  });
});
```

- [ ] **Step 2: Write failing about page test**

Create `src/apps/web/app/labs/about/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AboutPage from "./page";

describe("AboutPage", () => {
  it("renders the Labs method and partner CTA", () => {
    const markup = renderToStaticMarkup(<AboutPage />);

    expect(markup).toContain("How Operon Labs works.");
    expect(markup).toContain("Bring a workflow");
    expect(markup).toContain("Define the trust claim");
    expect(markup).toContain("Build the evidence path");
    expect(markup).toContain("Make it inspectable");
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
    expect(markup).toContain('href="/labs/experiments"');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/about/page.test.tsx
```

Expected: FAIL because both pages do not exist.

- [ ] **Step 4: Implement notes page**

Create `src/apps/web/app/labs/notes/page.tsx`:

```tsx
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
```

- [ ] **Step 5: Implement about page**

Create `src/apps/web/app/labs/about/page.tsx`:

```tsx
import Link from "next/link";

import { LabsHero, LabsPageShell } from "../../../components/labs-ui";
import { LabsSiteNav } from "../../../components/labs-site/LabsSiteNav";
import { aboutSteps } from "../../../components/labs-site/labs-site-content";

export default function AboutPage() {
  return (
    <LabsPageShell className="labs-magazine-page">
      <LabsSiteNav activeId="about" />

      <LabsHero compact eyebrow="About Labs" title="How Operon Labs works.">
        <p>
          Labs turns workflow friction into working prototypes with visible assumptions, policy-safe evidence, and
          inspectable controls.
        </p>
      </LabsHero>

      <section className="labs-magazine-process-list" aria-label="Operon Labs process">
        {aboutSteps.map((step, index) => (
          <article className="labs-magazine-process-step" key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="labs-magazine-cta" aria-labelledby="labs-about-cta-heading">
        <div>
          <span className="label">Build with Labs</span>
          <h2 id="labs-about-cta-heading">Bring a workflow, policy, consent problem, or trust gap.</h2>
          <p>We will turn it into a prototype that can be inspected, measured, and debated.</p>
        </div>
        <div className="labs-magazine-actions">
          <a className="primary-button" href="mailto:partners@operon.cloud">
            Discuss a workflow prototype
          </a>
          <Link className="primary-button secondary-button" href="/labs/experiments">
            Explore experiments
          </Link>
        </div>
      </section>
    </LabsPageShell>
  );
}
```

- [ ] **Step 6: Run notes and about tests to verify they pass**

Run:

```bash
npm test -- src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/about/page.test.tsx
```

Expected: PASS.

## Task 6: Magazine CSS and Draft CSS Cleanup

**Files:**
- Create: `src/apps/web/components/labs-site/labs-site-style.test.ts`
- Modify: `src/apps/web/app/styles.css`

- [ ] **Step 1: Write failing CSS namespace test**

Create `src/apps/web/components/labs-site/labs-site-style.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Labs magazine stylesheet", () => {
  it("uses the magazine namespace and removes the overloaded draft namespace", () => {
    const css = readRepoFile("src/apps/web/app/styles.css");

    expect(css).toContain(".labs-magazine-page");
    expect(css).toContain(".labs-magazine-nav");
    expect(css).toContain(".labs-magazine-portal-grid");
    expect(css).toContain(".labs-magazine-experiment-grid");
    expect(css).not.toContain(".labs-draft-page");
    expect(css).not.toContain(".labs-draft-domain-grid");
    expect(css).not.toContain(".labs-draft-pattern-list");
  });
});
```

- [ ] **Step 2: Run CSS namespace test to verify it fails**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-style.test.ts
```

Expected: FAIL because `styles.css` still contains `.labs-draft-*` rules and no `.labs-magazine-*` rules.

- [ ] **Step 3: Replace Labs route CSS**

In `src/apps/web/app/styles.css`, remove all `.labs-draft-*` rules and their media-query fragments. Add this CSS near the other route-specific sections:

```css
.labs-magazine-page {
  max-width: 1180px;
}

.labs-magazine-nav {
  align-items: center;
  border-bottom: 1px solid var(--op-line);
  display: grid;
  gap: 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 6px 0 14px;
}

.labs-magazine-brand,
.labs-magazine-demo-link,
.labs-magazine-nav-links a {
  font-family: var(--op-font-mono), ui-monospace, monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.labs-magazine-brand {
  color: var(--op-ink);
}

.labs-magazine-nav-links {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.labs-magazine-nav-links a,
.labs-magazine-demo-link {
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--op-muted);
  padding: 7px 10px;
}

.labs-magazine-nav-links a[aria-current="page"] {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(96, 165, 250, 0.18);
  color: var(--op-blue-2);
}

.labs-magazine-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.labs-magazine-feature {
  align-items: end;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.labs-magazine-feature h2,
.labs-magazine-teaser h2,
.labs-magazine-portal h2,
.labs-magazine-experiment-card h2,
.labs-magazine-note-card h2,
.labs-magazine-process-step h2,
.labs-magazine-cta h2 {
  color: var(--op-ink);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.14;
  margin: 0;
}

.labs-magazine-feature p,
.labs-magazine-teaser p,
.labs-magazine-portal p,
.labs-magazine-experiment-card p,
.labs-magazine-theme-card p,
.labs-magazine-note-card p,
.labs-magazine-process-step p,
.labs-magazine-cta p {
  color: var(--op-muted);
  line-height: 1.55;
  margin: 0;
}

.labs-magazine-feature div {
  display: grid;
  gap: 10px;
}

.labs-magazine-teaser-grid,
.labs-magazine-portal-grid,
.labs-magazine-experiment-grid,
.labs-magazine-theme-grid,
.labs-magazine-note-grid,
.labs-magazine-process-list {
  display: grid;
  gap: 14px;
}

.labs-magazine-teaser-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.labs-magazine-portal-grid,
.labs-magazine-theme-grid,
.labs-magazine-note-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.labs-magazine-experiment-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.labs-magazine-process-list {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.labs-magazine-teaser,
.labs-magazine-portal,
.labs-magazine-experiment-card,
.labs-magazine-theme-card,
.labs-magazine-note-card,
.labs-magazine-process-step {
  background: rgba(10, 15, 31, 0.72);
  border: 1px solid var(--op-line);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  padding: 18px;
}

.labs-magazine-portal span,
.labs-magazine-process-step span,
.labs-magazine-method-list span {
  color: var(--op-muted-2);
  font-family: var(--op-font-mono), ui-monospace, monospace;
  font-size: 12px;
}

.labs-magazine-experiment-card em {
  color: var(--op-green-2);
  font-family: var(--op-font-mono), ui-monospace, monospace;
  font-size: 11px;
  font-style: normal;
  text-transform: uppercase;
}

.labs-magazine-method-list {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.labs-magazine-method-list li {
  align-items: center;
  border: 1px solid var(--op-line);
  border-radius: 8px;
  display: flex;
  gap: 10px;
  min-height: 62px;
  padding: 12px;
}

.labs-magazine-method-list strong {
  color: var(--op-ink-2);
  font-size: 13px;
}

.labs-magazine-cta {
  align-items: center;
  background: rgba(5, 8, 22, 0.72);
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 8px;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 20px;
}

@media (max-width: 860px) {
  .labs-magazine-nav,
  .labs-magazine-feature,
  .labs-magazine-cta {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .labs-magazine-nav-links {
    justify-content: start;
  }

  .labs-magazine-portal-grid,
  .labs-magazine-theme-grid,
  .labs-magazine-note-grid,
  .labs-magazine-process-list,
  .labs-magazine-method-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .labs-magazine-teaser-grid,
  .labs-magazine-portal-grid,
  .labs-magazine-experiment-grid,
  .labs-magazine-theme-grid,
  .labs-magazine-note-grid,
  .labs-magazine-process-list,
  .labs-magazine-method-list {
    grid-template-columns: 1fr;
  }

  .labs-magazine-feature h2,
  .labs-magazine-teaser h2,
  .labs-magazine-portal h2,
  .labs-magazine-experiment-card h2,
  .labs-magazine-note-card h2,
  .labs-magazine-process-step h2,
  .labs-magazine-cta h2 {
    font-size: 21px;
  }
}
```

- [ ] **Step 4: Run CSS namespace test to verify it passes**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-style.test.ts
```

Expected: PASS.

## Task 7: Full Verification and Browser Review

**Files:**
- Verify all files changed in Tasks 1-6.

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

- [ ] **Step 3: Verify browser rendering**

Open and inspect these pages:

```text
http://127.0.0.1:3210/labs
http://127.0.0.1:3210/labs/experiments
http://127.0.0.1:3210/labs/themes
```

Check each at desktop `1280x900` and mobile `390x844`:

- no horizontal overflow
- nav wraps cleanly
- buttons fit
- cards do not overlap
- `/labs` first viewport is sparse and directional
- `/labs/experiments` shows four current experiments
- `/labs/themes` carries the six-domain taxonomy

- [ ] **Step 4: Commit scoped implementation**

Run:

```bash
git add docs/superpowers/plans/2026-05-30-operon-labs-magazine-ia.md src/apps/web/components/labs-site src/apps/web/app/labs src/apps/web/app/styles.css
git commit -m "feat: add Operon Labs magazine pages"
```

Expected: commit includes only the Magazine Lab plan, Labs site shared module, Labs route pages/tests, and stylesheet changes. Existing unrelated appeals edits remain unstaged.
