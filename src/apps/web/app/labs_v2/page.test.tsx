import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsV2OverviewPage from "./page";

describe("LabsV2OverviewPage", () => {
  it("leads with a provocation hero, the 88/5 stat, and a co-innovate path", () => {
    const markup = renderToStaticMarkup(<LabsV2OverviewPage />);

    expect(markup).toContain("The proving ground for AI in healthcare operations.");
    expect(markup).toContain("88% run AI. ~5% can prove it works.");
    expect(markup).toContain("Bring a workflow. Leave with a proof.");
    expect(markup).toContain('href="/labs_v2/proofs"');
    expect(markup).toContain('href="/labs_v2/co-innovate"');
    // featured proof links straight to a live demo for try-it energy
    expect(markup).toContain('href="/delegate-um"');
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
  });
});
