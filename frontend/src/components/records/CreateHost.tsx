import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { create } from "zustand";
import { CalendarClock, Phone, Users2 } from "lucide-react";
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { CompanySelect, ContactSelect, CustomFieldInputs, OwnerSelect, TagPicker } from "./Pickers";
import { api, ApiError } from "@/lib/api";
import { useAction, usePipelines, recordKeys } from "@/lib/queries";
import { useAuth } from "@/store";
import { fa, latinDigits, lifecycleLabel, lifecycleOrder, toman } from "@/lib/format";
import type { Activity, ActivityType, CompanyListItem, ContactListItem, DealCard, LifecycleStage, RecordType } from "@/lib/types";

type Kind = "contact" | "company" | "deal" | "activity";
export interface CreateDefaults {
  companyId?: string | null; contactId?: string | null; pipelineId?: string; stageId?: string;
  record?: { type: RecordType; id: string; title: string }; activityType?: ActivityType;
  edit?: ContactListItem | CompanyListItem | (DealCard & { customFields?: Record<string, string> }) | Activity;
}
interface CreateState { kind: Kind | null; defaults: CreateDefaults; open: (k: Kind, d?: CreateDefaults) => void; close: () => void }
export const useCreate = create<CreateState>((set) => ({
  kind: null,
  defaults: {},
  open: (kind, defaults = {}) => set({ kind, defaults }),
  close: () => set({ kind: null, defaults: {} }),
}));

const err = (e: unknown, f: string) => (e instanceof ApiError ? e.field(f) : undefined);

export function CreateHost() {
  const { kind, defaults, close } = useCreate();
  return (
    <>
      {kind === "contact" && <ContactForm defaults={defaults} onClose={close} />}
      {kind === "company" && <CompanyForm defaults={defaults} onClose={close} />}
      {kind === "deal" && <DealForm defaults={defaults} onClose={close} />}
      {kind === "activity" && <ActivityForm defaults={defaults} onClose={close} />}
    </>
  );
}

const sources = ["وب‌سایت", "معرفی مشتری", "نمایشگاه", "لینکدین", "تماس ورودی", "کمپین ایمیلی"];

function ContactForm({ defaults, onClose }: { defaults: CreateDefaults; onClose: () => void }) {
  const edit = defaults.edit as ContactListItem | undefined;
  const me = useAuth((s) => s.user?.id);
  const nav = useNavigate();
  const [f, setF] = useState({
    firstName: edit?.firstName ?? "", lastName: edit?.lastName ?? "", email: edit?.email ?? "", phone: edit?.phone ?? "",
    jobTitle: edit?.jobTitle ?? "", city: edit?.city ?? "", source: edit?.source ?? "", lifecycle: (edit?.lifecycle ?? "Lead") as LifecycleStage,
    companyId: edit?.company?.id ?? defaults.companyId ?? null, ownerId: edit?.owner?.id ?? me ?? null,
    tagIds: edit?.tags.map((t) => t.id) ?? [], customFields: edit?.customFields ?? {},
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useAction(
    (body: typeof f) => (edit ? api.put<ContactListItem>(`/contacts/${edit.id}`, body) : api.post<ContactListItem>("/contacts", body)),
    { invalidate: recordKeys, success: edit ? "تغییرات مخاطب ذخیره شد." : "مخاطب ساخته شد.", silent: true },
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const c = await save.mutateAsync({ ...f, email: f.email || "", phone: f.phone || "" });
      onClose();
      if (!edit) nav(`/app/contacts/${c.id}`);
    } catch { /* field errors shown inline */ }
  };
  const e = save.error;
  return (
    <Modal open onClose={onClose} title={edit ? "ویرایش مخاطب" : "مخاطب جدید"} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button type="submit" form="contact-form" loading={save.isPending}>{edit ? "ذخیره‌ی تغییرات" : "ساخت مخاطب"}</Button></>}>
      <form id="contact-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {e instanceof ApiError && !Object.keys(e.errors).length && <p className="rounded-md bg-pomegranate-50 p-3 text-pomegranate-600 sm:col-span-2">{e.message}</p>}
        <Field label="نام" error={err(e, "firstName")}><Input value={f.firstName} onChange={(x) => set("firstName", x.target.value)} invalid={!!err(e, "firstName")} required /></Field>
        <Field label="نام خانوادگی" error={err(e, "lastName")}><Input value={f.lastName} onChange={(x) => set("lastName", x.target.value)} /></Field>
        <Field label="ایمیل" error={err(e, "email")}><Input dir="ltr" type="email" value={f.email} onChange={(x) => set("email", x.target.value)} invalid={!!err(e, "email")} placeholder="name@company.ir" /></Field>
        <Field label="موبایل"><Input dir="ltr" value={f.phone} onChange={(x) => set("phone", latinDigits(x.target.value))} placeholder="0912…" /></Field>
        <Field label="سمت"><Input value={f.jobTitle} onChange={(x) => set("jobTitle", x.target.value)} /></Field>
        <Field label="شرکت" error={err(e, "companyId")}><CompanySelect value={f.companyId} onChange={(v) => set("companyId", v)} /></Field>
        <Field label="مرحله‌ی چرخه‌ی مشتری">
          <Select value={f.lifecycle} onChange={(x) => set("lifecycle", x.target.value as LifecycleStage)}>
            {lifecycleOrder.map((l) => <option key={l} value={l}>{lifecycleLabel[l]}</option>)}
          </Select>
        </Field>
        <Field label="مسئول" error={err(e, "ownerId")}><OwnerSelect value={f.ownerId} onChange={(v) => set("ownerId", v)} allowEmpty /></Field>
        <Field label="شهر"><Input value={f.city} onChange={(x) => set("city", x.target.value)} /></Field>
        <Field label="منبع">
          <Select value={f.source} onChange={(x) => set("source", x.target.value)}>
            <option value="">—</option>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="برچسب‌ها"><TagPicker value={f.tagIds} onChange={(v) => set("tagIds", v)} /></Field></div>
        <div className="sm:col-span-2"><CustomFieldInputs entity="Contact" values={f.customFields} onChange={(v) => set("customFields", v)} /></div>
      </form>
    </Modal>
  );
}

const industries = ["فناوری اطلاعات", "صنایع غذایی", "دارو و سلامت", "خرده‌فروشی", "بیمه و مالی", "ساخت‌وساز", "آموزش", "گردشگری", "حمل‌ونقل", "تولیدی", "مشاوره", "سایر"];
const sizes = ["۱–۱۰", "۱۱–۵۰", "۵۱–۲۰۰", "۲۰۱–۵۰۰", "۵۰۰+"];

function CompanyForm({ defaults, onClose }: { defaults: CreateDefaults; onClose: () => void }) {
  const edit = defaults.edit as CompanyListItem | undefined;
  const me = useAuth((s) => s.user?.id);
  const nav = useNavigate();
  const [f, setF] = useState({
    name: edit?.name ?? "", domain: edit?.domain ?? "", industry: edit?.industry ?? "", size: edit?.size ?? "", city: edit?.city ?? "",
    phone: edit?.phone ?? "", address: edit?.address ?? "", ownerId: edit?.owner?.id ?? me ?? null,
    tagIds: edit?.tags.map((t) => t.id) ?? [], customFields: edit?.customFields ?? {},
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useAction(
    (body: typeof f) => (edit ? api.put<CompanyListItem>(`/companies/${edit.id}`, body) : api.post<CompanyListItem>("/companies", body)),
    { invalidate: recordKeys, success: edit ? "تغییرات شرکت ذخیره شد." : "شرکت ساخته شد.", silent: true },
  );
  const e = save.error;
  return (
    <Modal open onClose={onClose} title={edit ? "ویرایش شرکت" : "شرکت جدید"} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button type="submit" form="company-form" loading={save.isPending}>{edit ? "ذخیره‌ی تغییرات" : "ساخت شرکت"}</Button></>}>
      <form id="company-form" className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
        ev.preventDefault();
        try { const c = await save.mutateAsync(f); onClose(); if (!edit) nav(`/app/companies/${c.id}`); } catch { /* inline */ }
      }}>
        {e instanceof ApiError && !Object.keys(e.errors).length && <p className="rounded-md bg-pomegranate-50 p-3 text-pomegranate-600 sm:col-span-2">{e.message}</p>}
        <Field label="نام شرکت" error={err(e, "name")} className="sm:col-span-2"><Input value={f.name} onChange={(x) => set("name", x.target.value)} invalid={!!err(e, "name")} required /></Field>
        <Field label="وب‌سایت"><Input dir="ltr" value={f.domain} onChange={(x) => set("domain", x.target.value)} placeholder="example.ir" /></Field>
        <Field label="تلفن"><Input dir="ltr" value={f.phone} onChange={(x) => set("phone", latinDigits(x.target.value))} /></Field>
        <Field label="صنعت">
          <Select value={f.industry} onChange={(x) => set("industry", x.target.value)}>
            <option value="">—</option>
            {[...new Set([...(f.industry ? [f.industry] : []), ...industries])].map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="اندازه (نفر)">
          <Select value={f.size} onChange={(x) => set("size", x.target.value)}>
            <option value="">—</option>
            {sizes.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="شهر"><Input value={f.city} onChange={(x) => set("city", x.target.value)} /></Field>
        <Field label="مسئول"><OwnerSelect value={f.ownerId} onChange={(v) => set("ownerId", v)} allowEmpty /></Field>
        <Field label="نشانی" className="sm:col-span-2"><Input value={f.address} onChange={(x) => set("address", x.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="برچسب‌ها"><TagPicker value={f.tagIds} onChange={(v) => set("tagIds", v)} /></Field></div>
        <div className="sm:col-span-2"><CustomFieldInputs entity="Company" values={f.customFields} onChange={(v) => set("customFields", v)} /></div>
      </form>
    </Modal>
  );
}

export function MoneyInput({ value, onChange, invalid, id }: { value: number; onChange: (v: number) => void; invalid?: boolean; id?: string }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="numeric" invalid={invalid} className="num pe-16"
        value={value ? fa(value) : ""}
        onChange={(e) => onChange(Number(latinDigits(e.target.value).replace(/[^0-9]/g, "")) || 0)} placeholder="۰" />
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-xs text-fg-subtle">تومان</span>
    </div>
  );
}

function DealForm({ defaults, onClose }: { defaults: CreateDefaults; onClose: () => void }) {
  const edit = defaults.edit as (DealCard & { customFields?: Record<string, string> }) | undefined;
  const { data: pipelines } = usePipelines();
  const me = useAuth((s) => s.user?.id);
  const nav = useNavigate();
  const [f, setF] = useState({
    title: edit?.title ?? "", value: edit?.value ?? 0, pipelineId: edit?.pipelineId ?? defaults.pipelineId ?? "", stageId: edit?.stageId ?? defaults.stageId ?? "",
    contactId: edit?.contact?.id ?? defaults.contactId ?? null, companyId: edit?.company?.id ?? defaults.companyId ?? null,
    ownerId: edit?.owner?.id ?? me ?? null, probability: null as number | null, expectedCloseDate: edit?.expectedCloseDate ?? null as string | null,
    tagIds: edit?.tags.map((t) => t.id) ?? [], customFields: edit?.customFields ?? {},
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => {
    if (!pipelines?.length) return;
    setF((s) => {
      const p = pipelines.find((x) => x.id === s.pipelineId) ?? pipelines[0];
      const stageOk = p.stages.some((st) => st.id === s.stageId);
      return { ...s, pipelineId: p.id, stageId: stageOk ? s.stageId : p.stages[0]?.id ?? "" };
    });
  }, [pipelines, f.pipelineId]);
  const pipeline = pipelines?.find((p) => p.id === f.pipelineId);
  const save = useAction(
    (body: typeof f) => (edit ? api.put<DealCard>(`/deals/${edit.id}`, body) : api.post<DealCard>("/deals", body)),
    { invalidate: recordKeys, success: edit ? "تغییرات معامله ذخیره شد." : "معامله ساخته شد.", silent: true },
  );
  const e = save.error;
  const stage = pipeline?.stages.find((s) => s.id === f.stageId);
  return (
    <Modal open onClose={onClose} title={edit ? "ویرایش معامله" : "معامله‌ی جدید"} size="lg"
      description={stage && f.value ? `ارزش وزنی: ${toman((f.value * (f.probability ?? stage.probability)) / 100)}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button type="submit" form="deal-form" loading={save.isPending}>{edit ? "ذخیره‌ی تغییرات" : "ساخت معامله"}</Button></>}>
      <form id="deal-form" className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
        ev.preventDefault();
        try { const d = await save.mutateAsync(f); onClose(); if (!edit) nav(`/app/deals/${d.id}`); } catch { /* inline */ }
      }}>
        {e instanceof ApiError && !Object.keys(e.errors).length && <p className="rounded-md bg-pomegranate-50 p-3 text-pomegranate-600 sm:col-span-2">{e.message}</p>}
        <Field label="عنوان معامله" error={err(e, "title")} className="sm:col-span-2">
          <Input value={f.title} onChange={(x) => set("title", x.target.value)} invalid={!!err(e, "title")} placeholder="مثلاً: لایسنس سالانه برای فولاد پارس" required />
        </Field>
        <Field label="مبلغ" error={err(e, "value")}><MoneyInput value={f.value} onChange={(v) => set("value", v)} invalid={!!err(e, "value")} /></Field>
        <Field label="تاریخ احتمالی بستن"><DatePicker value={f.expectedCloseDate} onChange={(v) => set("expectedCloseDate", v)} /></Field>
        <Field label="پایپ‌لاین">
          <Select value={f.pipelineId} onChange={(x) => set("pipelineId", x.target.value)}>
            {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="مرحله" error={err(e, "stageId")}>
          <Select value={f.stageId} onChange={(x) => set("stageId", x.target.value)}>
            {pipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name} ({fa(s.probability)}٪)</option>)}
          </Select>
        </Field>
        <Field label="شرکت"><CompanySelect value={f.companyId} onChange={(v) => set("companyId", v)} /></Field>
        <Field label="مخاطب"><ContactSelect value={f.contactId} onChange={(v) => set("contactId", v)} companyId={f.companyId} /></Field>
        <Field label="مسئول"><OwnerSelect value={f.ownerId} onChange={(v) => set("ownerId", v)} allowEmpty /></Field>
        <Field label="احتمال موفقیت" hint="خالی = احتمال مرحله" error={err(e, "probability")}>
          <Input inputMode="numeric" value={f.probability === null ? "" : fa(f.probability)} placeholder={stage ? `${fa(stage.probability)}٪` : ""}
            onChange={(x) => { const n = latinDigits(x.target.value).replace(/[^0-9]/g, ""); set("probability", n === "" ? null : Math.min(100, Number(n))); }} />
        </Field>
        <div className="sm:col-span-2"><Field label="برچسب‌ها"><TagPicker value={f.tagIds} onChange={(v) => set("tagIds", v)} /></Field></div>
        <div className="sm:col-span-2"><CustomFieldInputs entity="Deal" values={f.customFields} onChange={(v) => set("customFields", v)} /></div>
      </form>
    </Modal>
  );
}

const typeOptions: { value: ActivityType; label: React.ReactNode }[] = [
  { value: "Task", label: <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" />کار</span> },
  { value: "Call", label: <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />تماس</span> },
  { value: "Meeting", label: <span className="inline-flex items-center gap-1.5"><Users2 className="size-3.5" />جلسه</span> },
];

/** Splits an ISO instant into Tehran-local date + "HH:mm". */
function splitLocal(iso?: string | null) {
  if (!iso) return { date: null as string | null, time: "10:00" };
  const d = new Date(new Date(iso).getTime() + 3.5 * 3600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}
export function joinLocal(date: string | null, time: string) {
  if (!date) return null;
  return new Date(new Date(`${date}T${time || "10:00"}:00Z`).getTime() - 3.5 * 3600_000).toISOString();
}

function ActivityForm({ defaults, onClose }: { defaults: CreateDefaults; onClose: () => void }) {
  const edit = defaults.edit as Activity | undefined;
  const me = useAuth((s) => s.user?.id);
  const local = splitLocal(edit?.dueAt ?? new Date(Date.now() + 86400_000).toISOString());
  const [f, setF] = useState({
    type: (edit?.type ?? defaults.activityType ?? "Task") as ActivityType, subject: edit?.subject ?? "", description: edit?.description ?? "",
    date: local.date, time: edit ? local.time : "10:00", durationMinutes: edit?.durationMinutes ?? null as number | null,
    assigneeId: edit?.assignee?.id ?? me ?? null,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const record = edit?.record ?? defaults.record;
  const save = useAction(
    () => {
      const body = {
        type: f.type, subject: f.subject, description: f.description || null, dueAt: joinLocal(f.date, f.time), durationMinutes: f.durationMinutes,
        assigneeId: f.assigneeId, recordType: record?.type ?? null, recordId: record?.id ?? null,
      };
      return edit ? api.put<Activity>(`/activities/${edit.id}`, body) : api.post<Activity>("/activities", body);
    },
    { invalidate: recordKeys, success: edit ? "فعالیت به‌روز شد." : "فعالیت ثبت شد.", silent: true },
  );
  const e = save.error;
  return (
    <Modal open onClose={onClose} title={edit ? "ویرایش فعالیت" : "فعالیت جدید"} description={record ? `برای «${record.title}»` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button type="submit" form="activity-form" loading={save.isPending}>{edit ? "ذخیره" : "ثبت فعالیت"}</Button></>}>
      <form id="activity-form" className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
        ev.preventDefault();
        try { await save.mutateAsync(undefined); onClose(); } catch { /* inline */ }
      }}>
        <div className="sm:col-span-2"><Segmented value={f.type} onChange={(v) => set("type", v)} options={typeOptions} /></div>
        <Field label="عنوان" error={err(e, "subject")} className="sm:col-span-2">
          <Input value={f.subject} onChange={(x) => set("subject", x.target.value)} invalid={!!err(e, "subject")} required
            placeholder={f.type === "Call" ? "تماس پیگیری پیشنهاد" : f.type === "Meeting" ? "جلسه‌ی دمو با تیم خرید" : "ارسال پیش‌فاکتور"} />
        </Field>
        <Field label="تاریخ"><DatePicker value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="ساعت"><Input type="time" dir="ltr" value={f.time} onChange={(x) => set("time", x.target.value)} /></Field>
        <Field label="مسئول"><OwnerSelect value={f.assigneeId} onChange={(v) => set("assigneeId", v)} /></Field>
        {f.type !== "Task" ? (
          <Field label="مدت (دقیقه)">
            <Select value={f.durationMinutes ?? ""} onChange={(x) => set("durationMinutes", x.target.value ? Number(x.target.value) : null)}>
              <option value="">—</option>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{fa(m)} دقیقه</option>)}
            </Select>
          </Field>
        ) : <div className="hidden sm:block" />}
        <Field label="توضیحات" className="sm:col-span-2"><Textarea value={f.description} onChange={(x) => set("description", x.target.value)} rows={3} /></Field>
      </form>
    </Modal>
  );
}
