import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SignalsPage from "./page";

describe("SignalsPage", () => {
  it("renders executive intelligence instead of notes or generic briefs", () => {
    const markup = renderToStaticMarkup(<SignalsPage />);

    expect(markup).toContain("Forward intelligence for healthcare operations leaders.");
    expect(markup).toContain("Why healthcare AI pilots struggle to become operating models");
    expect(markup).toContain("How to reward quality without rewarding outcomes");
    expect(markup).toContain("When instant payments need a human checkpoint");
    expect(markup).toContain("Agentic operations need ownership before autonomy");
    expect(markup).toContain("Executive signal");
    expect(markup).toContain("workflow ownership, implementation path, and governance");
    expect(markup).toContain("Working on one of these questions?");
    expect(markup).toContain("Book a Call");
    expect(markup).toContain('href="/labs/book-a-call"');
    expect(markup).not.toContain("88% run AI");
    expect(markup).not.toContain("Field notes");
  });
});
