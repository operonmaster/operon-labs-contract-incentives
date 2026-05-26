import Link from "next/link";

type UseCaseView = "provider" | "plan" | "policies";

export function UseCaseNavigation({
  activeView,
  umRequestId
}: {
  activeView: UseCaseView;
  umRequestId?: string | null;
}) {
  const planHref = umRequestId
    ? `/provider-documentation/incentives?umRequestId=${encodeURIComponent(umRequestId)}`
    : "/provider-documentation/incentives";
  const policiesHref = umRequestId
    ? `/provider-documentation/policies?umRequestId=${encodeURIComponent(umRequestId)}`
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
