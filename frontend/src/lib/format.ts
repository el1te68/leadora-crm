import type { ActivityType, LifecycleStage, WorkspaceRole } from "./types";

const faNum = new Intl.NumberFormat("fa-IR");
const faDec = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

export const fa = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return faNum.format(v);
  return v.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
};

export const faDecimal = (v: number) => faDec.format(v);
export const percent = (v: number) => `${faDec.format(v)}٪`;

/** "۱۲٬۵۰۰٬۰۰۰ تومان" */
export const toman = (v: number) => `${faNum.format(Math.round(v))} تومان`;

/** Short money for dense UI: "۲٫۵ میلیارد", "۸۴۰ میلیون" */
export function tomanShort(v: number, withUnit = true): string {
  const abs = Math.abs(v);
  let out: string;
  if (abs >= 1e9) out = `${faDec.format(v / 1e9)} میلیارد`;
  else if (abs >= 1e6) out = `${faDec.format(v / 1e6)} میلیون`;
  else if (abs >= 1e3) out = `${faDec.format(v / 1e3)} هزار`;
  else out = faNum.format(v);
  return withUnit ? `${out} تومان` : out;
}

/** Convert Persian/Arabic digits typed by the user back to Latin. */
export const latinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const dateFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" });
const shortFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", day: "numeric", timeZone: "Asia/Tehran" });
const numericFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" });
const timeFmt = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" });
const weekdayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" });
const fullFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" });

const toDate = (v: string | Date) => (typeof v === "string" ? new Date(v.length === 10 ? `${v}T12:00:00Z` : v) : v);

export const dateFa = (v?: string | Date | null) => (v ? dateFmt.format(toDate(v)) : "—");
export const dateShort = (v?: string | Date | null) => (v ? shortFmt.format(toDate(v)) : "—");
export const dateNumeric = (v?: string | Date | null) => (v ? numericFmt.format(toDate(v)) : "");
export const timeFa = (v?: string | Date | null) => (v ? timeFmt.format(toDate(v)) : "");
export const weekdayFa = (v: string | Date) => weekdayFmt.format(toDate(v));
export const fullDateFa = (v: string | Date) => fullFmt.format(toDate(v));
export const dateTimeFa = (v?: string | null) => (v ? `${dateShort(v)}، ساعت ${timeFa(v)}` : "—");

const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
export function relative(v?: string | null): string {
  if (!v) return "—";
  const diff = (toDate(v).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "همین حالا";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

/** Days from today (Tehran) to an ISO date; negative = past. */
export function daysUntil(iso: string): number {
  const d = toDate(iso);
  const today = new Date();
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / 86400000);
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  return parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}‌${parts[parts.length - 1][0]}`;
}

export const lifecycleLabel: Record<LifecycleStage, string> = {
  Subscriber: "مشترک",
  Lead: "سرنخ",
  Qualified: "واجد شرایط",
  Opportunity: "فرصت",
  Customer: "مشتری",
};
export const lifecycleOrder: LifecycleStage[] = ["Subscriber", "Lead", "Qualified", "Opportunity", "Customer"];

export const activityLabel: Record<ActivityType, string> = { Task: "کار", Call: "تماس", Meeting: "جلسه" };
export const roleLabel: Record<WorkspaceRole, string> = { Owner: "مالک", Admin: "مدیر", Member: "عضو" };

export function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" }).format(new Date()));
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  return "عصر بخیر";
}
