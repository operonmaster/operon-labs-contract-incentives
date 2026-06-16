// @vitest-environment happy-dom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LabsUseCaseNav } from "./index";

const items = [
  { id: "vendor", label: "Vendor View", href: "/x" },
  { id: "plan", label: "Plan View", href: "/x/plan", param: "umRequestId" },
  { id: "policies", label: "Policies View", href: "/x/policies" }
];

describe("LabsUseCaseNav", () => {
  it("marks the active item and carries the context id only on param links", () => {
    const markup = renderToStaticMarkup(
      createElement(LabsUseCaseNav, {
        ariaLabel: "Demo views",
        activeId: "plan",
        contextId: "PA-1/evil",
        items
      })
    );

    expect(markup).toContain('aria-label="Demo views"');
    expect(markup).toContain('aria-current="page"');
    // context id is URL-encoded and applied only to the param link
    expect(markup).toContain("/x/plan?umRequestId=PA-1%2Fevil");
    expect(markup).toContain('href="/x"');
    expect(markup).toContain('href="/x/policies"');
    expect(markup).not.toContain("/x/policies?");
  });

  it("omits the query param when no context id is supplied", () => {
    const markup = renderToStaticMarkup(
      createElement(LabsUseCaseNav, { ariaLabel: "Demo views", activeId: "vendor", items })
    );

    expect(markup).toContain('href="/x/plan"');
    expect(markup).not.toContain("?umRequestId=");
  });
});
