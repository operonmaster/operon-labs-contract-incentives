import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BriefsPage from "./page";

describe("BriefsPage", () => {
  it("renders executive brief teasers", () => {
    const markup = renderToStaticMarkup(<BriefsPage />);

    expect(markup).toContain("Briefs from the healthcare proof layer.");
    expect(markup).toContain("From AI pilot to operational proof");
    expect(markup).toContain("Consent as executable infrastructure");
    expect(markup).toContain("Rewards without outcome bias");
    expect(markup).toContain("Why screenshots do not prove healthcare operations");
    expect(markup).toContain("When instant settlement needs a human checkpoint");
    expect(markup).toContain("Executive brief");
  });
});
