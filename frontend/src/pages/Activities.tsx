import { useState } from "react";
import { CalendarCheck2, Plus } from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Button, EmptyState, Segmented, Toggle } from "@/components/ui";
import { OwnerSelect } from "@/components/records/Pickers";
import { ActivityRow } from "@/components/records/RecordParts";
import { useCreate } from "@/components/records/CreateHost";
import { useActivities } from "@/lib/queries";
import { dateFa, fa, weekdayFa } from "@/lib/format";
import type { Activity } from "@/lib/types";

type Status = "today" | "overdue" | "upcoming" | "done" | "open";
const tabs: { value: Status; label: string }[] = [
  { value: "today", label: "امروز" }, { value: "overdue", label: "عقب‌افتاده" }, { value: "upcoming", label: "آینده" },
  { value: "open", label: "همه‌ی باز" }, { value: "done", label: "انجام‌شده" },
];

const key = (a: Activity) => {
  const d = a.isDone ? a.doneAt : a.dueAt;
  return d ? new Date(new Date(d).getTime() + 3.5 * 3600_000).toISOString().slice(0, 10) : "none";
};

export default function Activities() {
  const [status, setStatus] = useState<Status>("today");
  const [type, setType] = useState<"" | "Task" | "Call" | "Meeting">("");
  const [mine, setMine] = useState(true);
  const [assigneeId, setAssignee] = useState<string | null>(null);
  const open = useCreate((s) => s.open);
  const { data, isLoading } = useActivities({ status, type: type || undefined, mine: mine || undefined, assigneeId: !mine ? assigneeId ?? undefined : undefined, take: 200 });

  const groups = new Map<string, Activity[]>();
  for (const a of data ?? []) groups.set(key(a), [...(groups.get(key(a)) ?? []), a]);

  return (
    <div>
      <PageHeader title="فعالیت‌ها" subtitle="کارها، تماس‌ها و جلسه‌های تیم" actions={<Button icon={<Plus className="size-4" />} onClick={() => open("activity")}>فعالیت جدید</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="no-scrollbar max-w-full overflow-x-auto"><Segmented value={status} onChange={setStatus} options={tabs} /></div>
        <Segmented size="sm" value={type} onChange={setType} options={[{ value: "", label: "همه" }, { value: "Call", label: "تماس" }, { value: "Meeting", label: "جلسه" }, { value: "Task", label: "کار" }]} />
        <label className="ms-auto flex items-center gap-2 text-[13px] text-fg-muted"><Toggle checked={mine} onChange={setMine} label="فقط کارهای من" />فقط کارهای من</label>
        {!mine && <div className="w-44"><OwnerSelect value={assigneeId} onChange={setAssignee} allowEmpty emptyLabel="همه‌ی هم‌تیمی‌ها" /></div>}
      </div>
      <div className="card p-2 sm:p-3">
        {isLoading ? <TableSkeleton rows={6} cols={2} /> : !data?.length ? (
          <EmptyState icon={<CalendarCheck2 className="size-7" />}
            title={status === "overdue" ? "هیچ کار عقب‌افتاده‌ای ندارید" : status === "done" ? "هنوز کاری انجام نشده" : "اینجا خالی است"}
            body={status === "overdue" ? "همه‌چیز سر وقت انجام شده. 👏" : "برای پیگیری مشتری‌ها یک تماس یا کار برنامه‌ریزی کنید."}
            action={status !== "overdue" ? <Button variant="soft" onClick={() => open("activity")}>فعالیت جدید</Button> : undefined} />
        ) : (
          <div className="space-y-4">
            {[...groups.entries()].map(([k, items]) => (
              <section key={k}>
                <div className="flex items-center gap-3 px-2 pb-1 pt-2 text-xs font-semibold text-fg-subtle">
                  <span>{k === "none" ? "بدون تاریخ" : `${weekdayFa(k)}`}</span><span className="h-px flex-1 bg-line" />
                  <span className="num font-normal">{k !== "none" && dateFa(k)} · {fa(items.length)}</span>
                </div>
                <div className="divide-y divide-line/70">{items.map((a) => <ActivityRow key={a.id} a={a} showRecord />)}</div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
