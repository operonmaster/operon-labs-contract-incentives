"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Accessible dialog shell shared by every Labs modal. Centralizes the dialog
 * semantics and keyboard behavior that were previously hand-rolled (and missing
 * in several modals): role="dialog" + aria-modal, Escape-to-close, focus-on-open,
 * a focus trap, and focus restoration to the trigger on close.
 *
 * Callers provide the modal body (toolbar, close button, content). The close
 * button should call `onClose`.
 */
export function LabsModal({
  onClose,
  labelledBy,
  describedBy,
  className,
  backdropClassName,
  children
}: Readonly<{
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  backdropClassName?: string;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    function focusableItems(): HTMLElement[] {
      if (!dialog) {
        return [];
      }
      return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement
      );
    }

    const initial = focusableItems();
    (initial[0] ?? dialog)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const items = focusableItems();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={cx("modal-backdrop", backdropClassName)} role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cx("modal", className)}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
