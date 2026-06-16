# Operon Labs Executive Proof Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the approved `/labs_v2/co-innovate` positioning into the real `/labs` site as an executive proof studio.

**Architecture:** Keep the existing static Labs content module and server-rendered Next.js route structure. Replace `Briefs` and `Method` with `Signals` and `Co-Innovate`, redirect retired routes, and reuse the existing `labs-proof-*` visual system.

**Tech Stack:** Next.js App Router, React server components, Vitest static render tests, shared CSS in `src/apps/web/app/styles.css`.

---

### Task 1: Content Model And Navigation

**Files:**
- Modify: `src/apps/web/components/labs-site/labs-site-content.test.ts`
- Modify: `src/apps/web/components/labs-site/LabsSiteNav.test.tsx`
- Modify: `src/apps/web/components/labs-site/labs-site-content.ts`

- [ ] **Step 1: Write failing tests**

Update tests to expect:

```text
/labs
/labs/proofs
/labs/themes
/labs/signals
/labs/co-innovate
```

Expected labels:

```text
Overview, Proofs, Themes, Signals, Co-Innovate
```

Also assert that content exports include:

- `signals`
- `coInnovateOffer`
- `coInnovateSteps`
- no `briefs` or `methodSteps` imports in tests

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx
```

Expected: FAIL because current nav still contains `Briefs` and `Method`.

- [ ] **Step 3: Implement content changes**

Update `labs-site-content.ts`:

- `LabsNavItem["id"]`: `"overview" | "proofs" | "themes" | "signals" | "co-innovate"`
- portal cards: `Proofs`, `Themes`, `Signals`, `Co-Innovate`
- add `signals`
- add `coInnovateOffer`
- add `coInnovateSteps`
- keep `proofCards`, `proofMethodSteps`, `platformSpine`, `researchThemes`

- [ ] **Step 4: Verify green**

Run the same focused content/nav test command. Expected: PASS.

### Task 2: Homepage, Signals, Co-Innovate, And Theme Claim Order

**Files:**
- Modify: `src/apps/web/app/labs/page.test.tsx`
- Modify: `src/apps/web/app/labs/themes/page.test.tsx`
- Create: `src/apps/web/app/labs/signals/page.test.tsx`
- Create: `src/apps/web/app/labs/co-innovate/page.test.tsx`
- Modify: `src/apps/web/app/labs/page.tsx`
- Modify: `src/apps/web/app/labs/themes/page.tsx`
- Create: `src/apps/web/app/labs/signals/page.tsx`
- Create: `src/apps/web/app/labs/co-innovate/page.tsx`

- [ ] **Step 1: Write failing page tests**

Assert:

- `/labs` renders `Where healthcare operations become provable.`
- `/labs` links to `/labs/co-innovate`, `/labs/proofs`, `/labs/themes`, and `/labs/signals`
- `/labs/co-innovate` renders `Bring a workflow. Leave with a proof.`
- `/labs/signals` renders `Forward intelligence for healthcare operations leaders.`
- `/labs/themes` renders theme claims as headings

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/signals/page.test.tsx src/apps/web/app/labs/co-innovate/page.test.tsx
```

Expected: FAIL because new route files do not exist and homepage copy has not changed.

- [ ] **Step 3: Implement pages**

Use existing components:

- `LabsPageShell`
- `LabsHero`
- `LabsProductFrame`
- `LabsBadge`
- `LabsSiteNav`

Do not add new visual abstractions.

- [ ] **Step 4: Verify green**

Run the same focused page test command. Expected: PASS.

### Task 3: Redirect Retired Routes

**Files:**
- Modify: `src/apps/web/app/labs/notes/page.test.tsx`
- Modify: `src/apps/web/app/labs/about/page.test.tsx`
- Create: `src/apps/web/app/labs/briefs/page.test.tsx` or modify existing
- Create: `src/apps/web/app/labs/method/page.test.tsx` or modify existing
- Modify: redirect route pages

- [ ] **Step 1: Write failing redirect expectations**

Expected redirects:

```text
/labs/experiments -> /labs/proofs
/labs/notes       -> /labs/signals
/labs/briefs      -> /labs/signals
/labs/about       -> /labs/co-innovate
/labs/method      -> /labs/co-innovate
```

- [ ] **Step 2: Verify red**

Run retired route tests. Expected: FAIL until route files redirect.

- [ ] **Step 3: Implement redirects**

Use `redirect()` from `next/navigation` in each retired page.

- [ ] **Step 4: Verify green**

Run retired route tests. Expected: PASS.

### Task 4: Final Verification

**Files:**
- No new files unless tests expose a gap.

- [ ] **Step 1: Run focused Labs suite**

```bash
npm test -- src/apps/web/components/labs-site/labs-site-content.test.ts src/apps/web/components/labs-site/LabsSiteNav.test.tsx src/apps/web/components/labs-site/labs-site-style.test.ts src/apps/web/app/labs/page.test.tsx src/apps/web/app/labs/proofs/page.test.tsx src/apps/web/app/labs/themes/page.test.tsx src/apps/web/app/labs/signals/page.test.tsx src/apps/web/app/labs/co-innovate/page.test.tsx src/apps/web/app/labs/experiments/page.test.tsx src/apps/web/app/labs/notes/page.test.tsx src/apps/web/app/labs/briefs/page.test.tsx src/apps/web/app/labs/about/page.test.tsx src/apps/web/app/labs/method/page.test.tsx
```

- [ ] **Step 2: Run project checks**

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

- [ ] **Step 3: Browser QA**

Open:

```text
http://localhost:3000/labs
http://localhost:3000/labs/co-innovate
http://localhost:3000/labs/signals
```

Verify H1s, nav active states, redirects, and no horizontal overflow.

- [ ] **Step 4: Commit scoped changes**

Stage only Labs and docs changes. Do not stage unrelated Appeals edits or untracked `/labs_v2` prototype files.
