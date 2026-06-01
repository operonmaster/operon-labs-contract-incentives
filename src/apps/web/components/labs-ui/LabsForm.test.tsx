import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LabsButton, LabsForm, LabsTextareaField, LabsTextField } from "./index";

describe("Labs form primitives", () => {
  it("renders a shared panel-backed form with consistent field controls", () => {
    const markup = renderToStaticMarkup(
      <LabsForm action="/submit" className="demo-form" method="post">
        <LabsTextField autoComplete="name" label="Full name" name="fullName" required />
        <LabsTextareaField label="Context" name="context" rows={4} />
        <LabsButton type="submit">Submit</LabsButton>
      </LabsForm>
    );

    expect(markup).toContain('class="op-panel labs-form demo-form"');
    expect(markup).toContain('<label class="labs-form-field">');
    expect(markup).toContain('<span>Full name</span>');
    expect(markup).toMatch(/<input\b(?=[^>]*class="labs-form-control")(?=[^>]*name="fullName")/);
    expect(markup).toMatch(/<textarea\b(?=[^>]*class="labs-form-control")(?=[^>]*name="context")/);
    expect(markup).toMatch(/<button\b(?=[^>]*class="primary-button")(?=[^>]*type="submit")/);
  });
});
