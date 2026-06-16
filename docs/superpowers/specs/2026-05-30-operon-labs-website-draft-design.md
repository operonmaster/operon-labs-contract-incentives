# Operon Labs Website Draft Design

## Goal

Create a simple new sub-page in the contract incentives demo app that drafts a broader Operon Labs website direction. The page should keep the visual language of the existing Operon Labs contract incentives site, but reposition Operon Labs beyond the current incentive demo catalog.

The page should present Operon Labs as the applied R&D layer for Operon's healthcare trust infrastructure: a place where digital identity, verifiable evidence, consent, incentives, instant payments, rewards, and clinical operations agents become working prototypes.

## Positioning Decision

Operon Labs should not be framed as four pillars based on the current demos. Those demos are proof points inside a larger agenda.

Use this core thesis:

```text
Operon Labs turns healthcare trust infrastructure into working clinical-ops experiments.
```

Supporting copy:

```text
We prototype how digital identity, verifiable evidence, patient consent, policy incentives, and instant value flows can make regulated healthcare workflows more accountable, measurable, and programmable.
```

This keeps Labs connected to the corporate product architecture while letting it remain more experimental than the primary Operon.Cloud and TrustOperon websites.

## Source Alignment

The page should align with existing Operon positioning:

- `ID.Operon`: verifiable identity, authority, credentials, consent, and signatures.
- `Trust.Operon`: proof services, signed events, immutable audit trails, and shared workflow evidence.
- `Pulse.Operon`: operational performance, incentives, rewards, value exchange, and ROI signals.
- Current contract-incentive demos: concrete examples of the trust fabric applied to prior authorization, utilization management, specialty pharmacy, and appeals workflows.

The external standards and ecosystem context support this broader framing:

- W3C DID Core: decentralized identifiers for people, organizations, systems, and autonomous software.
- W3C Verifiable Credentials Data Model 2.0: issuer-holder-verifier credentials and tamper-resistant proof models.
- HL7 FHIR Consent: structured healthcare consent expression.
- CMS prior authorization interoperability rules: API-mediated authorization workflows and operational transparency.
- Hedera Consensus Service: ordered, timestamped workflow evidence.
- Hedera Token Service and account transfers: programmable value movement for incentives, rewards, and settlement prototypes.

## Page Scope

Add one draft sub-page rather than changing the current homepage:

```text
/labs
```

The page is a positioning draft and should be safe to iterate. It should not replace the active bounty/demo catalog yet.

## Information Architecture

### Hero

Purpose: establish Operon Labs as a broader innovation hub.

Content:

- Eyebrow: `Operon Labs`
- H1: `Applied R&D for verifiable healthcare operations`
- Primary thesis line: `Operon Labs turns healthcare trust infrastructure into working clinical-ops experiments.`
- Supporting paragraph: identity, evidence, consent, incentives, payments, and clinical operations prototypes.
- Primary action: link to current experiments section.
- Secondary action: link back to the existing demo catalog or homepage.

### Why Labs Exists

Purpose: define the market and operational problem without sounding like a generic innovation page.

Message:

Healthcare operations are becoming API-mediated and AI-assisted, but many trust questions are still handled through manual review, screenshots, email trails, disconnected logs, and after-the-fact reconciliation. Labs explores how the trust layer becomes explicit:

- Who acted?
- What changed?
- Was the actor authorized?
- Did consent or delegation exist?
- What evidence supports the workflow claim?
- What policy applied?
- What reward or payment should move next?

### Research Domains

Use six domains. These are not product SKUs; they are the Labs agenda.

1. Trust & Evidence
   - Signed workflow events, proof packets, immutable audit trails, and accountable AI actions.
2. Digital Identity
   - Verifiable identities for patients, providers, health plans, systems, vendors, and software agents.
3. Verifiable Consent
   - Patient permissions, enterprise delegation, access scopes, revocation, and auditable consent evidence.
4. Incentives & Rewards
   - Policy-based rewards for quality, timeliness, completeness, coordination, and evidence readiness.
5. Instant Payments
   - Programmable settlement, micropayments, reward rails, and controlled value flows.
6. Clinical Ops Agents
   - Standards-aware workflow prototypes across prior authorization, pharmacy, appeals, and other regulated operations.

### Platform Continuity

Purpose: connect Labs to the corporate architecture without making the page feel like a product brochure.

Structure:

- `ID.Operon`: establishes who can act.
- `Trust.Operon`: proves what happened.
- `Pulse.Operon`: connects measurable work to incentives, rewards, and value flow.

Copy direction:

```text
Labs is where the Operon trust fabric is pressure-tested against real operational workflows.
```

### Current Experiments

Purpose: reuse the four current use cases as proof points, not as the whole brand.

Cards:

- Provider Documentation Completeness: evidence completeness before prior authorization submission.
- Delegate UM SLA Bonus: audit-ready delegated review with verifiable SLA proof.
- Specialty Rx Fulfillment SLA: fulfillment coordination after authorization.
- Appeals Packet Quality: packet readiness and exception-path quality without outcome incentives.

Each card should link to the existing route. The section label should avoid `pillars`. Use `Current Experiments`, `Working Prototypes`, or `Live Experiments`.

### Prototype Pattern

Purpose: show that Labs has a repeatable method.

Every experiment should show:

- a regulated workflow
- a trust claim
- an actor identity or authority model
- a policy or consent constraint
- a policy-safe evidence packet
- an execution or settlement path
- a human-readable audit trail

This section helps the page feel forward-looking without becoming abstract.

### Closing CTA

Purpose: light collaboration CTA.

Copy direction:

```text
Bring a workflow, policy, consent problem, or trust gap. Labs turns it into a working prototype that can be inspected, measured, and debated.
```

Actions:

- `Explore current experiments`
- `Discuss a workflow prototype`

The second action should link to `mailto:partners@operon.cloud`, matching the corporate site's partner contact pattern, and remain visually secondary.

## Visual Direction

Reuse the current contract incentives visual language:

- dark operational background
- restrained blue, cyan, and green accents
- 8px card radius
- dense but readable sections
- product-console feel rather than marketing landing-page ornamentation
- no large decorative hero illustration
- no gradient orb backgrounds

The page should feel like a serious lab notebook and product strategy surface, not a hackathon splash page.

The first viewport should include:

- Operon Labs brand signal
- the broader trust infrastructure thesis
- enough below-the-fold hinting to reveal the research-domain structure

## Implementation Shape

Use existing app patterns:

- Add `src/apps/web/app/labs/page.tsx`.
- Reuse `LabsPageShell`, `LabsHero`, `LabsProductFrame`, `LabsPanel`, and related primitives from `src/apps/web/components/labs-ui`.
- Reuse `demoScenarios` from `src/apps/web/components/demo-catalog` for the current experiments section.
- Add narrow route-specific CSS to `src/apps/web/app/styles.css` only if the existing primitives are insufficient.
- Do not modify the existing homepage in the first implementation.

The page should be mostly static content. It does not need new backend APIs, persistence, or policy-engine changes.

## Navigation

For the first implementation, the page can be reached directly at `/labs`. It does not need to be added to every use-case nav yet.

Add a link from the new `/labs` page back to `/` so users can reach the active demo catalog.

Adding a homepage card or nav item for `/labs` can be considered after visual review, but it is not required for the initial draft.

## Data Flow

No new runtime data flow is required.

The only dynamic content should be reuse of `demoScenarios` so the current experiment cards stay aligned with the existing demo catalog.

## Error Handling

No new error states are required because the page is static.

If an experiment card references a scenario route, it should use the existing `slug` field. Broken route handling remains the responsibility of the existing app routing.

## Testing Requirements

Add a focused rendering test for the `/labs` page if the app test setup supports app-route rendering in the current pattern. The test should verify:

- the broader Labs headline renders
- all six research domains render
- all four current experiments render from `demoScenarios`
- the page links back to the demo catalog

Also run the standard local verification used for UI/copy changes:

```text
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Before claiming implementation complete, verify the page in-browser at desktop and mobile widths.

## Non-Goals

- Do not replace the existing bounty/demo catalog homepage.
- Do not redesign the full corporate website.
- Do not introduce new backend APIs.
- Do not add real contact form submission.
- Do not add new payment, consent, identity, or evidence runtime behavior.
- Do not present current incentive workflows as the final permanent Labs taxonomy.
- Do not claim production deployment, PHI handling, or regulatory compliance outcomes.

## Acceptance Criteria

- `/labs` exists and renders as a polished draft sub-page.
- The page frames Labs as broader than the four incentive demos.
- Research domains include trust and evidence, incentives and rewards, instant payments, digital identities, and verifiable patient consent.
- The four current demos appear as current experiments or working prototypes.
- The design visually matches the existing contract incentives site.
- The page remains synthetic/demo-safe and does not imply production PHI use.
- Verification commands and browser checks pass before implementation is marked complete.
