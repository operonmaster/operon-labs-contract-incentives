import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import InitiativesPage from "./page";

describe("InitiativesPage", () => {
  it("renders the current demos as healthcare operations initiatives", () => {
    const markup = renderToStaticMarkup(<InitiativesPage />);

    expect(markup).toContain("Healthcare operations initiatives in motion.");
    expect(markup).toContain("coordination, automation, incentives, and implementation");
    expect(markup).toContain("Prior Auth Readiness Model");
    expect(markup).toContain("Delegated UM Quality Model");
    expect(markup).toContain("Specialty Rx Fulfillment Model");
    expect(markup).toContain("Appeals Readiness Model");
    expect(markup).toContain("Can better documentation readiness reduce avoidable prior-auth friction before review starts?");
    expect(markup).toContain("Can exception-path readiness be rewarded without touching appeal outcomes?");
    expect(markup).toContain('href="/provider-documentation"');
    expect(markup).toContain('href="/appeals"');
    expect(markup).toContain("Have a workflow like this?");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).not.toContain("Initiative model method");
    expect(markup).not.toContain("Workflow to path");
    expect(markup).not.toContain("Proofs you can inspect.");
    expect(markup).not.toContain("Working models you can inspect.");
  });
});
