// @vitest-environment happy-dom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LabsButton } from "./index";

describe("LabsButton", () => {
  it("maps variants to the established button class contract and defaults to type=button", () => {
    expect(renderToStaticMarkup(<LabsButton>Go</LabsButton>)).toContain('<button class="primary-button" type="button">Go</button>');
    expect(renderToStaticMarkup(<LabsButton variant="secondary">Skip</LabsButton>)).toContain(
      'class="primary-button secondary-button"'
    );
    expect(renderToStaticMarkup(<LabsButton variant="row">Open</LabsButton>)).toContain('class="row-action"');
  });

  it("forwards native button props such as disabled", () => {
    const markup = renderToStaticMarkup(
      <LabsButton disabled type="submit">
        Submit
      </LabsButton>
    );
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Submit<\/button>/);
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*>Submit<\/button>/);
  });
});
