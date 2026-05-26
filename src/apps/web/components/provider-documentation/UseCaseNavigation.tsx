import Link from "next/link";

type UseCaseView = "provider" | "plan" | "policies";

export function UseCaseNavigation({ activeView, caseId }: { activeView: UseCaseView; caseId?: string | null }) {
  const planHref = caseId ? `/provider-documentation/incentives?caseId=${encodeURIComponent(caseId)}` : "/provider-documentation/incentives";
  const policiesHref = caseId ? `/provider-documentation/policies?caseId=${encodeURIComponent(caseId)}` : "/provider-documentation/policies";

  return (
    <nav className="use-case-nav" aria-label="Provider documentation use case views">
      <Link aria-current={activeView === "provider" ? "page" : undefined} href="/provider-documentation">
        Provider View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href={planHref}>
        Health Plan View
      </Link>
      <Link aria-current={activeView === "policies" ? "page" : undefined} href={policiesHref}>
        Policies View
      </Link>
    </nav>
  );
}
