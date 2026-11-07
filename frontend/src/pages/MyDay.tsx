import { Link } from "react-router";
import { AlarmClock, CalendarCheck2, Coffee, Hourglass, Plus } from "lucide-react";
import { PageSkeleton } from "./common";
import { Button, cx, Money } from "@/components/ui";
import { ActivityRow, Panel } from "@/components/records/RecordParts";
import { useCreate } from "@/components/records/CreateHost";
import { useMyDay } from "@/lib/queries";
import { daysUntil, dateFa, fa, fullDateFa, greeting, relative, timeFa } from "@/lib/format";
import { useAuth } from "@/store";

function Ring({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 1 : done / total;
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--sunken)" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-pistachio-500)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 600ms var(--ease-out-quint)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div><div className="num text-lg font-extrabold">{fa(done)}<span className="text-xs font-medium text-fg-subtle">/{fa(total)}</span></div></div>
      </div>
    </div>
  );
}

export default function MyDay() {
  const { data, isLoading } = useMyDay();
  const user = useAuth((s) => s.user);
  const open = useCreate((s) => s.open);
  if (isLoading || !data) return <PageSkeleton />;

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const openToday = data.today.filter((a) => !a.isDone);
  const totalToday = data.today.length;
  const doneToday = data.today.filter((a) => a.isDone).length;
  const nextUp = openToday.find((a) => a.dueAt && new Date(a.dueAt) > new Date());

  return (
    <div>
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] text-fg-subtle">{fullDateFa(new Date())}</p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{greeting()}، {firstName}</h1>
          <p className="mt-1 text-fg-muted">
            {openToday.length ? `${fa(openToday.length)} کار برای امروز مانده` : "کارهای امروز تمام شده"}
            {data.overdue.length > 0 && <> و <span className="font-semibold text-pomegranate-500">{fa(data.overdue.length)} کار عقب‌افتاده</span></>}
            {nextUp && <> · بعدی ساعت <b className="num text-fg">{timeFa(nextUp.dueAt)}</b></>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Ring done={doneToday} total={totalToday} />
            <div className="text-[13px] leading-6 text-fg-muted">انجام‌شده‌ی<br />امروز</div>
          </div>
          <Button icon={<Plus className="size-4" />} onClick={() => open("activity")}>فعالیت</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {data.overdue.length > 0 && (
            <section className="rounded-lg border border-pomegranate-100 bg-pomegranate-50/60 p-4 dark:border-pomegranate-700/40 dark:bg-pomegranate-700/10">
              <h2 className="mb-1 flex items-center gap-2 text-[14px] font-bold text-pomegranate-600 dark:text-pomegranate-100"><AlarmClock className="size-4" />عقب‌افتاده</h2>
              <div className="-mx-2">{data.overdue.map((a) => <ActivityRow key={a.id} a={a} showRecord />)}</div>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold"><CalendarCheck2 className="size-4 text-accent" />برنامه‌ی امروز</h2>
            {data.today.length ? (
              <ol className="relative space-y-1 before:absolute before:inset-y-3 before:start-[56px] before:w-px before:bg-line">
                {data.today.map((a) => {
                  const past = a.dueAt && new Date(a.dueAt) < new Date();
                  return (
                    <li key={a.id} className="relative grid grid-cols-[56px_1fr] items-start gap-4">
                      <span className={cx("num pt-3 text-end text-xs font-semibold", past && !a.isDone ? "text-pomegranate-500" : "text-fg-subtle")}>{timeFa(a.dueAt)}</span>
                      <div className="relative">
                        <span className={cx("absolute -start-[21px] top-4 size-2.5 rounded-full ring-4 ring-surface", a.isDone ? "bg-pistachio-500" : a === nextUp ? "bg-saffron-500" : "bg-line-strong")} />
                        <div className={cx("rounded-lg", a === nextUp && "bg-saffron-50/70 ring-1 ring-saffron-200 dark:bg-saffron-800/10 dark:ring-saffron-800/40")}>
                          <ActivityRow a={a} showRecord />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col items-center py-10 text-center text-fg-muted">
                <Coffee className="mb-3 size-7 text-saffron-500" />
                امروز برنامه‌ای ندارید.
                <Button variant="soft" size="sm" className="mt-4" onClick={() => open("activity")}>یک کار برای امروز بگذارید</Button>
              </div>
            )}
          </section>

          <Panel title="روزهای آینده">
            {data.upcoming.length ? (
              <div className="-mx-2 divide-y divide-line">{data.upcoming.map((a) => <ActivityRow key={a.id} a={a} showRecord />)}</div>
            ) : <p className="py-3 text-[13px] text-fg-subtle">برای روزهای آینده چیزی برنامه‌ریزی نشده.</p>}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="نزدیک به بستن">
            {data.closingSoon.length ? (
              <ul className="-mx-1 space-y-0.5">
                {data.closingSoon.map((d) => {
                  const days = d.expectedCloseDate ? daysUntil(d.expectedCloseDate) : 0;
                  return (
                    <li key={d.id}>
                      <Link to={`/app/deals/${d.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-sunken">
                        <span className={cx("num grid size-11 shrink-0 place-items-center rounded-lg text-center text-[11px] font-bold leading-4",
                          days < 0 ? "bg-pomegranate-50 text-pomegranate-600 dark:bg-pomegranate-700/30 dark:text-pomegranate-100" : "bg-saffron-50 text-saffron-700 dark:bg-saffron-800/40 dark:text-saffron-200")}>
                          {days < 0 ? <>{fa(-days)}<br />روز پیش</> : days === 0 ? "امروز" : <>{fa(days)}<br />روز</>}
                        </span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{d.title}</span>
                          <span className="block text-xs text-fg-subtle">{d.stageName} · {dateFa(d.expectedCloseDate)}</span></span>
                        <Money value={d.value} short className="text-xs" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="py-3 text-[13px] text-fg-subtle">در دو هفته‌ی آینده معامله‌ای برای بستن ندارید.</p>}
          </Panel>

          <Panel title="معامله‌های راکد شما">
            {data.staleDeals.length ? (
              <ul className="space-y-2.5">
                {data.staleDeals.map((d) => (
                  <li key={d.id} className="rounded-lg border border-line p-3">
                    <Link to={`/app/deals/${d.id}`} className="block text-[13px] font-semibold hover:text-accent">{d.title}</Link>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-saffron-700 dark:text-saffron-300"><Hourglass className="size-3" />در «{d.stageName}» از {relative(d.stageEnteredAt)}</div>
                    <Button size="sm" variant="soft" className="mt-2.5 w-full"
                      onClick={() => open("activity", { record: { type: "Deal", id: d.id, title: d.title }, activityType: "Call" })}>برنامه‌ی تماس پیگیری</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="py-3 text-[13px] text-fg-subtle">همه‌ی معامله‌هایتان در جریان‌اند. 👌</p>}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
