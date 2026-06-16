import { LabsUseCaseNav, type LabsUseCaseNavItem } from "../labs-ui";

type UseCaseView = "provider" | "plan" | "policies";

const items: LabsUseCaseNavItem[] = [
  { id: "provider", label: "Provider View", href: "/provider-documentation" },
  { id: "plan", label: "Health Plan View", href: "/provider-documentation/incentives", param: "umRequestId" },
  { id: "policies", label: "Policies View", href: "/provider-documentation/policies", param: "umRequestId" }
];

export function UseCaseNavigation({
  activeView,
  umRequestId
}: {
  activeView: UseCaseView;
  umRequestId?: string | null;
}) {
  return (
    <LabsUseCaseNav
      ariaLabel="Provider documentation use case views"
      activeId={activeView}
      contextId={umRequestId}
      items={items}
    />
  );
}
