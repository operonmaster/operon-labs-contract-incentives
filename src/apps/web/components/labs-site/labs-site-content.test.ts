import { describe, expect, it } from "vitest";

import {
  coInnovateOffer,
  coInnovateSteps,
  labsNavItems,
  labsPortalCards,
  platformSpine,
  proofCards,
  proofMethodSteps,
  researchThemes,
  signals,
  type ProofSlug
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines the executive Proof Studio navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/proofs",
      "/labs/themes",
      "/labs/signals",
      "/labs/co-innovate"
    ]);

    expect(labsNavItems.map((item) => item.label)).toEqual([
      "Overview",
      "Proofs",
      "Themes",
      "Signals",
      "Co-Innovate"
    ]);
    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/proofs",
      "/labs/themes",
      "/labs/signals",
      "/labs/co-innovate"
    ]);
  });

  it("stores Proof Studio themes, signals, and co-innovation content away from the homepage", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Trust & Evidence",
      "Digital Identity & Authority",
      "Verifiable Consent & Delegation",
      "Incentives & Rewards",
      "Instant Settlement & Value Flow",
      "Clinical Ops Agents & AI Proof"
    ]);
    expect(signals.map((signal) => signal.title)).toEqual([
      "Why healthcare AI pilots struggle to become operational proof",
      "How to reward quality without rewarding outcomes",
      "When instant settlement needs a human checkpoint",
      "Agents are about to act inside operations. Can you prove what they did?"
    ]);
    expect(coInnovateOffer.map((offer) => offer.title)).toEqual([
      "A working proof, not a slide deck",
      "Production-aligned primitives",
      "Your operating context, reusable proof"
    ]);
    expect(coInnovateSteps.map((step) => step.title)).toEqual([
      "Bring an executive-pressure workflow",
      "Define the proof claim",
      "Build an inspectable proof model",
      "Decide the next path"
    ]);
    expect(platformSpine.map((item) => item.product)).toEqual(["ID.Operon", "Trust.Operon", "Pulse.Operon"]);
    expect(proofMethodSteps).toEqual(["Actor", "Evidence", "Policy", "Control", "Settlement", "Audit"]);
  });

  it("frames every current proof with an executive question and evidence claim", () => {
    const expectedSlugs: ProofSlug[] = [
      "provider-documentation",
      "delegate-um",
      "specialty-rx",
      "appeals"
    ];

    expect(proofCards.map((proof) => proof.slug)).toEqual(expectedSlugs);
    expect(proofCards.map((proof) => proof.title)).toEqual([
      "Prior Auth Evidence Readiness",
      "Delegated UM Quality Proof",
      "Specialty Rx Fulfillment Proof",
      "Appeals Readiness Proof"
    ]);
    expect(proofCards[0].executiveQuestion).toContain("upstream evidence");
    expect(proofCards[3].whatIsProven).toContain("receipt-based SLA");
  });
});
