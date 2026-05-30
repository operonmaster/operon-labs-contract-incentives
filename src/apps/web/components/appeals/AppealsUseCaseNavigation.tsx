import { LabsUseCaseNav, type LabsUseCaseNavItem } from "../labs-ui";

type AppealsUseCaseView = "provider" | "plan" | "policies";

const items: LabsUseCaseNavItem[] = [
  { id: "provider", label: "Provider Appeals View", href: "/appeals" },
  { id: "plan", label: "Health Plan View", href: "/appeals/plan", param: "appealId" },
  { id: "policies", label: "Policies View", href: "/appeals/policies" }
];

export function AppealsUseCaseNavigation({
  activeView,
  appealId
}: {
  activeView: AppealsUseCaseView;
  appealId?: string | null;
}) {
  return (
    <LabsUseCaseNav
      ariaLabel="Appeals use case views"
      activeId={activeView}
      contextId={appealId}
      items={items}
    />
  );
}
