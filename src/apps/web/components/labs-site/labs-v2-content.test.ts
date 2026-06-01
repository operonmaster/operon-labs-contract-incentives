import { describe, expect, it } from "vitest";

import {
  coInnovateOffer,
  coInnovateSteps,
  labsV2NavItems,
  labsV2PortalCards,
  labsV2Proofs,
  labsV2Signals,
  labsV2Stat,
  labsV2Themes,
  proofSequence
} from "./labs-v2-content";

describe("labs v2 content", () => {
  it("defines the v2 navigation and portals under /labs_v2", () => {
    expect(labsV2NavItems.map((item) => item.href)).toEqual([
      "/labs_v2",
      "/labs_v2/proofs",
      "/labs_v2/themes",
      "/labs_v2/signals",
      "/labs_v2/co-innovate"
    ]);
    expect(labsV2NavItems.map((item) => item.label)).toEqual([
      "Overview",
      "Proofs",
      "Themes",
      "Signals",
      "Co-Innovate"
    ]);
    expect(labsV2PortalCards.map((card) => card.href)).toEqual([
      "/labs_v2/proofs",
      "/labs_v2/themes",
      "/labs_v2/signals",
      "/labs_v2/co-innovate"
    ]);
  });

  it("maps the four demos to proofs that link to the live demo routes", () => {
    expect(labsV2Proofs.map((proof) => proof.slug)).toEqual([
      "provider-documentation",
      "delegate-um",
      "specialty-rx",
      "appeals"
    ]);
    expect(labsV2Proofs.map((proof) => proof.route)).toEqual([
      "/provider-documentation",
      "/delegate-um",
      "/specialty-rx",
      "/appeals"
    ]);
  });

  it("ships substantive Signals instead of an empty shelf", () => {
    const published = labsV2Signals.filter((signal) => signal.status === "Published");
    expect(published.length).toBeGreaterThanOrEqual(3);
    published.forEach((signal) => {
      expect(signal.body.length).toBeGreaterThan(200);
    });
  });

  it("keeps the chain out of the v2 surface (blockchain stays nearly hidden)", () => {
    const surface = JSON.stringify([
      labsV2Stat,
      labsV2PortalCards,
      labsV2Proofs,
      labsV2Themes,
      labsV2Signals,
      coInnovateOffer,
      coInnovateSteps,
      proofSequence
    ]).toLowerCase();

    for (const term of ["hedera", "hbar", "blockchain", "on-chain", "onchain", "crypto", "ledger", "token", "web3"]) {
      expect(surface).not.toContain(term);
    }
  });
});
