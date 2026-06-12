import { LabsUseCaseNav, type LabsUseCaseNavItem } from "../labs-ui";

type DelegateUseCaseView = "vendor" | "plan" | "policies";

const items: LabsUseCaseNavItem[] = [
  { id: "vendor", label: "Delegate Vendor View", href: "/delegate-um" },
  { id: "plan", label: "Health Plan View", href: "/delegate-um/plan" },
  { id: "policies", label: "Policies View", href: "/delegate-um/policies" }
];

export function DelegateUseCaseNavigation({
  activeView
}: {
  activeView: DelegateUseCaseView;
}) {
  return (
    <LabsUseCaseNav
      ariaLabel="Delegate UM use case views"
      activeId={activeView}
      items={items}
    />
  );
}
