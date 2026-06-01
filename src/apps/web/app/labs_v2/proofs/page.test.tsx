import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsV2ProofsPage from "./page";

describe("LabsV2ProofsPage", () => {
  it("leads each proof with the executive question and links to the live demo", () => {
    const markup = renderToStaticMarkup(<LabsV2ProofsPage />);

    expect(markup).toContain("A proof states a claim you can inspect.");
    expect(markup).toContain("Actor");
    expect(markup).toContain("Settlement");
    expect(markup).toContain("Audit");
    expect(markup).toContain("Can better upstream evidence cut avoidable prior-auth rework");
    expect(markup).toContain('href="/provider-documentation"');
    expect(markup).toContain('href="/delegate-um"');
    expect(markup).toContain('href="/specialty-rx"');
    expect(markup).toContain('href="/appeals"');
  });
});
