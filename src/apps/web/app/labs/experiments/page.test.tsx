import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ExperimentsPage from "./page";

describe("ExperimentsPage", () => {
  it("renders the current demos as inspectable Labs experiments", () => {
    const markup = renderToStaticMarkup(<ExperimentsPage />);

    expect(markup).toContain("Experiments you can inspect.");
    expect(markup).toContain("Workflow friction");
    expect(markup).toContain("Trust claim");
    expect(markup).toContain("Evidence model");
    expect(markup).toContain("Policy decision");
    expect(markup).toContain("Controlled execution");
    expect(markup).toContain("Provider Documentation Completeness");
    expect(markup).toContain("Delegate UM SLA Bonus");
    expect(markup).toContain("Specialty Rx Fulfillment SLA");
    expect(markup).toContain("Appeals Packet Quality");
    expect(markup).toContain("Can better upstream evidence reduce avoidable prior-auth friction?");
    expect(markup).toContain("Can exception-path readiness be rewarded without touching appeal outcomes?");
    expect(markup).toContain('href="/provider-documentation"');
    expect(markup).toContain('href="/appeals"');
  });
});
