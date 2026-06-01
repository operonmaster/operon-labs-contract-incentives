"use client";

import { useState } from "react";

import {
  LabsButton,
  LabsForm,
  LabsSelect,
  LabsTextareaField,
  LabsTextField,
  type LabsSelectOption
} from "../../../components/labs-ui";

const workflowAreaLabelId = "labs-book-workflow-area-label";

const workflowAreaOptions: LabsSelectOption[] = [
  { value: "Prior authorization", label: "Prior authorization" },
  { value: "Delegated operations", label: "Delegated operations" },
  { value: "Specialty pharmacy", label: "Specialty pharmacy" },
  { value: "Appeals readiness", label: "Appeals readiness" },
  { value: "Identity / consent", label: "Identity / consent" },
  { value: "Incentives / payments", label: "Incentives / payments" },
  { value: "AI operations", label: "AI operations" },
  { value: "Other", label: "Other" }
];

export function BookACallForm() {
  const [workflowArea, setWorkflowArea] = useState("");

  return (
    <LabsForm
      action="mailto:partners@operon.cloud?subject=Operon%20Labs%20Book%20a%20Call"
      className="labs-book-form"
      encType="text/plain"
      method="post"
    >
      <div className="labs-book-form-header">
        <span className="label">Contact Labs</span>
        <h2>Book a Call</h2>
        <p>Share enough context for a useful first conversation.</p>
      </div>

      <LabsTextField autoComplete="name" label="Full name" name="fullName" required type="text" />

      <LabsTextField autoComplete="email" label="Work email" name="email" required type="email" />

      <div className="labs-book-field-row">
        <LabsTextField autoComplete="organization-title" label="Role / title" name="role" type="text" />
        <LabsTextField autoComplete="organization" label="Organization" name="organization" type="text" />
      </div>

      <label className="labs-form-field">
        <span id={workflowAreaLabelId}>Workflow area</span>
        <input name="workflowArea" readOnly type="hidden" value={workflowArea} />
        <LabsSelect
          ariaLabelledby={workflowAreaLabelId}
          id="labs-book-workflow-area"
          options={workflowAreaOptions}
          placeholder="Select one"
          value={workflowArea}
          onChange={setWorkflowArea}
        />
      </label>

      <LabsTextareaField
        label="What are you trying to solve?"
        maxLength={1200}
        name="context"
        placeholder="A few sentences about the workflow, constraint, stakeholder pressure, or innovation question."
        required
        rows={7}
      />

      <LabsButton disabled={!workflowArea} type="submit">
        Book a Call
      </LabsButton>
      <p className="labs-book-note">This opens an email draft to partners@operon.cloud with your details.</p>
    </LabsForm>
  );
}
