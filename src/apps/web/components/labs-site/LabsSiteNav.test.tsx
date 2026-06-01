import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsSiteNav } from "./LabsSiteNav";

describe("LabsSiteNav", () => {
  it("renders a compact executive Innovation Studio nav with all Labs links", () => {
    const markup = renderToStaticMarkup(<LabsSiteNav activeId="themes" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain("%2Fassets%2Fbranding%2Foperon-logo.png");
    expect(markup).toContain('alt=""');
    expect(markup).toContain('href="/labs"');
    expect(markup).toContain('href="/labs/initiatives"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/signals"');
    expect(markup).toContain('href="/labs/co-innovate"');
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).toContain("Book a Call");
    expect(markup).toContain("Overview");
    expect(markup).toContain("Initiatives");
    expect(markup).toContain("Co-Innovate");
    expect(markup).not.toContain("Demo catalog");
    expect(markup).not.toContain("Proofs");
    expect(markup).not.toContain("Experiments");
    expect(markup).not.toContain("Notes");
    expect(markup).not.toContain("Briefs");
    expect(markup).not.toContain("Method");
    expect(markup).toMatch(
      /<a\b(?=[^>]*href="\/labs\/themes")(?=[^>]*aria-current="page")[^>]*>Themes<\/a>/
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
