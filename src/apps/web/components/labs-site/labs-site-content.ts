export interface LabsNavItem {
  id: "labs" | "experiments" | "themes" | "notes" | "about";
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
}

export interface FieldNote {
  label: "Field note" | "Pattern" | "Question";
  title: string;
  body: string;
}

export interface AboutStep {
  title: string;
  body: string;
}

export type CurrentExperimentSlug = "provider-documentation" | "delegate-um" | "specialty-rx" | "appeals";

export const labsNavItems: LabsNavItem[] = [
  { id: "labs", label: "Labs", href: "/labs" },
  { id: "experiments", label: "Experiments", href: "/labs/experiments" },
  { id: "themes", label: "Themes", href: "/labs/themes" },
  { id: "notes", label: "Notes", href: "/labs/notes" },
  { id: "about", label: "About", href: "/labs/about" }
];

export const labsPortalCards: LabsPortalCard[] = [
  {
    title: "Experiments",
    href: "/labs/experiments",
    kicker: "01",
    body: "Working demos people can inspect."
  },
  {
    title: "Field notes",
    href: "/labs/notes",
    kicker: "02",
    body: "Short learnings from prototypes."
  },
  {
    title: "Themes",
    href: "/labs/themes",
    kicker: "03",
    body: "Identity, consent, proof, payments."
  }
];

export const researchThemes: ResearchTheme[] = [
  {
    title: "Trust & Evidence",
    body: "Signed events, proof packets, audit trails, and AI accountability."
  },
  {
    title: "Digital Identity",
    body: "Verifiable identities for patients, providers, plans, vendors, systems, and agents."
  },
  {
    title: "Verifiable Consent",
    body: "Patient permissions, enterprise delegation, access scopes, and revocation evidence."
  },
  {
    title: "Incentives & Rewards",
    body: "Policy-based rewards for quality, timeliness, completeness, and coordination."
  },
  {
    title: "Instant Payments",
    body: "Programmable settlement, micropayments, reward rails, and controlled value movement."
  },
  {
    title: "Clinical Ops Agents",
    body: "Standards-aware workflow prototypes across prior authorization, pharmacy, appeals, and future operations."
  }
];

export const fieldNotes: FieldNote[] = [
  {
    label: "Field note",
    title: "What counts as proof in a prior-auth workflow?",
    body: "A note on turning workflow metadata into policy-safe evidence."
  },
  {
    label: "Question",
    title: "Patient consent as executable infrastructure",
    body: "Why consent should behave like an active control, not a scanned artifact."
  },
  {
    label: "Pattern",
    title: "Rewards without outcome bias",
    body: "How to reward operational quality without tying incentives to clinical or financial outcomes."
  },
  {
    label: "Pattern",
    title: "When instant payment needs a human checkpoint",
    body: "A practical pattern for combining programmable settlement with explicit approval controls."
  }
];

export const aboutSteps: AboutStep[] = [
  {
    title: "Bring a workflow",
    body: "Partner or internal workflow friction enters as a concrete operating problem."
  },
  {
    title: "Define the trust claim",
    body: "The prototype states what must be proven, by whom, and under what authority."
  },
  {
    title: "Build the evidence path",
    body: "Synthetic demo-safe events, policies, and proof packets are modeled."
  },
  {
    title: "Make it inspectable",
    body: "The result is a working prototype with visible assumptions, controls, and open questions."
  }
];

export const experimentMethodSteps = [
  "Workflow friction",
  "Trust claim",
  "Evidence model",
  "Policy decision",
  "Controlled execution"
];

export const experimentFramingBySlug: Record<CurrentExperimentSlug, string> = {
  "provider-documentation": "Can better upstream evidence reduce avoidable prior-auth friction?",
  "delegate-um": "Can delegated review quality be proven without relying on outcome incentives?",
  "specialty-rx": "Can post-authorization fulfillment be measured as a trust-preserving workflow?",
  appeals: "Can exception-path readiness be rewarded without touching appeal outcomes?"
};
