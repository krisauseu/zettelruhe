import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Einheitlicher leerer Listen-/Bereichszustand (de-DE, BA14).
 */
export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-prose leading-relaxed">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
