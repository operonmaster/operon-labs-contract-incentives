import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DelegatePlanConsole } from "./DelegatePlanConsole";

describe("DelegatePlanConsole source", () => {
  it("shows plan SLA and outcome status fields from the delegate plan API", () => {
    const source = readFileSync(path.join(process.cwd(), "src/apps/web/components/delegate-um/DelegatePlanConsole.tsx"), "utf8");

    expect(source).toContain("/api/delegate-um/plan");
    expect(source).toContain("Outcome status");
    expect(source).toContain("SLA");
    expect(source).toContain('className="row-action mono-cell"');
    expect(source).toContain("aria-pressed={row.umRequestId === selectedUmRequestId}");
  });

  it("renders the plan view shell with loading state and delegate navigation", () => {
    const markup = renderToStaticMarkup(createElement(DelegatePlanConsole, { initialUmRequestId: "PA-260526-0900-REVIEW1" }));

    expect(markup).toContain("Delegate determination log");
    expect(markup).toContain("Refresh plan view");
    expect(markup).toContain("Loading delegate plan audit rows");
    expect(markup).toContain("/delegate-um/policies");
    expect(markup).toContain("/delegate-um/plan?umRequestId=PA-260526-0900-REVIEW1");
  });
});
