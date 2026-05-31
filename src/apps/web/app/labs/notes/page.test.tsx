import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotesPage from "./page";

describe("NotesPage", () => {
  it("renders static field-note teasers", () => {
    const markup = renderToStaticMarkup(<NotesPage />);

    expect(markup).toContain("Field notes from the trust layer.");
    expect(markup).toContain("What counts as proof in a prior-auth workflow?");
    expect(markup).toContain("Patient consent as executable infrastructure");
    expect(markup).toContain("Rewards without outcome bias");
    expect(markup).toContain("When instant payment needs a human checkpoint");
    expect(markup).toContain(
      "A practical pattern for combining programmable settlement with explicit approval controls."
    );
  });
});
