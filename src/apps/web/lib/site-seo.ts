import type { Metadata } from "next";

export const googleAnalyticsMeasurementId = "G-HZ4JMN1767";
export const googleTagManagerId = "GTM-NQRNTTPT";

export const siteMetadata = {
  title: "Operon Contract Incentives",
  description:
    "Policy-gated healthcare contract incentives with Hedera Agent Kit payment controls and bounded HBAR settlement.",
  url: "https://contract-incentives.demo.labs.operon.cloud"
} as const;

export const pageMetadata = {
  "/": {
    title: "Operon Contract Incentives",
    description:
      "Business-first healthcare contract incentive demo where policy-safe evidence controls Hedera Agent Kit HBAR settlement."
  },
  "/provider-documentation": {
    title: "Provider Prior Authorization Portal",
    description:
      "Provider workflow for coverage checks, prior authorization documentation, contract incentive eligibility, and policy-bound settlement."
  },
  "/provider-documentation/incentives": {
    title: "Provider Documentation Plan Incentives",
    description:
      "Plan-side audit console for provider documentation incentive events, business policy outcomes, and Hedera settlement controls."
  },
  "/provider-documentation/policies": {
    title: "Provider Documentation Policy Catalog",
    description:
      "Read-only provider documentation contract policies and Hedera Agent Kit payment policies for prior authorization incentives."
  },
  "/delegate-um": {
    title: "Delegate UM SLA Bonus Console",
    description:
      "Delegated utilization-management workqueue for pharmacy prior authorization reviews with contract incentive policy controls."
  },
  "/delegate-um/plan": {
    title: "Delegate UM Plan Audit Console",
    description:
      "Plan audit view for delegated UM SLA bonus events, business policy decisions, and Hedera payment policy settlement outcomes."
  },
  "/delegate-um/policies": {
    title: "Delegate UM Policy Catalog",
    description:
      "Read-only delegated UM SLA contract policies and Hedera Agent Kit payment controls for incentive settlement."
  },
  "/specialty-rx": {
    title: "Specialty Rx Fulfillment Workqueue",
    description:
      "Specialty pharmacy fulfillment workflow for post-approval operating milestones, SLA incentive policy checks, and settlement."
  },
  "/specialty-rx/plan": {
    title: "Specialty Rx Plan Audit Console",
    description:
      "Plan audit console for specialty pharmacy fulfillment SLA events, contract incentive outcomes, and Hedera settlement evidence."
  },
  "/specialty-rx/policies": {
    title: "Specialty Rx Policy Catalog",
    description:
      "Read-only specialty pharmacy fulfillment SLA policies and Hedera Agent Kit payment controls for contract incentives."
  },
  "/appeals": {
    title: "Appeals Packet Quality Console",
    description:
      "Appeals packet workflow for complete, timely, outcome-neutral contract incentive evidence and payment policy review."
  },
  "/appeals/plan": {
    title: "Appeals Plan Audit Console",
    description:
      "Plan audit view for appeals packet quality incentive events, business policy outcomes, and Hedera settlement controls."
  },
  "/appeals/policies": {
    title: "Appeals Policy Catalog",
    description:
      "Read-only appeals packet quality contract policies and Hedera Agent Kit payment controls for bounded incentive settlement."
  }
} as const;

export type PageMetadataPath = keyof typeof pageMetadata;

export function buildPageMetadata(path: PageMetadataPath): Metadata {
  const page = pageMetadata[path];
  const canonicalUrl = new URL(path, siteMetadata.url).toString();

  return {
    metadataBase: new URL(siteMetadata.url),
    title: page.title,
    description: page.description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title: page.title,
      description: page.description,
      siteName: siteMetadata.title,
      type: "website",
      url: canonicalUrl
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description
    }
  };
}

export function isAnalyticsHostnameEnabled(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) {
    return false;
  }

  return !(
    normalizedHostname === "localhost" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname.startsWith("127.") ||
    normalizedHostname.startsWith("local.") ||
    normalizedHostname.endsWith(".local")
  );
}
