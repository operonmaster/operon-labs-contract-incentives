import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LabsPage from "./page";

describe("LabsPage", () => {
  it("frames Operon Labs as broader than the current incentive demos", () => {
    const markup = renderToStaticMarkup(<LabsPage />);

    expect(markup).toContain("Applied R&amp;D for verifiable healthcare operations");
    expect(markup).toContain("Operon Labs turns healthcare trust infrastructure into working clinical-ops experiments.");
    expect(markup).toContain("Trust &amp; Evidence");
    expect(markup).toContain("Digital Identity");
    expect(markup).toContain("Verifiable Consent");
    expect(markup).toContain("Incentives &amp; Rewards");
    expect(markup).toContain("Instant Payments");
    expect(markup).toContain("Clinical Ops Agents");
    expect(markup).toContain("Provider Documentation Completeness");
    expect(markup).toContain("Delegate UM SLA Bonus");
    expect(markup).toContain("Specialty Rx Fulfillment SLA");
    expect(markup).toContain("Appeals Packet Quality");
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
  });
});
