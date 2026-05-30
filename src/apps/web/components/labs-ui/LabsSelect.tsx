"use client";

/* eslint-disable no-unused-vars -- Callback parameter names document select values. */

import type { KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";

export interface LabsSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  eyebrow?: string;
}

export function LabsSelect({
  ariaLabel,
  ariaLabelledby,
  disabled = false,
  id,
  onChange,
  options,
  placeholder,
  value
}: Readonly<{
  ariaLabel?: string;
  ariaLabelledby?: string;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  options: LabsSelectOption[];
  placeholder: string;
  value: string;
}>) {
  const generatedId = useId();
  const triggerId = id ?? `labs-select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  function closeDropdown() {
    setIsOpen(false);
  }

  function toggleDropdown() {
    if (!disabled) {
      setIsOpen((currentOpen) => !currentOpen);
    }
  }

  function selectOption(nextValue: string) {
    const nextOption = options.find((option) => option.value === nextValue);
    if (!nextOption || nextOption.disabled) {
      return;
    }

    onChange(nextOption.value);
    closeDropdown();
  }

  function navigateOptions(direction: 1 | -1) {
    const enabledOptions = options.filter((option) => !option.disabled);
    if (disabled || enabledOptions.length === 0) {
      return;
    }

    const currentIndex = enabledOptions.findIndex((option) => option.value === value);
    const nextIndex = currentIndex === -1 ? (direction === 1 ? 0 : enabledOptions.length - 1) : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
    onChange(enabledOptions[nextIndex].value);
    setIsOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      navigateOptions(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      navigateOptions(-1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDropdown();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  }

  return (
    <div className="labs-select">
      <button
        aria-controls={listboxId}
        aria-disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        className="labs-select-trigger"
        disabled={disabled}
        id={triggerId}
        role="combobox"
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`labs-select-value ${selectedOption ? "" : "placeholder"}`}>{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true" className="labs-select-chevron"></span>
      </button>

      {isOpen ? (
        <>
          <div aria-hidden="true" className="labs-select-backdrop" onClick={closeDropdown}></div>
          <div aria-labelledby={triggerId} className="labs-select-menu" id={listboxId} role="listbox">
            {options.length > 0 ? (
              options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    aria-selected={isSelected}
                    className={`labs-select-option ${isSelected ? "selected" : ""}`}
                    disabled={option.disabled}
                    role="option"
                    type="button"
                    onClick={() => selectOption(option.value)}
                  >
                    <span className="labs-select-option-main">
                      {option.eyebrow ? <span className="labs-select-option-eyebrow">{option.eyebrow}</span> : null}
                      <span className="labs-select-option-label">{option.label}</span>
                      {option.description ? <span className="labs-select-option-description">{option.description}</span> : null}
                    </span>
                    {isSelected ? <span aria-hidden="true" className="labs-select-check"></span> : null}
                  </button>
                );
              })
            ) : (
              <span className="labs-select-empty">No options available</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
