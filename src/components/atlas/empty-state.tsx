import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      {icon && <div className="text-ink-muted [&_svg]:size-6">{icon}</div>}
      <h3 className="type-title">{title}</h3>
      {description && <p className="type-body-sm text-ink-muted max-w-md">{description}</p>}
      {action}
    </div>
  );
}
