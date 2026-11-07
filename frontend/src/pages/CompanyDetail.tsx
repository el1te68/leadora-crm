import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Building2, Globe, MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { PageSkeleton } from "./common";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, MenuItem, Monogram, Popover } from "@/components/ui";
import { RecordTimeline } from "@/components/records/Timeline";
import { CustomProps, DealMiniList, OpenActivities, Panel, Prop } from "@/components/records/RecordParts";
import { OwnerChip, TagList } from "@/components/records/Pickers";
import { useCreate } from "@/components/records/CreateHost";
import { recordKeys, useAction, useCompany } from "@/lib/queries";
import { api } from "@/lib/api";
import { dateFa, fa, lifecycleLabel, relative, tomanShort } from "@/lib/format";

export default function CompanyDetail() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useCompany(id);
  const open = useCreate((s) => s.open);
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const del = useAction(() => api.del(`/companies/${id}`), { invalidate: recordKeys, success: "شرکت حذف شد." });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <EmptyState icon={<Building2 className="size-7" />} title="این شرکت پیدا نشد" action={<Link to="/app/companies"><Button variant="secondary">بازگشت به شرکت‌ها</Button></Link>} />;
  const c = data.company;

  return (
    <div>
      <nav className="mb-4 text-xs text-fg-subtle"><Link to="/app/companies" className="hover:text-fg">شرکت‌ها</Link> / <span>{c.name}</span></nav>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-start gap-3">
              <Monogram name={c.name} size={56} />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-extrabold leading-8">{c.name}</h1>
                <p className="text-[13px] text-fg-muted">{[c.industry, c.city].filter(Boolean).join(" · ")}</p>
              </div>
              <Popover align="end" className="w-44 p-1.5" trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-sunken" aria-label="گزینه‌ها"><MoreHorizontal className="size-4" /></button>
              )}>
                {(close) => <>
                  <MenuItem icon={<Pencil />} onClick={() => { open("company", { edit: c }); close(); }}>ویرایش</MenuItem>
                  <MenuItem icon={<Trash2 />} danger onClick={() => { setConfirm(true); close(); }}>حذف شرکت</MenuItem>
                </>}
              </Popover>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-x-reverse divide-line rounded-lg border border-line text-center">
              <div className="p-2.5"><div className="num text-lg font-extrabold">{fa(c.contactCount)}</div><div className="text-[11px] text-fg-subtle">مخاطب</div></div>
              <div className="p-2.5"><div className="num text-lg font-extrabold">{fa(c.openDeals)}</div><div className="text-[11px] text-fg-subtle">معامله‌ی باز</div></div>
              <div className="p-2.5"><div className="num text-lg font-extrabold text-money">{tomanShort(data.wonValue, false)}</div><div className="text-[11px] text-fg-subtle">برنده (تومان)</div></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="soft" size="sm" icon={<UserPlus className="size-3.5" />} onClick={() => open("contact", { companyId: c.id })}>مخاطب</Button>
              <Button variant="soft" size="sm" icon={<Plus className="size-3.5" />} onClick={() => open("deal", { companyId: c.id })}>معامله</Button>
            </div>
          </section>
          <Panel title="مشخصات" action={<Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => open("company", { edit: c })}>ویرایش</Button>}>
            <dl className="divide-y divide-line">
              <Prop label="وب‌سایت">{c.domain && <a dir="ltr" href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent"><Globe className="size-3.5" />{c.domain}</a>}</Prop>
              <Prop label="تلفن">{c.phone && <span dir="ltr" className="num">{fa(c.phone)}</span>}</Prop>
              <Prop label="اندازه">{c.size && `${c.size} نفر`}</Prop>
              <Prop label="نشانی">{c.address}</Prop>
              <Prop label="مسئول"><OwnerChip name={c.owner?.fullName} color={c.owner?.avatarColor} /></Prop>
              <Prop label="برچسب‌ها">{c.tags.length ? <TagList tags={c.tags} max={6} /> : null}</Prop>
              <CustomProps entity="Company" values={c.customFields} />
              <Prop label="ساخته‌شده">{dateFa(c.createdAt)}</Prop>
              <Prop label="آخرین فعالیت">{c.lastActivityAt ? relative(c.lastActivityAt) : null}</Prop>
            </dl>
          </Panel>
        </aside>
        <div className="min-w-0"><RecordTimeline type="Company" id={c.id} /></div>
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
          <Panel title={`افراد (${fa(data.contacts.length)})`} action={<Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => open("contact", { companyId: c.id })}>افزودن</Button>}>
            {data.contacts.length ? (
              <ul className="-mx-1 space-y-0.5">
                {data.contacts.map((p) => (
                  <li key={p.id}>
                    <Link to={`/app/contacts/${p.id}`} className="flex items-center gap-3 rounded-lg px-1.5 py-2 hover:bg-sunken">
                      <Avatar name={p.fullName} size={30} color="#5B6BC0" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{p.fullName}</span><span className="block truncate text-xs text-fg-subtle">{p.jobTitle}</span></span>
                      <Badge className="h-5 text-[10.5px]">{lifecycleLabel[p.lifecycle]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="py-3 text-[13px] text-fg-subtle">هنوز کسی از این شرکت ثبت نشده.</p>}
          </Panel>
          <Panel title={`معامله‌ها (${fa(data.deals.length)})`}><DealMiniList deals={data.deals} empty="معامله‌ای با این شرکت نیست." /></Panel>
          <OpenActivities type="Company" id={c.id} title={c.name} />
        </aside>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="حذف شرکت" confirmLabel="حذف" loading={del.isPending}
        body={`«${c.name}» حذف می‌شود. مخاطبین و معامله‌هایش باقی می‌مانند ولی دیگر به این شرکت وصل نیستند.`}
        onConfirm={async () => { await del.mutateAsync(undefined); nav("/app/companies"); }} />
    </div>
  );
}
