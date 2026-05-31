# Operon Labs Magazine IA Design

## Goal

Replace the overloaded single-page `/labs` draft with a multi-page "Magazine Lab" experience. The homepage should create curiosity and establish taste. Deeper strategy, taxonomy, and proof points should move into subpages.

This spec supersedes `docs/superpowers/specs/2026-05-30-operon-labs-website-draft-design.md` for the next implementation pass.

## Diagnosis

The current `/labs` page puts too much conceptual weight in one view:

- six research domains
- seven operational trust questions
- three platform layers
- seven prototype-pattern steps
- four current experiments
- partner CTA

That may be strategically accurate, but it reads like a compressed product strategy document. It does not yet have the "coolness factor" of a Labs page. Strong Labs and research pages usually do the opposite: they lead with a memorable idea, feature one artifact, and route depth into projects, posts, themes, publications, or people.

## Positioning Decision

Use Page A from the brainstorm: **Magazine Lab**.

Core headline:

```text
The lab for verifiable healthcare operations.
```

Primary supporting line:

```text
Operon Labs prototypes trust, consent, identity, and value-flow systems for the workflows that decide care.
```

Tone:

- editorial, sparse, confident
- experimental but serious
- healthcare-specific without sounding like a compliance brochure
- cool because it shows working artifacts, not because it over-explains the taxonomy

## Site Map

Create real subpages now:

```text
/labs
/labs/experiments
/labs/themes
/labs/notes
/labs/about
```

The current product-demo routes remain unchanged:

```text
/provider-documentation
/delegate-um
/specialty-rx
/appeals
```

The new Labs pages link to those existing routes as live experiments.

## Shared Navigation

Add a Labs-specific navigation strip used across all Labs pages:

- `Labs` -> `/labs`
- `Experiments` -> `/labs/experiments`
- `Themes` -> `/labs/themes`
- `Notes` -> `/labs/notes`
- `About` -> `/labs/about`
- secondary link: `Demo catalog` -> `/`

The nav should feel like a small editorial masthead, not an enterprise navbar. Keep it compact and text-based.

## `/labs` Homepage

Purpose: create curiosity and route people to depth.

Content budget:

1. Hero
   - Eyebrow: `Operon Labs`
   - H1: `The lab for verifiable healthcare operations.`
   - Body: `Operon Labs prototypes trust, consent, identity, and value-flow systems for the workflows that decide care.`
   - Primary CTA: `Explore experiments` -> `/labs/experiments`
   - Secondary CTA: `Read field notes` -> `/labs/notes`

2. Featured experiment
   - Title: `Policy-triggered rewards for clinical operations`
   - Body: `A working testbed for evidence packets, SLA policies, human approval, and programmable settlement.`
   - CTA: `/labs/experiments`

3. Two editorial teasers
   - Field note teaser: `What counts as proof in a prior-auth workflow?`
   - Research theme teaser: `Patient consent as executable infrastructure.`

4. Three portal cards
   - `Experiments`: working demos people can inspect.
   - `Field notes`: short learnings from prototypes.
   - `Themes`: identity, consent, proof, payments.

Do not include the six-domain grid, seven-question list, platform-layer explanation, or full prototype pattern on the homepage.

## `/labs/experiments`

Purpose: show working artifacts and make the current demos feel intentional.

Page headline:

```text
Experiments you can inspect.
```

Page body:

```text
Each experiment starts with an operational trust gap, then turns it into a workflow, evidence packet, policy decision, and controlled execution path.
```

Content:

- Feature the current four demos as experiment cards.
- Use `demoScenarios` as the source for titles, submitters, purposes, slugs, and statuses.
- Add a short "experiment method" sidebar or strip:
  - workflow friction
  - trust claim
  - evidence model
  - policy decision
  - controlled execution

Experiment card framing:

- Provider Documentation Completeness: `Can better upstream evidence reduce avoidable prior-auth friction?`
- Delegate UM SLA Bonus: `Can delegated review quality be proven without relying on outcome incentives?`
- Specialty Rx Fulfillment SLA: `Can post-authorization fulfillment be measured as a trust-preserving workflow?`
- Appeals Packet Quality: `Can exception-path readiness be rewarded without touching appeal outcomes?`

## `/labs/themes`

Purpose: hold the deeper taxonomy that overloaded the first homepage.

Page headline:

```text
Research themes for trust-native healthcare operations.
```

Themes:

1. Trust & Evidence
   - signed events, proof packets, audit trails, AI accountability
2. Digital Identity
   - verifiable identities for patients, providers, plans, vendors, systems, and agents
3. Verifiable Consent
   - patient permissions, enterprise delegation, access scopes, revocation evidence
4. Incentives & Rewards
   - policy-based rewards for quality, timeliness, completeness, coordination
5. Instant Payments
   - programmable settlement, micropayments, reward rails, controlled value movement
6. Clinical Ops Agents
   - standards-aware workflow prototypes across prior authorization, pharmacy, appeals, and future operations

The page can use cards, but keep each card short. Each theme should feel like an entry point, not a whitepaper.

## `/labs/notes`

Purpose: make Labs feel alive and editorial.

Page headline:

```text
Field notes from the trust layer.
```

Initial note teasers can be static. They do not need full article pages yet.

Initial notes:

1. `What counts as proof in a prior-auth workflow?`
   - `A note on turning workflow metadata into policy-safe evidence.`
2. `Patient consent as executable infrastructure`
   - `Why consent should behave like an active control, not a scanned artifact.`
3. `Rewards without outcome bias`
   - `How to reward operational quality without tying incentives to clinical or financial outcomes.`
4. `When instant payment needs a human checkpoint`
   - `A practical pattern for combining programmable settlement with explicit approval controls.`

Each note teaser should show a short label such as `Field note`, `Pattern`, or `Question`.

## `/labs/about`

Purpose: explain how Labs works without crowding the homepage.

Page headline:

```text
How Operon Labs works.
```

Sections:

- `Bring a workflow`: partner or internal workflow friction enters as a concrete operating problem.
- `Define the trust claim`: the prototype states what must be proven, by whom, and under what authority.
- `Build the evidence path`: synthetic/demo-safe events, policies, and proof packets are modeled.
- `Make it inspectable`: the result is a working prototype with visible assumptions, controls, and open questions.

CTA:

- Primary: `Discuss a workflow prototype` -> `mailto:partners@operon.cloud`
- Secondary: `Explore experiments` -> `/labs/experiments`

## Visual Direction

Keep the existing dark Operon Labs visual language, but reduce density:

- large hero typography
- fewer cards per viewport
- more empty space
- one featured artifact near the top
- concise editorial labels
- cards as navigation surfaces, not content dumps
- no nested cards
- no decorative gradient orbs
- no full taxonomy on the first page

The homepage should feel closer to GitHub Next or Google Labs than an enterprise solution overview.

## Implementation Shape

Add focused page files:

```text
src/apps/web/app/labs/page.tsx
src/apps/web/app/labs/experiments/page.tsx
src/apps/web/app/labs/themes/page.tsx
src/apps/web/app/labs/notes/page.tsx
src/apps/web/app/labs/about/page.tsx
```

Add a small shared Labs site module:

```text
src/apps/web/components/labs-site/LabsSiteNav.tsx
src/apps/web/components/labs-site/labs-site-content.ts
```

Responsibilities:

- `LabsSiteNav.tsx`: common Labs masthead/nav across the five Labs pages.
- `labs-site-content.ts`: static arrays for nav items, research themes, note teasers, experiment framing, and about-process steps.

Reuse existing app primitives where helpful:

- `LabsPageShell`
- `LabsHero`
- `LabsProductFrame`
- `LabsPanel`
- `LabsBadge`
- `demoScenarios`

Add route-specific CSS to `src/apps/web/app/styles.css` under a new `.labs-magazine-*` namespace. Remove or stop using the earlier overloaded `.labs-draft-*` styles where possible during implementation.

## Testing Requirements

Add rendering tests for:

- `/labs`
- `/labs/experiments`
- `/labs/themes`
- `/labs/notes`
- `/labs/about`
- shared Labs nav/content module

Tests should verify:

- homepage does not render all six research themes
- homepage links to the four subpages
- experiments page renders all four `demoScenarios`
- themes page renders the six research themes
- notes page renders the four static note teasers
- about page renders the four process steps and partner CTA
- shared nav marks or exposes the expected links

Run:

```text
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Browser verification must check:

- `/labs` desktop and mobile
- `/labs/experiments` desktop and mobile
- one deep content page, preferably `/labs/themes`, desktop and mobile
- no horizontal overflow
- buttons and nav wrap cleanly on mobile
- first viewport of `/labs` feels sparse and directional

## Non-Goals

- Do not redesign the existing four demo routes.
- Do not replace the root homepage `/`.
- Do not add dynamic CMS, MDX, or article detail pages yet.
- Do not add backend APIs.
- Do not change incentive/payment/identity runtime behavior.
- Do not add real PHI or production claims.
- Do not make the Labs homepage a full product matrix.

## Acceptance Criteria

- `/labs` is noticeably lighter and more compelling than the current draft.
- `/labs` routes into real subpages instead of carrying all content itself.
- `/labs/experiments` presents the four existing demos as inspectable experiments.
- `/labs/themes` carries the deeper trust/identity/consent/incentive/payment taxonomy.
- `/labs/notes` gives Labs an editorial/research pulse.
- `/labs/about` explains the Labs method and partner engagement path.
- The design remains consistent with the current contract-incentives visual system.
- All verification commands and browser checks pass before implementation is marked complete.
