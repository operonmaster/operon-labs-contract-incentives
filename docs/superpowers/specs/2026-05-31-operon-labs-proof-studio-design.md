# Operon Labs Proof Studio Design

## Goal

Reposition the current Operon Labs website draft from a generic "Magazine Lab" into an executive-grade proof studio for healthcare operations.

The earlier multi-page direction solved the first problem, which was density. It reduced the overloaded homepage and moved detail into subpages. The new problem is positioning. The current language still feels too generic for Operon and too soft for a CIO, Head of Innovation, clinical operations executive, or health-tech business leader.

This spec supersedes:

- `docs/superpowers/specs/2026-05-30-operon-labs-magazine-ia-design.md`
- `docs/superpowers/specs/2026-05-30-operon-labs-website-draft-design.md`

## Critical Diagnosis

The current implementation uses:

```text
/labs
/labs/experiments
/labs/themes
/labs/notes
/labs/about
```

That structure is cleaner than the original one-page draft, but it borrows too much from consumer and developer labs sites. It creates curiosity, but it does not yet create executive confidence.

Problems to fix:

- `Experiments` sounds tentative. It implies internal exploration, not a controlled proof model an executive can sponsor.
- `Notes` is ambiguous. It could mean blog posts, scraps, changelog entries, or research diary content.
- `About` is too generic. The page should communicate a method, not company background.
- The homepage headline is too quiet. `The lab for verifiable healthcare operations` is accurate, but it does not say why Operon Labs is unique.
- The draft underuses Operon's strongest existing language: proof, workflow visibility, operational baselines, AI impact, identity, consent, auditability, and value flow.
- The four current demos are still framed as "experiments" too prominently. They should become proof examples inside a broader Labs agenda.

## Source Alignment

The revised Labs site must inherit the strongest language already present in Operon's ecosystem.

From the corporate site:

- `Live Operational Visibility for Clinical Workflows`
- `See where cases stall, what they cost, and whether AI delivers`
- `See It. Prove It. Act on It.`
- `From Pilot to Proof`
- `Proof beats promises`
- `Operational impact measurement`

From TrustOperon:

- healthcare needs trust, not just interoperability
- transparent health data exchange
- traceability, fraud resistance, patient privacy expectations
- a proxy layer that mediates, verifies, and logs every transaction
- audit trails, smart access controls, monetization logic

From Operon product architecture:

- `ID.Operon`: establishes who can act through identity, signatures, authority, and consent.
- `Trust.Operon`: proves what happened through signed events, immutable audit, shared consensus, and evidence trails.
- `Pulse.Operon`: connects measurable work to incentives, rewards, usage, revenue, and settlement.

From this Labs repo:

- the shared incentive layer evaluates policy-safe evidence, maps approved actors to wallets, applies payment controls, and records auditable settlement
- current use cases prove quality, timeliness, completeness, and readiness without tying incentives to prohibited clinical or financial outcomes
- the technical pattern is evidence -> policy -> control -> settlement -> audit, not a payment bot

## Audience

Primary audience:

- CIOs
- Chief Digital Officers
- Heads of Innovation
- clinical operations executives
- payer transformation leaders
- health-tech platform executives
- strategic partners evaluating whether Operon is differentiated

Audience need:

They are not looking for a casual research page. They want to see a credible place where hard healthcare innovation problems become inspectable, governed, and fundable proof models.

The desired reaction:

```text
This is not another AI demo page. This is a place where identity, consent, evidence, incentives, and settlement are being turned into operational proof systems.
```

## Positioning Decision

Use this primary frame:

```text
Operon Labs is the proof studio for next-generation healthcare operations.
```

Primary homepage headline:

```text
Proof studio for healthcare operations.
```

Supporting line:

```text
Operon Labs turns identity, consent, evidence, incentives, and instant settlement into working proof models for clinical operations leaders.
```

Strategic thesis:

```text
Healthcare innovation does not fail because teams lack pilots. It fails because leaders cannot prove what changed, who acted, what policy applied, what evidence supports the claim, and what value should move next. Operon Labs builds the proof models behind that future.
```

Tone:

- executive, sharp, and practical
- forward-looking without vague futurism
- technical enough to feel credible
- business-readable enough for innovation and operations leaders
- cool because it shows governed proof systems, not because it uses playful lab language

Avoid these visible labels:

- `Experiments`
- `Notes`
- `Sandbox`
- `Playground`
- `Lab notebook`
- `Research domains`
- `Hack`

Use these labels:

- `Proofs`
- `Themes`
- `Briefs`
- `Method`
- `Proof Portfolio`
- `Proof Model`
- `Operating Thesis`
- `Trust System`
- `Controlled Settlement`
- `Executive Brief`

## Site Map

Create the revised Labs IA:

```text
/labs
/labs/proofs
/labs/themes
/labs/briefs
/labs/method
```

Retire or redirect the older Magazine IA routes:

```text
/labs/experiments -> /labs/proofs
/labs/notes       -> /labs/briefs
/labs/about       -> /labs/method
```

The current product-demo routes remain unchanged:

```text
/provider-documentation
/delegate-um
/specialty-rx
/appeals
```

The demo routes are proof artifacts. They should not define the full Labs taxonomy.

## Navigation

Labs-specific navigation:

- `Labs` -> `/labs`
- `Proofs` -> `/labs/proofs`
- `Themes` -> `/labs/themes`
- `Briefs` -> `/labs/briefs`
- `Method` -> `/labs/method`
- secondary link: `Demo catalog` -> `/`

Navigation should feel like a serious innovation property, not an editorial masthead. It should be compact, stable, and direct.

## `/labs` Homepage

Purpose:

Create immediate executive intrigue and route people into the proof portfolio, themes, and method without overloading the first page.

Content budget:

1. Hero
   - Eyebrow: `Operon Labs`
   - H1: `Proof studio for healthcare operations.`
   - Body: `Operon Labs turns identity, consent, evidence, incentives, and instant settlement into working proof models for clinical operations leaders.`
   - Primary CTA: `View proof portfolio` -> `/labs/proofs`
   - Secondary CTA: `Explore themes` -> `/labs/themes`

2. Proof-system statement
   - Title: `From pilot activity to operational proof`
   - Body should contrast normal innovation theater with Operon's proof model:
     - who acted
     - under what authority
     - what evidence exists
     - what policy applied
     - what value moved
     - what can be audited

3. Featured proof model
   - Title: `Policy-bound clinical operations rewards`
   - Body: `A working proof model for evidence packets, SLA policies, human approval, controlled settlement, and audit-ready incentive records.`
   - CTA: `Open proof` -> `/labs/proofs`

4. Platform spine
   - `ID.Operon`: who can act
   - `Trust.Operon`: what happened
   - `Pulse.Operon`: what value moves next

5. Portal cards
   - `Proofs`: working proof models you can inspect
   - `Themes`: the trust infrastructure agenda
   - `Briefs`: executive signals and operating patterns
   - `Method`: how Labs turns a workflow into proof

Do not put all six themes, all four proof cards, all brief teasers, and the full method on the homepage. The homepage should make the idea memorable, not complete the whole strategy.

## `/labs/proofs`

Purpose:

Show that Labs produces serious, inspectable proof models. This replaces `/labs/experiments`.

Page headline:

```text
Proofs you can inspect.
```

Page body:

```text
Each proof starts with a healthcare operations claim, then makes the actors, evidence, policies, controls, settlement path, and audit trail visible.
```

Current proof cards:

1. `Prior Auth Evidence Readiness`
   - Source route: `/provider-documentation`
   - Executive question: `Can upstream evidence reduce avoidable prior-auth friction before review starts?`
   - What is proven: clean documentation, PAS submission, policy-safe evidence, eligible or blocked incentive.

2. `Delegated UM Quality Proof`
   - Source route: `/delegate-um`
   - Executive question: `Can delegated review quality be measured without rewarding approvals, denials, savings, or utilization?`
   - What is proven: timely review, complete rationale, quality audit, approved submitter, payment controls.

3. `Specialty Rx Fulfillment Proof`
   - Source route: `/specialty-rx`
   - Executive question: `Can post-authorization fulfillment be measured as a trust-preserving operating workflow?`
   - What is proven: clear-to-fill readiness, shipment scheduling, delivery confirmation, exception separation, cold-chain evidence.

4. `Appeals Readiness Proof`
   - Source route: `/appeals`
   - Executive question: `Can exception-path readiness be rewarded without touching appeal outcomes?`
   - What is proven: receipt-based SLA, acknowledgement, required documents, clinical rationale, policy citation, evidence index.

Card fields:

- proof title
- executive question
- what is proven
- control surface
- source workflow link
- optional status from existing `demoScenarios`

Do not call these pillars. Do not imply these four are the full Operon Labs agenda.

## `/labs/themes`

Purpose:

Keep the broader agenda, but make it more executive and more connected to Operon's product architecture.

Page headline:

```text
Themes for trust-native healthcare operations.
```

Themes:

1. `Trust & Evidence`
   - Signed events, proof packets, audit trails, provenance, AI accountability.
   - Executive claim: healthcare leaders need shared evidence, not screenshots and retrospective reconciliation.

2. `Digital Identity & Authority`
   - Verifiable identities for patients, providers, plans, vendors, systems, and agents.
   - Executive claim: every action needs a reliable actor and authority model.

3. `Verifiable Consent & Delegation`
   - Patient permissions, enterprise delegation, access scopes, revocation, approval records.
   - Executive claim: consent should act like runtime infrastructure, not static paperwork.

4. `Incentives & Rewards`
   - Policy-based rewards for quality, timeliness, completeness, coordination, and evidence readiness.
   - Executive claim: value should move when contract-defined operational quality is proven.

5. `Instant Settlement & Value Flow`
   - Programmable settlement, micropayments, reward rails, usage billing, capped exposure, payment controls.
   - Executive claim: payment can be fast only when the proof and controls are explicit.

6. `Clinical Ops Agents & AI Proof`
   - Standards-aware agents across prior authorization, pharmacy, appeals, delegated operations, and future workflows.
   - Executive claim: AI does not scale on output. It scales when operations can prove what changed.

## `/labs/briefs`

Purpose:

Replace vague `Notes` with an executive-readable content surface. Briefs should feel like short, sharp ideas a CIO or innovation leader would send to a colleague.

Page headline:

```text
Briefs from the healthcare proof layer.
```

Initial brief teasers:

1. `From AI pilot to operational proof`
   - `Why clinical operations leaders need case-level evidence before they can scale automation.`

2. `Consent as executable infrastructure`
   - `Why patient and enterprise permissions should behave like active controls, not scanned artifacts.`

3. `Rewards without outcome bias`
   - `How to reward operational quality without tying incentives to clinical or financial outcomes.`

4. `Why screenshots do not prove healthcare operations`
   - `The case for signed workflow events, policy-safe evidence, and shared audit trails.`

5. `When instant settlement needs a human checkpoint`
   - `A practical pattern for combining programmable settlement with explicit approval controls.`

Brief labels:

- `Executive brief`
- `Operating pattern`
- `Trust signal`
- `Proof model`

Do not add full article pages in this implementation unless the user asks. Static teasers are enough for this pass.

## `/labs/method`

Purpose:

Replace generic `About` with a page that shows how Labs works and why it is serious.

Page headline:

```text
How Labs turns workflows into proof.
```

Method steps:

1. `Select an executive-pressure workflow`
   - Start with a real operating problem: prior authorization friction, delegated vendor performance, specialty pharmacy handoffs, appeals readiness, consent enforcement, AI impact, or value-flow reconciliation.

2. `Define the proof claim`
   - State what must be proven, who must prove it, under what authority, and what would count as sufficient evidence.

3. `Model identity, consent, policy, and evidence`
   - Connect the actor model, consent or delegation boundary, policy controls, evidence packet, and audit event sequence.

4. `Build an inspectable proof model`
   - Produce a working workflow surface with visible controls, assumptions, policy decisions, and audit trail.

5. `Decide the next path`
   - Retire the idea, turn it into a partner proof, map it into ID.Operon, Trust.Operon, or Pulse.Operon, or productize it as a future Operon capability.

CTA:

- Primary: `Discuss a proof model` -> `mailto:partners@operon.cloud`
- Secondary: `View proof portfolio` -> `/labs/proofs`

## Visual Direction

Keep the current dark Operon Labs visual system, but shift the page from "editorial magazine" to "executive proof studio."

Visual principles:

- first viewport should immediately signal Operon Labs, proof, healthcare operations, and executive relevance
- show one strong proof-system visual near the top: actor -> evidence -> policy -> control -> settlement -> audit
- use console-like product surfaces and proof cards instead of long explanatory grids
- keep section count low on the homepage
- use compact cards and restrained accent colors
- keep the existing no-nested-card rule
- avoid decorative gradient-orb backgrounds
- avoid blog-like layouts for Briefs
- use real words over cute category labels

Recommended homepage rhythm:

1. Large hero with one concise thesis.
2. Proof-system strip or diagram.
3. Featured proof model.
4. ID/Trust/Pulse spine.
5. Four portal cards.

## Implementation Shape

This spec is design-only until the user approves it.

Expected implementation changes later:

Add or update route files:

```text
src/apps/web/app/labs/page.tsx
src/apps/web/app/labs/proofs/page.tsx
src/apps/web/app/labs/themes/page.tsx
src/apps/web/app/labs/briefs/page.tsx
src/apps/web/app/labs/method/page.tsx
```

Redirect or remove old conceptual routes:

```text
src/apps/web/app/labs/experiments/page.tsx
src/apps/web/app/labs/notes/page.tsx
src/apps/web/app/labs/about/page.tsx
```

Update shared content:

```text
src/apps/web/components/labs-site/LabsSiteNav.tsx
src/apps/web/components/labs-site/labs-site-content.ts
```

Preferred content module shape:

- nav items
- portal cards
- proof cards
- themes
- briefs
- method steps
- ID/Trust/Pulse spine items

Style namespace:

Rename `.labs-magazine-*` styles to a conceptually accurate namespace such as `.labs-proof-*`. This reduces drift between CSS names and page strategy.

Reuse:

- `LabsPageShell`
- `LabsHero`
- `LabsProductFrame`
- `LabsPanel`
- `LabsBadge`
- `demoScenarios`

Do not add new backend routes, persistence, payment logic, identity runtime behavior, consent runtime behavior, or Hedera behavior.

## Testing Requirements

Add or update rendering tests for:

- `/labs`
- `/labs/proofs`
- `/labs/themes`
- `/labs/briefs`
- `/labs/method`
- `LabsSiteNav`
- `labs-site-content`
- CSS/style guard if the repo keeps that pattern

Tests should verify:

- the homepage uses `Proof studio for healthcare operations`
- no primary nav item uses `Experiments` or `Notes`
- `/labs/proofs` renders all four current proof models from or aligned with `demoScenarios`
- `/labs/themes` renders the six revised themes
- `/labs/briefs` renders executive brief labels and teaser titles
- `/labs/method` renders the five proof-method steps
- old route tests are updated or redirect behavior is covered

Run normal verification before implementation is considered complete:

```text
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Before final handoff after implementation, browser-check:

- `/labs` desktop and mobile
- `/labs/proofs` desktop and mobile
- `/labs/themes` or `/labs/method` desktop and mobile

## Non-Goals

- Do not redesign the full corporate website.
- Do not replace the existing demo catalog route.
- Do not change healthcare workflow runtime behavior.
- Do not change policy evaluation, payment execution, settlement identity, Firestore persistence, or Hedera execution.
- Do not introduce a real CMS or article system.
- Do not claim production PHI use, regulatory certification, or production deployment.
- Do not describe the current demos as permanent product pillars.
- Do not present "research" as detached from Operon's platform strategy.

## Acceptance Criteria

- The written spec clearly replaces Magazine IA with Proof Studio IA.
- The word `Experiments` is removed from primary navigation and hero CTA language.
- The word `Notes` is removed from primary navigation and replaced by `Briefs`.
- `Themes` remains and is reframed around executive trust-infrastructure themes.
- The four current demo routes appear as proof models, not the whole Labs brand.
- ID.Operon, Trust.Operon, and Pulse.Operon are explicitly connected to Labs.
- The homepage content budget is tight enough to avoid the original overload problem.
- The design is ready for a separate implementation plan after user review.

## Spec Self-Review

- Placeholder scan: no placeholders, TBDs, or unfinished sections remain.
- Internal consistency: the sitemap, navigation, route redirects, and content labels all use `Proofs`, `Themes`, `Briefs`, and `Method`.
- Scope check: this is a single IA and content revision for the existing Labs pages, not a full corporate-site redesign.
- Ambiguity check: `Proofs` is the chosen label for the current working artifacts; `Proof Models` can still be used in body copy, but not as the primary nav label.
