import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsV2SignalsPage from "./page";

describe("LabsV2SignalsPage", () => {
  it("ships real Signals with substance and an honest status", () => {
    const markup = renderToStaticMarkup(<LabsV2SignalsPage />);

    expect(markup).toContain("Forward intelligence for operations leaders.");
    expect(markup).toContain("prove their AI works");
    expect(markup).toContain("How to reward quality without rewarding outcomes");
    expect(markup).toContain("Published");
    expect(markup).toContain("In progress");
  });
});
