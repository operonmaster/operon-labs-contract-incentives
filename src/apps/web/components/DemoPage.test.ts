import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/policy-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/policy-store")>();

  return {
    ...actual,
    policyStore: actual.createInMemoryPolicyStore(actual.defaultIncentivePolicies)
  };
});

import { DemoPage } from "./DemoPage";

describe("DemoPage", () => {
  it("uses a policy aligned with the delegate UM demo scenario", async () => {
    const element = await DemoPage({ slug: "delegate-um" });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Policy: delegate-um-sla-bonus-v1");
    expect(markup).toContain("Reason codes: none");
    expect(markup).not.toContain("REQUEST_TYPE_NOT_ELIGIBLE");
  });
});
