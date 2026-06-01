// Alternative ("v2") Operon Labs positioning, served at /labs_v2 so the current
// /labs proof-studio stays intact for side-by-side comparison. v2 sharpens four
// things vs /labs: (1) a provocation-first hero + the company's own 88/5 stat,
// (2) a first-class Co-Innovate engagement surface (the conversion centerpiece),
// (3) Signals (forward intelligence) with real substance instead of an empty shelf,
// (4) Themes that lead with the executive claim, not the taxonomy label.

export type LabsV2NavId = "overview" | "proofs" | "themes" | "signals" | "co-innovate";

export interface LabsV2NavItem {
  id: LabsV2NavId;
  label: string;
  href: string;
}

export interface LabsV2PortalCard {
  title: string;
  href: string;
  kicker: string;
  body: string;
}

export type ProofSlug = "provider-documentation" | "delegate-um" | "specialty-rx" | "appeals";

export interface LabsV2Proof {
  slug: ProofSlug;
  title: string;
  route: string;
  executiveQuestion: string;
  whatItProves: string;
  controlSurface: string;
}

export interface LabsV2Theme {
  label: string;
  claim: string;
  body: string;
}

export interface LabsV2Signal {
  kicker: "Signal" | "Operating pattern" | "Executive brief";
  title: string;
  body: string;
  status: "Published" | "In progress";
}

export interface LabsV2OfferCard {
  title: string;
  body: string;
}

export interface LabsV2Step {
  title: string;
  body: string;
}

export const labsV2NavItems: LabsV2NavItem[] = [
  { id: "overview", label: "Overview", href: "/labs_v2" },
  { id: "proofs", label: "Proofs", href: "/labs_v2/proofs" },
  { id: "themes", label: "Themes", href: "/labs_v2/themes" },
  { id: "signals", label: "Signals", href: "/labs_v2/signals" },
  { id: "co-innovate", label: "Co-Innovate", href: "/labs_v2/co-innovate" }
];

export const labsV2Stat = {
  big: "88% run AI. ~5% can prove it works.",
  body:
    "Most health plans already run AI in at least one clinical workflow. Almost none can prove it is delivering value. Operon Labs is where that gap gets closed."
} as const;

export const labsV2PortalCards: LabsV2PortalCard[] = [
  {
    title: "Proofs",
    href: "/labs_v2/proofs",
    kicker: "01",
    body: "Working proof models leaders can inspect."
  },
  {
    title: "Themes",
    href: "/labs_v2/themes",
    kicker: "02",
    body: "The questions we think decide the next decade of operations."
  },
  {
    title: "Signals",
    href: "/labs_v2/signals",
    kicker: "03",
    body: "Forward intelligence for clinical operations leaders."
  },
  {
    title: "Co-Innovate",
    href: "/labs_v2/co-innovate",
    kicker: "04",
    body: "Bring a workflow. Leave with a proof."
  }
];

export const proofSequence = ["Actor", "Evidence", "Policy", "Control", "Settlement", "Audit"];

export const labsV2Proofs: LabsV2Proof[] = [
  {
    slug: "provider-documentation",
    title: "Prior Auth Evidence Readiness",
    route: "/provider-documentation",
    executiveQuestion: "Can better upstream evidence cut avoidable prior-auth rework before a reviewer ever opens the case?",
    whatItProves: "Documentation completeness, benefit coverage, and a policy decision are measurable at submission — and reward only the cases that are genuinely review-ready.",
    controlSurface: "Evidence completeness, benefit coverage, payment cap, approved recipient, and a non-PHI settlement record."
  },
  {
    slug: "delegate-um",
    title: "Delegated UM Quality Proof",
    route: "/delegate-um",
    executiveQuestion: "Can a delegated vendor's review quality be scored without paying for approvals, denials, savings, or utilization?",
    whatItProves: "Review timeliness, rationale completeness, and audit readiness can be measured and rewarded with outcome bias explicitly excluded.",
    controlSurface: "Delegate SLA, audit readiness, outcome-bias exclusions, recipient controls, and plan settlement policy."
  },
  {
    slug: "specialty-rx",
    title: "Specialty Rx Fulfillment Proof",
    route: "/specialty-rx",
    executiveQuestion: "Can post-authorization fulfillment be measured, step by step, as a trust-preserving operating workflow?",
    whatItProves: "Clear-to-fill readiness, shipment, delivery confirmation, and cold-chain handling are provable — with avoidable exceptions separated from external blockers.",
    controlSurface: "Fulfillment milestones, external-blocker separation, handling complexity, and prohibited steering metrics."
  },
  {
    slug: "appeals",
    title: "Appeals Readiness Proof",
    route: "/appeals",
    executiveQuestion: "Can exception-path readiness be rewarded without ever touching the appeal's outcome?",
    whatItProves: "Acknowledgement timing, required documents, clinical rationale, and an evidence index are measurable — while the decision itself stays untouched.",
    controlSurface: "Packet readiness, acknowledgement SLA, quality audit, no-reversal incentive, and non-PHI payment metadata."
  }
];

export const labsV2Themes: LabsV2Theme[] = [
  {
    label: "Trust & Evidence",
    claim: "Operations leaders need shared evidence, not screenshots and month-end reconciliation.",
    body: "Signed workflow events, policy-safe evidence packets, and a shared audit trail that every party can inspect."
  },
  {
    label: "Identity & Authority",
    claim: "Every action needs a reliable answer to “who acted, and under what authority?”",
    body: "Verifiable identity and authority for patients, providers, plans, vendors, systems, and the agents now acting on their behalf."
  },
  {
    label: "Consent & Access Control",
    claim: "Consent should behave like a runtime control, not a scanned form in a folder.",
    body: "Patient permissions and enterprise delegation modeled as active scopes — granted, checked, and revoked while work runs."
  },
  {
    label: "Incentives & Rewards",
    claim: "Value should move when contract-defined operational quality is proven — not assumed.",
    body: "Policy-based rewards for quality, timeliness, completeness, and coordination, separated from clinical or financial outcomes."
  },
  {
    label: "Programmable Payments & Value Flow",
    claim: "Payment can be fast only when the proof and the controls are explicit.",
    body: "Capped, policy-bound value movement with human checkpoints, approved recipients, and an auditable record of what paid and why."
  },
  {
    label: "AI Accountability in Operations",
    claim: "AI does not scale on output. It scales when operations can prove what it changed.",
    body: "Standards-aware agents across prior authorization, pharmacy, appeals, and delegated operations — measured against an operational baseline."
  }
];

export const labsV2Signals: LabsV2Signal[] = [
  {
    kicker: "Executive brief",
    title: "Why ~95% of health plans can't prove their AI works",
    status: "Published",
    body: "Most AI ROI in healthcare operations is asserted in a deck, not measured in the workflow. The proof gap is structural: pilots run beside the system of record, so there is no case-level baseline to compare against, no shared evidence of what the AI actually touched, and no neutral record both buyer and vendor trust. Closing it does not require a better model. It requires instrumenting the workflow itself — capturing what happened, under what policy, with what result — so “it's working” becomes a number a CFO and a regulator can both read."
  },
  {
    kicker: "Operating pattern",
    title: "How to reward quality without rewarding outcomes",
    status: "Published",
    body: "The fastest way to corrupt a clinical-operations incentive is to pay on approvals, denials, savings, or utilization — it quietly trains the wrong behavior and invites regulatory scrutiny. The durable pattern separates operational quality from clinical and financial outcomes: reward timeliness, evidence completeness, rationale quality, and coordination, and make the outcome explicitly out of scope in policy. The proof is in what is measured, and in what is deliberately excluded. Labs models both sides so the exclusion is inspectable, not a promise."
  },
  {
    kicker: "Operating pattern",
    title: "When instant settlement needs a human checkpoint",
    status: "Published",
    body: "Programmable payment is only as safe as the controls around it. The useful pattern is not “automate everything” or “approve everything” — it is a policy that auto-settles inside explicit limits (amount caps, approved recipients, scope) and routes anything outside them to a named human. The result moves at the speed of the workflow for the routine 90%, and keeps a person accountable for the exceptions. Labs treats that checkpoint as a first-class control, with an auditable record of which path each case took and why."
  },
  {
    kicker: "Signal",
    title: "Agents are about to act inside your operations. Can you prove what they did?",
    status: "In progress",
    body: "As autonomous agents take on prior auth, pharmacy handoffs, and appeals prep, the governing question shifts from “can AI do this?” to “can we prove what it did, under whose authority, and within which policy?” A forthcoming signal on the controls that let agents act inside regulated operations without becoming unauditable."
  }
];

export const coInnovateOffer: LabsV2OfferCard[] = [
  {
    title: "A working proof, not a slide deck",
    body: "Leave with an inspectable proof model of your workflow — visible actors, evidence, policy decisions, controls, and audit trail — that you can put in front of your own stakeholders."
  },
  {
    title: "Implementation-grade rigor",
    body: "Modeled with the same identity, consent, evidence, and policy primitives Operon runs in production — so what graduates from Labs has a real path into Operon.Cloud."
  },
  {
    title: "Your problem, your IP",
    body: "You bring the operating problem and the domain context. The proof model and the operating insight are yours to take into your roadmap."
  }
];

export const coInnovateSteps: LabsV2Step[] = [
  {
    title: "Bring an executive-pressure workflow",
    body: "A real operating problem under board pressure: prior-auth friction, delegated vendor performance, specialty handoffs, appeals readiness, consent enforcement, or proving AI impact."
  },
  {
    title: "Define the proof claim",
    body: "Together we state what must be proven, who must prove it, under what authority, and what would count as sufficient evidence."
  },
  {
    title: "Build the inspectable proof model",
    body: "We model the actor, consent or delegation boundary, policy controls, evidence packet, and audit sequence into a working surface."
  },
  {
    title: "Decide the next path",
    body: "Retire it, keep it as an internal proof, or graduate it toward an Operon.Cloud capability your teams can deploy."
  }
];
