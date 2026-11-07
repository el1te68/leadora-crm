import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps,
} from "recharts";
import { Activity as ActivityIcon, BarChart3, Mail, Table2 } from "lucide-react";
import { PageHeader, Stat } from "./common";
import { Avatar, Button, cx, Segmented, Select, Skeleton } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { OwnerSelect } from "@/components/records/Pickers";
import { useAction, usePipelines, useReport } from "@/lib/queries";
import { api } from "@/lib/api";
import { dateShort, fa, faDecimal, percent, relative, tomanShort, toman } from "@/lib/format";
import { jalaliMonthLabel } from "@/lib/jalali";
import { useAuth } from "@/store";

type Preset = "30" | "90" | "365" | "custom";
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface TipProps {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; name?: unknown; value?: unknown; color?: string }[];
  label?: unknown;
  money?: boolean;
  labelFormat?: (l: string) => string;
}
const tip = (p: TooltipContentProps<number, string>) => ({ active: p.active, payload: p.payload as TipProps["payload"], label: p.label });

function ChartTooltip({ active, payload, label, money, labelFormat }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="popover min-w-44 px-3.5 py-2.5 text-[12.5px]" dir="rtl">
      <div className="mb-1.5 font-semibold">{labelFormat ? labelFormat(String(label)) : String(label)}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-fg-muted">{String(p.name)}</span>
          <span className="num ms-auto ps-4 font-semibold">{money ? tomanShort(Number(p.value)) : fa(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cx("card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const axisTick = { fill: "var(--fg-subtle)", fontSize: 11 };

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const [preset, setPreset] = useState<Preset>("90");
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [tableView, setTableView] = useState(false);
  const { data: pipelines } = usePipelines();

  const q = useMemo(() => {
    if (preset === "custom") return { from: range.from ?? undefined, to: range.to ?? undefined };
    const to = new Date();
    const from = new Date(Date.now() - (Number(preset) - 1) * 86400_000);
    return { from: iso(from), to: iso(to) };
  }, [preset, range]);
  const { data, isLoading, isFetching } = useReport({ ...q, ownerId: ownerId ?? undefined, pipelineId: pipelineId || undefined });
  const digest = useAction(() => api.post("/digest/send-now"), { success: "خلاصه‌ی امروز به ایمیل شما فرستاده شد (در MailHog ببینید)." });

  const k = data?.kpis;
  const wonDelta = k && k.prevWonValue > 0 ? ((k.wonValue - k.prevWonValue) / k.prevWonValue) * 100 : null;
  const rateDelta = k ? k.winRate - k.prevWinRate : null;
  const maxStage = Math.max(1, ...(data?.pipeline.map((s) => s.value) ?? [1]));
  const maxReason = Math.max(1, ...(data?.lostReasons.map((r) => r.count) ?? [1]));

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        subtitle={user ? `وضعیت فروش ${pipelines?.find((p) => p.id === (pipelineId || data?.pipelineId))?.name ?? ""} در یک نگاه` : undefined}
        actions={<Button variant="secondary" size="sm" icon={<Mail className="size-4" />} loading={digest.isPending} onClick={() => digest.mutate(undefined)}>ارسال خلاصه‌ی امروز</Button>}
      />

      {/* Filters — one row above all charts */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <Segmented value={preset} onChange={setPreset} options={[
          { value: "30", label: "۳۰ روز" }, { value: "90", label: "۹۰ روز" }, { value: "365", label: "یک سال" }, { value: "custom", label: "بازه‌ی دلخواه" },
        ]} />
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} placeholder="از تاریخ" className="w-40" />
            <span className="text-fg-subtle">تا</span>
            <DatePicker value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} placeholder="تا تاریخ" className="w-40" />
          </div>
        )}
        <div className="w-44"><OwnerSelect value={ownerId} onChange={setOwnerId} allowEmpty emptyLabel="همه‌ی هم‌تیمی‌ها" /></div>
        <div className="w-44">
          <Select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} aria-label="پایپ‌لاین">
            {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        {isFetching && !isLoading && <span className="text-xs text-fg-subtle">در حال به‌روزرسانی…</span>}
        <button type="button" onClick={() => setTableView(!tableView)} className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-fg-muted hover:bg-sunken hover:text-fg">
          {tableView ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}{tableView ? "نمای نمودار" : "نمای جدول"}
        </button>
      </div>

      {isLoading || !data || !k ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[124px] rounded-lg" />)}
          <Skeleton className="h-80 rounded-lg sm:col-span-2" /><Skeleton className="h-80 rounded-lg sm:col-span-2" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="ارزش پایپ‌لاین باز" value={tomanShort(k.openValue)} hint={`وزنی: ${tomanShort(k.weightedValue)}`} />
            <Stat label="درآمد برنده‌شده" value={<span className="text-money">{tomanShort(k.wonValue)}</span>}
              delta={wonDelta === null ? null : { value: percent(Math.abs(wonDelta)), positive: wonDelta >= 0 }} hint={`${fa(k.wonCount)} معامله، نسبت به دوره‌ی قبل`} />
            <Stat label="نرخ برد" value={percent(k.winRate)}
              delta={rateDelta === null ? null : { value: `${faDecimal(Math.abs(rateDelta))} واحد`, positive: rateDelta >= 0 }} hint={`${fa(k.wonCount)} برد از ${fa(k.wonCount + k.lostCount)}`} />
            <Stat label="میانگین هر معامله" value={tomanShort(k.avgDealSize)} hint={`${faDecimal(k.avgDaysToClose)} روز تا بستن · ${fa(k.newContacts)} مخاطب جدید`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Panel title="ارزش پایپ‌لاین به تفکیک مرحله" subtitle="معامله‌های باز؛ نوار پررنگ = ارزش وزنی با احتمال مرحله" className="xl:col-span-2">
              <ul className="space-y-4">
                {data.pipeline.map((s) => (
                  <li key={s.stageId} className="group" title={`${s.stage}: ${toman(s.value)} — وزنی ${toman(s.weighted)}`}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-medium"><span className="h-3 w-1 rounded-full" style={{ background: s.color }} />{s.stage}
                        <span className="num text-xs font-normal text-fg-subtle">{fa(s.count)} معامله</span></span>
                      <span className="num font-semibold">{tomanShort(s.value)}</span>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-[4px] bg-sunken">
                      <div className="absolute inset-y-0 start-0 rounded-[4px] opacity-35 transition-[width] duration-500" style={{ width: `${(s.value / maxStage) * 100}%`, background: "var(--chart-1)" }} />
                      <div className="absolute inset-y-0 start-0 rounded-[4px] transition-[width] duration-500" style={{ width: `${(s.weighted / maxStage) * 100}%`, background: "var(--chart-1)" }} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-4 border-t border-line pt-3 text-xs text-fg-muted">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm opacity-35" style={{ background: "var(--chart-1)" }} />کل ارزش</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--chart-1)" }} />ارزش وزنی</span>
              </div>
            </Panel>

            <Panel title="پیش‌بینی درآمد" subtitle="بر اساس تاریخ احتمالی بستن معامله‌های باز، ۶ ماه آینده" className="xl:col-span-3">
              {tableView ? (
                <table className="w-full text-[13px]">
                  <thead className="text-fg-subtle"><tr><th className="py-2 text-start font-medium">ماه</th><th className="text-start font-medium">مورد انتظار</th><th className="text-start font-medium">وزنی</th><th className="text-start font-medium">برنده‌شده</th></tr></thead>
                  <tbody className="divide-y divide-line">{data.forecast.map((m) => (
                    <tr key={m.month}><td className="py-2">{jalaliMonthLabel(m.month, true)}</td><td className="num">{tomanShort(m.expected)}</td><td className="num">{tomanShort(m.weighted)}</td><td className="num">{tomanShort(m.won)}</td></tr>
                  ))}</tbody>
                </table>
              ) : (
                <div className="h-72" dir="ltr">
                  <ResponsiveContainer>
                    <BarChart data={data.forecast} barGap={2} barCategoryGap="22%">
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="month" reversed tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(m) => jalaliMonthLabel(m)} />
                      <YAxis orientation="right" tickLine={false} axisLine={false} tick={axisTick} width={64} tickFormatter={(v) => tomanShort(v, false)} />
                      <Tooltip cursor={{ fill: "var(--sunken)" }} content={(p) => <ChartTooltip {...tip(p as TooltipContentProps<number, string>)} money labelFormat={(l) => jalaliMonthLabel(l, true)} />} />
                      <Legend align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
                      <Bar dataKey="expected" name="مورد انتظار" fill="var(--chart-1)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
                      <Bar dataKey="weighted" name="وزنی" fill="var(--chart-3)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
                      <Bar dataKey="won" name="برنده‌شده" fill="var(--chart-2)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Panel title="معامله‌ها در طول زمان" subtitle="هفتگی: ساخته‌شده، برنده و از دست رفته" className="xl:col-span-3">
              <div className="h-72" dir="ltr">
                <ResponsiveContainer>
                  <LineChart data={data.overTime}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="week" reversed tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(w) => dateShort(w)} minTickGap={24} />
                    <YAxis orientation="right" tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} width={32} tickFormatter={(v) => fa(v)} />
                    <Tooltip content={(p) => <ChartTooltip {...tip(p as TooltipContentProps<number, string>)} labelFormat={(l) => `هفته‌ی ${dateShort(l)}`} />} />
                    <Legend align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
                    <Line type="monotone" dataKey="created" name="ساخته‌شده" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} />
                    <Line type="monotone" dataKey="won" name="برنده" stroke="var(--color-pistachio-500)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} />
                    <Line type="monotone" dataKey="lost" name="از دست رفته" stroke="var(--color-pomegranate-500)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="دلیل از دست رفتن" subtitle={`${fa(k.lostCount)} معامله‌ی باخته در این بازه`} className="xl:col-span-2">
              {data.lostReasons.length ? (
                <ul className="space-y-3.5">
                  {data.lostReasons.map((r) => (
                    <li key={r.reason}>
                      <div className="mb-1 flex justify-between text-[13px]"><span>{r.reason}</span><span className="num font-semibold">{fa(r.count)}</span></div>
                      <div className="h-2 rounded-[4px] bg-sunken"><div className="h-2 rounded-[4px] bg-pomegranate-400" style={{ width: `${(r.count / maxReason) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="py-10 text-center text-fg-muted">در این بازه معامله‌ای از دست نرفته است.</p>}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Panel title="فعالیت هم‌تیمی‌ها" subtitle="فعالیت‌های انجام‌شده در این بازه" className="xl:col-span-3">
              {tableView ? (
                <table className="w-full text-[13px]">
                  <thead className="text-fg-subtle"><tr>{["هم‌تیمی", "تماس", "جلسه", "کار", "یادداشت", "ایمیل", "برد"].map((h) => <th key={h} className="py-2 text-start font-medium">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">{data.team.map((t) => (
                    <tr key={t.user.id}><td className="py-2">{t.user.fullName}</td>{[t.calls, t.meetings, t.tasks, t.notes, t.emails, t.dealsWon].map((v, i) => <td key={i} className="num">{fa(v)}</td>)}</tr>
                  ))}</tbody>
                </table>
              ) : (
                <div style={{ height: Math.max(220, data.team.length * 52) }} dir="ltr">
                  <ResponsiveContainer>
                    <BarChart data={data.team.map((t) => ({ ...t, name: t.user.fullName }))} layout="vertical" barCategoryGap="28%">
                      <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" reversed tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} tickFormatter={(v) => fa(v)} />
                      <YAxis type="category" dataKey="name" orientation="right" tickLine={false} axisLine={false} width={96} tick={{ ...axisTick, fill: "var(--fg-muted)", fontSize: 12 }} />
                      <Tooltip cursor={{ fill: "var(--sunken)" }} content={(p) => <ChartTooltip {...tip(p as TooltipContentProps<number, string>)} />} />
                      <Legend align="right" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
                      {([["calls", "تماس", 1], ["meetings", "جلسه", 2], ["tasks", "کار", 3], ["notes", "یادداشت", 4], ["emails", "ایمیل", 5]] as const).map(([key, name, c], i, arr) => (
                        <Bar key={key} dataKey={key} name={name} stackId="a" fill={`var(--chart-${c})`} stroke="var(--surface)" strokeWidth={2}
                          radius={i === arr.length - 1 ? [0, 4, 4, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="آخرین اتفاق‌ها" className="xl:col-span-2" action={<ActivityIcon className="size-4 text-fg-subtle" />}>
              <ol className="space-y-3.5">
                {data.recent.slice(0, 9).map((r) => (
                  <li key={r.id} className="flex gap-3 text-[13px]">
                    {r.actor ? <Avatar name={r.actor.fullName} color={r.actor.avatarColor} size={26} /> : <span className="size-[26px] rounded-full bg-sunken" />}
                    <div className="min-w-0 flex-1">
                      <p className="leading-6"><b className="font-semibold">{r.actor?.fullName ?? "سیستم"}</b> {r.title}</p>
                      {r.via && (
                        <Link to={r.recordType === "Deal" ? `/app/deals/${r.recordId}` : r.recordType === "Contact" ? `/app/contacts/${r.recordId}` : `/app/companies/${r.recordId}`}
                          className="block truncate text-xs text-accent hover:underline">{r.via}</Link>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-fg-subtle">{relative(r.occurredAt)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
