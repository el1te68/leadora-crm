import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, CalendarPlus, CheckCircle2, Mail, MessageSquareText, PenLine, Phone, PlusCircle, Send, Sparkles, StickyNote, Trash2, Trophy, Users2, XCircle, Zap,
} from "lucide-react";
import { Avatar, Button, cx, Input, Segmented, Skeleton, Textarea } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { api } from "@/lib/api";
import { recordKeys, useAction, useTimeline } from "@/lib/queries";
import { dateFa, fa, relative, timeFa } from "@/lib/format";
import { joinLocal } from "./CreateHost";
import type { ActivityType, RecordType, TimelineItem, TimelineKind } from "@/lib/types";
import { useAuth } from "@/store";

const filterOptions = [
  { value: "all", label: "همه" },
  { value: "notes", label: "یادداشت‌ها" },
  { value: "activities", label: "فعالیت‌ها" },
  { value: "emails", label: "ایمیل‌ها" },
  { value: "changes", label: "تغییرات" },
] as const;
type Filter = (typeof filterOptions)[number]["value"];

const kindMeta: Record<TimelineKind, { icon: typeof Mail; tone: string }> = {
  Created: { icon: PlusCircle, tone: "bg-lapis-50 text-lapis-600 dark:bg-lapis-800 dark:text-lapis-200" },
  FieldChanged: { icon: PenLine, tone: "bg-sunken text-fg-muted" },
  StageChanged: { icon: ArrowLeft, tone: "bg-lapis-50 text-lapis-600 dark:bg-lapis-800 dark:text-lapis-200" },
  Note: { icon: StickyNote, tone: "bg-saffron-50 text-saffron-700 dark:bg-saffron-800/40 dark:text-saffron-200" },
  ActivityCreated: { icon: CalendarPlus, tone: "bg-sunken text-fg-muted" },
  ActivityCompleted: { icon: CheckCircle2, tone: "bg-pistachio-50 text-pistachio-600 dark:bg-pistachio-700/30 dark:text-pistachio-100" },
  EmailSent: { icon: Mail, tone: "bg-[#E6F4F6] text-[#0A7F90] dark:bg-[#0A3A44] dark:text-[#7FD3DF]" },
  DealWon: { icon: Trophy, tone: "bg-saffron-500 text-lapis-950" },
  DealLost: { icon: XCircle, tone: "bg-pomegranate-50 text-pomegranate-500 dark:bg-pomegranate-700/30 dark:text-pomegranate-100" },
  Automation: { icon: Zap, tone: "bg-[#F1ECF9] text-plum-500 dark:bg-[#2A1E44] dark:text-[#C3A8EE]" },
};

const typeIcon: Record<string, typeof Mail> = { Call: Phone, Meeting: Users2, Task: CheckCircle2 };

function dayKey(iso: string) {
  return new Date(new Date(iso).getTime() + 3.5 * 3600_000).toISOString().slice(0, 10);
}
function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const y = dayKey(new Date(Date.now() - 86400_000).toISOString());
  if (key === today) return "امروز";
  if (key === y) return "دیروز";
  return dateFa(key);
}

function Item({ it, canDelete }: { it: TimelineItem; canDelete: boolean }) {
  const meta = kindMeta[it.kind];
  const Icon = it.kind.startsWith("Activity") && it.data.type ? typeIcon[it.data.type] ?? meta.icon : meta.icon;
  const [open, setOpen] = useState(false);
  const del = useAction(() => api.del(`/notes/${it.id}`), { invalidate: ["timeline"], success: "یادداشت حذف شد." });
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-1">
      <span className={cx("relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface", meta.tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13.5px]">
          {it.actor && <span className="font-semibold">{it.actor.fullName}</span>}
          <span className={cx(it.kind === "DealWon" && "font-bold text-money")}>{it.title}</span>
          {it.via && <span className="rounded bg-sunken px-1.5 text-[11px] text-fg-muted">در معامله‌ی «{it.via}»</span>}
          <span className="ms-auto shrink-0 text-xs text-fg-subtle" title={dateFa(it.occurredAt)}>{timeFa(it.occurredAt)}</span>
        </div>

        {it.kind === "StageChanged" && it.data.from && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-sunken px-2 py-0.5 text-fg-muted line-through decoration-fg-subtle/50">{it.data.from}</span>
            <ArrowLeft className="size-3.5 text-fg-subtle" />
            <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: `${it.data.color}22`, color: it.data.color }}>{it.data.to}</span>
          </div>
        )}
        {it.kind === "FieldChanged" && it.data.field && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span className="max-w-[45%] truncate line-through decoration-fg-subtle/60">{it.data.old || "خالی"}</span>
            <ArrowLeft className="size-3 text-fg-subtle" />
            <span className="max-w-[45%] truncate font-medium text-fg">{it.data.new || "خالی"}</span>
          </div>
        )}
        {it.kind === "Note" && it.body && (
          <div className="group relative mt-2 whitespace-pre-line rounded-lg border border-saffron-100 bg-saffron-50/60 px-4 py-3 leading-7 dark:border-saffron-800/40 dark:bg-saffron-800/10">
            {it.body}
            {canDelete && (
              <button type="button" onClick={() => del.mutate(undefined)} aria-label="حذف یادداشت"
                className="absolute end-2 top-2 hidden rounded p-1 text-fg-subtle hover:bg-surface hover:text-pomegranate-500 group-hover:block">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {it.kind === "EmailSent" && (
          <div className="mt-2 rounded-lg border border-line bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span>به</span><span dir="ltr" className="font-medium text-fg">{it.data.to}</span>
              {it.data.delivered === "false" && <span className="text-pomegranate-500">· ارسال نشد</span>}
            </div>
            {it.body && (
              <>
                <p className={cx("mt-1.5 whitespace-pre-line leading-7 text-fg-muted", !open && "line-clamp-2")}>{it.body}</p>
                <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs text-accent hover:underline">{open ? "بستن" : "نمایش کامل"}</button>
              </>
            )}
          </div>
        )}
        {(it.kind === "DealLost" || it.kind === "Automation" || it.kind === "DealWon" || it.kind === "Created" || it.kind === "ActivityCreated") && it.body && (
          <p className="mt-0.5 text-[13px] text-fg-muted">{it.body}</p>
        )}
      </div>
    </li>
  );
}

function Composer({ type, id, emailTo }: { type: RecordType; id: string; emailTo?: string | null }) {
  const [tab, setTab] = useState<"note" | "activity" | "email">("note");
  const [note, setNote] = useState("");
  const [act, setAct] = useState({ type: "Call" as ActivityType, subject: "", date: null as string | null, time: "10:00" });
  const [mail, setMail] = useState({ to: emailTo ?? "", subject: "", body: "" });

  const addNote = useAction(() => api.post("/notes", { recordType: type, recordId: id, body: note }), {
    invalidate: ["timeline", ...recordKeys], success: "یادداشت ثبت شد.",
  });
  const addAct = useAction(() => api.post("/activities", {
    type: act.type, subject: act.subject, dueAt: joinLocal(act.date ?? new Date().toISOString().slice(0, 10), act.time), recordType: type, recordId: id,
  }), { invalidate: recordKeys, success: "فعالیت ثبت شد." });
  const send = useAction(() => api.post("/emails", { recordType: type, recordId: id, ...mail }), {
    invalidate: ["timeline", ...recordKeys], success: "ایمیل ارسال و در پرونده ثبت شد.",
  });

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-line px-2">
        {([
          ["note", "یادداشت", MessageSquareText],
          ["activity", "فعالیت", CalendarPlus],
          ["email", "ایمیل", Mail],
        ] as const).map(([k, label, I]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={cx("relative flex h-11 items-center gap-2 px-3.5 text-[13px] font-medium transition",
              tab === k ? "text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-saffron-500" : "text-fg-muted hover:text-fg")}>
            <I className="size-4" />{label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "note" && (
          <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(undefined, { onSuccess: () => setNote("") }); }}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="نتیجه‌ی تماس، نکته‌ای از جلسه یا هر چیزی که تیم باید بداند…" rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }} />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-fg-subtle">Ctrl + Enter برای ثبت</span>
              <Button type="submit" size="sm" loading={addNote.isPending} disabled={!note.trim()}>ثبت یادداشت</Button>
            </div>
          </form>
        )}
        {tab === "activity" && (
          <form className="grid gap-3 sm:grid-cols-[auto_1fr]" onSubmit={(e) => {
            e.preventDefault();
            if (act.subject.trim()) addAct.mutate(undefined, { onSuccess: () => setAct((a) => ({ ...a, subject: "" })) });
          }}>
            <Segmented size="sm" value={act.type} onChange={(v) => setAct({ ...act, type: v })}
              options={[{ value: "Call", label: "تماس" }, { value: "Meeting", label: "جلسه" }, { value: "Task", label: "کار" }]} />
            <Input value={act.subject} onChange={(e) => setAct({ ...act, subject: e.target.value })} placeholder="عنوان فعالیت" />
            <div className="grid grid-cols-[1fr_120px] gap-2 sm:col-span-2">
              <DatePicker value={act.date} onChange={(v) => setAct({ ...act, date: v })} placeholder="امروز" clearable={false} />
              <Input type="time" dir="ltr" value={act.time} onChange={(e) => setAct({ ...act, time: e.target.value })} />
            </div>
            <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" loading={addAct.isPending} disabled={!act.subject.trim()}>ثبت فعالیت</Button></div>
          </form>
        )}
        {tab === "email" && (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); send.mutate(undefined, { onSuccess: () => setMail((m) => ({ ...m, subject: "", body: "" })) }); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input dir="ltr" type="email" required value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} placeholder="to@company.ir" />
              <Input required value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} placeholder="موضوع" />
            </div>
            <Textarea required value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} rows={4} placeholder="متن ایمیل…" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-subtle">از طریق SMTP فرستاده و در پرونده ثبت می‌شود.</span>
              <Button type="submit" size="sm" icon={<Send className="size-3.5" />} loading={send.isPending}>ارسال</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function RecordTimeline({ type, id, emailTo }: { type: RecordType; id: string; emailTo?: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useTimeline(type, id, filter);
  const me = useAuth((s) => s.user?.id);
  const groups = new Map<string, TimelineItem[]>();
  for (const it of data ?? []) {
    const k = dayKey(it.occurredAt);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return (
    <div className="space-y-5">
      <Composer type={type} id={id} emailTo={emailTo} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">تاریخچه</h2>
        <div className="no-scrollbar overflow-x-auto"><Segmented size="sm" value={filter} onChange={setFilter} options={filterOptions.map((o) => ({ ...o }))} /></div>
      </div>
      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2, 3].map((i) => <div key={i} className="flex gap-3"><Skeleton className="size-8 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
      ) : !data?.length ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center text-fg-muted">
          <Sparkles className="size-6 text-saffron-500" />
          {filter === "all" ? "هنوز چیزی ثبت نشده. اولین یادداشت یا تماس را بنویسید." : "در این دسته موردی نیست."}
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([k, items]) => (
            <section key={k}>
              <div className="mb-3 flex items-center gap-3 text-xs font-semibold text-fg-subtle">
                <span>{dayLabel(k)}</span><span className="h-px flex-1 bg-line" /><span className="font-normal">{fa(items.length)} رویداد</span>
              </div>
              <ol className="relative before:absolute before:inset-y-2 before:start-[15px] before:w-px before:bg-line">
                {items.map((it) => <Item key={it.id} it={it} canDelete={it.kind === "Note" && it.actor?.id === me} />)}
              </ol>
            </section>
          ))}
          <p className="text-center text-xs text-fg-subtle">آخرین رویداد {relative(data[0].occurredAt)}</p>
        </div>
      )}
    </div>
  );
}

export function ActorAvatar({ name, color }: { name: string; color: string }) {
  return <Avatar name={name} color={color} size={22} />;
}

export function RecordLink({ type, id, children, className }: { type: RecordType; id: string; children: React.ReactNode; className?: string }) {
  const to = type === "Contact" ? `/app/contacts/${id}` : type === "Company" ? `/app/companies/${id}` : `/app/deals/${id}`;
  return <Link to={to} className={cx("hover:text-accent hover:underline", className)}>{children}</Link>;
}
