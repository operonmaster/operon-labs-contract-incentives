import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("renders the executive Innovation Studio front door", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("Innovation Studio for Healthcare Operations");
    expect(markup).toContain('<span class="eyebrow">Healthcare operations innovation studio</span>');
    expect(markup).toContain("Bring a healthcare operations workflow under pressure.");
    expect(markup).toContain("Healthcare innovation breaks when the operating model is unclear.");
    expect(markup).toContain("what can run, who can act, what evidence proves it");
    expect(markup).toContain("Authority");
    expect(markup).toContain("Evidence");
    expect(markup).toContain("Working demo");
    expect(markup).toContain("See how delegated UM quality becomes a governed operating model.");
    expect(markup).toContain("timeliness, rationale completeness, audit readiness, policy exclusions");
    expect(markup).toContain("Delegated review");
    expect(markup).toContain("Assigned reviewer");
    expect(markup).toContain("SLA + rationale");
    expect(markup).toContain("No outcome bias");
    expect(markup).toContain("Quality incentive");
    expect(markup).toContain("View working demo");
    expect(markup).toContain("Bring a workflow. Leave with a working model.");
    expect(markup).toContain("From operating pressure to implementation path");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).toContain('href="/labs/initiatives"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/signals"');
    expect(markup).toContain('href="/delegate-um"');
    expect(markup).not.toContain('href="mailto:partners@operon.cloud"');
    expect(markup).not.toContain("Open model");
    expect(markup).not.toContain('<span class="eyebrow">Operon Labs</span>');
    expect(markup).not.toContain("Reward review quality without paying for outcomes.");
    expect(markup).not.toContain("Example operating model");
  });

  it("keeps heavy taxonomy off the homepage", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).not.toContain("Digital Identity &amp; Authority");
    expect(markup).not.toContain("Verifiable Consent &amp; Delegation");
    expect(markup).not.toContain("Instant Payments &amp; Value Flow");
    expect(markup).not.toContain("Clinical Ops Agents &amp; AI Accountability");
    expect(markup).not.toContain("Why screenshots do not prove healthcare operations");
    expect(markup).not.toContain("Select an executive-pressure workflow");
    expect(markup).not.toContain("Why healthcare AI pilots struggle to become operating models");
    expect(markup).not.toContain("Experiments you can inspect.");
    expect(markup).not.toContain("Field notes from the trust layer.");
    expect(markup).not.toContain("ID.Operon");
    expect(markup).not.toContain("Trust.Operon");
    expect(markup).not.toContain("Pulse.Operon");
    expect(markup).not.toContain("Explore Operon Labs");
  });
});
