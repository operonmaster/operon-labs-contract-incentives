export interface LabsNavItem {
  id: "overview" | "proofs" | "themes" | "signals" | "co-innovate";
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

export interface Signal {
  label: "Executive signal" | "Operating pattern" | "Proof model";
  title: string;
  body: string;
  status: "Published" | "In progress";
}

export interface CoInnovateOffer {
  title: string;
  body: string;
}

export interface CoInnovateStep {
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
  { id: "overview", label: "Overview", href: "/labs" },
  { id: "proofs", label: "Proofs", href: "/labs/proofs" },
  { id: "themes", label: "Themes", href: "/labs/themes" },
  { id: "signals", label: "Signals", href: "/labs/signals" },
  { id: "co-innovate", label: "Co-Innovate", href: "/labs/co-innovate" }
];

export const labsPortalCards: LabsPortalCard[] = [
  {
    title: "Proofs",
    href: "/labs/proofs",
    kicker: "01",
    body: "Working proof models leaders can inspect."
  },
  {
    title: "Themes",
    href: "/labs/themes",
    kicker: "02",
    body: "The operating claims behind the proof portfolio."
  },
  {
    title: "Signals",
    href: "/labs/signals",
    kicker: "03",
    body: "Forward intelligence for healthcare operations leaders."
  },
  {
    title: "Co-Innovate",
    href: "/labs/co-innovate",
    kicker: "04",
    body: "Bring a workflow. Leave with a proof."
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
    body: "Signed workflow events, policy-safe evidence packets, and a shared audit trail that every party can inspect.",
    executiveClaim: "Operations leaders need shared evidence, not screenshots and month-end reconciliation."
  },
  {
    title: "Digital Identity & Authority",
    body: "Verifiable identities for patients, providers, plans, vendors, systems, and agents.",
    executiveClaim: "Every action needs a reliable answer to who acted and under what authority."
  },
  {
    title: "Verifiable Consent & Delegation",
    body: "Patient permissions, enterprise delegation, access scopes, revocation, and approval records.",
    executiveClaim: "Consent should behave like a runtime control, not a scanned form in a folder."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for quality, timeliness, completeness, coordination, and evidence readiness.",
    executiveClaim: "Value should move when contract-defined operational quality is proven, not assumed."
  },
  {
    title: "Instant Settlement & Value Flow",
    body: "Programmable settlement, reward rails, usage billing, capped exposure, and payment controls.",
    executiveClaim: "Payment can be fast only when the proof and controls are explicit."
  },
  {
    title: "Clinical Ops Agents & AI Proof",
    body: "Standards-aware agents across prior authorization, pharmacy, appeals, delegated operations, and future workflows.",
    executiveClaim: "AI does not scale on output. It scales when operations can prove what changed."
  }
];

export const signals: Signal[] = [
  {
    label: "Executive signal",
    title: "Why healthcare AI pilots struggle to become operational proof",
    status: "Published",
    body:
      "Most AI value in healthcare operations is asserted beside the workflow, not measured inside it. Labs focuses on the missing proof layer: baselines, signed events, policy context, and case-level evidence that leaders can inspect."
  },
  {
    label: "Operating pattern",
    title: "How to reward quality without rewarding outcomes",
    status: "Published",
    body:
      "The durable pattern separates operational quality from clinical and financial outcomes. Reward timeliness, evidence completeness, rationale quality, and coordination while policy makes prohibited outcomes explicitly out of scope."
  },
  {
    label: "Operating pattern",
    title: "When instant settlement needs a human checkpoint",
    status: "Published",
    body:
      "Programmable payment is strongest when routine cases settle inside explicit limits and exceptions route to a named human. Labs treats the checkpoint as a control, not a delay."
  },
  {
    label: "Proof model",
    title: "Agents are about to act inside operations. Can you prove what they did?",
    status: "In progress",
    body:
      "As agents enter prior authorization, pharmacy handoffs, and appeals prep, the governing question shifts from whether AI can act to whether the organization can prove what it did, under whose authority, and inside which policy."
  }
];

export const coInnovateOffer: CoInnovateOffer[] = [
  {
    title: "A working proof, not a slide deck",
    body:
      "Leave with an inspectable proof model of your workflow: visible actors, evidence, policy decisions, controls, settlement path, and audit trail."
  },
  {
    title: "Production-aligned primitives",
    body:
      "Model the workflow with Operon's identity, consent, evidence, policy, incentive, and settlement primitives so useful work has a path beyond a workshop."
  },
  {
    title: "Your operating context, reusable proof",
    body:
      "Bring the pressure, constraints, and domain detail. Labs turns them into a reusable proof pattern your team can evaluate with stakeholders."
  }
];

export const coInnovateSteps: CoInnovateStep[] = [
  {
    title: "Bring an executive-pressure workflow",
    body:
      "Start with a real operating problem: prior-auth friction, delegated vendor performance, specialty handoffs, appeals readiness, consent enforcement, AI impact, or value-flow reconciliation."
  },
  {
    title: "Define the proof claim",
    body: "State what must be proven, who must prove it, under what authority, and what would count as sufficient evidence."
  },
  {
    title: "Build an inspectable proof model",
    body: "Model the actors, consent or delegation boundary, policy controls, evidence packet, value movement, and audit sequence."
  },
  {
    title: "Decide the next path",
    body:
      "Retire it, keep it as an internal proof, graduate it toward an Operon.Cloud capability, or move into a partner implementation."
  }
];
