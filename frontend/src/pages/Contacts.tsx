import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Search, Users } from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Avatar, Badge, Button, EmptyState, Field, Input, Select } from "@/components/ui";
import { OwnerSelect, TagList } from "@/components/records/Pickers";
import { CsvButtons, FilterButton, Pagination, SavedViewTabs, SortHeader } from "@/components/records/Lists";
import { useCreate } from "@/components/records/CreateHost";
import { useContacts, useTags, type ContactFilters } from "@/lib/queries";
import { fa, lifecycleLabel, lifecycleOrder, relative } from "@/lib/format";
import type { LifecycleStage } from "@/lib/types";

const lcTone: Record<LifecycleStage, "neutral" | "lapis" | "saffron" | "pistachio"> = {
  Subscriber: "neutral", Lead: "lapis", Qualified: "lapis", Opportunity: "saffron", Customer: "pistachio",
};
const sources = ["وب‌سایت", "معرفی مشتری", "نمایشگاه", "لینکدین", "تماس ورودی", "کمپین ایمیلی"];
const base: ContactFilters = { sort: "createdAt", dir: "desc", page: 1, pageSize: 25 };

export default function Contacts() {
  const [f, setF] = useState<ContactFilters>(base);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const open = useCreate((s) => s.open);
  const { data: tags } = useTags();
  useEffect(() => {
    const t = setTimeout(() => setF((s) => ({ ...s, q: q.trim() || undefined, page: 1 })), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, isPlaceholderData } = useContacts(f);
  const set = (patch: Partial<ContactFilters>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const sortBy = (k: string) => set({ sort: k, dir: f.sort === k && f.dir === "asc" ? "desc" : "asc", page: f.page });
  const viewState = useMemo(() => {
    const { page: _p, pageSize: _s, ...rest } = f;
    void _p; void _s;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ""));
  }, [f]);
  const filterCount = [f.ownerId, f.lifecycle, f.tagId, f.source].filter(Boolean).length;
  const dirty = filterCount > 0 || !!f.q || f.sort !== "createdAt";

  return (
    <div>
      <PageHeader title="مخاطبین" subtitle={data ? `${fa(data.total)} نفر` : " "}
        actions={<>
          <CsvButtons path="/contacts" entity="contacts" filename="leadora-contacts.csv" query={viewState as Record<string, string>} />
          <Button icon={<Plus className="size-4" />} onClick={() => open("contact")}>مخاطب جدید</Button>
        </>} />

      <div className="card overflow-hidden">
        <div className="px-4 pt-1"><SavedViewTabs entity="Contact" current={viewState} isDirty={dirty}
          onApply={(v) => { setQ(String(v?.q ?? "")); setF({ ...base, ...(v ?? {}) }); }} /></div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Input data-page-search icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام، ایمیل، تلفن یا شرکت…  /" className="w-full sm:w-80" />
          <FilterButton count={filterCount}>
            {() => (
              <div className="space-y-3.5">
                <Field label="مسئول"><OwnerSelect value={f.ownerId ?? null} onChange={(v) => set({ ownerId: v ?? undefined })} allowEmpty emptyLabel="همه" /></Field>
                <Field label="مرحله‌ی چرخه">
                  <Select value={f.lifecycle ?? ""} onChange={(e) => set({ lifecycle: e.target.value || undefined })}>
                    <option value="">همه</option>
                    {lifecycleOrder.map((l) => <option key={l} value={l}>{lifecycleLabel[l]}</option>)}
                  </Select>
                </Field>
                <Field label="برچسب">
                  <Select value={f.tagId ?? ""} onChange={(e) => set({ tagId: e.target.value || undefined })}>
                    <option value="">همه</option>
                    {tags?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Field label="منبع">
                  <Select value={f.source ?? ""} onChange={(e) => set({ source: e.target.value || undefined })}>
                    <option value="">همه</option>
                    {sources.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
                {filterCount > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => set({ ownerId: undefined, lifecycle: undefined, tagId: undefined, source: undefined })}>پاک کردن فیلترها</Button>}
              </div>
            )}
          </FilterButton>
          {isPlaceholderData && <span className="text-xs text-fg-subtle">…</span>}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? <TableSkeleton /> : !data?.items.length ? (
            f.q || filterCount ? (
              <EmptyState icon={<Search className="size-7" />} title="مخاطبی با این مشخصات نیست" body="عبارت جستجو یا فیلترها را تغییر دهید." />
            ) : (
              <EmptyState icon={<Users className="size-7" />} title="اولین مخاطب را اضافه کنید" body="مخاطبین را یکی‌یکی بسازید یا فایل CSV فعلی‌تان را وارد کنید."
                action={<Button icon={<Plus className="size-4" />} onClick={() => open("contact")}>مخاطب جدید</Button>} />
            )
          ) : (
            <table className="w-full min-w-[880px] text-[13.5px]">
              <thead className="border-b border-line bg-surface-2 text-xs text-fg-subtle">
                <tr>
                  <SortHeader label="نام" k="name" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="شرکت" k="company" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="ایمیل" k="email" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="مرحله" k="lifecycle" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="مسئول" k="owner" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <th className="px-4 py-3 text-start font-medium">برچسب‌ها</th>
                  <SortHeader label="آخرین فعالیت" k="lastActivityAt" sort={f.sort} dir={f.dir} onSort={sortBy} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer transition hover:bg-surface-2" onClick={() => nav(`/app/contacts/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.fullName} color={c.owner?.avatarColor ?? "#5B6BC0"} size={32} />
                        <div className="min-w-0">
                          <Link to={`/app/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold hover:text-accent">{c.fullName}</Link>
                          <div className="truncate text-xs text-fg-subtle">{c.jobTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{c.company ? <Link to={`/app/companies/${c.company.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent">{c.company.name}</Link> : <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-2.5 text-fg-muted" dir="ltr"><span className="block max-w-56 truncate text-end">{c.email}</span></td>
                    <td className="px-4 py-2.5"><Badge tone={lcTone[c.lifecycle]}>{lifecycleLabel[c.lifecycle]}</Badge></td>
                    <td className="px-4 py-2.5">{c.owner && <span className="inline-flex items-center gap-2"><Avatar name={c.owner.fullName} color={c.owner.avatarColor} size={22} /><span className="truncate">{c.owner.fullName}</span></span>}</td>
                    <td className="px-4 py-2.5"><TagList tags={c.tags} max={2} /></td>
                    <td className="px-4 py-2.5 text-fg-subtle">{relative(c.lastActivityAt ?? c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.total > 0 && <Pagination page={f.page ?? 1} pageSize={f.pageSize ?? 25} total={data.total} onPage={(p) => set({ page: p })} noun="مخاطب" />}
      </div>
    </div>
  );
}
