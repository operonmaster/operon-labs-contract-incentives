export interface LabsNavItem {
  id: "labs" | "proofs" | "themes" | "briefs" | "method";
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
  executiveClaim: string;
}

export interface Brief {
  label: "Executive brief" | "Operating pattern" | "Trust signal" | "Proof model";
  title: string;
  body: string;
}

export interface MethodStep {
  title: string;
  body: string;
}

export interface PlatformSpineItem {
  product: "ID.Operon" | "Trust.Operon" | "Pulse.Operon";
  role: string;
  body: string;
}

export type ProofSlug = "provider-documentation" | "delegate-um" | "specialty-rx" | "appeals";

export interface ProofCard {
  slug: ProofSlug;
  title: string;
  route: string;
  executiveQuestion: string;
  whatIsProven: string;
  controlSurface: string;
}

export const labsNavItems: LabsNavItem[] = [
  { id: "labs", label: "Labs", href: "/labs" },
  { id: "proofs", label: "Proofs", href: "/labs/proofs" },
  { id: "themes", label: "Themes", href: "/labs/themes" },
  { id: "briefs", label: "Briefs", href: "/labs/briefs" },
  { id: "method", label: "Method", href: "/labs/method" }
];

export const labsPortalCards: LabsPortalCard[] = [
  {
    title: "Proofs",
    href: "/labs/proofs",
    kicker: "01",
    body: "Working proof models you can inspect."
  },
  {
    title: "Themes",
    href: "/labs/themes",
    kicker: "02",
    body: "The trust infrastructure agenda."
  },
  {
    title: "Briefs",
    href: "/labs/briefs",
    kicker: "03",
    body: "Executive signals and operating patterns."
  },
  {
    title: "Method",
    href: "/labs/method",
    kicker: "04",
    body: "How Labs turns a workflow into proof."
  }
];

export const proofMethodSteps = ["Actor", "Evidence", "Policy", "Control", "Settlement", "Audit"];

export const platformSpine: PlatformSpineItem[] = [
  {
    product: "ID.Operon",
    role: "Who can act",
    body: "Identity, authority, signatures, and consent make the actor model explicit before work moves."
  },
  {
    product: "Trust.Operon",
    role: "What happened",
    body: "Signed events, shared evidence, immutable audit, and consensus make workflow claims verifiable."
  },
  {
    product: "Pulse.Operon",
    role: "What value moves next",
    body: "Incentives, rewards, usage, revenue, and settlement connect measurable work to controlled value flow."
  }
];

export const proofCards: ProofCard[] = [
  {
    slug: "provider-documentation",
    title: "Prior Auth Evidence Readiness",
    route: "/provider-documentation",
    executiveQuestion: "Can upstream evidence reduce avoidable prior-auth friction before review starts?",
    whatIsProven: "Clean documentation, PAS submission, policy-safe evidence, and an eligible or blocked incentive.",
    controlSurface: "Evidence completeness, benefit coverage, payment cap, approved wallet, and non-PHI settlement memo."
  },
  {
    slug: "delegate-um",
    title: "Delegated UM Quality Proof",
    route: "/delegate-um",
    executiveQuestion: "Can delegated review quality be measured without rewarding approvals, denials, savings, or utilization?",
    whatIsProven: "Timely review, complete rationale, quality audit, approved submitter, and payment controls.",
    controlSurface: "Delegate SLA, audit readiness, outcome-bias exclusions, recipient controls, and plan settlement policy."
  },
  {
    slug: "specialty-rx",
    title: "Specialty Rx Fulfillment Proof",
    route: "/specialty-rx",
    executiveQuestion: "Can post-authorization fulfillment be measured as a trust-preserving operating workflow?",
    whatIsProven: "Clear-to-fill readiness, shipment scheduling, delivery confirmation, exception separation, and cold-chain evidence.",
    controlSurface: "Fulfillment milestones, external blocker separation, handling complexity, and prohibited steering metrics."
  },
  {
    slug: "appeals",
    title: "Appeals Readiness Proof",
    route: "/appeals",
    executiveQuestion: "Can exception-path readiness be rewarded without touching appeal outcomes?",
    whatIsProven: "A receipt-based SLA, acknowledgement, required documents, clinical rationale, policy citation, and evidence index.",
    controlSurface: "Packet readiness, acknowledgement timing, quality audit, no reversal incentive, and non-PHI payment metadata."
  }
];

export const researchThemes: ResearchTheme[] = [
  {
    title: "Trust & Evidence",
    body: "Signed events, proof packets, audit trails, provenance, and AI accountability.",
    executiveClaim: "Healthcare leaders need shared evidence, not screenshots and retrospective reconciliation."
  },
  {
    title: "Digital Identity & Authority",
    body: "Verifiable identities for patients, providers, plans, vendors, systems, and agents.",
    executiveClaim: "Every action needs a reliable actor and authority model."
  },
  {
    title: "Verifiable Consent & Delegation",
    body: "Patient permissions, enterprise delegation, access scopes, revocation, and approval records.",
    executiveClaim: "Consent should act like runtime infrastructure, not static paperwork."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for quality, timeliness, completeness, coordination, and evidence readiness.",
    executiveClaim: "Value should move when contract-defined operational quality is proven."
  },
  {
    title: "Instant Settlement & Value Flow",
    body: "Programmable settlement, micropayments, reward rails, usage billing, capped exposure, and payment controls.",
    executiveClaim: "Payment can be fast only when the proof and controls are explicit."
  },
  {
    title: "Clinical Ops Agents & AI Proof",
    body: "Standards-aware agents across prior authorization, pharmacy, appeals, delegated operations, and future workflows.",
    executiveClaim: "AI does not scale on output. It scales when operations can prove what changed."
  }
];

export const briefs: Brief[] = [
  {
    label: "Executive brief",
    title: "From AI pilot to operational proof",
    body: "Why clinical operations leaders need case-level evidence before they can scale automation."
  },
  {
    label: "Operating pattern",
    title: "Consent as executable infrastructure",
    body: "Why patient and enterprise permissions should behave like active controls, not scanned artifacts."
  },
  {
    label: "Proof model",
    title: "Rewards without outcome bias",
    body: "How to reward operational quality without tying incentives to clinical or financial outcomes."
  },
  {
    label: "Trust signal",
    title: "Why screenshots do not prove healthcare operations",
    body: "The case for signed workflow events, policy-safe evidence, and shared audit trails."
  },
  {
    label: "Operating pattern",
    title: "When instant settlement needs a human checkpoint",
    body: "A practical pattern for combining programmable settlement with explicit approval controls."
  }
];

export const methodSteps: MethodStep[] = [
  {
    title: "Select an executive-pressure workflow",
    body:
      "Start with a real operating problem: prior authorization friction, delegated vendor performance, specialty pharmacy handoffs, appeals readiness, consent enforcement, AI impact, or value-flow reconciliation."
  },
  {
    title: "Define the proof claim",
    body: "State what must be proven, who must prove it, under what authority, and what would count as sufficient evidence."
  },
  {
    title: "Model identity, consent, policy, and evidence",
    body: "Connect the actor model, consent or delegation boundary, policy controls, evidence packet, and audit event sequence."
  },
  {
    title: "Build an inspectable proof model",
    body: "Produce a working workflow surface with visible controls, assumptions, policy decisions, and audit trail."
  },
  {
    title: "Decide the next path",
    body:
      "Retire the idea, turn it into a partner proof, map it into ID.Operon, Trust.Operon, or Pulse.Operon, or productize it as a future Operon capability."
  }
];
