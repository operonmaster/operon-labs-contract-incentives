import Link from "next/link";

type DelegateUseCaseView = "vendor" | "plan" | "policies";

export function DelegateUseCaseNavigation({
  activeView,
  umRequestId
}: {
  activeView: DelegateUseCaseView;
  umRequestId?: string | null;
}) {
  const planHref = umRequestId ? `/delegate-um/plan?umRequestId=${encodeURIComponent(umRequestId)}` : "/delegate-um/plan";
  return (
    <nav className="use-case-nav" aria-label="Delegate UM use case views">
      <Link aria-current={activeView === "vendor" ? "page" : undefined} href="/delegate-um">
        Delegate Vendor View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href={planHref}>
        Health Plan View
      </Link>
      <Link aria-current={activeView === "policies" ? "page" : undefined} href="/delegate-um/policies">
        Policies View
      </Link>
    </nav>
  );
}
