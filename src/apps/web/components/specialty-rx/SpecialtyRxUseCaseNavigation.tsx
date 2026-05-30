import { LabsUseCaseNav, type LabsUseCaseNavItem } from "../labs-ui";

type SpecialtyRxUseCaseView = "pharmacy" | "plan" | "policies";

const items: LabsUseCaseNavItem[] = [
  { id: "pharmacy", label: "Specialty Pharmacy View", href: "/specialty-rx" },
  { id: "plan", label: "Health Plan View", href: "/specialty-rx/plan", param: "fulfillmentCaseId" },
  { id: "policies", label: "Policies View", href: "/specialty-rx/policies" }
];

export function SpecialtyRxUseCaseNavigation({
  activeView,
  fulfillmentCaseId
}: {
  activeView: SpecialtyRxUseCaseView;
  fulfillmentCaseId?: string | null;
}) {
  return (
    <LabsUseCaseNav
      ariaLabel="Specialty Rx use case views"
      activeId={activeView}
      contextId={fulfillmentCaseId}
      items={items}
    />
  );
}
