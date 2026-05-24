import Link from "next/link";

type UseCaseView = "provider" | "plan";

export function UseCaseNavigation({ activeView, caseId }: { activeView: UseCaseView; caseId?: string | null }) {
  const planHref = caseId ? `/provider-documentation/incentives?caseId=${encodeURIComponent(caseId)}` : "/provider-documentation/incentives";

  return (
    <nav className="use-case-nav" aria-label="Provider documentation use case views">
      <Link aria-current={activeView === "provider" ? "page" : undefined} href="/provider-documentation">
        Provider View
      </Link>
      <Link aria-current={activeView === "plan" ? "page" : undefined} href={planHref}>
        Health Plan View
      </Link>
    </nav>
  );
}
