import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsV2ThemesPage from "./page";

describe("LabsV2ThemesPage", () => {
  it("leads each theme with the executive claim, not the taxonomy label", () => {
    const markup = renderToStaticMarkup(<LabsV2ThemesPage />);

    expect(markup).toContain("The questions we think decide the next decade of operations.");
    expect(markup).toContain("Operations leaders need shared evidence, not screenshots and month-end reconciliation.");
    expect(markup).toContain("Value should move when contract-defined operational quality is proven");
    expect(markup).toContain("AI does not scale on output.");
  });
});
