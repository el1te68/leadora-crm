import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, LogIn, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/shell/Logo";
import { Button, Field, Input, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/store";
import { roleLabel } from "@/lib/format";
import type { AuthResponse, InvitationPreview, Me } from "@/lib/types";

const DEMO = { email: "demo@leadora.ir", password: "Demo1234!" };

function Aside() {
  return (
    <aside className="girih relative hidden flex-col justify-between overflow-hidden bg-lapis-900 p-12 text-white lg:flex">
      <Logo onDark />
      <div>
        <svg viewBox="0 0 400 120" className="mb-8 w-full max-w-sm" aria-hidden>
          <path d="M10 100 C 80 20, 140 110, 210 60 S 330 10, 390 40" fill="none" stroke="#E9A23B" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="600" style={{ ["--len" as string]: 600, animation: "draw-thread 1.8s var(--ease-out-quint) both" }} />
          <circle cx="10" cy="100" r="5" fill="#fff" />
          <circle cx="390" cy="40" r="7" fill="#E9A23B" />
        </svg>
        <p className="max-w-md text-[24px] font-bold leading-[1.7]">
          هیچ پیش‌فاکتوری بی‌پیگیری نمی‌ماند؛ هر تماس، هر ایمیل و هر قدم معامله در پرونده‌ی مشتری ثبت می‌شود.
        </p>
        <p className="mt-4 text-sm text-lapis-200">یادآوری‌ها، خلاصه‌ی روزانه و هشدار معامله‌های راکد، خودکار.</p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        {[["۱۵۰", "مخاطب نمونه"], ["۸۰", "معامله در دو پایپ‌لاین"], ["۹۰", "روز تاریخچه"]].map(([n, l]) => (
          <div key={l} className="rounded-lg bg-white/6 p-3 ring-1 ring-white/10">
            <div className="text-2xl font-extrabold">{n}</div><div className="text-lapis-200">{l}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function Auth({ mode }: { mode: "login" | "register" | "invite" }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { token: inviteToken } = useParams();
  const session = useAuth((s) => s.token);
  const setSession = useAuth((s) => s.setSession);
  const setUser = useAuth((s) => s.setUser);
  const setWorkspace = useAuth((s) => s.setWorkspace);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", workspaceName: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteMode, setInviteMode] = useState<"register" | "login">("register");

  const invite = useQuery({
    queryKey: ["invite", inviteToken],
    queryFn: () => api.get<InvitationPreview>(`/invitations/${inviteToken}`),
    enabled: mode === "invite" && !!inviteToken,
    retry: false,
  });
  useEffect(() => {
    if (invite.data) {
      setForm((f) => ({ ...f, email: invite.data.email }));
      setInviteMode(invite.data.hasAccount ? "login" : "register");
    }
  }, [invite.data]);

  useEffect(() => {
    if (params.get("expired")) toast.message("نشست شما تمام شد؛ دوباره وارد شوید.");
    if (mode === "login" && params.get("demo")) setForm((f) => ({ ...f, ...DEMO }));
  }, [params, mode]);

  const after = (res: AuthResponse) => {
    setSession(res.token, res.user);
    nav(params.get("next") ?? "/app/my-day", { replace: true });
  };

  const submit = async (e: FormEvent, override?: typeof DEMO) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const creds = override ?? form;
      if (mode === "login" || (mode === "invite" && inviteMode === "login")) {
        const res = await api.post<AuthResponse>("/auth/login", { email: creds.email, password: creds.password });
        if (mode === "invite") {
          setSession(res.token, res.user);
          const me = await api.post<Me>(`/invitations/${inviteToken}/accept`);
          setUser(me);
          const ws = me.workspaces.find((w) => w.name === invite.data?.workspaceName);
          if (ws) setWorkspace(ws.id);
          toast.success(`به «${invite.data?.workspaceName}» خوش آمدید.`);
          nav("/app/my-day", { replace: true });
        } else after(res);
      } else {
        const res = await api.post<AuthResponse>("/auth/register", { ...form, inviteToken: mode === "invite" ? inviteToken : undefined });
        if (mode === "invite") {
          const ws = res.user.workspaces[0];
          setSession(res.token, res.user);
          if (ws) setWorkspace(ws.id);
          nav("/app/my-day", { replace: true });
        } else after(res);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "خطای ناشناخته"));
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login" || (mode === "invite" && inviteMode === "login");
  const fe = (f: string) => error?.field(f);

  if (session && mode !== "invite") return <Navigate to="/app/my-day" replace />;

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1fr_1.05fr]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="mb-auto lg:hidden" aria-label="صفحه‌ی اصلی"><Logo /></Link>
        <Link to="/" className="mb-auto hidden text-sm text-fg-subtle hover:text-fg lg:block">بازگشت به صفحه‌ی اصلی</Link>
        <div className="mx-auto w-full max-w-sm py-10">
          {mode === "invite" && (
            <div className="mb-8 rounded-xl border border-line bg-surface-2 p-4">
              {invite.isLoading ? <Skeleton className="h-12" /> : invite.error ? (
                <p className="text-pomegranate-500">{(invite.error as ApiError).message}</p>
              ) : invite.data && (
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><MailOpen className="size-5" /></span>
                  <p className="text-[13.5px] leading-7">
                    <b>{invite.data.invitedBy}</b> شما را به فضای کاری <b>«{invite.data.workspaceName}»</b> با نقش «{roleLabel[invite.data.role]}» دعوت کرده است.
                  </p>
                </div>
              )}
            </div>
          )}
          <h1 className="text-[28px] font-extrabold tracking-tight">
            {isLogin ? (mode === "invite" ? "برای پذیرفتن دعوت وارد شوید" : "ورود به لیدورا") : mode === "invite" ? "ساخت حساب و پیوستن به تیم" : "فضای کاری تیم‌تان را بسازید"}
          </h1>
          <p className="mt-2 text-fg-muted">
            {isLogin ? "ایمیل و رمز عبورتان را وارد کنید." : mode === "invite" ? "چند ثانیه بیشتر طول نمی‌کشد." : "رایگان است و کارت بانکی لازم ندارد."}
          </p>

          {error && !Object.keys(error.errors).length && (
            <div role="alert" className="mt-6 rounded-lg border border-pomegranate-100 bg-pomegranate-50 px-4 py-3 text-[13.5px] text-pomegranate-600 dark:border-pomegranate-700/40 dark:bg-pomegranate-700/20 dark:text-pomegranate-100">
              {error.message}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {!isLogin && (
              <Field label="نام و نام خانوادگی" error={fe("fullName")}>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" invalid={!!fe("fullName")} required />
              </Field>
            )}
            <Field label="ایمیل" error={fe("email")}>
              <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" invalid={!!fe("email")} required
                readOnly={mode === "invite" && !!invite.data} />
            </Field>
            <Field label="رمز عبور" error={fe("password")} hint={!isLogin ? "دست‌کم ۸ کاراکتر" : undefined}>
              <Input dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={isLogin ? "current-password" : "new-password"} invalid={!!fe("password")} required />
            </Field>
            {mode === "register" && (
              <Field label="نام فضای کاری" error={fe("workspaceName")} hint="مثلاً نام شرکت یا تیم فروش">
                <Input value={form.workspaceName} onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} invalid={!!fe("workspaceName")} required />
              </Field>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {isLogin ? (mode === "invite" ? "ورود و پذیرفتن دعوت" : "ورود") : mode === "invite" ? "ساخت حساب و پیوستن" : "ساخت فضای کاری"}
            </Button>
          </form>

          {mode === "login" && (
            <div className="mt-8 rounded-xl border border-saffron-200 bg-saffron-50 p-4 dark:border-saffron-800/50 dark:bg-saffron-800/15">
              <div className="mb-2 text-[13.5px] font-bold text-saffron-800 dark:text-saffron-200">حساب نمایشی</div>
              <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-[13px]">
                {(["email", "password"] as const).map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-fg-muted">{k === "email" ? "ایمیل" : "رمز عبور"}</dt>
                    <dd dir="ltr" className="text-end font-semibold">{DEMO[k]}</dd>
                    <button type="button" aria-label="کپی" className="rounded p-1 text-fg-subtle hover:text-fg" onClick={() => { navigator.clipboard?.writeText(DEMO[k]); toast.success("کپی شد."); }}>
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                ))}
              </dl>
              <Button variant="saffron" className="mt-3 w-full" icon={<LogIn className="size-4" />} loading={busy}
                onClick={(e) => { setForm((f) => ({ ...f, ...DEMO })); submit(e as unknown as FormEvent, DEMO); }}>
                ورود با حساب نمایشی
              </Button>
            </div>
          )}

          <p className="mt-8 text-center text-[13.5px] text-fg-muted">
            {mode === "login" && <>حساب ندارید؟ <Link to="/register" className="font-semibold text-accent hover:underline">فضای کاری بسازید</Link></>}
            {mode === "register" && <>قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login" className="font-semibold text-accent hover:underline">وارد شوید</Link></>}
            {mode === "invite" && (
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setInviteMode(inviteMode === "login" ? "register" : "login")}>
                {inviteMode === "login" ? "حساب ندارم؛ ثبت‌نام می‌کنم" : "حساب دارم؛ وارد می‌شوم"}
              </button>
            )}
          </p>
        </div>
        <div className="mt-auto" />
      </main>
      <Aside />
    </div>
  );
}
