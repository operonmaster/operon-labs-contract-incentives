import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsSiteNav } from "./LabsSiteNav";

describe("LabsSiteNav", () => {
  it("renders a compact Proof Studio nav with all Labs links", () => {
    const markup = renderToStaticMarkup(<LabsSiteNav activeId="themes" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain('href="/labs"');
    expect(markup).toContain('href="/labs/proofs"');
    expect(markup).toContain('href="/labs/themes"');
    expect(markup).toContain('href="/labs/briefs"');
    expect(markup).toContain('href="/labs/method"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Demo catalog");
    expect(markup).not.toContain("Experiments");
    expect(markup).not.toContain("Notes");
    expect(markup).toMatch(
      /<a\b(?=[^>]*href="\/labs\/themes")(?=[^>]*aria-current="page")[^>]*>Themes<\/a>/
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
