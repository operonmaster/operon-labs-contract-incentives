import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ThemesPage from "./page";

describe("ThemesPage", () => {
  it("renders the full Proof Studio theme taxonomy away from the homepage", () => {
    const markup = renderToStaticMarkup(<ThemesPage />);

    expect(markup).toContain("Themes for trust-native healthcare operations.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity &amp; Authority");
    expect(markup).toContain("Verifiable Consent &amp; Delegation");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Settlement &amp; Value Flow");
    expect(markup).toContain("Clinical Ops Agents &amp; AI Proof");
    expect(markup).toContain("Healthcare leaders need shared evidence, not screenshots and retrospective reconciliation.");
  });
});
