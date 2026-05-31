import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AboutPage from "./page";

describe("AboutPage", () => {
  it("renders the Labs method and partner CTA", () => {
    const markup = renderToStaticMarkup(<AboutPage />);

    expect(markup).toContain("How Operon Labs works.");
    expect(markup).toContain("Bring a workflow");
    expect(markup).toContain("Define the trust claim");
    expect(markup).toContain("Build the evidence path");
    expect(markup).toContain("Make it inspectable");
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
    expect(markup).toContain('href="/labs/experiments"');
  });
});
