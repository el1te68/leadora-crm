import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useUi } from "@/store";
import { Kbd, Modal } from "@/components/ui";
import { useCreate } from "@/components/records/CreateHost";

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

/** Ctrl/⌘+K palette · "?" help · "[" sidebar · "N" new deal · "G" then a letter to jump. */
export function useGlobalShortcuts() {
  const nav = useNavigate();
  const { setPalette, setShortcuts, toggleSidebar } = useUi();
  const create = useCreate((s) => s.open);

  useEffect(() => {
    let leader = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const jumps: Record<string, string> = { m: "/app/my-day", d: "/app", p: "/app/deals", c: "/app/contacts", o: "/app/companies", a: "/app/activities", s: "/app/settings" };

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "k" || e.code === "KeyK")) {
        e.preventDefault();
        setPalette(!useUi.getState().paletteOpen);
        return;
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const k = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.key;
      if (leader && jumps[k]) {
        e.preventDefault();
        leader = false;
        nav(jumps[k]);
        return;
      }
      if (k === "g") {
        leader = true;
        clearTimeout(timer);
        timer = setTimeout(() => (leader = false), 900);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.code === "Slash")) { e.preventDefault(); setShortcuts(true); }
      else if (e.code === "BracketLeft" || e.code === "BracketRight") toggleSidebar();
      else if (k === "n") { e.preventDefault(); create("deal"); }
      else if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) { e.preventDefault(); search.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nav, setPalette, setShortcuts, toggleSidebar, create]);
}

const rows: [string, string[]][] = [
  ["جستجو و فرمان‌ها", ["Ctrl", "K"]],
  ["معامله‌ی جدید", ["N"]],
  ["جستجو در همین صفحه", ["/"]],
  ["جمع/باز کردن نوار کناری", ["["]],
  ["رفتن به «روز من»", ["G", "M"]],
  ["رفتن به گزارش‌ها", ["G", "D"]],
  ["رفتن به پایپ‌لاین معاملات", ["G", "P"]],
  ["رفتن به مخاطبین", ["G", "C"]],
  ["رفتن به شرکت‌ها", ["G", "O"]],
  ["رفتن به فعالیت‌ها", ["G", "A"]],
  ["همین راهنما", ["?"]],
];

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcuts } = useUi();
  return (
    <Modal open={shortcutsOpen} onClose={() => setShortcuts(false)} title="میان‌برهای صفحه‌کلید" description="بیشتر کارها بدون ماوس هم انجام می‌شوند." size="sm">
      <ul className="divide-y divide-line">
        {rows.map(([label, ks]) => (
          <li key={label} className="flex items-center justify-between py-2.5">
            <span>{label}</span>
            <span className="flex items-center gap-1" dir="ltr">{ks.map((k, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <span className="text-[11px] text-fg-subtle">بعد</span>}<Kbd>{k}</Kbd></span>)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
