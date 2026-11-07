import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cx, Popover } from "./index";
import { fa, dateFa } from "@/lib/format";
import { fromIso, jalaliMonths, monthLength, persianWeekday, toGregorian, toIso, toJalali, weekDaysShort } from "@/lib/jalali";

/** Jalali calendar picker. Value/onChange use ISO yyyy-mm-dd (Gregorian) so the API stays calendar-neutral. */
export function DatePicker({ value, onChange, placeholder = "انتخاب تاریخ", invalid, clearable = true, className }: {
  value?: string | null; onChange: (v: string | null) => void; placeholder?: string; invalid?: boolean; clearable?: boolean; className?: string;
}) {
  const initial = value ? toJalali(fromIso(value)) : toJalali(new Date());
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm });
  const todayIso = toIso(new Date());

  const cells = useMemo(() => {
    const first = toGregorian(view.jy, view.jm, 1);
    const lead = persianWeekday(first);
    const len = monthLength(view.jy, view.jm);
    const out: ({ day: number; iso: string } | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= len; d++) out.push({ day: d, iso: toIso(toGregorian(view.jy, view.jm, d)) });
    return out;
  }, [view]);

  const shift = (n: number) =>
    setView((v) => {
      let jm = v.jm + n, jy = v.jy;
      if (jm < 1) { jm = 12; jy--; }
      if (jm > 12) { jm = 1; jy++; }
      return { jy, jm };
    });

  return (
    <Popover
      className="w-72 p-3"
      trigger={({ toggle }) => (
        <div className={cx("relative", className)}>
          <button type="button" onClick={toggle} aria-invalid={invalid || undefined} className="field flex items-center gap-2 text-start">
            <CalendarDays className="size-4 shrink-0 text-fg-subtle" />
            <span className={cx("flex-1 truncate", !value && "text-fg-subtle")}>{value ? dateFa(value) : placeholder}</span>
          </button>
          {clearable && value && (
            <button type="button" aria-label="پاک کردن تاریخ" onClick={() => onChange(null)} className="absolute inset-y-0 end-2 grid place-items-center text-fg-subtle hover:text-fg">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
    >
      {(close) => (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-sunken" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight className="size-4" /></button>
            <div className="text-sm font-bold">{jalaliMonths[view.jm - 1]} <span className="num">{fa(String(view.jy))}</span></div>
            <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-sunken" onClick={() => shift(1)} aria-label="ماه بعد"><ChevronLeft className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekDaysShort.map((w, i) => <div key={w} className={cx("py-1 text-[11px] font-medium text-fg-subtle", i === 6 && "text-pomegranate-400")}>{w}</div>)}
            {cells.map((c, i) =>
              c ? (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => { onChange(c.iso); close(); }}
                  className={cx(
                    "num grid aspect-square place-items-center rounded-md text-[13px] transition",
                    c.iso === value ? "bg-lapis-600 font-bold text-white dark:bg-lapis-400 dark:text-lapis-950" : "hover:bg-sunken",
                    c.iso === todayIso && c.iso !== value && "ring-1 ring-saffron-500",
                    i % 7 === 6 && c.iso !== value && "text-pomegranate-400",
                  )}
                >
                  {fa(String(c.day))}
                </button>
              ) : <span key={`e${i}`} />,
            )}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs">
            <button type="button" className="rounded px-2 py-1 text-accent hover:bg-accent-soft" onClick={() => { onChange(todayIso); close(); }}>امروز</button>
            <button type="button" className="rounded px-2 py-1 text-fg-muted hover:bg-sunken" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); onChange(toIso(d)); close(); }}>یک هفته‌ی بعد</button>
          </div>
        </div>
      )}
    </Popover>
  );
}
