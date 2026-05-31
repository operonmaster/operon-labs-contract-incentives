import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CoInnovatePage from "./page";

describe("CoInnovatePage", () => {
  it("renders the executive co-innovation engagement model", () => {
    const markup = renderToStaticMarkup(<CoInnovatePage />);

    expect(markup).toContain("Bring a workflow. Leave with a proof.");
    expect(markup).toContain("executive proof-studio track");
    expect(markup).toContain("A working proof, not a slide deck");
    expect(markup).toContain("Production-aligned primitives");
    expect(markup).toContain("Your operating context, reusable proof");
    expect(markup).toContain("Bring an executive-pressure workflow");
    expect(markup).toContain("Define the proof claim");
    expect(markup).toContain("Build an inspectable proof model");
    expect(markup).toContain("Decide the next path");
    expect(markup).toContain('href="mailto:partners@operon.cloud"');
    expect(markup).toContain('href="/labs/proofs"');
    expect(markup).not.toContain("Your problem, your IP");
  });
});
