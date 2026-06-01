import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CoInnovatePage from "./page";

describe("CoInnovatePage", () => {
  it("renders the executive co-innovation engagement model", () => {
    const markup = renderToStaticMarkup(<CoInnovatePage />);

    expect(markup).toContain("Bring a workflow. Leave with a working model.");
    expect(markup).toContain("executive innovation track");
    expect(markup).toContain("What you bring");
    expect(markup).toContain("An executive-pressure workflow");
    expect(markup).toContain("workflow, authority, evidence, policy, value, and path to implementation");
    expect(markup).toContain("What we build");
    expect(markup).toContain("A working model, not a slide deck");
    expect(markup).toContain("What it connects to");
    expect(markup).toContain("Production-aligned primitives");
    expect(markup).toContain("What you keep");
    expect(markup).toContain("Your context, reusable pattern");
    expect(markup).not.toContain("What you leave with");
    expect(markup).toContain("Bring an executive-pressure workflow");
    expect(markup).toContain("Define the operating claim");
    expect(markup).toContain("Build an inspectable model");
    expect(markup).toContain("Decide the next path");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).toContain('href="/labs/initiatives"');
    expect(markup).not.toContain('href="mailto:partners@operon.cloud"');
    expect(markup).not.toContain("Your problem, your IP");
  });
});
