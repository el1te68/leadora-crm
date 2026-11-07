import { Check, Plus, Tag as TagIcon } from "lucide-react";
import { useCompanies, useContacts, useCustomFields, useMembers, useTags } from "@/lib/queries";
import { Avatar, Field, Input, Popover, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import type { CustomField, RecordType, TagDto } from "@/lib/types";
import { latinDigits } from "@/lib/format";

export function OwnerSelect({ value, onChange, allowEmpty, emptyLabel = "بدون مسئول", id }: { value?: string | null; onChange: (v: string | null) => void; allowEmpty?: boolean; emptyLabel?: string; id?: string }) {
  const { data } = useMembers();
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {data?.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
    </Select>
  );
}

export function CompanySelect({ value, onChange, id }: { value?: string | null; onChange: (v: string | null) => void; id?: string }) {
  const { data } = useCompanies({ pageSize: 200, sort: "name", dir: "asc" });
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">بدون شرکت</option>
      {data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </Select>
  );
}

export function ContactSelect({ value, onChange, companyId, id }: { value?: string | null; onChange: (v: string | null) => void; companyId?: string | null; id?: string }) {
  const { data } = useContacts({ pageSize: 200, sort: "name", dir: "asc", companyId: companyId ?? undefined });
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">بدون مخاطب</option>
      {data?.items.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.company ? ` — ${c.company.name}` : ""}</option>)}
    </Select>
  );
}

export function TagList({ tags, max = 3 }: { tags: TagDto[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.slice(0, max).map((t) => (
        <span key={t.id} className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium dark:brightness-[1.7]" style={{ background: `${t.color}1C`, color: t.color }}>
          {t.name}
        </span>
      ))}
      {tags.length > max && <span className="text-[11px] text-fg-subtle">+{(tags.length - max).toLocaleString("fa-IR")}</span>}
    </span>
  );
}

export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data } = useTags();
  const selected = data?.filter((t) => value.includes(t.id)) ?? [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(value.filter((v) => v !== t.id))}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition hover:opacity-75" style={{ background: `${t.color}1C`, color: t.color }}
          title="حذف برچسب">
          {t.name} ×
        </button>
      ))}
      <Popover
        className="w-56 p-1.5"
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-xs text-fg-muted hover:border-fg-subtle hover:text-fg">
            <Plus className="size-3" /> برچسب
          </button>
        )}
      >
        {data?.length ? data.map((t) => {
          const on = value.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={() => onChange(on ? value.filter((v) => v !== t.id) : [...value, t.id])}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-[13px] hover:bg-sunken">
              <span className="size-2.5 rounded-full" style={{ background: t.color }} />
              <span className="flex-1">{t.name}</span>
              {on && <Check className="size-4 text-accent" />}
            </button>
          );
        }) : <div className="flex items-center gap-2 p-3 text-xs text-fg-muted"><TagIcon className="size-4" />در تنظیمات برچسب بسازید.</div>}
      </Popover>
    </div>
  );
}

export function CustomFieldInputs({ entity, values, onChange }: { entity: RecordType; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { data } = useCustomFields();
  const defs = (data ?? []).filter((f) => f.entityType === entity);
  if (!defs.length) return null;
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {defs.map((f) => <CustomFieldInput key={f.id} def={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />)}
    </div>
  );
}

export function CustomFieldInput({ def, value, onChange }: { def: CustomField; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={def.label}>
      {def.type === "Select" ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : def.type === "Date" ? (
        <DatePicker value={value || null} onChange={(v) => onChange(v ?? "")} />
      ) : (
        <Input value={value} inputMode={def.type === "Number" ? "decimal" : undefined}
          onChange={(e) => onChange(def.type === "Number" ? latinDigits(e.target.value).replace(/[^0-9.]/g, "") : e.target.value)} />
      )}
    </Field>
  );
}

export function OwnerChip({ name, color }: { name?: string | null; color?: string | null }) {
  if (!name) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar name={name} color={color ?? undefined} size={22} />
      <span className="truncate">{name}</span>
    </span>
  );
}

