import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  BarChart3, Briefcase, Building2, CalendarCheck2, CornerDownLeft, KanbanSquare, Moon, Search, Settings, SunMedium, User, UserPlus, Users, Workflow,
} from "lucide-react";
import { useUi } from "@/store";
import { useSearch } from "@/lib/queries";
import { cx, Kbd, Spinner } from "@/components/ui";
import { tomanShort } from "@/lib/format";
import { useCreate } from "@/components/records/CreateHost";
import type { SearchHit } from "@/lib/types";

interface Item { id: string; group: string; label: string; hint?: string; meta?: string; icon: ReactNode; run: () => void }

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function CommandPalette() {
  const { paletteOpen: open, setPalette, theme, setTheme } = useUi();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const dq = useDebounced(q.trim(), 160);
  const { data, isFetching } = useSearch(dq, open);
  const nav = useNavigate();
  const create = useCreate((s) => s.open);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setIndex(0); }
  }, [open]);

  const close = () => setPalette(false);
  const go = (to: string) => () => { nav(to); close(); };

  const items = useMemo<Item[]>(() => {
    const term = q.trim();
    const actions: Item[] = [
      { id: "a-deal", group: "اقدام‌ها", label: "معامله‌ی جدید", icon: <Briefcase />, hint: "N", run: () => { close(); create("deal"); } },
      { id: "a-contact", group: "اقدام‌ها", label: "مخاطب جدید", icon: <UserPlus />, run: () => { close(); create("contact"); } },
      { id: "a-company", group: "اقدام‌ها", label: "شرکت جدید", icon: <Building2 />, run: () => { close(); create("company"); } },
      { id: "a-activity", group: "اقدام‌ها", label: "ثبت فعالیت یا کار", icon: <CalendarCheck2 />, run: () => { close(); create("activity"); } },
      { id: "a-theme", group: "اقدام‌ها", label: theme === "dark" ? "رفتن به حالت روشن" : "رفتن به حالت تاریک", icon: <Moon />, run: () => { setTheme(theme === "dark" ? "light" : "dark"); close(); } },
      { id: "g-day", group: "رفتن به", label: "روز من", icon: <SunMedium />, hint: "G M", run: go("/app/my-day") },
      { id: "g-dash", group: "رفتن به", label: "گزارش‌ها", icon: <BarChart3 />, hint: "G D", run: go("/app") },
      { id: "g-deals", group: "رفتن به", label: "معامله‌ها", icon: <KanbanSquare />, hint: "G P", run: go("/app/deals") },
      { id: "g-contacts", group: "رفتن به", label: "مخاطبین", icon: <Users />, hint: "G C", run: go("/app/contacts") },
      { id: "g-companies", group: "رفتن به", label: "شرکت‌ها", icon: <Building2 />, hint: "G O", run: go("/app/companies") },
      { id: "g-acts", group: "رفتن به", label: "فعالیت‌ها", icon: <CalendarCheck2 />, hint: "G A", run: go("/app/activities") },
      { id: "g-auto", group: "رفتن به", label: "اتوماسیون‌ها", icon: <Workflow />, run: go("/app/automations") },
      { id: "g-settings", group: "رفتن به", label: "تنظیمات", icon: <Settings />, run: go("/app/settings") },
    ];
    const matched = term ? actions.filter((a) => a.label.includes(term)) : actions.slice(0, 4);
    const hit = (h: SearchHit, group: string, icon: ReactNode, path: string): Item => ({
      id: `${h.type}-${h.id}`, group, label: h.title, hint: h.subtitle ?? undefined,
      meta: h.type === "Deal" && h.meta ? tomanShort(Number(h.meta)) : h.meta ?? undefined, icon, run: go(path),
    });
    const groupLabel = (g: string) => (term ? g : `${g} اخیر`);
    return [
      ...(data?.deals ?? []).map((h) => hit(h, groupLabel("معامله‌ها"), <KanbanSquare />, `/app/deals/${h.id}`)),
      ...(data?.contacts ?? []).map((h) => hit(h, groupLabel("مخاطبین"), <User />, `/app/contacts/${h.id}`)),
      ...(data?.companies ?? []).map((h) => hit(h, groupLabel("شرکت‌ها"), <Building2 />, `/app/companies/${h.id}`)),
      ...matched,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, theme]);

  useEffect(() => setIndex(0), [dq]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter") { e.preventDefault(); items[index]?.run(); }
    if (e.key === "Escape") close();
  };

  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-3 pt-[12vh]" dir="rtl">
      <div className="absolute inset-0 animate-fade-in bg-lapis-950/45 backdrop-blur-[2px]" onClick={close} />
      <div role="dialog" aria-modal="true" aria-label="جستجو و فرمان‌ها" className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-fg-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="نام مخاطب، شرکت، معامله یا یک فرمان…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[index]?.id}
          />
          {isFetching && <Spinner className="size-4" />}
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(440px,60vh)] overflow-y-auto p-2">
          {items.length === 0 && <div className="px-4 py-10 text-center text-fg-muted">چیزی با «{q}» پیدا نشد.</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-fg-subtle first:pt-1">{header}</div>}
                <button
                  id={it.id}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  data-index={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={it.run}
                  className={cx("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start", i === index ? "bg-accent-soft" : "")}
                >
                  <span className={cx("[&>svg]:size-4", i === index ? "text-accent" : "text-fg-subtle")}>{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{it.label}</span>
                    {it.hint && it.group !== "اقدام‌ها" && it.group !== "رفتن به" && <span className="block truncate text-xs text-fg-subtle">{it.hint}</span>}
                  </span>
                  {it.meta && <span className="num shrink-0 text-xs text-fg-muted">{it.meta}</span>}
                  {(it.group === "اقدام‌ها" || it.group === "رفتن به") && it.hint && <span className="flex gap-1" dir="ltr">{it.hint.split(" ").map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                  {i === index && <CornerDownLeft className="size-3.5 text-fg-subtle" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> جابه‌جایی</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> باز کردن</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
