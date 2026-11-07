import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Plus, Search } from "lucide-react";
import { PageHeader, TableSkeleton } from "./common";
import { Avatar, Button, EmptyState, Field, Input, Monogram, Select } from "@/components/ui";
import { OwnerSelect, TagList } from "@/components/records/Pickers";
import { CsvButtons, FilterButton, Pagination, SavedViewTabs, SortHeader } from "@/components/records/Lists";
import { useCreate } from "@/components/records/CreateHost";
import { useCompanies, useTags, type CompanyFilters } from "@/lib/queries";
import { fa, relative, tomanShort } from "@/lib/format";

const base: CompanyFilters = { sort: "name", dir: "asc", page: 1, pageSize: 25 };
const industries = ["فناوری اطلاعات", "صنایع غذایی", "دارو و سلامت", "خرده‌فروشی", "بیمه و مالی", "ساخت‌وساز", "آموزش", "گردشگری", "حمل‌ونقل", "کشاورزی"];

export default function Companies() {
  const [f, setF] = useState<CompanyFilters>(base);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const open = useCreate((s) => s.open);
  const { data: tags } = useTags();
  useEffect(() => {
    const t = setTimeout(() => setF((s) => ({ ...s, q: q.trim() || undefined, page: 1 })), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading } = useCompanies(f);
  const set = (patch: Partial<CompanyFilters>) => setF((s) => ({ ...s, ...patch, page: patch.page ?? 1 }));
  const sortBy = (k: string) => set({ sort: k, dir: f.sort === k && f.dir === "asc" ? "desc" : "asc", page: f.page });
  const viewState = useMemo(() => {
    const { page: _p, pageSize: _s, ...rest } = f;
    void _p; void _s;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ""));
  }, [f]);
  const filterCount = [f.ownerId, f.industry, f.tagId, f.city].filter(Boolean).length;

  return (
    <div>
      <PageHeader title="شرکت‌ها" subtitle={data ? `${fa(data.total)} شرکت` : " "}
        actions={<>
          <CsvButtons path="/companies" entity="companies" filename="leadora-companies.csv" query={viewState as Record<string, string>} />
          <Button icon={<Plus className="size-4" />} onClick={() => open("company")}>شرکت جدید</Button>
        </>} />
      <div className="card overflow-hidden">
        <div className="px-4 pt-1"><SavedViewTabs entity="Company" current={viewState} isDirty={filterCount > 0 || !!f.q || f.sort !== "name"}
          onApply={(v) => { setQ(String(v?.q ?? "")); setF({ ...base, ...(v ?? {}) }); }} /></div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Input data-page-search icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا وب‌سایت…  /" className="w-full sm:w-80" />
          <FilterButton count={filterCount}>
            {() => (
              <div className="space-y-3.5">
                <Field label="مسئول"><OwnerSelect value={f.ownerId ?? null} onChange={(v) => set({ ownerId: v ?? undefined })} allowEmpty emptyLabel="همه" /></Field>
                <Field label="صنعت">
                  <Select value={f.industry ?? ""} onChange={(e) => set({ industry: e.target.value || undefined })}>
                    <option value="">همه</option>{industries.map((i) => <option key={i}>{i}</option>)}
                  </Select>
                </Field>
                <Field label="برچسب">
                  <Select value={f.tagId ?? ""} onChange={(e) => set({ tagId: e.target.value || undefined })}>
                    <option value="">همه</option>{tags?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Field label="شهر"><Input value={f.city ?? ""} onChange={(e) => set({ city: e.target.value || undefined })} /></Field>
              </div>
            )}
          </FilterButton>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? <TableSkeleton /> : !data?.items.length ? (
            <EmptyState icon={<Building2 className="size-7" />} title={f.q || filterCount ? "شرکتی با این مشخصات نیست" : "اولین شرکت را اضافه کنید"}
              body={f.q || filterCount ? "عبارت جستجو یا فیلترها را تغییر دهید." : "شرکت‌ها مخاطبین و معامله‌ها را کنار هم نگه می‌دارند."}
              action={!f.q && !filterCount ? <Button icon={<Plus className="size-4" />} onClick={() => open("company")}>شرکت جدید</Button> : undefined} />
          ) : (
            <table className="w-full min-w-[860px] text-[13.5px]">
              <thead className="border-b border-line bg-surface-2 text-xs text-fg-subtle">
                <tr>
                  <SortHeader label="شرکت" k="name" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="صنعت" k="industry" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="شهر" k="city" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="مخاطبین" k="contacts" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="معامله‌های باز" k="openValue" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="مسئول" k="owner" sort={f.sort} dir={f.dir} onSort={sortBy} />
                  <SortHeader label="آخرین فعالیت" k="lastActivityAt" sort={f.sort} dir={f.dir} onSort={sortBy} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((c) => (
                  <tr key={c.id} className="cursor-pointer transition hover:bg-surface-2" onClick={() => nav(`/app/companies/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Monogram name={c.name} size={34} />
                        <div className="min-w-0">
                          <Link to={`/app/companies/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold hover:text-accent">{c.name}</Link>
                          <div className="flex items-center gap-2 text-xs text-fg-subtle"><span dir="ltr">{c.domain}</span><TagList tags={c.tags} max={1} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">{c.industry}</td>
                    <td className="px-4 py-2.5 text-fg-muted">{c.city}</td>
                    <td className="num px-4 py-2.5">{fa(c.contactCount)}</td>
                    <td className="px-4 py-2.5">{c.openDeals ? <span><b className="num text-money">{tomanShort(c.openValue)}</b> <span className="num text-xs text-fg-subtle">({fa(c.openDeals)})</span></span> : <span className="text-fg-subtle">—</span>}</td>
                    <td className="px-4 py-2.5">{c.owner && <span className="inline-flex items-center gap-2"><Avatar name={c.owner.fullName} color={c.owner.avatarColor} size={22} />{c.owner.fullName}</span>}</td>
                    <td className="px-4 py-2.5 text-fg-subtle">{relative(c.lastActivityAt ?? c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.total > 0 && <Pagination page={f.page ?? 1} pageSize={f.pageSize ?? 25} total={data.total} onPage={(p) => set({ page: p })} noun="شرکت" />}
      </div>
    </div>
  );
}
