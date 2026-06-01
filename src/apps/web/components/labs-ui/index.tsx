import type {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes
} from "react";
import Link from "next/link";

export { LabsSelect } from "./LabsSelect";
export type { LabsSelectOption } from "./LabsSelect";
export { LabsModal } from "./LabsModal";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type LabsButtonVariant = "primary" | "secondary" | "row";

const LABS_BUTTON_VARIANT_CLASS: Record<LabsButtonVariant, string> = {
  primary: "primary-button",
  secondary: "primary-button secondary-button",
  row: "row-action"
};

/**
 * Shared button primitive over the app's button styles. `variant` selects the
 * established class contract (primary action, secondary action, in-row action) so
 * call sites stop hand-writing `className="primary-button"` etc. All native button
 * props (onClick, disabled, aria-*, ...) pass through; type defaults to "button".
 */
export function LabsButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: Readonly<{ variant?: LabsButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={cx(LABS_BUTTON_VARIANT_CLASS[variant], className)} type={type} {...props} />;
}

export function LabsForm({
  className,
  ...props
}: Readonly<FormHTMLAttributes<HTMLFormElement>>) {
  return <form className={cx("op-panel", "labs-form", className)} {...props} />;
}

type LabsFieldProps = Readonly<{
  className?: string;
  controlClassName?: string;
  label: ReactNode;
}>;

export function LabsTextField({
  className,
  controlClassName,
  label,
  ...props
}: LabsFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <label className={cx("labs-form-field", className)}>
      <span>{label}</span>
      <input className={cx("labs-form-control", controlClassName)} {...props} />
    </label>
  );
}

export function LabsTextareaField({
  className,
  controlClassName,
  label,
  ...props
}: LabsFieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  return (
    <label className={cx("labs-form-field", className)}>
      <span>{label}</span>
      <textarea className={cx("labs-form-control", controlClassName)} {...props} />
    </label>
  );
}

export interface LabsUseCaseNavItem {
  id: string;
  label: string;
  href: string;
  /** Query-param key to carry the active `contextId` on this link (e.g. "umRequestId"). */
  param?: string;
}

/**
 * Shared three-up "use case" nav used by every feature area. Replaces the three
 * near-identical *UseCaseNavigation components; each feature now supplies a config
 * array, including which links should carry the context id (which previously
 * diverged silently between features).
 */
export function LabsUseCaseNav({
  ariaLabel,
  activeId,
  contextId,
  items
}: Readonly<{
  ariaLabel: string;
  activeId: string;
  contextId?: string | null;
  items: ReadonlyArray<LabsUseCaseNavItem>;
}>) {
  return (
    <nav className="use-case-nav" aria-label={ariaLabel}>
      {items.map((item) => {
        const href =
          item.param && contextId ? `${item.href}?${item.param}=${encodeURIComponent(contextId)}` : item.href;
        return (
          <Link key={item.id} aria-current={item.id === activeId ? "page" : undefined} href={href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
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

export function LabsBadge({
  children,
  className,
  id,
  variant = "neutral"
}: Readonly<{
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: "success" | "warning" | "info" | "neutral";
}>) {
  return (
    <span className={cx("op-badge", `op-badge-${variant}`, className)} id={id}>
      {children}
    </span>
  );
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
      <div className="op-product-toolbar">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
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
