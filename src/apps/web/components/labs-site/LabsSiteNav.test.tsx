import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsSiteNav } from "./LabsSiteNav";

describe("LabsSiteNav", () => {
  it("renders a compact editorial masthead with all Labs links", () => {
    const markup = renderToStaticMarkup(<LabsSiteNav activeId="themes" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain('href="/labs"');
    expect(markup).toContain('href="/labs/experiments"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/notes"');
    expect(markup).toContain('href="/labs/about"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Demo catalog");
    expect(markup).toContain('aria-current="page"');
  });
});
