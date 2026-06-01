import Link from "next/link";

import { labsV2NavItems, type LabsV2NavId } from "./labs-v2-content";

export function LabsV2Nav({ activeId }: Readonly<{ activeId: LabsV2NavId }>) {
  return (
    <nav className="labs-proof-nav" aria-label="Operon Labs sections">
      <Link className="labs-proof-brand" href="/labs_v2">
        Operon Labs
      </Link>
      <div className="labs-proof-nav-links">
        {labsV2NavItems.map((item) => (
          <Link aria-current={item.id === activeId ? "page" : undefined} href={item.href} key={item.id}>
            {item.label}
          </Link>
        ))}
      </div>
      <Link className="labs-proof-demo-link" href="/">
        Demo catalog
      </Link>
    </nav>
  );
}
