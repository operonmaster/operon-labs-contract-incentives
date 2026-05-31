import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SignalsPage from "./page";

describe("SignalsPage", () => {
  it("renders executive intelligence instead of notes or generic briefs", () => {
    const markup = renderToStaticMarkup(<SignalsPage />);

    expect(markup).toContain("Forward intelligence for healthcare operations leaders.");
    expect(markup).toContain("Why healthcare AI pilots struggle to become operational proof");
    expect(markup).toContain("How to reward quality without rewarding outcomes");
    expect(markup).toContain("When instant settlement needs a human checkpoint");
    expect(markup).toContain("Agents are about to act inside operations. Can you prove what they did?");
    expect(markup).toContain("Executive signal");
    expect(markup).not.toContain("88% run AI");
    expect(markup).not.toContain("Field notes");
  });
});
