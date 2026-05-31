import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("renders the Proof Studio front door", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("Proof studio for healthcare operations.");
    expect(markup).toContain("Operon Labs turns identity, consent, evidence, incentives, and instant settlement");
    expect(markup).toContain("From pilot activity to operational proof");
    expect(markup).toContain("Policy-bound clinical operations rewards");
    expect(markup).toContain("ID.Operon");
    expect(markup).toContain("Trust.Operon");
    expect(markup).toContain("Pulse.Operon");
    expect(markup).toContain('href="/labs/proofs"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/briefs"');
    expect(markup).toContain('href="/labs/method"');
  });

  it("keeps heavy taxonomy off the homepage", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).not.toContain("Digital Identity &amp; Authority");
    expect(markup).not.toContain("Verifiable Consent &amp; Delegation");
    expect(markup).not.toContain("Instant Settlement &amp; Value Flow");
    expect(markup).not.toContain("Clinical Ops Agents &amp; AI Proof");
    expect(markup).not.toContain("Why screenshots do not prove healthcare operations");
    expect(markup).not.toContain("Select an executive-pressure workflow");
    expect(markup).not.toContain("Experiments you can inspect.");
    expect(markup).not.toContain("Field notes from the trust layer.");
  });
});
