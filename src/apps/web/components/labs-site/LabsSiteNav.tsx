import Link from "next/link";

import { labsNavItems, type LabsNavItem } from "./labs-site-content";

export function LabsSiteNav({ activeId }: Readonly<{ activeId: LabsNavItem["id"] }>) {
  return (
    <nav className="labs-magazine-nav" aria-label="Operon Labs sections">
      <Link className="labs-magazine-brand" href="/labs">
        Operon Labs
      </Link>
      <div className="labs-magazine-nav-links">
        {labsNavItems.map((item) => (
          <Link aria-current={item.id === activeId ? "page" : undefined} href={item.href} key={item.id}>
            {item.label}
          </Link>
        ))}
      </div>
      <Link className="labs-magazine-demo-link" href="/">
        Demo catalog
      </Link>
    </nav>
  );
}
