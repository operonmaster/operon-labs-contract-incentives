import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BookACallForm } from "./BookACallForm";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("BookACallForm", () => {
  it("uses the shared LabsSelect dropdown and submits its value through the form", () => {
    const source = readRepoFile("src/apps/web/app/labs/book-a-call/BookACallForm.tsx");
    const markup = renderToStaticMarkup(<BookACallForm />);

    expect(source).toContain("LabsSelect");
    expect(source).toContain("workflowAreaOptions");
    expect(source).toContain("Prior authorization");
    expect(source).toContain("Identity / consent");
    expect(source).toContain("Incentives / payments");
    expect(source).toContain('name="workflowArea"');
    expect(source).toContain('type="hidden"');
    expect(source).not.toContain("LabsSelectField");
    expect(source).not.toContain("<select");
    expect(markup).toContain('class="labs-select"');
    expect(markup).toContain('class="labs-select-trigger"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('name="workflowArea"');
    expect(markup).toContain("Select one");
  });
});
