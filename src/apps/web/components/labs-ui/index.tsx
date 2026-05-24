import type { ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LabsPageShell({
  children,
  className,
  variant = "app"
}: Readonly<{
  children: ReactNode;
  className?: string;
  variant?: "app" | "deck" | "document";
}>) {
  return <main className={cx("op-page-shell", `op-page-shell-${variant}`, className)}>{children}</main>;
}

export function LabsHero({
  children,
  className,
  compact = false,
  eyebrow,
  title
}: Readonly<{
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  eyebrow: string;
  title: ReactNode;
}>) {
  return (
    <section className={cx("hero", "op-hero", compact && "compact", className)}>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children ? <div className="op-hero-copy">{children}</div> : null}
    </section>
  );
}

export function LabsPanel({
  children,
  className
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return <section className={cx("panel", "op-panel", className)}>{children}</section>;
}

export function LabsProductFrame({
  children,
  className,
  meta,
  title
}: Readonly<{
  children: ReactNode;
  className?: string;
  meta?: ReactNode;
  title: string;
}>) {
  return (
    <section className={cx("op-product-frame", className)}>
      <div className="op-product-toolbar" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <strong>{title}</strong>
        {meta ? <em>{meta}</em> : null}
      </div>
      <div className="op-product-frame-body">{children}</div>
    </section>
  );
}

export function LabsDeckRail({
  activeId,
  className,
  items
}: Readonly<{
  activeId: string;
  className?: string;
  items: Array<{ id: string; label: string; kicker?: string }>;
}>) {
  return (
    <nav className={cx("op-deck-rail", className)} aria-label="Demo sections">
      {items.map((item, index) => (
        <a aria-current={item.id === activeId ? "step" : undefined} href={`#${item.id}`} key={item.id}>
          <span>{index + 1}</span>
          <strong>{item.label}</strong>
          {item.kicker ? <em>{item.kicker}</em> : null}
        </a>
      ))}
    </nav>
  );
}
