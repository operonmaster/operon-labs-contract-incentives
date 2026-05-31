import { describe, expect, it } from "vitest";

import {
  briefs,
  labsNavItems,
  labsPortalCards,
  methodSteps,
  platformSpine,
  proofCards,
  proofMethodSteps,
  researchThemes,
  type ProofSlug
} from "./labs-site-content";

describe("labs site content", () => {
  it("defines Proof Studio navigation and homepage portals", () => {
    expect(labsNavItems.map((item) => item.href)).toEqual([
      "/labs",
      "/labs/proofs",
      "/labs/themes",
      "/labs/briefs",
      "/labs/method"
    ]);

    expect(labsNavItems.map((item) => item.label)).toEqual(["Labs", "Proofs", "Themes", "Briefs", "Method"]);
    expect(labsPortalCards.map((card) => card.href)).toEqual([
      "/labs/proofs",
      "/labs/themes",
      "/labs/briefs",
      "/labs/method"
    ]);
  });

  it("stores Proof Studio content away from the homepage", () => {
    expect(researchThemes.map((theme) => theme.title)).toEqual([
      "Trust & Evidence",
      "Digital Identity & Authority",
      "Verifiable Consent & Delegation",
      "Incentives & Rewards",
      "Instant Settlement & Value Flow",
      "Clinical Ops Agents & AI Proof"
    ]);
    expect(briefs).toHaveLength(5);
    expect(methodSteps.map((step) => step.title)).toEqual([
      "Select an executive-pressure workflow",
      "Define the proof claim",
      "Model identity, consent, policy, and evidence",
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
