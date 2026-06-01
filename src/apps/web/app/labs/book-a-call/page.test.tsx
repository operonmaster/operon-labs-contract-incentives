import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import BookACallPage from "./page";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("BookACallPage", () => {
  it("renders a focused Labs contact form for healthcare operations leaders", () => {
    const markup = renderToStaticMarkup(<BookACallPage />);

    expect(markup).toContain("Talk through a healthcare operations workflow.");
    expect(markup).toContain("No pitch deck. No pressure.");
    expect(markup).toContain("What to expect");
    expect(markup).toContain("Discovery, not a demo");
    expect(markup).toContain("Talk to the Labs team");
    expect(markup).toContain("30-minute working conversation");
    expect(markup).toContain("Clear next step");
    expect(markup).toContain("Full name");
    expect(markup).toContain("Work email");
    expect(markup).toContain("Role / title");
    expect(markup).toContain("Organization");
    expect(markup).toContain("Workflow area");
    expect(markup).toContain("What are you trying to solve?");
    expect(markup).toContain("Select one");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('action="mailto:partners@operon.cloud?subject=Operon%20Labs%20Book%20a%20Call"');
    expect(markup).toContain('method="post"');
    expect(markup).toContain('encType="text/plain"');
  });

  it("composes the intake page from shared Labs UI primitives instead of bespoke controls", () => {
    const source = readRepoFile("src/apps/web/app/labs/book-a-call/page.tsx");
    const markup = renderToStaticMarkup(<BookACallPage />);

    expect(source).toContain("LabsProductFrame");
    expect(source).toContain("BookACallForm");
    expect(source).not.toContain('<button className="primary-button"');
    expect(source).not.toContain('className="labs-book-field"');
    expect(markup).toContain("op-product-frame");
    expect(markup).toContain("labs-form-control");
    expect(markup).toContain("op-panel labs-form labs-book-form");
  });
});
