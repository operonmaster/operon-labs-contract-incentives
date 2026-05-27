export interface DemoScenario {
  slug: string;
  title: string;
  submitter: string;
  purpose: string;
  evaluationType: string;
  status: "active" | "dormant";
}

export const demoScenarios: DemoScenario[] = [
  {
    slug: "provider-documentation",
    title: "Provider Documentation Completeness",
    submitter: "Provider administrative team",
    purpose: "Reward complete prior-auth-ready documentation submitted before initial decision.",
    evaluationType: "provider_documentation_completeness",
    status: "active"
  },
  {
    slug: "delegate-um",
    title: "Delegate UM SLA Bonus",
    submitter: "Delegated UM vendor",
    purpose: "Reward timely, complete, audit-ready delegated utilization-management work.",
    evaluationType: "delegate_um_sla_bonus",
    status: "active"
  },
  {
    slug: "appeals",
    title: "Appeals Packet Quality",
    submitter: "Appeals operations partner",
    purpose: "Reward complete, timely, well-rationalized appeal packets without outcome incentives.",
    evaluationType: "appeals_packet_quality",
    status: "dormant"
  },
  {
    slug: "provider-directory",
    title: "Provider Directory Data Quality",
    submitter: "Roster-management vendor",
    purpose: "Reward accurate, validated provider directory updates submitted before deadline.",
    evaluationType: "provider_directory_quality",
    status: "dormant"
  }
];

export function getScenario(slug: string): DemoScenario {
  const scenario = demoScenarios.find((candidate) => candidate.slug === slug);
  if (!scenario) {
    throw new Error(`Unknown demo scenario: ${slug}`);
  }
  return scenario;
}
