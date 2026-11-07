import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { cx, Skeleton } from "@/components/ui";

export function PageHeader({ title, subtitle, actions, crumbs, className }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { label: string; to: string }[]; className?: string;
}) {
  return (
    <div className={cx("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="مسیر" className="mb-1.5 flex items-center gap-1 text-xs text-fg-subtle">
            {crumbs.map((c, i) => (
              <span key={c.to} className="flex items-center gap-1">
                {i > 0 && <ChevronLeft className="size-3" />}
                <Link to={c.to} className="hover:text-fg">{c.label}</Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-fg-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری">
      <Skeleton className="mb-2 h-4 w-28" />
      <Skeleton className="mb-8 h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
      <Skeleton className="mt-6 h-80 rounded-lg" />
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          {Array.from({ length: cols }).map((__, c) => <Skeleton key={c} className={cx("h-3.5", c === 0 ? "w-40" : "w-24")} />)}
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, delta, hint, className }: { label: string; value: ReactNode; delta?: { value: string; positive: boolean } | null; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("card p-5", className)}>
      <div className="text-[13px] text-fg-muted">{label}</div>
      <div className="num mt-2 text-[26px] font-extrabold leading-tight tracking-tight">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cx("num rounded-full px-2 py-0.5 font-semibold", delta.positive ? "bg-pistachio-50 text-pistachio-700 dark:bg-pistachio-700/30 dark:text-pistachio-100" : "bg-pomegranate-50 text-pomegranate-600 dark:bg-pomegranate-700/30 dark:text-pomegranate-100")}>
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span className="text-fg-subtle">{hint}</span>}
      </div>
    </div>
  );
}
