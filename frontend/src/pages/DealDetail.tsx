import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, KanbanSquare, MoreHorizontal, Pencil, RotateCcw, ThumbsDown, Trash2, Trophy, User } from "lucide-react";
import { PageSkeleton } from "./common";
import { LoseDialog } from "./Deals";
import { Badge, Button, ConfirmDialog, cx, EmptyState, MenuItem, Money, Popover } from "@/components/ui";
import { RecordTimeline } from "@/components/records/Timeline";
import { CustomProps, OpenActivities, Panel, Prop } from "@/components/records/RecordParts";
import { OwnerChip, TagList } from "@/components/records/Pickers";
import { useCreate } from "@/components/records/CreateHost";
import { recordKeys, showError, useAction, useDeal, useWs } from "@/lib/queries";
import { api } from "@/lib/api";
import { dateFa, daysUntil, fa, lifecycleLabel, relative, toman } from "@/lib/format";

export default function DealDetail() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useDeal(id);
  const open = useCreate((s) => s.open);
  const nav = useNavigate();
  const qc = useQueryClient();
  const ws = useWs();
  const [losing, setLosing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const refresh = () => recordKeys.forEach((k) => qc.invalidateQueries({ queryKey: [ws, k] }));
  const win = useAction(() => api.post(`/deals/${id}/won`), { invalidate: recordKeys, success: "تبریک! معامله برنده شد 🎉" });
  const reopen = useAction(() => api.post(`/deals/${id}/reopen`), { invalidate: recordKeys, success: "معامله دوباره باز شد." });
  const del = useAction(() => api.del(`/deals/${id}`), { invalidate: recordKeys, success: "معامله حذف شد." });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <EmptyState icon={<KanbanSquare className="size-7" />} title="این معامله پیدا نشد" action={<Link to="/app/deals"><Button variant="secondary">بازگشت به معامله‌ها</Button></Link>} />;
  const d = data.deal;
  const currentIdx = data.stages.findIndex((s) => s.id === d.stageId);

  const moveTo = async (stageId: string) => {
    if (d.status !== "Open" || stageId === d.stageId) return;
    try {
      await api.post(`/deals/${id}/move`, { stageId, sortOrder: d.sortOrder });
      toast.success(`به «${data.stages.find((s) => s.id === stageId)?.name}» رفت.`);
      refresh();
    } catch (e) { showError(e); }
  };

  const close = d.expectedCloseDate ? daysUntil(d.expectedCloseDate) : null;

  return (
    <div>
      <nav className="mb-4 text-xs text-fg-subtle"><Link to="/app/deals" className="hover:text-fg">معامله‌ها</Link> / <span>{data.pipelineName}</span></nav>

      <section className="card mb-5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {d.status === "Won" && <Badge tone="saffron"><Trophy className="size-3" />برنده شد · {dateFa(data.closedAt)}</Badge>}
              {d.status === "Lost" && <Badge tone="pomegranate"><ThumbsDown className="size-3" />از دست رفت · {data.lostReason}</Badge>}
              {d.isStale && d.status === "Open" && <Badge tone="saffron">راکد — {relative(d.stageEnteredAt)} در این مرحله</Badge>}
              <TagList tags={d.tags} />
            </div>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">{d.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-fg-muted">
              <Money value={d.value} className="text-lg" />
              <span>احتمال <b className="num text-fg">{fa(d.probability)}٪</b></span>
              <span>ارزش وزنی <b className="num text-fg">{toman((d.value * d.probability) / 100)}</b></span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d.status === "Open" ? (
              <>
                <Button variant="saffron" icon={<Trophy className="size-4" />} loading={win.isPending} onClick={() => win.mutate(undefined)}>برنده شد</Button>
                <Button variant="secondary" icon={<ThumbsDown className="size-4" />} onClick={() => setLosing(true)}>از دست رفت</Button>
              </>
            ) : (
              <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={reopen.isPending} onClick={() => reopen.mutate(undefined)}>بازگشایی معامله</Button>
            )}
            <Popover align="end" className="w-44 p-1.5" trigger={({ toggle }) => (
              <Button variant="ghost" onClick={toggle} aria-label="گزینه‌ها" className="px-2.5"><MoreHorizontal className="size-4" /></Button>
            )}>
              {(c) => <>
                <MenuItem icon={<Pencil />} onClick={() => { open("deal", { edit: { ...d, customFields: data.customFields } }); c(); }}>ویرایش</MenuItem>
                <MenuItem icon={<Trash2 />} danger onClick={() => { setConfirm(true); c(); }}>حذف معامله</MenuItem>
              </>}
            </Popover>
          </div>
        </div>

        {/* Stage path — click to move */}
        <ol className="no-scrollbar mt-6 flex overflow-x-auto" aria-label="مرحله‌های پایپ‌لاین">
          {data.stages.map((s, i) => {
            const done = d.status === "Won" || i < currentIdx;
            const current = d.status === "Open" && i === currentIdx;
            return (
              <li key={s.id} className="min-w-[120px] flex-1">
                <button type="button" disabled={d.status !== "Open"} onClick={() => moveTo(s.id)}
                  className={cx("group relative flex h-11 w-full items-center justify-center gap-1.5 px-4 text-[12.5px] font-semibold transition",
                    current ? "bg-lapis-600 text-white dark:bg-lapis-400 dark:text-lapis-950" : done ? "bg-lapis-100 text-lapis-700 dark:bg-lapis-800 dark:text-lapis-100" : "bg-sunken text-fg-muted hover:bg-line",
                    i > 0 && "-ms-1.5")}
                  style={{ clipPath: i === data.stages.length - 1 ? "polygon(100% 0, 100% 100%, 0 100%, 0 0)" : "polygon(100% 0, 100% 100%, 14px 100%, 0 50%, 14px 0)" }}>
                  {done && <Check className="size-3.5" />}{s.name}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel title="جزئیات" action={<Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => open("deal", { edit: { ...d, customFields: data.customFields } })}>ویرایش</Button>}>
            <dl className="divide-y divide-line">
              <Prop label="مسئول"><OwnerChip name={d.owner?.fullName} color={d.owner?.avatarColor} /></Prop>
              <Prop label="مرحله">{d.status === "Open" ? <Badge color={d.stageColor}>{d.stageName}</Badge> : d.status === "Won" ? "برنده" : "باخته"}</Prop>
              <Prop label="تاریخ بستن">{d.expectedCloseDate && <span className={cx(close !== null && close < 0 && d.status === "Open" && "font-medium text-pomegranate-500")}>{dateFa(d.expectedCloseDate)}{close !== null && d.status === "Open" && <span className="text-xs text-fg-subtle"> ({close < 0 ? `${fa(-close)} روز گذشته` : close === 0 ? "امروز" : `${fa(close)} روز دیگر`})</span>}</span>}</Prop>
              <Prop label="پایپ‌لاین">{data.pipelineName}</Prop>
              <CustomProps entity="Deal" values={data.customFields} />
              <Prop label="ساخته‌شده">{dateFa(data.createdAt)}</Prop>
              <Prop label="در این مرحله از">{relative(d.stageEnteredAt)}</Prop>
            </dl>
          </Panel>
          <Panel title="طرف معامله">
            <div className="space-y-1">
              {data.contactInfo ? (
                <Link to={`/app/contacts/${data.contactInfo.id}`} className="-mx-1 flex items-center gap-3 rounded-lg p-1.5 hover:bg-sunken">
                  <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><User className="size-4" /></span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{data.contactInfo.fullName}</span>
                    <span className="block truncate text-xs text-fg-subtle">{data.contactInfo.jobTitle} · {lifecycleLabel[data.contactInfo.lifecycle]}</span></span>
                </Link>
              ) : <p className="text-[13px] text-fg-subtle">مخاطبی وصل نیست.</p>}
              {d.company && (
                <Link to={`/app/companies/${d.company.id}`} className="-mx-1 flex items-center gap-3 rounded-lg p-1.5 hover:bg-sunken">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Building2 className="size-4" /></span>
                  <span className="truncate font-semibold">{d.company.name}</span>
                </Link>
              )}
            </div>
          </Panel>
          <OpenActivities type="Deal" id={d.id} title={d.title} />
        </aside>
        <div className="min-w-0"><RecordTimeline type="Deal" id={d.id} emailTo={data.contactInfo?.email} /></div>
      </div>

      {losing && <LoseDialog deal={d} onClose={() => setLosing(false)} />}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="حذف معامله" confirmLabel="حذف" loading={del.isPending}
        body={`«${d.title}» و تاریخچه‌اش برای همیشه حذف می‌شود.`} onConfirm={async () => { await del.mutateAsync(undefined); nav("/app/deals"); }} />
    </div>
  );
}
