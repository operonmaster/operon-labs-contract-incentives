import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("renders the executive Proof Studio front door", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("Where healthcare operations become provable.");
    expect(markup).toContain("helps healthcare leaders turn high-pressure workflows into inspectable proof models");
    expect(markup).toContain("Proof beats pilot activity.");
    expect(markup).toContain("Score delegated review quality without paying for outcomes.");
    expect(markup).toContain("Bring a workflow. Leave with a proof.");
    expect(markup).toContain("ID.Operon");
    expect(markup).toContain("Trust.Operon");
    expect(markup).toContain("Pulse.Operon");
    expect(markup).toContain('href="/labs/co-innovate"');
    expect(markup).toContain('href="/labs/proofs"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/signals"');
  });

  it("keeps heavy taxonomy off the homepage", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).not.toContain("Digital Identity &amp; Authority");
    expect(markup).not.toContain("Verifiable Consent &amp; Delegation");
    expect(markup).not.toContain("Instant Settlement &amp; Value Flow");
    expect(markup).not.toContain("Clinical Ops Agents &amp; AI Proof");
    expect(markup).not.toContain("Why screenshots do not prove healthcare operations");
    expect(markup).not.toContain("Select an executive-pressure workflow");
    expect(markup).not.toContain("Why healthcare AI pilots struggle to become operational proof");
    expect(markup).not.toContain("Experiments you can inspect.");
    expect(markup).not.toContain("Field notes from the trust layer.");
  });
});
