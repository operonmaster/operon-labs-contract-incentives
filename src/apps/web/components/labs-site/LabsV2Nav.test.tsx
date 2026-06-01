import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsV2Nav } from "./LabsV2Nav";

describe("LabsV2Nav", () => {
  it("renders the v2 nav with every section link and a single active item", () => {
    const markup = renderToStaticMarkup(<LabsV2Nav activeId="co-innovate" />);

    expect(markup).toContain("Operon Labs");
    expect(markup).toContain('href="/labs_v2"');
    expect(markup).toContain('href="/labs_v2/proofs"');
    expect(markup).toContain('href="/labs_v2/themes"');
    expect(markup).toContain('href="/labs_v2/signals"');
    expect(markup).toContain('href="/labs_v2/co-innovate"');
    expect(markup).toContain("Demo catalog");
    expect(markup).not.toContain("Experiments");
    expect(markup).not.toContain("Notes");
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
