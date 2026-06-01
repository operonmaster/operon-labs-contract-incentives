import { describe, expect, it } from "vitest";

import {
  coInnovateOffer,
  coInnovateSteps,
  initiativeCards,
  initiativeMethodSteps,
  labsNavItems,
  labsPortalCards,
  operatingModelSpine,
  platformSpine,
  researchThemes,
  signals,
  type InitiativeSlug
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines the executive Innovation Studio navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/initiatives",
      "/labs/themes",
      "/labs/signals",
      "/labs/co-innovate"
    ]);

    expect(labsNavItems.map((item) => item.label)).toEqual([
      "Overview",
      "Initiatives",
      "Themes",
      "Signals",
      "Co-Innovate"
    ]);
    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/initiatives",
      "/labs/themes",
      "/labs/signals",
      "/labs/co-innovate"
    ]);
  });

  it("stores Innovation Studio themes, signals, and co-innovation content away from the homepage", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Clinical Ops Agents & AI Accountability",
      "Incentives & Rewards",
      "Instant Payments & Value Flow",
      "Digital Identity & Authority",
      "Verifiable Consent & Delegation",
      "Operational Visibility"
    ]);
    expect(signals.map((signal) => signal.title)).toEqual([
      "Why healthcare AI pilots struggle to become operating models",
      "How to reward quality without rewarding outcomes",
      "When instant payments need a human checkpoint",
      "Agentic operations need ownership before autonomy"
    ]);
    expect(coInnovateOffer.map((offer) => offer.label)).toEqual([
      "What you bring",
      "What we build",
      "What it connects to",
      "What you keep"
    ]);
    expect(coInnovateOffer.map((offer) => offer.title)).toEqual([
      "An executive-pressure workflow",
      "A working model, not a slide deck",
      "Production-aligned primitives",
      "Your context, reusable pattern"
    ]);
    expect(coInnovateSteps.map((step) => step.title)).toEqual([
      "Bring an executive-pressure workflow",
      "Define the operating claim",
      "Build an inspectable model",
      "Decide the next path"
    ]);
    expect(platformSpine.map((item) => item.product)).toEqual(["ID.Operon", "Trust.Operon", "Pulse.Operon"]);
    expect(initiativeMethodSteps).toEqual(["Workflow", "Actors", "Data", "Policy", "Value", "Path"]);
    expect(operatingModelSpine).toEqual(["Workflow", "Authority", "Evidence", "Policy", "Value", "Path"]);
  });

  it("frames every current initiative with an executive question and operating focus", () => {
    const expectedSlugs: InitiativeSlug[] = [
      "provider-documentation",
      "delegate-um",
      "specialty-rx",
      "appeals"
    ];

    expect(initiativeCards.map((initiative) => initiative.slug)).toEqual(expectedSlugs);
    expect(initiativeCards.map((initiative) => initiative.title)).toEqual([
      "Prior Auth Readiness Model",
      "Delegated UM Quality Model",
      "Specialty Rx Fulfillment Model",
      "Appeals Readiness Model"
    ]);
    expect(initiativeCards[0].executiveQuestion).toContain("documentation readiness");
    expect(initiativeCards[3].modelFocus).toContain("receipt-based SLA");
  });
});
