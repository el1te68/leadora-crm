import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Building, Copy, GitBranch, Link2, ListPlus, Plus, Tags, Trash2, Users } from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Avatar, Badge, Button, cx, EmptyState, Field, Input, Modal, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAction, useCustomFields, useInvitations, useMembers, usePipelines, useTags, useWorkspace } from "@/lib/queries";
import { dateFa, fa, latinDigits, roleLabel } from "@/lib/format";
import { useActiveWorkspace, useAuth } from "@/store";
import type { CustomField, CustomFieldType, Pipeline, RecordType, WorkspaceRole } from "@/lib/types";

const tabs = [
  { id: "profile", label: "پروفایل فضای کاری", icon: Building },
  { id: "members", label: "اعضا و نقش‌ها", icon: Users },
  { id: "pipelines", label: "پایپ‌لاین‌ها", icon: GitBranch },
  { id: "fields", label: "فیلدهای سفارشی", icon: ListPlus },
  { id: "tags", label: "برچسب‌ها", icon: Tags },
];
const swatches = ["#2B3A9E", "#5B6BC0", "#8C96C9", "#B07CC6", "#7A4FB5", "#C23A55", "#E9A23B", "#5E9E6E", "#1F8A9E", "#B5651D"];

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {swatches.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} aria-pressed={value === c}
          className={cx("size-6 rounded-full ring-offset-2 ring-offset-surface transition", value === c && "ring-2 ring-fg")} style={{ background: c }} />
      ))}
    </div>
  );
}

function ReadOnlyNote({ show }: { show: boolean }) {
  return show ? <p className="mb-4 rounded-lg bg-sunken px-4 py-3 text-[13px] text-fg-muted">این بخش را فقط مالک و مدیر فضای کاری می‌توانند تغییر دهند.</p> : null;
}

function Profile({ admin }: { admin: boolean }) {
  const { data } = useWorkspace();
  const setUser = useAuth((s) => s.setUser);
  const [f, setF] = useState({ name: "", industry: "", accentColor: "#2B3A9E" });
  useEffect(() => { if (data) setF({ name: data.name, industry: data.industry ?? "", accentColor: data.accentColor }); }, [data]);
  const save = useAction(() => api.put("/workspace", f), { invalidate: ["workspace"], success: "پروفایل فضای کاری ذخیره شد." });
  if (!data) return <TableSkeleton rows={3} cols={1} />;
  return (
    <div className="card max-w-2xl p-6">
      <ReadOnlyNote show={!admin} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="نام فضای کاری" className="sm:col-span-2"><Input value={f.name} disabled={!admin} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="حوزه‌ی کاری"><Input value={f.industry} disabled={!admin} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Field>
        <Field label="واحد پول"><Input value="تومان" disabled /></Field>
        <Field label="رنگ شناسه" className="sm:col-span-2"><Swatches value={f.accentColor} onChange={(c) => admin && setF({ ...f, accentColor: c })} /></Field>
        <div className="text-[13px] text-fg-subtle sm:col-span-2">ساخته‌شده در {dateFa(data.createdAt)} · شناسه <span dir="ltr" className="font-mono text-xs">{data.slug}</span></div>
      </div>
      {admin && <div className="mt-6 flex justify-end"><Button loading={save.isPending} onClick={async () => { await save.mutateAsync(undefined); setUser(await api.get("/auth/me")); }}>ذخیره‌ی تغییرات</Button></div>}
    </div>
  );
}

function Members({ admin, owner }: { admin: boolean; owner: boolean }) {
  const { data } = useMembers();
  const { data: invites } = useInvitations();
  const me = useAuth((s) => s.user?.id);
  const [inviting, setInviting] = useState(false);
  const [inv, setInv] = useState({ email: "", role: "Member" as WorkspaceRole });
  const [link, setLink] = useState<string | null>(null);
  const role = useAction((x: { userId: string; role: WorkspaceRole }) => api.put(`/workspace/members/${x.userId}/role`, { role: x.role }), { invalidate: ["members"], success: "نقش به‌روز شد." });
  const remove = useAction((userId: string) => api.del(`/workspace/members/${userId}`), { invalidate: ["members"], success: "عضو حذف شد." });
  const invite = useAction(() => api.post<{ link: string }>("/workspace/invitations", inv), { invalidate: ["invitations"], success: "دعوت‌نامه ساخته و ایمیل شد.", silent: true });
  const revoke = useAction((id: string) => api.del(`/workspace/invitations/${id}`), { invalidate: ["invitations"], success: "دعوت‌نامه لغو شد." });
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast.success("لینک کپی شد."); };
  const e = invite.error instanceof ApiError ? invite.error : null;

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><h2 className="font-bold">اعضای تیم</h2><p className="text-xs text-fg-subtle">{fa(data?.length ?? 0)} نفر</p></div>
          {admin && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => { setInviting(true); setLink(null); }}>دعوت هم‌تیمی</Button>}
        </div>
        <ul className="divide-y divide-line">
          {data?.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Avatar name={m.fullName} color={m.avatarColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{m.fullName} {m.userId === me && <span className="text-xs font-normal text-fg-subtle">(شما)</span>}</div>
                <div className="truncate text-xs text-fg-subtle"><span dir="ltr">{m.email}</span>{m.jobTitle && ` · ${m.jobTitle}`}</div>
              </div>
              {admin && m.userId !== me && (owner || m.role !== "Owner") ? (
                <div className="flex items-center gap-2">
                  <Select className="h-8 w-28 text-[13px]" value={m.role} onChange={(x) => role.mutate({ userId: m.userId, role: x.target.value as WorkspaceRole })}>
                    {(["Owner", "Admin", "Member"] as WorkspaceRole[]).filter((r) => owner || r !== "Owner").map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </Select>
                  {m.role !== "Owner" && <button type="button" aria-label="حذف عضو" className="rounded p-1.5 text-fg-subtle hover:bg-pomegranate-50 hover:text-pomegranate-500" onClick={() => remove.mutate(m.userId)}><Trash2 className="size-4" /></button>}
                </div>
              ) : <Badge tone={m.role === "Owner" ? "saffron" : m.role === "Admin" ? "lapis" : "neutral"}>{roleLabel[m.role]}</Badge>}
            </li>
          ))}
        </ul>
      </div>

      {admin && !!invites?.length && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-bold">دعوت‌های در انتظار</h2></div>
          <ul className="divide-y divide-line">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span dir="ltr" className="font-medium">{i.email}</span>
                <Badge>{roleLabel[i.role]}</Badge>
                <span className="text-xs text-fg-subtle">تا {dateFa(i.expiresAt)}</span>
                <div className="ms-auto flex gap-1">
                  <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => copy(i.link)}>کپی لینک</Button>
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>لغو</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={inviting} onClose={() => setInviting(false)} title="دعوت هم‌تیمی" description="لینک دعوت به ایمیل او فرستاده می‌شود؛ می‌توانید خودتان هم آن را بفرستید." size="sm"
        footer={link ? <Button onClick={() => setInviting(false)}>تمام</Button> : <><Button variant="ghost" onClick={() => setInviting(false)}>انصراف</Button>
          <Button loading={invite.isPending} onClick={async () => { try { const r = await invite.mutateAsync(undefined); setLink(r.link); setInv({ email: "", role: "Member" }); } catch { /* inline */ } }}>ارسال دعوت</Button></>}>
        {link ? (
          <div className="space-y-3">
            <p className="text-[13.5px]">دعوت‌نامه ساخته شد. ایمیل در MailHog قابل مشاهده است. لینک:</p>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
              <Link2 className="size-4 shrink-0 text-fg-subtle" />
              <span dir="ltr" className="flex-1 truncate font-mono text-xs">{link}</span>
              <Button size="sm" variant="secondary" onClick={() => copy(link)}>کپی</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {e && !Object.keys(e.errors).length && <p className="rounded-md bg-pomegranate-50 p-3 text-[13px] text-pomegranate-600">{e.message}</p>}
            <Field label="ایمیل" error={e?.field("email")}><Input dir="ltr" type="email" value={inv.email} onChange={(x) => setInv({ ...inv, email: x.target.value })} /></Field>
            <Field label="نقش">
              <Select value={inv.role} onChange={(x) => setInv({ ...inv, role: x.target.value as WorkspaceRole })}>
                <option value="Member">عضو — کار با رکوردها</option>
                <option value="Admin">مدیر — به‌علاوه‌ی تنظیمات و اعضا</option>
                {owner && <option value="Owner">مالک — دسترسی کامل</option>}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

interface StageRow { id?: string; key: string; name: string; probability: number; color: string }

function PipelineEditor({ pipeline, onDone }: { pipeline: Pipeline | null; onDone: () => void }) {
  const [name, setName] = useState(pipeline?.name ?? "");
  const [rows, setRows] = useState<StageRow[]>(pipeline?.stages.map((s) => ({ id: s.id, key: s.id, name: s.name, probability: s.probability, color: s.color }))
    ?? [{ key: "a", name: "سرنخ", probability: 10, color: "#8C96C9" }, { key: "b", name: "مذاکره", probability: 60, color: "#E9A23B" }, { key: "c", name: "قرارداد", probability: 90, color: "#5E9E6E" }]);
  const save = useAction(() => {
    const body = { name, stages: rows.map(({ id, name: n, probability, color }) => ({ id, name: n, probability, color })) };
    return pipeline ? api.put(`/pipelines/${pipeline.id}`, body) : api.post("/pipelines", body);
  }, { invalidate: ["pipelines", "board"], success: "پایپ‌لاین ذخیره شد." });
  const del = useAction(() => api.del(`/pipelines/${pipeline!.id}`), { invalidate: ["pipelines", "board"], success: "پایپ‌لاین حذف شد." });
  const move = (i: number, d: number) => setRows((r) => { const n = [...r]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const upd = (i: number, patch: Partial<StageRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="card p-5">
      <Field label="نام پایپ‌لاین"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <h3 className="mb-2 mt-6 text-[13.5px] font-bold">مرحله‌ها <span className="font-normal text-fg-subtle">— به ترتیب از چپ به راست روی بورد</span></h3>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
            <span className="num grid size-7 place-items-center rounded-md bg-surface text-xs font-bold text-fg-muted">{fa(i + 1)}</span>
            <span className="h-7 w-1.5 rounded-full" style={{ background: r.color }} />
            <Input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} className="h-8 min-w-36 flex-1" aria-label="نام مرحله" />
            <div className="relative w-24">
              <Input value={fa(r.probability)} onChange={(e) => upd(i, { probability: Math.min(100, Number(latinDigits(e.target.value).replace(/\D/g, "")) || 0) })} className="h-8 pe-7" aria-label="احتمال" />
              <span className="pointer-events-none absolute inset-y-0 end-2.5 grid place-items-center text-xs text-fg-subtle">٪</span>
            </div>
            <Select value={r.color} onChange={(e) => upd(i, { color: e.target.value })} className="h-8 w-24 text-xs" aria-label="رنگ">
              {swatches.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="flex">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-fg-subtle hover:bg-surface disabled:opacity-30" aria-label="بالاتر"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-fg-subtle hover:bg-surface disabled:opacity-30" aria-label="پایین‌تر"><ArrowDown className="size-4" /></button>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded p-1.5 text-fg-subtle hover:bg-pomegranate-50 hover:text-pomegranate-500 disabled:opacity-30" aria-label="حذف مرحله"><Trash2 className="size-4" /></button>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />}
        onClick={() => setRows([...rows, { key: crypto.randomUUID(), name: "مرحله‌ی جدید", probability: 50, color: "#5B6BC0" }])}>افزودن مرحله</Button>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        {pipeline ? <Button variant="ghost" className="text-pomegranate-500" loading={del.isPending} onClick={async () => { await del.mutateAsync(undefined); onDone(); }}>حذف پایپ‌لاین</Button> : <span />}
        <Button loading={save.isPending} disabled={!name.trim()} onClick={async () => { await save.mutateAsync(undefined); if (!pipeline) onDone(); }}>ذخیره</Button>
      </div>
    </div>
  );
}

function Pipelines({ admin }: { admin: boolean }) {
  const { data } = usePipelines();
  const [sel, setSel] = useState<string | "new" | null>(null);
  const current = sel === "new" ? null : data?.find((p) => p.id === (sel ?? data[0]?.id)) ?? null;
  if (!data) return <TableSkeleton rows={3} cols={2} />;
  return (
    <div>
      <ReadOnlyNote show={!admin} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {data.map((p) => (
            <button key={p.id} type="button" onClick={() => setSel(p.id)}
              className={cx("block w-full rounded-lg border p-3.5 text-start transition", current?.id === p.id && sel !== "new" ? "border-lapis-300 bg-accent-soft" : "border-line bg-surface hover:border-line-strong")}>
              <div className="font-semibold">{p.name}</div>
              <div className="num mt-0.5 text-xs text-fg-subtle">{fa(p.stages.length)} مرحله · {fa(p.openDeals)} معامله‌ی باز</div>
              <div className="mt-2 flex gap-0.5">{p.stages.map((s) => <span key={s.id} className="h-1.5 flex-1 rounded-full" style={{ background: s.color }} />)}</div>
            </button>
          ))}
          {admin && <Button variant="secondary" className="w-full" icon={<Plus className="size-4" />} onClick={() => setSel("new")}>پایپ‌لاین جدید</Button>}
        </div>
        {admin ? <PipelineEditor key={sel === "new" ? "new" : current?.id} pipeline={sel === "new" ? null : current} onDone={() => setSel(null)} /> : (
          <div className="card p-5"><ol className="space-y-2">{current?.stages.map((s) => <li key={s.id} className="flex items-center gap-3"><span className="h-6 w-1.5 rounded-full" style={{ background: s.color }} />{s.name}<span className="num text-xs text-fg-subtle">{fa(s.probability)}٪</span></li>)}</ol></div>
        )}
      </div>
    </div>
  );
}

const fieldTypeLabel: Record<CustomFieldType, string> = { Text: "متن", Number: "عدد", Date: "تاریخ", Select: "انتخابی" };
const entityLabel: Record<RecordType, string> = { Contact: "مخاطبین", Company: "شرکت‌ها", Deal: "معامله‌ها" };

function Fields({ admin }: { admin: boolean }) {
  const { data } = useCustomFields();
  const [editing, setEditing] = useState<CustomField | { entityType: RecordType } | null>(null);
  return (
    <div className="space-y-5">
      <ReadOnlyNote show={!admin} />
      {(Object.keys(entityLabel) as RecordType[]).map((et) => {
        const list = data?.filter((f) => f.entityType === et) ?? [];
        return (
          <div key={et} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-bold">{entityLabel[et]}</h2>
              {admin && <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setEditing({ entityType: et })}>فیلد جدید</Button>}
            </div>
            {list.length ? (
              <ul className="divide-y divide-line">
                {list.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="font-medium">{f.label}</span>
                    <Badge tone="lapis">{fieldTypeLabel[f.type]}</Badge>
                    {f.type === "Select" && <span className="truncate text-xs text-fg-subtle">{f.options.join("، ")}</span>}
                    {admin && <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setEditing(f)}>ویرایش</Button>}
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-[13px] text-fg-subtle">فیلد سفارشی ندارد.</p>}
          </div>
        );
      })}
      {editing && <FieldEditor field={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FieldEditor({ field, onClose }: { field: CustomField | { entityType: RecordType }; onClose: () => void }) {
  const existing = "id" in field ? field : null;
  const [f, setF] = useState({ label: existing?.label ?? "", type: existing?.type ?? ("Text" as CustomFieldType), options: existing?.options.join("\n") ?? "" });
  const body = () => ({ entityType: field.entityType, label: f.label, type: f.type, options: f.options.split(/\n|،|,/).map((o) => o.trim()).filter(Boolean), order: existing?.order ?? 99 });
  const save = useAction(() => (existing ? api.put(`/custom-fields/${existing.id}`, body()) : api.post("/custom-fields", body())), { invalidate: ["custom-fields"], success: "فیلد ذخیره شد.", silent: true });
  const del = useAction(() => api.del(`/custom-fields/${existing!.id}`), { invalidate: ["custom-fields"], success: "فیلد حذف شد." });
  const e = save.error instanceof ApiError ? save.error : null;
  return (
    <Modal open onClose={onClose} title={existing ? "ویرایش فیلد" : `فیلد جدید برای ${entityLabel[field.entityType]}`} size="sm"
      footer={<>
        {existing && <Button variant="ghost" className="me-auto text-pomegranate-500" onClick={async () => { await del.mutateAsync(undefined); onClose(); }}>حذف</Button>}
        <Button variant="ghost" onClick={onClose}>انصراف</Button>
        <Button loading={save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* inline */ } }}>ذخیره</Button>
      </>}>
      <div className="space-y-4">
        <Field label="عنوان" error={e?.field("label")}><Input value={f.label} onChange={(x) => setF({ ...f, label: x.target.value })} /></Field>
        <Field label="نوع">
          <Select value={f.type} onChange={(x) => setF({ ...f, type: x.target.value as CustomFieldType })}>
            {(Object.keys(fieldTypeLabel) as CustomFieldType[]).map((t) => <option key={t} value={t}>{fieldTypeLabel[t]}</option>)}
          </Select>
        </Field>
        {f.type === "Select" && (
          <Field label="گزینه‌ها" hint="هر گزینه در یک خط" error={e?.field("options")}>
            <textarea className="field h-28 py-2" value={f.options} onChange={(x) => setF({ ...f, options: x.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function TagsTab() {
  const { data } = useTags();
  const [name, setName] = useState("");
  const [color, setColor] = useState(swatches[0]);
  const create = useAction(() => api.post("/tags", { name, color }), { invalidate: ["tags"], success: "برچسب ساخته شد." });
  const del = useAction((id: string) => api.del(`/tags/${id}`), { invalidate: ["tags", "contacts", "companies", "board"], success: "برچسب حذف شد." });
  return (
    <div className="card max-w-2xl overflow-hidden">
      <form className="flex flex-wrap items-end gap-3 border-b border-line p-5" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await create.mutateAsync(undefined); setName(""); } }}>
        <Field label="برچسب جدید" className="min-w-48 flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: مشتری قدیمی" /></Field>
        <Swatches value={color} onChange={setColor} />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>افزودن</Button>
      </form>
      {data?.length ? (
        <ul className="divide-y divide-line">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium" style={{ background: `${t.color}1C`, color: t.color }}>{t.name}</span>
              <span className="num text-xs text-fg-subtle">روی {fa(t.usage)} رکورد</span>
              <button type="button" aria-label="حذف برچسب" className="ms-auto rounded p-1.5 text-fg-subtle hover:bg-pomegranate-50 hover:text-pomegranate-500" onClick={() => del.mutate(t.id)}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<Tags className="size-7" />} title="برچسبی ندارید" body="برچسب‌ها برای دسته‌بندی سریع مخاطبین، شرکت‌ها و معامله‌ها هستند." />}
    </div>
  );
}

export default function Settings() {
  const { tab = "profile" } = useParams();
  const ws = useActiveWorkspace();
  const admin = ws?.role === "Owner" || ws?.role === "Admin";
  const owner = ws?.role === "Owner";
  return (
    <div>
      <PageHeader title="تنظیمات" subtitle={ws ? `${ws.name} · نقش شما: ${roleLabel[ws.role]}` : undefined} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col" aria-label="بخش‌های تنظیمات">
          {tabs.map((t) => (
            <NavLink key={t.id} to={`/app/settings/${t.id}`} className={() => cx("flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-[13.5px] font-medium transition",
              tab === t.id ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:bg-sunken hover:text-fg")}>
              <t.icon className="size-4" />{t.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "profile" && <Profile admin={admin} />}
          {tab === "members" && <Members admin={admin} owner={owner} />}
          {tab === "pipelines" && <Pipelines admin={admin} />}
          {tab === "fields" && <Fields admin={admin} />}
          {tab === "tags" && <TagsTab />}
        </div>
      </div>
    </div>
  );
}
