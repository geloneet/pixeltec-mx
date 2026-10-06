import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD } from "./tones";

/** Contenedor de widget: `section` + `h2` + conteo opcional + «Ver todas →». */
export function SectionCard({
  id,
  title,
  count,
  countLabel,
  action,
  aside,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  title: string;
  count?: number | null;
  /** Texto accesible del conteo (p. ej. «5 prioridades»). */
  countLabel?: string;
  action?: { label: string; href: string } | null;
  /** Contenido extra a la derecha del título (p. ej. «3/6»). */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className={cn(CARD, "flex min-w-0 flex-col", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 id={headingId} className="truncate text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {typeof count === "number" && (
            <span
              aria-label={countLabel}
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-2 text-xs font-semibold tabular-nums text-muted-foreground"
            >
              {count}
            </span>
          )}
        </div>
        {aside}
        {action && (
          <Link
            href={action.href}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-md text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </header>
      <div className={cn("min-w-0 flex-1 px-5 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}
