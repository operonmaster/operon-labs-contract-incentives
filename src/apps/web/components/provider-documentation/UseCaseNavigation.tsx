import Link from "next/link";

type UseCaseView = "provider" | "plan" | "policies";

export function UseCaseNavigation({
  activeView,
  umRequestId,
  caseId
}: {
  activeView: UseCaseView;
  umRequestId?: string | null;
  caseId?: string | null;
}) {
  const resolvedUmRequestId = umRequestId ?? caseId ?? null;
  const planHref = resolvedUmRequestId
    ? `/provider-documentation/incentives?umRequestId=${encodeURIComponent(resolvedUmRequestId)}`
    : "/provider-documentation/incentives";
  const policiesHref = resolvedUmRequestId
    ? `/provider-documentation/policies?umRequestId=${encodeURIComponent(resolvedUmRequestId)}`
    : "/provider-documentation/policies";

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
