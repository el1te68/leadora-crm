import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Bookmark, Download, Filter, Plus, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, cx, Field, Input, Modal, Popover } from "@/components/ui";
import { api, downloadCsv } from "@/lib/api";
import { showError, useAction, useViews, useWs } from "@/lib/queries";
import { fa } from "@/lib/format";
import type { ImportResult, RecordType } from "@/lib/types";

/** Saved views as tabs: "همه" + the user's views + "ذخیره‌ی نمای فعلی". */
export function SavedViewTabs<T extends Record<string, unknown>>({ entity, current, onApply, isDirty }: {
  entity: RecordType; current: T; onApply: (q: Partial<T> | null, id: string | null) => void; isDirty: boolean;
}) {
  const { data } = useViews(entity);
  const [active, setActive] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const create = useAction((body: { name: string }) => api.post<{ id: string }>("/views", { entityType: entity, name: body.name, query: JSON.stringify(current) }), {
    invalidate: ["views"], success: "نما ذخیره شد.",
  });
  const remove = useAction((id: string) => api.del(`/views/${id}`), { invalidate: ["views"], success: "نما حذف شد." });

  return (
    <div className="no-scrollbar -mb-px flex items-center gap-1 overflow-x-auto border-b border-line">
      <Tab active={active === null} onClick={() => { setActive(null); onApply(null, null); }}>همه</Tab>
      {data?.map((v) => (
        <Tab key={v.id} active={active === v.id} onClick={() => {
          setActive(v.id);
          try { onApply(JSON.parse(v.query) as Partial<T>, v.id); } catch { onApply(null, v.id); }
        }}>
          <Bookmark className="size-3.5" />{v.name}
          {active === v.id && (
            <span role="button" tabIndex={0} aria-label="حذف نما" className="ms-1 rounded p-0.5 text-fg-subtle hover:bg-sunken hover:text-pomegranate-500"
              onClick={(e) => { e.stopPropagation(); remove.mutate(v.id); setActive(null); onApply(null, null); }}>
              <X className="size-3" />
            </span>
          )}
        </Tab>
      ))}
      {isDirty && (
        <button type="button" onClick={() => setSaving(true)} className="ms-1 inline-flex h-10 shrink-0 items-center gap-1 px-2 text-[13px] text-accent hover:underline">
          <Plus className="size-3.5" />ذخیره‌ی این نما
        </button>
      )}
      <Modal open={saving} onClose={() => setSaving(false)} title="ذخیره‌ی نما" description="فیلترها و مرتب‌سازی فعلی با این نام ذخیره می‌شود." size="sm"
        footer={<><Button variant="ghost" onClick={() => setSaving(false)}>انصراف</Button>
          <Button loading={create.isPending} disabled={!name.trim()} onClick={async () => {
            const v = await create.mutateAsync({ name: name.trim() });
            setActive(v.id); setSaving(false); setName("");
          }}>ذخیره</Button></>}>
        <Field label="نام نما"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: سرنخ‌های تهران" /></Field>
      </Modal>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cx("relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[13px] font-medium transition",
        active ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-saffron-500" : "text-fg-muted hover:text-fg")}>
      {children}
    </button>
  );
}

export function FilterButton({ count, children }: { count: number; children: (close: () => void) => ReactNode }) {
  return (
    <Popover className="w-72 p-4" trigger={({ toggle }) => (
      <Button variant="secondary" size="sm" icon={<Filter className="size-3.5" />} onClick={toggle}>
        فیلتر{count > 0 && <span className="num grid size-5 place-items-center rounded-full bg-lapis-600 text-[11px] text-white dark:bg-lapis-400 dark:text-lapis-950">{fa(count)}</span>}
      </Button>
    )}>
      {children}
    </Popover>
  );
}

export function SortHeader({ label, k, sort, dir, onSort, className }: { label: string; k: string; sort?: string; dir?: string; onSort: (k: string) => void; className?: string }) {
  const on = sort === k;
  return (
    <th className={cx("px-4 py-3 text-start font-medium", className)} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cx("inline-flex items-center gap-1 hover:text-fg", on && "text-fg")}>
        {label}{on && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

export function Pagination({ page, pageSize, total, onPage, noun }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-fg-muted">
      <span className="num">{fa(from)}–{fa(to)} از {fa(total)} {noun}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>قبلی</Button>
        <span className="num">صفحه‌ی {fa(page)} از {fa(pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>بعدی</Button>
      </div>
    </div>
  );
}

export function CsvButtons({ path, query, filename, entity }: { path: string; query: Record<string, string | number | undefined>; filename: string; entity: "contacts" | "companies" }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const ws = useWs();
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Upload className="size-3.5" />} loading={busy === "in"} onClick={() => input.current?.click()}>ورود CSV</Button>
      <Button variant="secondary" size="sm" icon={<Download className="size-3.5" />} loading={busy === "out"} onClick={async () => {
        setBusy("out");
        try { await downloadCsv(`${path}/export`, query, filename); } catch (e) { showError(e); } finally { setBusy(null); }
      }}>خروجی CSV</Button>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy("in");
        try {
          const res = await api.post<ImportResult>(`${path}/import`, await file.text());
          toast.success(`${fa(res.created)} ردیف وارد شد${res.skipped ? `، ${fa(res.skipped)} ردیف تکراری یا ناقص رد شد` : ""}.`, {
            description: res.errors.slice(0, 3).join("\n") || undefined,
          });
          qc.invalidateQueries({ queryKey: [ws, entity] });
        } catch (err) { showError(err); } finally { setBusy(null); }
      }} />
    </>
  );
}
