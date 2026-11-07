import { clsx } from "clsx";
import {
  forwardRef, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { initials, tomanShort, toman } from "@/lib/format";

export const cx = clsx;

// ───────────── Button ─────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "saffron" | "soft";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-lapis-600 text-white hover:bg-lapis-700 active:bg-lapis-800 dark:bg-lapis-400 dark:text-lapis-950 dark:hover:bg-lapis-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-surface-2 hover:border-fg-subtle",
  ghost: "text-fg-muted hover:text-fg hover:bg-sunken",
  danger: "bg-pomegranate-500 text-white hover:bg-pomegranate-600",
  saffron: "bg-saffron-500 text-lapis-950 hover:bg-saffron-400 shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
  soft: "bg-accent-soft text-accent hover:brightness-95 dark:hover:brightness-125",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9.5 px-4 gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2.5 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,border,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-grid size-9 place-items-center rounded-md text-fg-muted transition hover:bg-sunken hover:text-fg", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ───────────── Form controls ─────────────

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode }>(
  function Input({ className, invalid, icon, ...rest }, ref) {
    if (icon)
      return (
        <div className={cx("relative", className)}>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-fg-subtle">{icon}</span>
          <input ref={ref} aria-invalid={invalid || undefined} className="field ps-9" {...rest} />
        </div>
      );
    return <input ref={ref} aria-invalid={invalid || undefined} className={cx("field", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cx("field h-auto min-h-24 py-2.5 leading-7", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(
          "field appearance-none bg-[length:16px] bg-[position:left_10px_center] bg-no-repeat pe-3 ps-8",
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a91ad' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Field({ label, error, hint, children, className, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg-muted">{label}</label>
      {children}
      {error ? <p className="text-xs text-pomegranate-500">{error}</p> : hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-pistachio-500" : "bg-line-strong")}
    >
      <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200", checked ? "start-[18px]" : "start-0.5")} />
    </button>
  );
}

// ───────────── Display ─────────────

export function Avatar({ name, color, size = 28, className, square }: { name: string; color?: string; size?: number; className?: string; square?: boolean }) {
  return (
    <span
      title={name}
      className={cx("inline-grid shrink-0 place-items-center font-semibold text-white", square ? "rounded-[30%]" : "rounded-full", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: color ?? "#5B6BC0", letterSpacing: 0 }}
    >
      {initials(name)}
    </span>
  );
}

/** Company "monogram" tile — colored deterministically from the name. */
export function Monogram({ name, size = 32 }: { name: string; size?: number }) {
  const palette = ["#2B3A9E", "#1F8A9E", "#7A4FB5", "#A86A17", "#4A8559", "#A82E47", "#3B4BB0"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = palette[h % palette.length];
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-[10px] font-bold" style={{ width: size, height: size, background: `${c}1A`, color: c, fontSize: size * 0.42 }}>
      {name.trim()[0] ?? "؟"}
    </span>
  );
}

export function Badge({ children, color, className, tone }: { children: ReactNode; color?: string; className?: string; tone?: "neutral" | "lapis" | "saffron" | "pomegranate" | "pistachio" }) {
  const tones = {
    neutral: "bg-sunken text-fg-muted",
    lapis: "bg-lapis-50 text-lapis-700 dark:bg-lapis-800/60 dark:text-lapis-200",
    saffron: "bg-saffron-50 text-saffron-700 dark:bg-saffron-800/40 dark:text-saffron-200",
    pomegranate: "bg-pomegranate-50 text-pomegranate-600 dark:bg-pomegranate-700/30 dark:text-pomegranate-100",
    pistachio: "bg-pistachio-50 text-pistachio-700 dark:bg-pistachio-700/30 dark:text-pistachio-100",
  };
  if (color)
    return (
      <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", className)} style={{ background: `${color}1F`, color }}>
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        {children}
      </span>
    );
  return <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium", tones[tone ?? "neutral"], className)}>{children}</span>;
}

export function Money({ value, short, className }: { value: number; short?: boolean; className?: string }) {
  return <span className={cx("num font-semibold text-money", className)} title={toman(value)}>{short ? tomanShort(value) : toman(value)}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-line-strong bg-surface-2 px-1 font-sans text-[11px] text-fg-muted shadow-[0_1px_0_var(--line-strong)]">{children}</kbd>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-fg-subtle", className)} />;
}

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5 grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        {icon}
        <span className="absolute -bottom-1 -start-1 size-3 rounded-full border-2 border-surface bg-saffron-500" />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-fg-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string; size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-lg bg-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            o.value === value ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="num rounded-full bg-line px-1.5 text-[11px] leading-5">{o.count.toLocaleString("fa-IR")}</span>}
        </button>
      ))}
    </div>
  );
}

// ───────────── Overlays ─────────────

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select,button[data-autofocus]")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" dir="rtl">
      <div className="absolute inset-0 animate-fade-in bg-lapis-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("relative flex max-h-[92dvh] w-full animate-pop-in flex-col rounded-t-2xl bg-surface shadow-pop sm:rounded-xl", w)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
          </div>
          <IconButton label="بستن" onClick={onClose} className="-me-2 -mt-1"><X className="size-5" /></IconButton>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3.5 sm:rounded-b-xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Click-to-open popover anchored to its trigger. */
export function Popover({ trigger, children, align = "start", className, open: controlled, onOpenChange }: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const set = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && set(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && set(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ open, toggle: () => set(!open) })}
      {open && (
        <div className={cx("popover absolute top-full z-40 mt-2 animate-pop-in", align === "start" ? "start-0" : "end-0", className)}>
          {typeof children === "function" ? children(() => set(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, active, hint }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; hint?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-[13px] transition",
        danger ? "text-pomegranate-500 hover:bg-pomegranate-50 dark:hover:bg-pomegranate-700/20" : "hover:bg-sunken",
        active && "bg-accent-soft text-accent",
      )}
    >
      {icon && <span className="text-fg-subtle [&>svg]:size-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint}
    </button>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel: string; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>انصراف</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-fg-muted">{body}</p>
    </Modal>
  );
}
