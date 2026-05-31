# Operon Labs Proof Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the existing `/labs` IA from Magazine Lab into the approved Proof Studio direction.

**Architecture:** Keep the current static Next.js Labs section and shared content module. Replace the old `experiments/notes/about` content model with `proofs/briefs/method`, redirect old routes to the new routes, and rename page-specific CSS from `labs-magazine-*` to `labs-proof-*`.

**Tech Stack:** Next.js App Router, React server components, Vitest static render tests, shared CSS in `src/apps/web/app/styles.css`.

---

### Task 1: Update Content Model And Nav Tests

**Files:**
- Modify: `src/apps/web/components/labs-site/labs-site-content.test.ts`
- Modify: `src/apps/web/components/labs-site/LabsSiteNav.test.tsx`
- Modify: `src/apps/web/components/labs-site/labs-site-content.ts`
- Modify: `src/apps/web/components/labs-site/LabsSiteNav.tsx`

- [ ] **Step 1: Write failing content tests**

Replace the old Magazine Lab expectations in `src/apps/web/components/labs-site/labs-site-content.test.ts` with Proof Studio expectations:

```ts
import { describe, expect, it } from "vitest";

import {
  briefs,
  labsNavItems,
  labsPortalCards,
  methodSteps,
  platformSpine,
  proofCards,
  proofMethodSteps,
  researchThemes,
  type ProofSlug
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines Proof Studio navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/proofs",
      "/labs/themes",
      "/labs/briefs",
      "/labs/method"
    ]);

    expect(labsNavItems.map((item) => item.label)).toEqual(["Labs", "Proofs", "Themes", "Briefs", "Method"]);
    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/proofs",
      "/labs/themes",
      "/labs/briefs",
      "/labs/method"
    ]);
  });

  it("stores Proof Studio content away from the homepage", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Trust & Evidence",
      "Digital Identity & Authority",
      "Verifiable Consent & Delegation",
      "Incentives & Rewards",
      "Instant Settlement & Value Flow",
      "Clinical Ops Agents & AI Proof"
    ]);
    expect(briefs).toHaveLength(5);
    expect(methodSteps.map((step) => step.title)).toEqual([
      "Select an executive-pressure workflow",
      "Define the proof claim",
      "Model identity, consent, policy, and evidence",
      "Build an inspectable proof model",
      "Decide the next path"
    ]);
    expect(platformSpine.map((item) => item.product)).toEqual(["ID.Operon", "Trust.Operon", "Pulse.Operon"]);
    expect(proofMethodSteps).toEqual(["Actor", "Evidence", "Policy", "Control", "Settlement", "Audit"]);
  });

  it("frames every current proof with an executive question and evidence claim", () => {
    const expectedSlugs: ProofSlug[] = ["provider-documentation", "delegate-um", "specialty-rx", "appeals"];

    expect(proofCards.map((proof) => proof.slug)).toEqual(expectedSlugs);
    expect(proofCards.map((proof) => proof.title)).toEqual([
      "Prior Auth Evidence Readiness",
      "Delegated UM Quality Proof",
      "Specialty Rx Fulfillment Proof",
      "Appeals Readiness Proof"
    ]);
    expect(proofCards[0].executiveQuestion).toContain("upstream evidence");
    expect(proofCards[3].whatIsProven).toContain("receipt-based SLA");
  });
});
```

- [ ] **Step 2: Write failing nav test**

Replace `src/apps/web/components/labs-site/LabsSiteNav.test.tsx` with:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsSiteNav } from "./LabsSiteNav";

describe("LabsSiteNav", () => {
  it("renders a compact Proof Studio nav with all Labs links", () => {
    const markup = renderToStaticMarkup(<LabsSiteNav activeId="themes" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain('href="/labs"');
    expect(markup).toContain('href="/labs/proofs"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/briefs"');
    expect(markup).toContain('href="/labs/method"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Demo catalog");
    expect(markup).not.toContain("Experiments");
    expect(markup).not.toContain("Notes");
    expect(markup).toMatch(/<a\b(?=[^>]*href="\/labs\/themes")(?=[^>]*aria-current="page")[^>]*>Themes<\/a>/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx
```

Expected: FAIL because the content module still exports the old Magazine Lab content and route names.

- [ ] **Step 4: Implement content module and nav**

Update `src/apps/web/components/labs-site/labs-site-content.ts` to export:

- `LabsNavItem` id union: `"labs" | "proofs" | "themes" | "briefs" | "method"`
- `labsNavItems` with `/labs/proofs`, `/labs/briefs`, `/labs/method`
- `labsPortalCards` with four cards: Proofs, Themes, Briefs, Method
- `proofCards` with the four approved proof models
- `researchThemes` with the six revised themes
- `briefs` with five executive brief teasers
- `methodSteps` with five method steps
- `platformSpine` with ID.Operon, Trust.Operon, Pulse.Operon
- `proofMethodSteps` with `Actor`, `Evidence`, `Policy`, `Control`, `Settlement`, `Audit`

Update `src/apps/web/components/labs-site/LabsSiteNav.tsx` only as needed to use the new nav item type and class namespace later.

- [ ] **Step 5: Run tests and verify green**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx
```

Expected: PASS.

### Task 2: Update Labs Pages And Route Tests

**Files:**
- Modify: `src/apps/web/app/labs/page.test.tsx`
- Create: `src/apps/web/app/labs/proofs/page.test.tsx`
- Modify: `src/apps/web/app/labs/themes/page.test.tsx`
- Create: `src/apps/web/app/labs/briefs/page.test.tsx`
- Create: `src/apps/web/app/labs/method/page.test.tsx`
- Modify: `src/apps/web/app/labs/page.tsx`
- Create: `src/apps/web/app/labs/proofs/page.tsx`
- Modify: `src/apps/web/app/labs/themes/page.tsx`
- Create: `src/apps/web/app/labs/briefs/page.tsx`
- Create: `src/apps/web/app/labs/method/page.tsx`

- [ ] **Step 1: Write failing page tests**

Update page tests so they assert:

- `/labs` renders `Proof studio for healthcare operations.`
- `/labs` links to `/labs/proofs`, `/labs/themes`, `/labs/briefs`, and `/labs/method`
- `/labs/proofs` renders all four proof names and source route links
- `/labs/themes` renders the six revised theme titles
- `/labs/briefs` renders `Briefs from the healthcare proof layer.`
- `/labs/method` renders `How Labs turns workflows into proof.`

- [ ] **Step 2: Run route tests and verify red**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/proofs/page.test.tsx src/apps/web/app/labs/briefs/page.test.tsx src/apps/web/app/labs/method/page.test.tsx
```

Expected: FAIL because the new route files do not exist yet and old page copy still renders.

- [ ] **Step 3: Implement pages**

Update the homepage and add the new subpages using existing `LabsPageShell`, `LabsHero`, `LabsProductFrame`, `LabsBadge`, `LabsSiteNav`, and the shared content exports.

Required homepage sections:

- hero
- proof-system statement
- featured proof model
- ID/Trust/Pulse spine
- four portal cards

Required subpage sections:

- `/labs/proofs`: proof method strip and proof cards
- `/labs/themes`: revised theme cards
- `/labs/briefs`: executive brief cards
- `/labs/method`: five method steps and mailto CTA

- [ ] **Step 4: Run route tests and verify green**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/proofs/page.test.tsx src/apps/web/app/labs/briefs/page.test.tsx src/apps/web/app/labs/method/page.test.tsx
```

Expected: PASS.

### Task 3: Redirect Old Magazine IA Routes

**Files:**
- Modify: `src/apps/web/app/labs/experiments/page.tsx`
- Modify: `src/apps/web/app/labs/notes/page.tsx`
- Modify: `src/apps/web/app/labs/about/page.tsx`
- Modify or delete old tests:
  - `src/apps/web/app/labs/experiments/page.test.tsx`
  - `src/apps/web/app/labs/notes/page.test.tsx`
  - `src/apps/web/app/labs/about/page.test.tsx`

- [ ] **Step 1: Replace old route tests with source checks**

Old route pages should become tiny redirect pages:

```tsx
import { redirect } from "next/navigation";

export default function ExperimentsRedirectPage() {
  redirect("/labs/proofs");
}
```

Tests should read source and assert the redirect target because rendering a Next redirect throws intentionally.

- [ ] **Step 2: Run old route tests and verify red**

Run:

```bash
npm test -- src/apps/web/app/labs/experiments/page.test.tsx src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/about/page.test.tsx
```

Expected: FAIL until the old pages redirect.

- [ ] **Step 3: Implement redirects**

Replace old pages with:

- `/labs/experiments` redirects to `/labs/proofs`
- `/labs/notes` redirects to `/labs/briefs`
- `/labs/about` redirects to `/labs/method`

- [ ] **Step 4: Run old route tests and verify green**

Run:

```bash
npm test -- src/apps/web/app/labs/experiments/page.test.tsx src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/about/page.test.tsx
```

Expected: PASS.

### Task 4: Rename Labs CSS Namespace And Verify Styling Hooks

**Files:**
- Modify: `src/apps/web/app/styles.css`
- Modify: `src/apps/web/components/labs-site/labs-site-style.test.ts`
- Modify page class names from `labs-magazine-*` to `labs-proof-*`

- [ ] **Step 1: Write failing CSS namespace test**

Update `src/apps/web/components/labs-site/labs-site-style.test.ts` to assert:

```ts
expect(css).toContain(".labs-proof-page");
expect(css).toContain(".labs-proof-nav");
expect(css).toContain(".labs-proof-portal-grid");
expect(css).toContain(".labs-proof-proof-grid");
expect(css).not.toMatch(/\.labs-magazine-/);
expect(css).not.toMatch(/\.labs-draft-/);
```

- [ ] **Step 2: Run style test and verify red**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-style.test.ts
```

Expected: FAIL because CSS still uses `.labs-magazine-*`.

- [ ] **Step 3: Rename CSS and class usages**

In `src/apps/web/app/styles.css`, rename `.labs-magazine-*` selectors to `.labs-proof-*`. Add small new selectors only where needed for the proof-system strip, platform spine, and proof cards.

In page components and `LabsSiteNav.tsx`, update class names to the new namespace.

- [ ] **Step 4: Run style test and page tests**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-style.test.ts src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/proofs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/briefs/page.test.tsx src/apps/web/app/labs/method/page.test.tsx
```

Expected: PASS.

### Task 5: Full Verification And Browser QA

**Files:**
- No new files expected unless browser QA exposes a small CSS fix.

- [ ] **Step 1: Run focused Labs tests**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx src/apps/web/components/labs-site/labs-site-style.test.ts src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/proofs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/briefs/page.test.tsx src/apps/web/app/labs/method/page.test.tsx src/apps/web/app/labs/experiments/page.test.tsx src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/about/page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run standard verification**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Browser-check key routes**

Start the dev server on an available port:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open in the browser:

- `http://127.0.0.1:3001/labs`
- `http://127.0.0.1:3001/labs/proofs`
- `http://127.0.0.1:3001/labs/themes`
- `http://127.0.0.1:3001/labs/briefs`
- `http://127.0.0.1:3001/labs/method`

Check desktop and mobile widths for obvious overflow, dead links, missing nav, or blank rendering.

## Plan Self-Review

- Spec coverage: the plan covers the new IA, copy model, routes, redirects, CSS namespace, tests, and browser verification.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. The plan intentionally leaves implementation code to task execution, but every task names exact files, assertions, commands, and expected results.
- Type consistency: `ProofSlug`, `proofCards`, `briefs`, `methodSteps`, `platformSpine`, and `proofMethodSteps` are used consistently across tests and planned implementation.
