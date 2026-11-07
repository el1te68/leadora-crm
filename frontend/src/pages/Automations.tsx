import { useState } from "react";
import { ArrowLeft, Bell, ListPlus, MoreHorizontal, Pencil, Plus, Trash2, UserCog, Workflow, Zap } from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Button, cx, EmptyState, Field, Input, MenuItem, Modal, Popover, Select, Toggle } from "@/components/ui";
import { OwnerSelect } from "@/components/records/Pickers";
import { api, ApiError } from "@/lib/api";
import { useAction, useAutomations, useMembers, usePipelines } from "@/lib/queries";
import { fa, latinDigits, relative } from "@/lib/format";
import type { Automation, AutomationAction, AutomationTrigger, Pipeline } from "@/lib/types";
import { useActiveWorkspace } from "@/store";

const triggerLabel: Record<AutomationTrigger, string> = {
  DealCreated: "معامله‌ی تازه‌ای ساخته شد",
  DealStageChanged: "معامله به مرحله‌ی دیگری رفت",
  DealWon: "معامله برنده شد",
  DealLost: "معامله از دست رفت",
  ContactCreated: "مخاطب تازه‌ای اضافه شد",
};
const actionLabel: Record<AutomationAction, string> = { CreateTask: "یک کار بساز", AssignOwner: "مسئول را عوض کن", SendNotification: "اعلان بفرست" };
const actionIcon = { CreateTask: ListPlus, AssignOwner: UserCog, SendNotification: Bell };

function describeTrigger(a: Automation, pipelines?: Pipeline[]) {
  const p = pipelines?.find((x) => x.id === a.pipelineId);
  const stage = pipelines?.flatMap((x) => x.stages).find((s) => s.id === a.stageId);
  if (a.trigger === "DealStageChanged" && stage) return `وقتی معامله به «${stage.name}» رفت`;
  return `وقتی ${triggerLabel[a.trigger]}${p ? ` (${p.name})` : ""}`;
}

function describeAction(a: Automation, members?: { userId: string; fullName: string }[]) {
  const who = members?.find((m) => m.userId === a.config.userId)?.fullName;
  if (a.action === "CreateTask") return `کار «${a.config.subject}» برای ${who ?? "مسئول معامله"}، ${a.config.dueInDays && a.config.dueInDays !== "0" ? `${fa(Number(a.config.dueInDays))} روز بعد` : "همان روز"}`;
  if (a.action === "AssignOwner") return `مسئول را ${who ?? "—"} کن`;
  return `اعلان «${a.config.message}» به ${who ?? "مسئول"}`;
}

function RuleCard({ a, onEdit, canEdit }: { a: Automation; onEdit: () => void; canEdit: boolean }) {
  const { data: pipelines } = usePipelines();
  const { data: members } = useMembers();
  const toggle = useAction(() => api.post(`/automations/${a.id}/toggle`), { invalidate: ["automations"], success: a.isActive ? "اتوماسیون متوقف شد." : "اتوماسیون فعال شد." });
  const del = useAction(() => api.del(`/automations/${a.id}`), { invalidate: ["automations"], success: "اتوماسیون حذف شد." });
  const Icon = actionIcon[a.action];
  return (
    <li className={cx("card flex flex-col gap-4 p-5 transition sm:flex-row sm:items-center", !a.isActive && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex items-center gap-2">
          <h3 className="font-bold">{a.name}</h3>
          {!a.isActive && <span className="rounded-full bg-sunken px-2 text-[11px] text-fg-muted">متوقف</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-lapis-50 px-2.5 py-1.5 font-medium text-lapis-700 dark:bg-lapis-800 dark:text-lapis-100">
            <Zap className="size-3.5" />{describeTrigger(a, pipelines)}
          </span>
          <ArrowLeft className="size-4 text-saffron-600" />
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-saffron-50 px-2.5 py-1.5 font-medium text-saffron-800 dark:bg-saffron-800/30 dark:text-saffron-200">
            <Icon className="size-3.5" />{describeAction(a, members)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-fg-subtle">
        <span className="num">{fa(a.runCount)} بار اجرا{a.lastRunAt && ` · آخرین ${relative(a.lastRunAt)}`}</span>
        {canEdit && <>
          <Toggle checked={a.isActive} onChange={() => toggle.mutate(undefined)} label="فعال/غیرفعال" />
          <Popover align="end" className="w-40 p-1.5" trigger={({ toggle: t }) => (
            <button type="button" onClick={t} className="grid size-8 place-items-center rounded-md hover:bg-sunken" aria-label="گزینه‌ها"><MoreHorizontal className="size-4" /></button>
          )}>
            {(close) => <>
              <MenuItem icon={<Pencil />} onClick={() => { onEdit(); close(); }}>ویرایش</MenuItem>
              <MenuItem icon={<Trash2 />} danger onClick={() => { del.mutate(undefined); close(); }}>حذف</MenuItem>
            </>}
          </Popover>
        </>}
      </div>
    </li>
  );
}

function RuleEditor({ rule, onClose }: { rule: Automation | null; onClose: () => void }) {
  const { data: pipelines } = usePipelines();
  const [f, setF] = useState({
    name: rule?.name ?? "", trigger: rule?.trigger ?? ("DealStageChanged" as AutomationTrigger), pipelineId: rule?.pipelineId ?? "",
    stageId: rule?.stageId ?? "", action: rule?.action ?? ("CreateTask" as AutomationAction),
    config: rule?.config ?? { subject: "", dueInDays: "1" } as Record<string, string>, isActive: rule?.isActive ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const cfg = (k: string, v: string) => setF((s) => ({ ...s, config: { ...s.config, [k]: v } }));
  const save = useAction(() => {
    const body = { ...f, pipelineId: f.pipelineId || null, stageId: f.trigger === "DealStageChanged" && f.stageId ? f.stageId : null };
    return rule ? api.put(`/automations/${rule.id}`, body) : api.post("/automations", body);
  }, { invalidate: ["automations"], success: rule ? "اتوماسیون ذخیره شد." : "اتوماسیون ساخته شد.", silent: true });
  const e = save.error instanceof ApiError ? save.error : null;
  const stages = pipelines?.find((p) => p.id === f.pipelineId)?.stages ?? pipelines?.flatMap((p) => p.stages.map((s) => ({ ...s, name: `${p.name} › ${s.name}` }))) ?? [];
  const isDeal = f.trigger !== "ContactCreated";

  return (
    <Modal open onClose={onClose} title={rule ? "ویرایش اتوماسیون" : "اتوماسیون جدید"} description="یک قانون «وقتی … آنگاه …» برای همه‌ی فضای کاری." size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button loading={save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* inline */ } }}>{rule ? "ذخیره" : "ساخت اتوماسیون"}</Button></>}>
      <div className="space-y-5">
        {e && !Object.keys(e.errors).length && <p className="rounded-md bg-pomegranate-50 p-3 text-pomegranate-600">{e.message}</p>}
        <Field label="نام" error={e?.field("name")}><Input value={f.name} onChange={(x) => set("name", x.target.value)} placeholder="مثلاً: پیگیری خودکار پیشنهاد" /></Field>

        <div className="rounded-xl border border-lapis-100 bg-lapis-50/50 p-4 dark:border-lapis-800 dark:bg-lapis-900/40">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-lapis-700 dark:text-lapis-200"><Zap className="size-4" />وقتی</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={f.trigger} onChange={(x) => set("trigger", x.target.value as AutomationTrigger)} className="sm:col-span-1">
              {(Object.keys(triggerLabel) as AutomationTrigger[]).map((t) => <option key={t} value={t}>{triggerLabel[t]}</option>)}
            </Select>
            {isDeal && (
              <Select value={f.pipelineId} onChange={(x) => { set("pipelineId", x.target.value); set("stageId", ""); }}>
                <option value="">در هر پایپ‌لاین</option>
                {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            {f.trigger === "DealStageChanged" && (
              <Select value={f.stageId} onChange={(x) => set("stageId", x.target.value)}>
                <option value="">به هر مرحله‌ای</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-saffron-100 bg-saffron-50/50 p-4 dark:border-saffron-800/40 dark:bg-saffron-800/10">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-saffron-800 dark:text-saffron-200"><ArrowLeft className="size-4" />آنگاه</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={f.action} onChange={(x) => set("action", x.target.value as AutomationAction)}>
              {(Object.keys(actionLabel) as AutomationAction[]).map((a) => <option key={a} value={a}>{actionLabel[a]}</option>)}
            </Select>
            {f.action === "CreateTask" && <>
              <Field label="عنوان کار" error={e?.field("config.subject")} className="sm:col-span-2"><Input value={f.config.subject ?? ""} onChange={(x) => cfg("subject", x.target.value)} placeholder="پیگیری پیشنهاد ارسالی" /></Field>
              <Field label="سررسید (روز بعد)"><Input inputMode="numeric" value={fa(f.config.dueInDays ?? "1")} onChange={(x) => cfg("dueInDays", latinDigits(x.target.value).replace(/\D/g, ""))} /></Field>
              <Field label="برای"><OwnerSelect value={f.config.userId ?? null} onChange={(v) => cfg("userId", v ?? "")} allowEmpty emptyLabel="مسئول رکورد" /></Field>
            </>}
            {f.action === "AssignOwner" && (
              <Field label="مسئول جدید" error={e?.field("config.userId")}><OwnerSelect value={f.config.userId ?? null} onChange={(v) => cfg("userId", v ?? "")} allowEmpty emptyLabel="انتخاب کنید" /></Field>
            )}
            {f.action === "SendNotification" && <>
              <Field label="متن اعلان" error={e?.field("config.message")} className="sm:col-span-2"><Input value={f.config.message ?? ""} onChange={(x) => cfg("message", x.target.value)} /></Field>
              <Field label="گیرنده"><OwnerSelect value={f.config.userId ?? null} onChange={(v) => cfg("userId", v ?? "")} allowEmpty emptyLabel="مسئول رکورد" /></Field>
            </>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Automations() {
  const { data, isLoading } = useAutomations();
  const ws = useActiveWorkspace();
  const canEdit = ws?.role !== "Member";
  const [editing, setEditing] = useState<Automation | null | "new">(null);
  const active = data?.filter((a) => a.isActive).length ?? 0;

  return (
    <div>
      <PageHeader title="اتوماسیون" subtitle={data ? `${fa(active)} قانون فعال از ${fa(data.length)}` : undefined}
        actions={canEdit ? <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>اتوماسیون جدید</Button> : undefined} />
      {!canEdit && <p className="mb-4 rounded-lg bg-sunken px-4 py-3 text-[13px] text-fg-muted">ساختن و تغییر اتوماسیون‌ها فقط از مالک و مدیر فضای کاری برمی‌آید.</p>}
      {isLoading ? <div className="card"><TableSkeleton rows={4} cols={2} /></div> : !data?.length ? (
        <div className="card"><EmptyState icon={<Workflow className="size-7" />} title="کارهای تکراری را به لیدورا بسپارید"
          body="مثلاً: وقتی معامله به مرحله‌ی «ارسال پیشنهاد» رفت، دو روز بعد یک کار پیگیری برای مسئولش بساز."
          action={canEdit ? <Button onClick={() => setEditing("new")}>اولین اتوماسیون</Button> : undefined} /></div>
      ) : (
        <ul className="space-y-3">{data.map((a) => <RuleCard key={a.id} a={a} canEdit={canEdit} onEdit={() => setEditing(a)} />)}</ul>
      )}
      {editing && <RuleEditor rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
