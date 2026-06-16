// @vitest-environment happy-dom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { LabsModal } from "./LabsModal";

let root: Root | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
    root = null;
  }
  document.body.innerHTML = "";
});

describe("LabsModal", () => {
  it("renders an accessible dialog with a labelled backdrop", () => {
    const markup = renderToStaticMarkup(
      <LabsModal onClose={() => undefined} labelledBy="demo-title" className="plan-audit-modal">
        <h2 id="demo-title">Demo dialog</h2>
      </LabsModal>
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="demo-title"');
    expect(markup).toContain('class="modal-backdrop"');
    expect(markup).toContain("plan-audit-modal");
    expect(markup).toContain("Demo dialog");
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ModalHarness />);
    });

    const trigger = document.getElementById("open-modal") as HTMLButtonElement;
    trigger.focus();
    await act(async () => {
      trigger.click();
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(document.getElementById("first-action"));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the backdrop is clicked", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ModalHarness />);
    });
    await act(async () => {
      document.getElementById("open-modal")!.click();
    });

    const backdrop = document.querySelector(".modal-backdrop") as HTMLDivElement;
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      backdrop.click();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps Tab focus inside the dialog", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ModalHarness />);
    });
    await act(async () => {
      document.getElementById("open-modal")!.click();
    });

    const first = document.getElementById("first-action") as HTMLButtonElement;
    const last = document.getElementById("last-action") as HTMLButtonElement;

    last.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(first);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(last);
  });
});

function ModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button id="open-modal" type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      {open ? (
        <LabsModal onClose={() => setOpen(false)} labelledBy="runtime-modal-title">
          <h2 id="runtime-modal-title">Runtime dialog</h2>
          <button id="first-action" type="button">
            First action
          </button>
          <button id="last-action" type="button">
            Last action
          </button>
        </LabsModal>
      ) : null}
    </>
  );
}
