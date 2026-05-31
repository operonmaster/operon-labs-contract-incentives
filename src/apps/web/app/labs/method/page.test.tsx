import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MethodPage from "./page";

describe("MethodPage", () => {
  it("renders the Labs proof method and partner CTA", () => {
    const markup = renderToStaticMarkup(<MethodPage />);

    expect(markup).toContain("How Labs turns workflows into proof.");
    expect(markup).toContain("Select an executive-pressure workflow");
    expect(markup).toContain("Define the proof claim");
    expect(markup).toContain("Model identity, consent, policy, and evidence");
    expect(markup).toContain("Build an inspectable proof model");
    expect(markup).toContain("Decide the next path");
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
    expect(markup).toContain('href="/labs/proofs"');
  });
});
