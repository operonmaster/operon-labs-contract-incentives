import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProofsPage from "./page";

describe("ProofsPage", () => {
  it("renders the current demos as inspectable proof models", () => {
    const markup = renderToStaticMarkup(<ProofsPage />);

    expect(markup).toContain("Proofs you can inspect.");
    expect(markup).toContain("Actor");
    expect(markup).toContain("Evidence");
    expect(markup).toContain("Policy");
    expect(markup).toContain("Control");
    expect(markup).toContain("Settlement");
    expect(markup).toContain("Audit");
    expect(markup).toContain("Prior Auth Evidence Readiness");
    expect(markup).toContain("Delegated UM Quality Proof");
    expect(markup).toContain("Specialty Rx Fulfillment Proof");
    expect(markup).toContain("Appeals Readiness Proof");
    expect(markup).toContain("Can upstream evidence reduce avoidable prior-auth friction before review starts?");
    expect(markup).toContain("Can exception-path readiness be rewarded without touching appeal outcomes?");
    expect(markup).toContain('href="/provider-documentation"');
    expect(markup).toContain('href="/appeals"');
  });
});
