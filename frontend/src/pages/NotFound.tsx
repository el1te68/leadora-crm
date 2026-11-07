import { Link } from "react-router";
import { Button } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";

export default function NotFound({ standalone }: { standalone?: boolean }) {
  const body = (
    <div className="flex flex-col items-center py-24 text-center">
      <svg viewBox="0 0 220 80" className="mb-6 w-56" aria-hidden>
        <path d="M10 60 C 50 10, 90 70, 120 40" fill="none" stroke="var(--color-saffron-500)" strokeWidth="3" strokeLinecap="round" />
        <path d="M150 40 C 170 20, 190 60, 210 30" fill="none" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7" />
        <circle cx="10" cy="60" r="5" fill="var(--color-lapis-600)" />
      </svg>
      <h1 className="text-2xl font-extrabold">این صفحه پیدا نشد</h1>
      <p className="mt-2 max-w-sm text-fg-muted">نشانی را بررسی کنید یا از جستجوی سراسری (Ctrl+K) برای پیدا کردن رکورد استفاده کنید.</p>
      <Link to={standalone ? "/" : "/app/my-day"} className="mt-6"><Button>{standalone ? "صفحه‌ی اصلی" : "رفتن به «روز من»"}</Button></Link>
    </div>
  );
  if (!standalone) return body;
  return <div className="min-h-dvh bg-canvas px-6 py-6"><Logo />{body}</div>;
}
