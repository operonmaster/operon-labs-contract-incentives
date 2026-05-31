import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ThemesPage from "./page";

describe("ThemesPage", () => {
  it("renders the full Labs research taxonomy away from the homepage", () => {
    const markup = renderToStaticMarkup(<ThemesPage />);

    expect(markup).toContain("Research themes for trust-native healthcare operations.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity");
    expect(markup).toContain("Verifiable Consent");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Payments");
    expect(markup).toContain("Clinical Ops Agents");
    expect(markup).toContain("Signed events, proof packets, audit trails, and AI accountability.");
  });
});
