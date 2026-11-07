import type { ReactNode } from "react";
import { Link } from "react-router";
import { CalendarClock, CheckCircle2, Circle, Phone, Plus, Users2 } from "lucide-react";
import { Badge, Button, cx, Money } from "@/components/ui";
import { api } from "@/lib/api";
import { recordKeys, useAction, useActivities, useCustomFields } from "@/lib/queries";
import { activityLabel, dateFa, dateTimeFa, fa } from "@/lib/format";
import type { Activity, DealCard, RecordType } from "@/lib/types";
import { useCreate } from "./CreateHost";

export function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-2 text-[13.5px]">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-fg-subtle">—</span>}</dd>
    </div>
  );
}

export function CustomProps({ entity, values }: { entity: RecordType; values: Record<string, string> }) {
  const { data } = useCustomFields();
  const defs = (data ?? []).filter((f) => f.entityType === entity);
  if (!defs.length) return null;
  return (
    <>
      {defs.map((d) => {
        const v = values[d.key];
        return (
          <Prop key={d.id} label={d.label}>
            {v ? (d.type === "Date" ? dateFa(v) : d.type === "Number" ? <span className="num">{fa(Number(v))}</span> : v) : null}
          </Prop>
        );
      })}
    </>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("card p-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DealMiniList({ deals, empty }: { deals: DealCard[]; empty: string }) {
  if (!deals.length) return <p className="py-3 text-[13px] text-fg-subtle">{empty}</p>;
  return (
    <ul className="-mx-1 space-y-1">
      {deals.map((d) => (
        <li key={d.id}>
          <Link to={`/app/deals/${d.id}`} className="block rounded-lg px-2.5 py-2 transition hover:bg-sunken">
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-1 text-[13px] font-semibold">{d.title}</span>
              <Money value={d.value} short className="shrink-0 text-xs" />
            </div>
            <div className="mt-1 flex items-center gap-2">
              {d.status === "Open" ? <Badge color={d.stageColor} className="h-5 text-[11px]">{d.stageName}</Badge>
                : d.status === "Won" ? <Badge tone="pistachio" className="h-5 text-[11px]">برنده</Badge>
                  : <Badge tone="pomegranate" className="h-5 text-[11px]">باخته</Badge>}
              {d.expectedCloseDate && d.status === "Open" && <span className="text-[11px] text-fg-subtle">بستن: {dateFa(d.expectedCloseDate)}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const icon = { Task: CalendarClock, Call: Phone, Meeting: Users2 };

export function ActivityRow({ a, showRecord }: { a: Activity; showRecord?: boolean }) {
  const toggle = useAction(() => api.post(`/activities/${a.id}/toggle`), { invalidate: recordKeys, success: a.isDone ? "دوباره باز شد." : "انجام شد ✓" });
  const open = useCreate((s) => s.open);
  const Icon = icon[a.type];
  return (
    <div className={cx("group flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-surface-2", a.isDone && "opacity-60")}>
      <button type="button" onClick={() => toggle.mutate(undefined)} aria-label={a.isDone ? "علامت انجام‌نشده" : "علامت انجام‌شده"}
        className={cx("mt-0.5 shrink-0 transition", a.isDone ? "text-pistachio-500" : "text-line-strong hover:text-pistachio-500")}>
        {a.isDone ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
      </button>
      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => open("activity", { edit: a })}>
        <div className={cx("text-[13.5px] font-medium leading-6", a.isDone && "line-through decoration-fg-subtle")}>{a.subject}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1"><Icon className="size-3" />{activityLabel[a.type]}</span>
          {a.dueAt && <span className={cx(a.isOverdue && "font-medium text-pomegranate-500")}>{a.isOverdue ? "عقب‌افتاده · " : ""}{dateTimeFa(a.dueAt)}</span>}
          {showRecord && a.record && <span className="truncate text-accent">{a.record.title}</span>}
          {a.assignee && <span>· {a.assignee.fullName}</span>}
        </div>
      </button>
    </div>
  );
}

export function OpenActivities({ type, id, title }: { type: RecordType; id: string; title: string }) {
  const { data } = useActivities({ recordType: type, recordId: id, status: "open" });
  const open = useCreate((s) => s.open);
  return (
    <Panel title="کارهای پیش رو" action={
      <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => open("activity", { record: { type, id, title } })}>افزودن</Button>
    }>
      {data?.length ? <div className="-mx-2">{data.map((a) => <ActivityRow key={a.id} a={a} />)}</div>
        : <p className="py-3 text-[13px] text-fg-subtle">کار بازی ندارد. برای پیگیری بعدی یک یادآور بگذارید.</p>}
    </Panel>
  );
}
