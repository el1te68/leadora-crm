import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  ArrowDownUp, CalendarClock, Hourglass, KanbanSquare, List, ListChecks, Plus, Search, ThumbsDown, Trophy,
} from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Avatar, Badge, Button, cx, EmptyState, Field, Input, Modal, Money, Segmented, Select, Skeleton, Textarea } from "@/components/ui";
import { OwnerSelect, TagList } from "@/components/records/Pickers";
import { useCreate } from "@/components/records/CreateHost";
import { keys, showError, useBoard, useDeals, usePipelines, useWs } from "@/lib/queries";
import { api } from "@/lib/api";
import { daysUntil, dateShort, fa, relative, tomanShort } from "@/lib/format";
import type { Board, DealCard, DealStatus } from "@/lib/types";

const lostReasons = ["قیمت بالاتر از بودجه", "انتخاب رقیب", "نبود بودجه در این فصل", "عدم پاسخ‌گویی مشتری", "نیاز با محصول تطبیق نداشت"];

function CloseDate({ date }: { date?: string | null }) {
  if (!date) return null;
  const d = daysUntil(date);
  const tone = d < 0 ? "text-pomegranate-500" : d <= 7 ? "text-saffron-700 dark:text-saffron-300" : "text-fg-subtle";
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px]", tone)} title={`تاریخ احتمالی بستن: ${dateShort(date)}`}>
      <CalendarClock className="size-3" />
      {d < 0 ? `${fa(-d)} روز گذشته` : d === 0 ? "امروز" : dateShort(date)}
    </span>
  );
}

const DealCardView = memo(function DealCardView({ deal, overlay, dragging }: { deal: DealCard; overlay?: boolean; dragging?: boolean }) {
  return (
    <div className={cx(
      "group rounded-[12px] border bg-surface p-3.5 text-start transition-[box-shadow,transform,opacity]",
      overlay ? "rotate-[-2deg] cursor-grabbing border-saffron-300 shadow-lift" : "border-line shadow-card hover:border-line-strong hover:shadow-[0_6px_16px_-8px_rgb(20_27_74/0.25)]",
      dragging && "opacity-35",
    )}>
      <div className="flex items-start gap-2">
        <Link to={`/app/deals/${deal.id}`} onPointerDown={(e) => e.stopPropagation()} className="line-clamp-2 flex-1 text-[13.5px] font-semibold leading-6 hover:text-accent">
          {deal.title}
        </Link>
        {deal.isStale && (
          <span title="بیش از ۱۴ روز بدون تغییر" className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-saffron-50 px-1.5 py-0.5 text-[10.5px] font-medium text-saffron-700 dark:bg-saffron-800/40 dark:text-saffron-200">
            <Hourglass className="size-2.5" />راکد
          </span>
        )}
      </div>
      {(deal.company || deal.contact) && (
        <div className="mt-0.5 truncate text-xs text-fg-subtle">{[deal.company?.name, deal.contact?.name].filter(Boolean).join(" · ")}</div>
      )}
      {deal.tags.length > 0 && <div className="mt-2"><TagList tags={deal.tags} max={2} /></div>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Money value={deal.value} short className="text-[13px]" />
        <div className="flex items-center gap-2">
          {deal.openActivities > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-fg-subtle" title={`${fa(deal.openActivities)} فعالیت باز`}>
              <ListChecks className="size-3" />{fa(deal.openActivities)}
            </span>
          )}
          <CloseDate date={deal.expectedCloseDate} />
          {deal.owner && <Avatar name={deal.owner.fullName} color={deal.owner.avatarColor} size={22} />}
        </div>
      </div>
    </div>
  );
});

function SortableDeal({ deal }: { deal: DealCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { stageId: deal.stageId } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}
      className="cursor-grab touch-manipulation outline-none focus-visible:rounded-[12px] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      aria-roledescription="کارت قابل جابه‌جایی">
      <DealCardView deal={deal} dragging={isDragging} />
    </div>
  );
}

function Column({ col, deals, onAdd }: { col: Board["columns"][number]; deals: DealCard[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.stage.id}`, data: { stageId: col.stage.id } });
  const total = deals.reduce((s, d) => s + d.value, 0);
  const weighted = deals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  return (
    <section className="flex w-[84vw] shrink-0 snap-start flex-col sm:w-[296px]" aria-label={col.stage.name}>
      <header className="mb-2.5 px-1">
        <div className="mb-2 h-[3px] rounded-full" style={{ background: col.stage.color }} />
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13.5px] font-bold">
            {col.stage.name}
            <span className="num rounded-full bg-sunken px-1.5 text-[11px] font-semibold leading-5 text-fg-muted">{fa(deals.length)}</span>
          </h2>
          <button type="button" onClick={onAdd} className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-sunken hover:text-fg" aria-label={`معامله‌ی جدید در ${col.stage.name}`}>
            <Plus className="size-4" />
          </button>
        </div>
        <div className="num mt-0.5 flex items-center gap-1.5 text-xs text-fg-subtle">
          <span className="font-semibold text-fg-muted">{tomanShort(total)}</span>
          <span>· وزنی {tomanShort(weighted, false)}</span>
          <span className="ms-auto">{fa(col.stage.probability)}٪</span>
        </div>
      </header>
      <div ref={setNodeRef}
        className={cx("flex min-h-40 flex-1 flex-col gap-2.5 rounded-[14px] p-2 transition-colors", isOver ? "bg-accent-soft ring-2 ring-inset ring-lapis-200 dark:ring-lapis-700" : "bg-sunken/60")}>
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => <SortableDeal key={d.id} deal={d} />)}
        </SortableContext>
        {deals.length === 0 && (
          <button type="button" onClick={onAdd} className="grid flex-1 place-items-center rounded-[12px] border-2 border-dashed border-line-strong/70 py-8 text-xs text-fg-subtle hover:border-fg-subtle hover:text-fg-muted">
            معامله‌ای اینجا نیست — بکشید یا بسازید
          </button>
        )}
      </div>
    </section>
  );
}

function DropZone({ id, label, icon, tone }: { id: "won" | "lost"; label: string; icon: React.ReactNode; tone: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cx("flex h-16 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-bold transition", tone, isOver && "scale-[1.02] border-solid")}>
      {icon}{label}
    </div>
  );
}

function Kanban({ pipelineId, ownerId, q }: { pipelineId?: string; ownerId?: string; q?: string }) {
  const ws = useWs();
  const qc = useQueryClient();
  const query = { pipelineId, ownerId, q };
  const { data, isLoading } = useBoard(query);
  const openCreate = useCreate((s) => s.open);
  const [cols, setCols] = useState<Record<string, DealCard[]>>({});
  const [active, setActive] = useState<DealCard | null>(null);
  const [losing, setLosing] = useState<DealCard | null>(null);
  const dragFrom = useRef<string | null>(null);

  useEffect(() => {
    if (!data || active) return;
    setCols(Object.fromEntries(data.columns.map((c) => [c.stage.id, c.deals])));
  }, [data, active]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findStage = (id: string) => (id.startsWith("col:") ? id.slice(4) : Object.keys(cols).find((s) => cols[s].some((d) => d.id === id)));

  const onStart = (e: DragStartEvent) => {
    const stage = findStage(String(e.active.id));
    dragFrom.current = stage ?? null;
    setActive(stage ? cols[stage].find((d) => d.id === e.active.id) ?? null : null);
  };

  const onOver = (e: DragOverEvent) => {
    if (!e.over || e.over.id === "won" || e.over.id === "lost") return;
    const from = findStage(String(e.active.id));
    const to = findStage(String(e.over.id));
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const moving = prev[from].find((d) => d.id === e.active.id);
      if (!moving) return prev;
      const target = [...prev[to]];
      const overIndex = target.findIndex((d) => d.id === e.over!.id);
      target.splice(overIndex < 0 ? target.length : overIndex, 0, { ...moving, stageId: to });
      return { ...prev, [from]: prev[from].filter((d) => d.id !== e.active.id), [to]: target };
    });
  };

  const snapshot = () => qc.getQueryData<Board>(keys.board(ws, query));
  const commitBoard = (next: Record<string, DealCard[]>) =>
    qc.setQueryData<Board>(keys.board(ws, query), (b) => b && ({ ...b, columns: b.columns.map((c) => ({ ...c, deals: next[c.stage.id] ?? [] })) }));

  const removeLocally = (id: string) => {
    const next = Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, v.filter((d) => d.id !== id)]));
    setCols(next);
    commitBoard(next);
  };

  const onEnd = async (e: DragEndEvent) => {
    const deal = active;
    setActive(null);
    if (!deal || !e.over) return;
    const prev = snapshot();

    if (e.over.id === "won") {
      removeLocally(deal.id);
      try {
        await api.post(`/deals/${deal.id}/won`);
        toast.success(`«${deal.title}» برنده شد 🎉`, { description: tomanShort(deal.value) });
        qc.invalidateQueries({ queryKey: [ws, "report"] });
      } catch (err) {
        if (prev) qc.setQueryData(keys.board(ws, query), prev);
        showError(err);
      }
      return;
    }
    if (e.over.id === "lost") {
      setLosing(deal);
      return;
    }

    const stage = findStage(String(e.over.id)) ?? deal.stageId;
    const list = [...(cols[stage] ?? [])];
    const oldIndex = list.findIndex((d) => d.id === deal.id);
    let newIndex = e.over.id === `col:${stage}` ? list.length - 1 : list.findIndex((d) => d.id === e.over!.id);
    if (newIndex < 0) newIndex = list.length - 1;
    if (oldIndex >= 0 && oldIndex !== newIndex) {
      const [m] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, m);
    }
    const idx = list.findIndex((d) => d.id === deal.id);
    const before = list[idx - 1]?.sortOrder;
    const after = list[idx + 1]?.sortOrder;
    const sortOrder = before !== undefined && after !== undefined ? (before + after) / 2 : before !== undefined ? before + 1 : after !== undefined ? after - 1 : 0;
    list[idx] = { ...list[idx], stageId: stage, sortOrder };
    const next = { ...cols, [stage]: list };
    setCols(next);
    commitBoard(next); // optimistic

    if (stage === dragFrom.current && oldIndex === newIndex) return;
    try {
      await api.post(`/deals/${deal.id}/move`, { stageId: stage, sortOrder });
      if (stage !== dragFrom.current) {
        const name = data?.columns.find((c) => c.stage.id === stage)?.stage.name;
        toast.success(`به «${name}» منتقل شد.`, { description: deal.title });
      }
      qc.invalidateQueries({ queryKey: [ws, "deal", deal.id] });
      qc.invalidateQueries({ queryKey: [ws, "report"] });
    } catch (err) {
      if (prev) {
        qc.setQueryData(keys.board(ws, query), prev);
        setCols(Object.fromEntries(prev.columns.map((c) => [c.stage.id, c.deals])));
      }
      showError(err);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[296px] shrink-0 space-y-2.5"><Skeleton className="h-12" />{[0, 1, 2].map((j) => <Skeleton key={j} className="h-28 rounded-[12px]" />)}</div>
        ))}
      </div>
    );
  }

  const openValue = Object.values(cols).flat().reduce((s, d) => s + d.value, 0);
  const weighted = Object.values(cols).flat().reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const count = Object.values(cols).flat().length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <span className="text-fg-muted">ارزش باز <b className="num ms-1 text-fg">{tomanShort(openValue)}</b></span>
        <span className="text-fg-muted">وزنی <b className="num ms-1 text-fg">{tomanShort(weighted)}</b></span>
        <span className="text-fg-muted">برنده‌ی این ماه <b className="num ms-1 text-money">{tomanShort(data.wonThisMonth)}</b> <span className="num text-fg-subtle">({fa(data.wonCountThisMonth)})</span></span>
        <span className="text-fg-muted">{fa(count)} معامله‌ی باز</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActive(null)}
        accessibility={{ screenReaderInstructions: { draggable: "برای برداشتن کارت Space را بزنید، با کلیدهای جهت جابه‌جا کنید و دوباره Space را بزنید." } }}>
        <div className="scroll-x-snap -mx-3 flex gap-4 px-3 pb-6 sm:-mx-6 sm:px-6">
          {data.columns.map((c) => (
            <Column key={c.stage.id} col={c} deals={cols[c.stage.id] ?? []} onAdd={() => openCreate("deal", { pipelineId: data.pipeline.id, stageId: c.stage.id })} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>{active ? <DealCardView deal={active} overlay /> : null}</DragOverlay>
        {active && (
          <div className="fixed inset-x-3 bottom-4 z-40 flex animate-pop-in gap-3 sm:inset-x-auto sm:start-1/2 sm:w-[560px] sm:translate-x-1/2 lg:ms-28">
            <DropZone id="won" label="برنده شد" icon={<Trophy className="size-4" />} tone="border-pistachio-400 bg-pistachio-50 text-pistachio-700 shadow-pop dark:bg-[#16302a] dark:text-pistachio-100" />
            <DropZone id="lost" label="از دست رفت" icon={<ThumbsDown className="size-4" />} tone="border-pomegranate-400 bg-pomegranate-50 text-pomegranate-600 shadow-pop dark:bg-[#3a1622] dark:text-pomegranate-100" />
          </div>
        )}
      </DndContext>
      {losing && <LoseDialog deal={losing} onClose={(done) => {
        if (done) removeLocally(losing.id);
        setLosing(null);
      }} />}
    </>
  );
}

export function LoseDialog({ deal, onClose }: { deal: { id: string; title: string }; onClose: (done: boolean) => void }) {
  const [reason, setReason] = useState(lostReasons[0]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const ws = useWs();
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/deals/${deal.id}/lost`, { reason: reason === "other" ? custom : reason });
      toast(`«${deal.title}» از دست رفته ثبت شد.`);
      ["board", "deals", "deal", "report", "timeline"].forEach((k) => qc.invalidateQueries({ queryKey: [ws, k] }));
      onClose(true);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title="چرا این معامله از دست رفت؟" description={deal.title} size="sm"
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>انصراف</Button><Button variant="danger" loading={busy} disabled={reason === "other" && !custom.trim()} onClick={submit}>ثبت باخت</Button></>}>
      <div className="space-y-2">
        {[...lostReasons, "other"].map((r) => (
          <label key={r} className={cx("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition", reason === r ? "border-pomegranate-400 bg-pomegranate-50 dark:bg-pomegranate-700/20" : "border-line hover:bg-surface-2")}>
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-pomegranate-500" />
            {r === "other" ? "دلیل دیگر…" : r}
          </label>
        ))}
        {reason === "other" && <Field label="توضیح"><Textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={2} /></Field>}
      </div>
    </Modal>
  );
}

const statusTone: Record<DealStatus, "lapis" | "pistachio" | "pomegranate"> = { Open: "lapis", Won: "pistachio", Lost: "pomegranate" };
const statusLabel: Record<DealStatus, string> = { Open: "باز", Won: "برنده", Lost: "باخته" };

function DealList({ pipelineId, ownerId, q }: { pipelineId?: string; ownerId?: string; q?: string }) {
  const [status, setStatus] = useState<"" | DealStatus>("Open");
  const [sort, setSort] = useState({ sort: "updatedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const { data, isLoading } = useDeals({ pipelineId, ownerId, q, status: status || undefined, ...sort, page, pageSize: 25 });
  const head = (key: string, label: string) => (
    <th className="px-4 py-3 text-start font-medium">
      <button type="button" className={cx("inline-flex items-center gap-1 hover:text-fg", sort.sort === key && "text-fg")}
        onClick={() => setSort((s) => ({ sort: key, dir: s.sort === key && s.dir === "desc" ? "asc" : "desc" }))}>
        {label}{sort.sort === key && <ArrowDownUp className="size-3" />}
      </button>
    </th>
  );
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;
  return (
    <div>
      <Segmented className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
        options={[{ value: "Open", label: "باز" }, { value: "Won", label: "برنده" }, { value: "Lost", label: "باخته" }, { value: "", label: "همه" }]} />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? <TableSkeleton /> : !data?.items.length ? (
            <EmptyState icon={<KanbanSquare className="size-7" />} title="معامله‌ای با این فیلترها نیست" body="فیلترها را تغییر دهید یا یک معامله‌ی تازه بسازید." />
          ) : (
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead className="border-b border-line bg-surface-2 text-xs text-fg-subtle">
                <tr>{head("title", "معامله")}{head("value", "مبلغ")}{head("stage", "مرحله")}{head("owner", "مسئول")}{head("expectedCloseDate", "تاریخ بستن")}{head("updatedAt", "آخرین تغییر")}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((d) => (
                  <tr key={d.id} className="cursor-pointer transition hover:bg-surface-2" onClick={() => nav(`/app/deals/${d.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{d.title}</div>
                      <div className="text-xs text-fg-subtle">{d.company?.name}</div>
                    </td>
                    <td className="px-4 py-3"><Money value={d.value} short /></td>
                    <td className="px-4 py-3">{d.status === "Open" ? <Badge color={d.stageColor}>{d.stageName}</Badge> : <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>}</td>
                    <td className="px-4 py-3">{d.owner && <span className="inline-flex items-center gap-2"><Avatar name={d.owner.fullName} color={d.owner.avatarColor} size={22} />{d.owner.fullName}</span>}</td>
                    <td className="px-4 py-3"><CloseDate date={d.expectedCloseDate} /></td>
                    <td className="px-4 py-3 text-fg-subtle">{relative(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-fg-muted">
            <span>{fa(data.total)} معامله</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</Button>
              <span className="num">{fa(page)} از {fa(pages)}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Deals() {
  const [params, setParams] = useSearchParams();
  const { data: pipelines } = usePipelines();
  const view = (params.get("view") as "board" | "list") ?? "board";
  const pipelineId = params.get("pipeline") ?? pipelines?.[0]?.id;
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const openCreate = useCreate((s) => s.open);
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const set = (k: string, v: string) => setParams((p) => { p.set(k, v); return p; }, { replace: true });
  const filters = useMemo(() => ({ pipelineId, ownerId: ownerId ?? undefined, q: dq || undefined }), [pipelineId, ownerId, dq]);

  return (
    <div>
      <PageHeader
        title="معامله‌ها"
        actions={<Button icon={<Plus className="size-4" />} onClick={() => openCreate("deal", { pipelineId })}>معامله‌ی جدید</Button>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-52">
          <Select value={pipelineId ?? ""} onChange={(e) => set("pipeline", e.target.value)} aria-label="پایپ‌لاین">
            {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <Input data-page-search icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی عنوان یا شرکت…  /" className="w-full sm:w-64" />
        <div className="w-full sm:w-44"><OwnerSelect value={ownerId} onChange={setOwnerId} allowEmpty emptyLabel="همه‌ی مسئولان" /></div>
        <Segmented className="ms-auto" value={view} onChange={(v) => set("view", v)} options={[
          { value: "board", label: <span className="inline-flex items-center gap-1.5"><KanbanSquare className="size-3.5" />بورد</span> },
          { value: "list", label: <span className="inline-flex items-center gap-1.5"><List className="size-3.5" />لیست</span> },
        ]} />
      </div>
      {pipelineId ? (view === "board" ? <Kanban {...filters} /> : <DealList {...filters} />) : <TableSkeleton />}
    </div>
  );
}
