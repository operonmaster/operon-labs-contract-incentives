import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ThemesPage from "./page";

describe("ThemesPage", () => {
  it("leads each theme with the executive claim instead of the taxonomy label", () => {
    const markup = renderToStaticMarkup(<ThemesPage />);

    expect(markup).toContain("The claims behind trust-native healthcare operations.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity &amp; Authority");
    expect(markup).toContain("Verifiable Consent &amp; Delegation");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Settlement &amp; Value Flow");
    expect(markup).toContain("Clinical Ops Agents &amp; AI Proof");
    expect(markup).toContain("Operations leaders need shared evidence, not screenshots and month-end reconciliation.");
    expect(markup).toMatch(/<h2>Operations leaders need shared evidence/);
    expect(markup).toMatch(/<h2>AI does not scale on output/);
  });
});
