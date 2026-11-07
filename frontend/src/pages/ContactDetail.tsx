import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Briefcase, Building2, Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { PageSkeleton } from "./common";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, MenuItem, Popover } from "@/components/ui";
import { RecordTimeline } from "@/components/records/Timeline";
import { CustomProps, DealMiniList, OpenActivities, Panel, Prop } from "@/components/records/RecordParts";
import { OwnerChip, TagList } from "@/components/records/Pickers";
import { useCreate } from "@/components/records/CreateHost";
import { recordKeys, useAction, useContact } from "@/lib/queries";
import { api } from "@/lib/api";
import { dateFa, fa, lifecycleLabel, lifecycleOrder, relative } from "@/lib/format";
import { cx } from "@/components/ui";

export function LifecycleBar({ value }: { value: string }) {
  const idx = lifecycleOrder.indexOf(value as never);
  return (
    <div className="flex gap-1" aria-label={`مرحله: ${lifecycleLabel[value as keyof typeof lifecycleLabel]}`}>
      {lifecycleOrder.map((l, i) => (
        <div key={l} className="flex-1">
          <div className={cx("h-1.5 rounded-full", i <= idx ? (idx === 4 ? "bg-pistachio-500" : "bg-lapis-500 dark:bg-lapis-400") : "bg-sunken")} />
          <div className={cx("mt-1 text-center text-[10.5px]", i === idx ? "font-semibold text-fg" : "text-fg-subtle")}>{lifecycleLabel[l]}</div>
        </div>
      ))}
    </div>
  );
}

export default function ContactDetail() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useContact(id);
  const open = useCreate((s) => s.open);
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const del = useAction(() => api.del(`/contacts/${id}`), { invalidate: recordKeys, success: "مخاطب حذف شد." });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <EmptyState icon={<Briefcase className="size-7" />} title="این مخاطب پیدا نشد" body="شاید حذف شده باشد یا متعلق به فضای کاری دیگری باشد." action={<Link to="/app/contacts"><Button variant="secondary">بازگشت به مخاطبین</Button></Link>} />;
  const c = data.contact;
  const record = { type: "Contact" as const, id: c.id, title: c.fullName };

  return (
    <div>
      <nav className="mb-4 text-xs text-fg-subtle"><Link to="/app/contacts" className="hover:text-fg">مخاطبین</Link> / <span>{c.fullName}</span></nav>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* Profile */}
        <aside className="space-y-4">
          <section className="card overflow-hidden">
            <div className="girih h-16 bg-lapis-900" />
            <div className="-mt-8 px-5 pb-5">
              <Avatar name={c.fullName} color={c.owner?.avatarColor ?? "#5B6BC0"} size={64} className="ring-4 ring-surface" />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-extrabold">{c.fullName}</h1>
                  <p className="text-[13px] text-fg-muted">
                    {c.jobTitle}{c.company && <> در <Link to={`/app/companies/${c.company.id}`} className="text-accent hover:underline">{c.company.name}</Link></>}
                  </p>
                </div>
                <Popover align="end" className="w-44 p-1.5" trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} className="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-sunken" aria-label="گزینه‌ها"><MoreHorizontal className="size-4" /></button>
                )}>
                  {(close) => <>
                    <MenuItem icon={<Pencil />} onClick={() => { open("contact", { edit: c }); close(); }}>ویرایش</MenuItem>
                    <MenuItem icon={<Trash2 />} danger onClick={() => { setConfirm(true); close(); }}>حذف مخاطب</MenuItem>
                  </>}
                </Popover>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {c.email ? <a href={`mailto:${c.email}`} className="contents"><Button variant="soft" size="sm" icon={<Mail className="size-3.5" />}>ایمیل</Button></a> : <Button variant="soft" size="sm" disabled icon={<Mail className="size-3.5" />}>ایمیل</Button>}
                <Button variant="soft" size="sm" icon={<Phone className="size-3.5" />} onClick={() => open("activity", { record, activityType: "Call" })}>تماس</Button>
                <Button variant="soft" size="sm" icon={<Plus className="size-3.5" />} onClick={() => open("deal", { contactId: c.id, companyId: c.company?.id })}>معامله</Button>
              </div>
              <div className="mt-5"><LifecycleBar value={c.lifecycle} /></div>
            </div>
          </section>

          <Panel title="مشخصات" action={<Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => open("contact", { edit: c })}>ویرایش</Button>}>
            <dl className="divide-y divide-line">
              <Prop label="ایمیل">{c.email && <a dir="ltr" href={`mailto:${c.email}`} title={c.email} className="block truncate text-end hover:text-accent">{c.email}</a>}</Prop>
              <Prop label="موبایل">{c.phone && <a dir="ltr" href={`tel:${c.phone}`} className="num hover:text-accent">{fa(c.phone)}</a>}</Prop>
              <Prop label="مسئول"><OwnerChip name={c.owner?.fullName} color={c.owner?.avatarColor} /></Prop>
              <Prop label="شهر">{c.city}</Prop>
              <Prop label="منبع">{c.source}</Prop>
              <Prop label="برچسب‌ها">{c.tags.length ? <TagList tags={c.tags} max={6} /> : null}</Prop>
              <CustomProps entity="Contact" values={c.customFields} />
              <Prop label="ساخته‌شده">{dateFa(c.createdAt)}</Prop>
              <Prop label="آخرین فعالیت">{c.lastActivityAt ? relative(c.lastActivityAt) : null}</Prop>
            </dl>
          </Panel>
        </aside>

        {/* Timeline */}
        <div className="min-w-0"><RecordTimeline type="Contact" id={c.id} emailTo={c.email} /></div>

        {/* Related */}
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
          <Panel title={`معامله‌ها (${fa(data.deals.length)})`} action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => open("deal", { contactId: c.id, companyId: c.company?.id })}>افزودن</Button>}>
            <DealMiniList deals={data.deals} empty="هنوز معامله‌ای برای این مخاطب ثبت نشده." />
          </Panel>
          <OpenActivities type="Contact" id={c.id} title={c.fullName} />
          {c.company && (
            <Panel title="شرکت">
              <Link to={`/app/companies/${c.company.id}`} className="-mx-1 flex items-center gap-3 rounded-lg p-1.5 hover:bg-sunken">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Building2 className="size-4" /></span>
                <span className="font-semibold">{c.company.name}</span>
                <Badge className="ms-auto">مشاهده</Badge>
              </Link>
            </Panel>
          )}
        </aside>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="حذف مخاطب" confirmLabel="حذف"
        body={`«${c.fullName}» و برچسب‌هایش حذف می‌شود. معامله‌های مرتبط باقی می‌مانند ولی بدون مخاطب.`} loading={del.isPending}
        onConfirm={async () => { await del.mutateAsync(undefined); nav("/app/contacts"); }} />
    </div>
  );
}
