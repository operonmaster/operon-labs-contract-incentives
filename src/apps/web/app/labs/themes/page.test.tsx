import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ThemesPage from "./page";

describe("ThemesPage", () => {
  it("leads each theme with the executive claim instead of the taxonomy label", () => {
    const markup = renderToStaticMarkup(<ThemesPage />);

    expect(markup).toContain("Innovation themes for healthcare operations.");
    expect(markup).toContain("Clinical Ops Agents &amp; AI Accountability");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Payments &amp; Value Flow");
    expect(markup).toContain("Digital Identity &amp; Authority");
    expect(markup).toContain("Verifiable Consent &amp; Delegation");
    expect(markup).toContain("Operational Visibility");
    expect(markup).toContain("AI belongs inside governed workflows, not beside them.");
    expect(markup).toContain("Working on one of these questions?");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).toMatch(/<h2>AI belongs inside governed workflows/);
    expect(markup).not.toContain("trust-native");
    expect(markup).not.toContain("Trust &amp; Evidence");
  });
});
