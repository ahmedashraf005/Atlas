import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  breadcrumbs,
  title,
  meta,
  actions,
}: {
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="type-body-sm text-ink-muted">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${crumb.href ?? index}`} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden>/</span>}
                {crumb.href ? (
                  <Link className="text-atlas-green hover:underline" href={crumb.href}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="type-heading-1">{title}</h1>
          {meta && <div className="flex flex-wrap items-center gap-3">{meta}</div>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
