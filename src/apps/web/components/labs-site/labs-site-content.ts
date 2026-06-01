export interface LabsNavItem {
  id: "overview" | "initiatives" | "themes" | "signals" | "co-innovate" | "book-a-call";
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
  label: "Executive signal" | "Operating pattern" | "Governance question";
  title: string;
  body: string;
  status: "Published" | "In progress";
}

export interface CoInnovateOffer {
  label: string;
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

export type InitiativeSlug = "provider-documentation" | "delegate-um" | "specialty-rx" | "appeals";

export interface InitiativeCard {
  slug: InitiativeSlug;
  title: string;
  route: string;
  executiveQuestion: string;
  modelFocus: string;
  operatingControls: string;
}

export const labsNavItems: LabsNavItem[] = [
  { id: "overview", label: "Overview", href: "/labs" },
  { id: "initiatives", label: "Initiatives", href: "/labs/initiatives" },
  { id: "themes", label: "Themes", href: "/labs/themes" },
  { id: "signals", label: "Signals", href: "/labs/signals" },
  { id: "co-innovate", label: "Co-Innovate", href: "/labs/co-innovate" }
];

export const labsPortalCards: LabsPortalCard[] = [
  {
    title: "Initiatives",
    href: "/labs/initiatives",
    kicker: "01",
    body: "Healthcare operations models moving from idea to implementation."
  },
  {
    title: "Themes",
    href: "/labs/themes",
    kicker: "02",
    body: "The strategic healthcare operations agenda behind Labs."
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
    body: "Bring a workflow. Leave with a working model."
  }
];

export const initiativeMethodSteps = ["Workflow", "Actors", "Data", "Policy", "Value", "Path"];

export const operatingModelSpine = ["Workflow", "Authority", "Evidence", "Policy", "Value", "Path"];

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

export const initiativeCards: InitiativeCard[] = [
  {
    slug: "provider-documentation",
    title: "Prior Auth Readiness Model",
    route: "/provider-documentation",
    executiveQuestion: "Can better documentation readiness reduce avoidable prior-auth friction before review starts?",
    modelFocus: "Documentation readiness, PAS submission, policy-safe evidence, and an eligible or blocked incentive.",
    operatingControls: "Completeness, benefit coverage, payment cap, approved wallet, and non-PHI settlement memo."
  },
  {
    slug: "delegate-um",
    title: "Delegated UM Quality Model",
    route: "/delegate-um",
    executiveQuestion: "Can delegated review quality be measured without rewarding approvals, denials, savings, or utilization?",
    modelFocus: "Timely review, complete rationale, quality audit, approved submitter, and payment controls.",
    operatingControls: "Delegate SLA, audit readiness, outcome-bias exclusions, recipient controls, and plan settlement policy."
  },
  {
    slug: "specialty-rx",
    title: "Specialty Rx Fulfillment Model",
    route: "/specialty-rx",
    executiveQuestion: "Can post-authorization fulfillment be measured as a trust-preserving operating workflow?",
    modelFocus: "Clear-to-fill readiness, shipment scheduling, delivery confirmation, exception separation, and cold-chain evidence.",
    operatingControls: "Fulfillment milestones, external blocker separation, handling complexity, and prohibited steering metrics."
  },
  {
    slug: "appeals",
    title: "Appeals Readiness Model",
    route: "/appeals",
    executiveQuestion: "Can exception-path readiness be rewarded without touching appeal outcomes?",
    modelFocus: "A receipt-based SLA, acknowledgement, required documents, clinical rationale, policy citation, and evidence index.",
    operatingControls: "Packet readiness, acknowledgement timing, quality audit, no reversal incentive, and non-PHI payment metadata."
  }
];

export const researchThemes: ResearchTheme[] = [
  {
    title: "Clinical Ops Agents & AI Accountability",
    body: "Standards-aware agents across prior authorization, pharmacy, appeals, delegated operations, and future workflows.",
    executiveClaim: "AI belongs inside governed workflows, not beside them."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for timeliness, completeness, coordination, quality, and implementation readiness.",
    executiveClaim: "Reward design should improve operations without training clinical or financial bias."
  },
  {
    title: "Instant Payments & Value Flow",
    body: "Programmable payments, reward rails, capped exposure, usage billing, and human checkpoints for exceptions.",
    executiveClaim: "Payment innovation matters when value can move at the speed of completed work."
  },
  {
    title: "Digital Identity & Authority",
    body: "Verifiable identities for patients, providers, plans, vendors, systems, and agents.",
    executiveClaim: "Every operational action needs a reliable answer to who acted and under what authority."
  },
  {
    title: "Verifiable Consent & Delegation",
    body: "Patient permissions, enterprise delegation, access scopes, revocation, and approval records.",
    executiveClaim: "Consent should behave like a runtime control, not a scanned form in a folder."
  },
  {
    title: "Operational Visibility",
    body: "Workflow events, policy-safe evidence packets, status changes, and shared records that teams can inspect.",
    executiveClaim: "Leaders need a clear operating record before they can automate, reward, or redesign work."
  }
];

export const signals: Signal[] = [
  {
    label: "Executive signal",
    title: "Why healthcare AI pilots struggle to become operating models",
    status: "Published",
    body:
      "Most AI value in healthcare operations is asserted beside the workflow, not adopted inside it. Labs focuses on ownership, workflow fit, baseline operations, and the implementation path from pilot to operating model."
  },
  {
    label: "Operating pattern",
    title: "How to reward quality without rewarding outcomes",
    status: "Published",
    body:
      "The durable pattern separates operational quality from clinical and financial outcomes. Reward timeliness, readiness, rationale quality, and coordination while policy keeps prohibited outcomes explicitly out of scope."
  },
  {
    label: "Operating pattern",
    title: "When instant payments need a human checkpoint",
    status: "Published",
    body:
      "Programmable payment is strongest when routine cases move inside explicit limits and exceptions route to a named human. Labs treats the checkpoint as an operating design choice, not a delay."
  },
  {
    label: "Governance question",
    title: "Agentic operations need ownership before autonomy",
    status: "In progress",
    body:
      "As agents enter prior authorization, pharmacy handoffs, and appeals prep, the question shifts from whether AI can act to whether the organization has workflow ownership, implementation path, and governance for what happens next."
  }
];

export const coInnovateOffer: CoInnovateOffer[] = [
  {
    label: "What you bring",
    title: "An executive-pressure workflow",
    body:
      "Bring a workflow where ownership, authority, evidence, policy, consent, incentives, or payment path is unclear. Labs uses it as the intake surface: workflow, authority, evidence, policy, value, and path to implementation."
  },
  {
    label: "What we build",
    title: "A working model, not a slide deck",
    body:
      "Leave with an inspectable operating model of your workflow: visible actors, evidence, policy decisions, controls, settlement path, and audit trail."
  },
  {
    label: "What it connects to",
    title: "Production-aligned primitives",
    body:
      "Model the workflow with Operon's identity, consent, evidence, policy, incentive, and settlement primitives so useful work has a path beyond a workshop."
  },
  {
    label: "What you keep",
    title: "Your context, reusable pattern",
    body:
      "Bring the pressure, constraints, and domain detail. Labs turns them into a reusable pattern your team can evaluate with stakeholders."
  }
];

export const coInnovateSteps: CoInnovateStep[] = [
  {
    title: "Bring an executive-pressure workflow",
    body:
      "Start with a real operating problem: prior-auth friction, delegated vendor performance, specialty handoffs, appeals readiness, consent enforcement, AI impact, or value-flow reconciliation."
  },
  {
    title: "Define the operating claim",
    body: "State what needs to change, who must act, under what authority, and what would count as sufficient evidence."
  },
  {
    title: "Build an inspectable model",
    body: "Model the actors, consent or delegation boundary, policy controls, evidence packet, value movement, and audit sequence."
  },
  {
    title: "Decide the next path",
    body:
      "Retire it, keep it as an internal validation model, graduate it toward an Operon.Cloud capability, or move into a partner implementation."
  }
];
