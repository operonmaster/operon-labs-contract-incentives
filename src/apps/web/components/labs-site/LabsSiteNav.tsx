import Link from "next/link";

import { labsNavItems, type LabsNavItem } from "./labs-site-content";

export function LabsSiteNav({ activeId }: Readonly<{ activeId: LabsNavItem["id"] }>) {
  return (
    <nav className="labs-proof-nav" aria-label="Operon Labs sections">
      <Link className="labs-proof-brand" href="/labs">
        Operon Labs
      </Link>
      <div className="labs-proof-nav-links">
        {labsNavItems.map((item) => (
          <Link aria-current={item.id === activeId ? "page" : undefined} href={item.href} key={item.id}>
            {item.label}
          </Link>
        ))}
      </div>
      <Link
        aria-current={activeId === "book-a-call" ? "page" : undefined}
        className="labs-proof-book-link"
        href="/labs/book-a-call"
      >
        Book a Call
      </Link>
    </nav>
  );
}
