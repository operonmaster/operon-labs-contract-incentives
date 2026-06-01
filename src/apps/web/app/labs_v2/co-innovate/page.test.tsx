import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsV2CoInnovatePage from "./page";

describe("LabsV2CoInnovatePage", () => {
  it("presents an executive co-innovation engagement with a clear apply CTA", () => {
    const markup = renderToStaticMarkup(<LabsV2CoInnovatePage />);

    expect(markup).toContain("Bring a workflow. Leave with a proof.");
    expect(markup).toContain("What you leave with");
    expect(markup).toContain("Bring an executive-pressure workflow");
    expect(markup).toContain("Define the proof claim");
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
  });
});
