import { cx } from "@/components/ui";

/** The Leadora knot: a saffron thread looping around a white bead on lapis. */
export function LogoMark({ size = 32, className, onDark }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill={onDark ? "#2B3A9E" : "#2B3A9E"} />
      <path d="M9 21c0-6 4-10 8-10s6 3 6 5-2 4-5 4-5-2-5-5" fill="none" stroke="#E9A23B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="9" cy="21" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, onDark, compact }: { className?: string; onDark?: boolean; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={compact ? 30 : 32} onDark={onDark} />
      {!compact && (
        <span className={cx("text-[21px] font-extrabold tracking-tight", onDark ? "text-white" : "text-fg")}>
          لیدورا<span className="text-saffron-500">.</span>
        </span>
      )}
    </span>
  );
}
