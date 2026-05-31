import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("renders a sparse Magazine Lab front door", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("The lab for verifiable healthcare operations.");
    expect(markup).toContain("Operon Labs prototypes trust, consent, identity, and value-flow systems");
    expect(markup).toContain("Policy-triggered rewards for clinical operations");
    expect(markup).toContain("What counts as proof in a prior-auth workflow?");
    expect(markup).toContain("Patient consent as executable infrastructure");
    expect(markup).toContain('href="/labs/experiments"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/notes"');
    expect(markup).toContain('href="/labs/about"');
  });

  it("keeps heavy taxonomy off the homepage", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).not.toContain("Digital Identity");
    expect(markup).not.toContain("Verifiable Consent");
    expect(markup).not.toContain("Instant Payments");
    expect(markup).not.toContain("Clinical Ops Agents");
    expect(markup).not.toContain("Was the actor authorized?");
    expect(markup).not.toContain("Each experiment needs a workflow, a trust claim, and an execution path.");
  });
});
