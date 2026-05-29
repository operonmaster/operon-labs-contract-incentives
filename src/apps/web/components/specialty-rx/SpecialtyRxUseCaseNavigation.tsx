import Link from "next/link";

type SpecialtyRxUseCaseView = "pharmacy" | "plan" | "policies";

export function SpecialtyRxUseCaseNavigation({
  activeView,
  fulfillmentCaseId
}: {
  activeView: SpecialtyRxUseCaseView;
  fulfillmentCaseId?: string | null;
}) {
  const planHref = fulfillmentCaseId
    ? `/specialty-rx/plan?fulfillmentCaseId=${encodeURIComponent(fulfillmentCaseId)}`
    : "/specialty-rx/plan";

  return (
    <nav className="use-case-nav" aria-label="Specialty Rx use case views">
      <Link aria-current={activeView === "pharmacy" ? "page" : undefined} href="/specialty-rx">
        Specialty Pharmacy View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href={planHref}>
        Health Plan View
      </Link>
      <Link aria-current={activeView === "policies" ? "page" : undefined} href="/specialty-rx/policies">
        Policies View
      </Link>
    </nav>
  );
}
