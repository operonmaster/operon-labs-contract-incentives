import { describe, expect, it } from "vitest";

import {
  aboutSteps,
  type CurrentExperimentSlug,
  experimentFramingBySlug,
  experimentMethodSteps,
  fieldNotes,
  labsNavItems,
  labsPortalCards,
  researchThemes
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines the Magazine Lab navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/experiments",
      "/labs/themes",
      "/labs/notes",
      "/labs/about"
    ]);

    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/experiments",
      "/labs/notes",
      "/labs/themes"
    ]);
  });

  it("keeps heavy content off the homepage by storing it in subpage content arrays", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Trust & Evidence",
      "Digital Identity",
      "Verifiable Consent",
      "Incentives & Rewards",
      "Instant Payments",
      "Clinical Ops Agents"
    ]);
    expect(fieldNotes).toHaveLength(4);
    expect(aboutSteps.map((step) => step.title)).toEqual([
      "Bring a workflow",
      "Define the trust claim",
      "Build the evidence path",
      "Make it inspectable"
    ]);
    expect(experimentMethodSteps).toEqual([
      "Workflow friction",
      "Trust claim",
      "Evidence model",
      "Policy decision",
      "Controlled execution"
    ]);
  });

  it("frames every current experiment with a research question", () => {
    const expectedSlugs: CurrentExperimentSlug[] = [
      "provider-documentation",
      "delegate-um",
      "specialty-rx",
      "appeals"
    ];

    expect(Object.keys(experimentFramingBySlug)).toEqual(expectedSlugs);
    expect(experimentFramingBySlug).toMatchObject({
      "provider-documentation": "Can better upstream evidence reduce avoidable prior-auth friction?",
      "delegate-um": "Can delegated review quality be proven without relying on outcome incentives?",
      "specialty-rx": "Can post-authorization fulfillment be measured as a trust-preserving workflow?",
      appeals: "Can exception-path readiness be rewarded without touching appeal outcomes?"
    });
  });
});
