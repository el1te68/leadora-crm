import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, BarChart3, Building2, CalendarCheck2, Check, ChevronsUpDown, KanbanSquare, LogOut, Menu, Moon, PanelRightClose,
  PanelRightOpen, Plus, Search, Settings, Sun, SunMedium, Users, Workflow, X, Keyboard, CheckCheck, Briefcase, UserPlus, ListTodo,
} from "lucide-react";
import { Logo, LogoMark } from "./Logo";
import { Avatar, Button, cx, IconButton, Kbd, MenuItem, Popover } from "@/components/ui";
import { useActiveWorkspace, useAuth, useUi } from "@/store";
import { useNotifications, useAction, useWs, keys } from "@/lib/queries";
import { api } from "@/lib/api";
import { relative, roleLabel, fa } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog, useGlobalShortcuts } from "./Shortcuts";
import { CreateHost, useCreate } from "@/components/records/CreateHost";

const nav = [
  { to: "/app/my-day", label: "روز من", icon: SunMedium },
  { to: "/app", label: "گزارش‌ها", icon: BarChart3, end: true },
  { to: "/app/deals", label: "معامله‌ها", icon: KanbanSquare },
  { to: "/app/contacts", label: "مخاطبین", icon: Users },
  { to: "/app/companies", label: "شرکت‌ها", icon: Building2 },
  { to: "/app/activities", label: "فعالیت‌ها", icon: CalendarCheck2 },
  { to: "/app/automations", label: "اتوماسیون", icon: Workflow },
];

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <div className="girih relative flex h-full flex-col bg-lapis-900 text-lapis-100 dark:bg-[#0a0e26]">
      <div className={cx("flex h-16 items-center", collapsed ? "justify-center" : "px-5")}>
        <NavLink to="/app/my-day" onClick={onNavigate} aria-label="لیدورا">
          {collapsed ? <LogoMark size={30} onDark /> : <Logo onDark />}
        </NavLink>
      </div>
      <nav className={cx("flex flex-1 flex-col gap-0.5 py-3", collapsed ? "px-2" : "px-3")} aria-label="ناوبری اصلی">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cx(
                "group flex h-10 items-center gap-3 rounded-md text-[13.5px] font-medium transition-colors",
                collapsed ? "justify-center" : "px-3",
                isActive ? "thread-start bg-white/10 text-white" : "text-lapis-200/80 hover:bg-white/5 hover:text-white",
                collapsed && "[&.thread-start]:before:-start-2",
              )
            }
          >
            <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
        <div className="my-3 h-px bg-white/8" />
        <NavLink
          to="/app/settings"
          onClick={onNavigate}
          title={collapsed ? "تنظیمات" : undefined}
          className={({ isActive }) => cx("flex h-10 items-center gap-3 rounded-md text-[13.5px] font-medium transition-colors", collapsed ? "justify-center" : "px-3",
            isActive ? "thread-start bg-white/10 text-white" : "text-lapis-200/80 hover:bg-white/5 hover:text-white")}
        >
          <Settings className="size-[18px] shrink-0" strokeWidth={1.8} />
          {!collapsed && <span>تنظیمات</span>}
        </NavLink>
      </nav>
      <div className={cx("border-t border-white/8 p-3", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={toggle}
          className="hidden h-9 w-full items-center gap-2.5 rounded-md px-3 text-[13px] text-lapis-200/70 transition hover:bg-white/5 hover:text-white lg:flex"
          aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <><PanelRightClose className="size-4" /><span>جمع کردن</span><span className="ms-auto opacity-60"><Kbd>[</Kbd></span></>}
        </button>
      </div>
    </div>
  );
}

function WorkspaceSwitcher() {
  const user = useAuth((s) => s.user);
  const active = useActiveWorkspace();
  const setWorkspace = useAuth((s) => s.setWorkspace);
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const create = useAction((n: string) => api.post<{ id: string }>("/workspaces", { name: n }), { success: "فضای کاری ساخته شد." });

  if (!user || !active) return null;
  return (
    <Popover
      className="w-72 p-2"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="flex h-10 items-center gap-2.5 rounded-lg ps-1.5 pe-2.5 transition hover:bg-sunken" aria-label="تعویض فضای کاری">
          <span className="grid size-7 place-items-center rounded-md text-xs font-bold text-white" style={{ background: active.accentColor }}>{active.name[0]}</span>
          <span className="hidden max-w-40 truncate text-[13.5px] font-semibold sm:block">{active.name}</span>
          <ChevronsUpDown className="size-3.5 text-fg-subtle" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-2.5 pb-1.5 pt-1 text-xs text-fg-subtle">فضاهای کاری شما</div>
          {user.workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                if (w.id !== active.id) {
                  setWorkspace(w.id);
                  qc.removeQueries({ queryKey: [active.id] });
                  nav("/app/my-day");
                }
                close();
              }}
              className={cx("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start transition hover:bg-sunken", w.id === active.id && "bg-accent-soft")}
            >
              <span className="grid size-8 place-items-center rounded-md text-sm font-bold text-white" style={{ background: w.accentColor }}>{w.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{w.name}</span>
                <span className="block text-xs text-fg-subtle">{roleLabel[w.role]} · {fa(w.memberCount)} عضو</span>
              </span>
              {w.id === active.id && <Check className="size-4 text-accent" />}
            </button>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            {creating ? (
              <form
                className="flex gap-1.5 p-1.5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  const ws = await create.mutateAsync(name.trim());
                  const me = await api.get<typeof user>("/auth/me");
                  setUser(me);
                  setWorkspace(ws.id);
                  setCreating(false);
                  setName("");
                  close();
                  nav("/app/my-day");
                }}
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="نام فضای کاری" className="field h-8 text-[13px]" />
                <Button size="sm" type="submit" loading={create.isPending}>ساخت</Button>
              </form>
            ) : (
              <MenuItem icon={<Plus />} onClick={() => setCreating(true)}>فضای کاری جدید</MenuItem>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

const notifIcon: Record<string, string> = { won: "🎉", stale: "⏳", reminder: "⏰", mention: "＠", assign: "👤", stage: "➜", task: "✓", automation: "⚡" };

function NotificationsBell() {
  const { data } = useNotifications();
  const ws = useWs();
  const qc = useQueryClient();
  const nav = useNavigate();
  const markAll = useAction(() => api.post("/notifications/read"), { invalidate: ["notifications"], silent: true });
  const unread = data?.unread ?? 0;
  return (
    <Popover
      align="end"
      className="w-[min(380px,calc(100vw-24px))] p-0"
      trigger={({ toggle }) => (
        <IconButton label={unread ? `اعلان‌ها (${fa(unread)} خوانده‌نشده)` : "اعلان‌ها"} onClick={toggle} className="relative">
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="num absolute -top-0.5 end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-pomegranate-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
              {fa(Math.min(unread, 9))}{unread > 9 ? "+" : ""}
            </span>
          )}
        </IconButton>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">اعلان‌ها</span>
            {unread > 0 && (
              <button type="button" onClick={() => markAll.mutate(undefined)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <CheckCheck className="size-3.5" /> همه را خواندم
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {data?.items.length ? data.items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.isRead) api.post(`/notifications/read?id=${n.id}`).then(() => qc.invalidateQueries({ queryKey: keys.notifications(ws) }));
                  if (n.link) nav(n.link);
                  close();
                }}
                className="flex w-full gap-3 rounded-md px-2.5 py-2.5 text-start transition hover:bg-sunken"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm">{notifIcon[n.kind] ?? "•"}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-[13px] leading-6", !n.isRead && "font-semibold")}>{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-fg-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-fg-subtle">{relative(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-saffron-500" aria-label="خوانده‌نشده" />}
              </button>
            )) : (
              <div className="px-6 py-10 text-center text-fg-muted">
                <Bell className="mx-auto mb-2 size-6 text-fg-subtle" />
                اعلانی ندارید. وقتی معامله‌ای جابه‌جا شود یا کاری به شما سپرده شود، اینجا می‌بینید.
              </div>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, setTheme, setShortcuts } = useUi();
  const nav = useNavigate();
  const qc = useQueryClient();
  if (!user) return null;
  return (
    <Popover
      align="end"
      className="w-64 p-1.5"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="rounded-full ring-offset-2 ring-offset-surface transition hover:ring-2 hover:ring-line-strong" aria-label="منوی کاربر">
          <Avatar name={user.fullName} color={user.avatarColor} size={32} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.fullName} color={user.avatarColor} size={38} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{user.fullName}</div>
              <div className="truncate text-xs text-fg-subtle" dir="ltr">{user.email}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={theme === "dark" ? <Sun /> : <Moon />} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "حالت روشن" : "حالت تاریک"}
          </MenuItem>
          <MenuItem icon={<Keyboard />} onClick={() => { setShortcuts(true); close(); }} hint={<Kbd>?</Kbd>}>میان‌برهای صفحه‌کلید</MenuItem>
          <MenuItem icon={<Settings />} onClick={() => { nav("/app/settings"); close(); }}>تنظیمات فضای کاری</MenuItem>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={<LogOut />} danger onClick={() => { logout(); qc.clear(); nav("/login"); }}>خروج</MenuItem>
        </div>
      )}
    </Popover>
  );
}

function QuickCreate() {
  const open = useCreate((s) => s.open);
  return (
    <Popover
      align="end"
      className="w-52 p-1.5"
      trigger={({ toggle }) => (
        <Button size="sm" onClick={toggle} icon={<Plus className="size-4" />}>ایجاد</Button>
      )}
    >
      {(close) => (
        <div>
          <MenuItem icon={<Briefcase />} onClick={() => { open("deal"); close(); }} hint={<Kbd>N</Kbd>}>معامله</MenuItem>
          <MenuItem icon={<UserPlus />} onClick={() => { open("contact"); close(); }}>مخاطب</MenuItem>
          <MenuItem icon={<Building2 />} onClick={() => { open("company"); close(); }}>شرکت</MenuItem>
          <MenuItem icon={<ListTodo />} onClick={() => { open("activity"); close(); }}>فعالیت</MenuItem>
        </div>
      )}
    </Popover>
  );
}

export function AppShell() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const { mobileNavOpen, setMobileNav, setPalette } = useUi();
  const location = useLocation();
  useRealtime();
  useGlobalShortcuts();
  useEffect(() => setMobileNav(false), [location.pathname, setMobileNav]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">پرش به محتوا</a>
      {/* Desktop sidebar (right side in RTL) */}
      <aside className={cx("fixed inset-y-0 start-0 z-30 hidden transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-60")}>
        <Sidebar collapsed={collapsed} />
      </aside>
      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-lapis-950/50" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 animate-[slide-in-rtl_240ms_var(--ease-out-quint)] shadow-pop">
            <Sidebar collapsed={false} onNavigate={() => setMobileNav(false)} />
            <IconButton label="بستن منو" onClick={() => setMobileNav(false)} className="absolute end-2 top-3.5 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="size-5" />
            </IconButton>
          </aside>
        </div>
      )}

      <div className={cx("transition-[padding] duration-200", collapsed ? "lg:ps-[68px]" : "lg:ps-60")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
          <IconButton label="باز کردن منو" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu className="size-5" /></IconButton>
          <WorkspaceSwitcher />
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="mx-auto flex h-10 min-w-0 flex-1 max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-fg-subtle transition hover:border-line-strong hover:text-fg-muted"
            aria-label="جستجوی سراسری"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-start">جستجوی مخاطب، شرکت یا معامله…</span>
            <span className="hidden items-center gap-1 sm:flex" dir="ltr"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </button>
          <div className="hidden sm:block"><QuickCreate /></div>
          <NotificationsBell />
          <UserMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <ShortcutsDialog />
      <CreateHost />
    </div>
  );
}
