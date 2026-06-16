# Operon Labs Executive Proof Studio Design

## Goal

Promote the strongest ideas from the `/labs_v2` prototype into the real `/labs` site without copying the prototype wholesale.

The approved direction is:

```text
Operon Labs is not a research archive. Operon Labs is an executive proof studio.
```

The page should create the reaction:

```text
This is where a healthcare leader brings a high-pressure workflow and leaves with an inspectable proof model.
```

## Positioning

Primary headline:

```text
Where healthcare operations become provable.
```

Supporting line:

```text
Operon Labs helps healthcare leaders turn high-pressure workflows into inspectable proof models: who acted, what evidence exists, what policy applied, what value moved, and what can be audited.
```

Use AI as an important pressure point, not as the full ceiling for Labs. The site should cover AI, delegated operations, vendor performance, consent, identity, incentives, rewards, and settlement.

## IA

Use the real `/labs` route family:

```text
/labs
/labs/proofs
/labs/themes
/labs/signals
/labs/co-innovate
```

Retire lower-signal pages by redirecting:

```text
/labs/experiments -> /labs/proofs
/labs/notes       -> /labs/signals
/labs/briefs      -> /labs/signals
/labs/about       -> /labs/co-innovate
/labs/method      -> /labs/co-innovate
```

This keeps the strongest density pattern from `/labs_v2/co-innovate`: one clear promise, concrete deliverables, a short process, and one conversion path.

## Homepage

The homepage must become a front door, not a taxonomy dump.

Required sections:

1. Hero
   - Eyebrow: `Operon Labs · Proof Studio`
   - H1: `Where healthcare operations become provable.`
   - Body: the supporting line above.
   - Primary CTA: `Co-innovate with Labs`
   - Secondary CTA: `See the proofs`

2. Buyer tension
   - Title: `Proof beats pilot activity.`
   - Body should state that leaders are investing in AI, vendors, delegated workflows, rewards, and automation, but need proof of what happened and why value should move.

3. Featured proof
   - Lead with delegated UM quality because it best demonstrates outcome-bias controls.
   - Link to `/delegate-um`.

4. Co-innovation CTA
   - Title: `Bring a workflow. Leave with a proof.`
   - Link to `/labs/co-innovate`.

5. Portal cards
   - Proofs
   - Themes
   - Signals
   - Co-Innovate

## Co-Innovate Page

Create `/labs/co-innovate` as the conversion centerpiece.

Hero:

```text
Bring a workflow. Leave with a proof.
```

Body:

```text
Operon Labs runs as an executive proof-studio track. You bring an operating problem under pressure; we build an inspectable proof model with you using Operon's identity, consent, evidence, policy, incentive, and settlement primitives.
```

Offer cards:

- `A working proof, not a slide deck`
- `Production-aligned primitives`
- `Your operating context, reusable proof`

Avoid `Your problem, your IP`; that overpromises ownership before partnership terms are defined.

Process steps:

- `Bring an executive-pressure workflow`
- `Define the proof claim`
- `Build the inspectable proof model`
- `Decide the next path`

CTA:

- Primary: `Bring a workflow` -> `mailto:partners@operon.cloud`
- Secondary: `See current proofs` -> `/labs/proofs`

## Signals Page

Replace `Briefs` with `Signals`.

Purpose:

Executive intelligence, not a blog shelf. Signals should be short, opinionated operating reads connected to proofs and themes.

Page headline:

```text
Forward intelligence for healthcare operations leaders.
```

The first signal should avoid unsourced `88% / 5%` claims. Use a defensible claim:

```text
Why healthcare AI pilots struggle to become operational proof
```

## Themes Page

Keep the six broad themes, but lead each card with the executive claim and use the theme label as the badge. This is stronger than taxonomy-first cards.

## Proofs Page

Keep the four current proof models. Improve copy by leading with executive questions where useful, but do not change demo routes.

## Constraints

- Do not touch `/labs_v2`; it remains a reference prototype.
- Do not touch unrelated Appeals changes.
- Do not introduce unsourced numeric market claims.
- Keep the existing visual system and `labs-proof-*` CSS namespace.
- Use TDD for content, route, and redirect behavior.
