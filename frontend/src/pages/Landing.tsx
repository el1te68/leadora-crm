import { Link } from "react-router";
import {
  ArrowLeft, BellRing, CalendarDays, Check, Command, Layers, Mail, Radio, ShieldCheck, Sparkles, Workflow,
} from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { Avatar, Button, cx } from "@/components/ui";

const demo = { email: "demo@leadora.ir", password: "Demo1234!" };

function MiniCard({ title, company, value, owner, color, className, days }: { title: string; company: string; value: string; owner: string; color: string; className?: string; days?: string }) {
  return (
    <div className={cx("rounded-[10px] border border-line bg-surface p-3 shadow-card", className)}>
      <div className="text-[12.5px] font-semibold leading-5 text-fg">{title}</div>
      <div className="mt-0.5 text-[11px] text-fg-subtle">{company}</div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="num text-[12px] font-bold text-money">{value}</span>
        <span className="flex items-center gap-1.5">
          {days && <span className="text-[10px] text-fg-subtle">{days}</span>}
          <Avatar name={owner} color={color} size={20} />
        </span>
      </div>
    </div>
  );
}

/** The one orchestrated moment: a saffron thread drawn from a lead to a signed deal. */
function HeroMockup() {
  const cols = [
    { name: "ارزیابی نیاز", color: "#5B6BC0", total: "۸۴۰ میلیون", cards: [
      { t: "پیاده‌سازی CRM", c: "داروسازی مهرآفرین", v: "۳۲۰ میلیون", o: "نگار احمدی", col: "#5E9E6E" },
      { t: "باشگاه مشتریان", c: "سبدینو", v: "۵۲۰ میلیون", o: "کیان مرادی", col: "#E9A23B", d: "۳ روز" },
    ] },
    { name: "ارسال پیشنهاد", color: "#B07CC6", total: "۱٫۲ میلیارد", cards: [
      { t: "لایسنس سالانه", c: "فولاد پارس‌گستر", v: "۹۵۰ میلیون", o: "آرش رحیمی", col: "#C23A55" },
      { t: "پکیج آموزش تیم فروش", c: "دیجی‌ساز", v: "۲۴۰ میلیون", o: "مهسا کریمی", col: "#2B3A9E" },
    ] },
    { name: "مذاکره", color: "#E9A23B", total: "۲٫۴ میلیارد", cards: [
      { t: "قرارداد پشتیبانی ویژه", c: "بیمه‌ی آسایش‌نو", v: "۱٫۸ میلیارد", o: "مهسا کریمی", col: "#2B3A9E" },
    ] },
  ];
  return (
    <div className="girih relative overflow-hidden rounded-2xl bg-lapis-900 p-3 shadow-lift sm:p-5" aria-hidden>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
        <span className="ms-3 rounded-md bg-white/10 px-3 py-1 text-[11px] text-lapis-100">معامله‌ها · فروش سازمانی</span>
      </div>
      <div className="relative rounded-xl bg-canvas p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">پایپ‌لاین فروش</span>
            <span className="rounded-full bg-saffron-50 px-2 py-0.5 text-[11px] font-semibold text-saffron-700">۴٫۴ میلیارد باز</span>
          </div>
          <div className="flex -space-x-1.5 space-x-reverse">
            {["#2B3A9E", "#C23A55", "#5E9E6E", "#E9A23B"].map((c, i) => <span key={c} className="size-6 rounded-full ring-2 ring-canvas" style={{ background: c, zIndex: 4 - i }} />)}
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-2.5">
          {cols.map((col, ci) => (
            <div key={col.name} className="rounded-[12px] bg-sunken/40 p-2">
              <div className="mb-2 px-1">
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold"><span className="h-3 w-1 rounded-full" style={{ background: col.color }} />{col.name}</div>
                <div className="num text-[10.5px] text-fg-subtle">{col.total}</div>
              </div>
              <div className="space-y-2">
                {col.cards.map((c, i) => (
                  <MiniCard key={c.t} title={c.t} company={c.c} value={c.v} owner={c.o} color={c.col} days={c.d}
                    className={cx(ci === 1 && i === 0 && "relative z-10 -rotate-2 shadow-lift ring-2 ring-saffron-400")} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* thread overlay */}
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 600 360" preserveAspectRatio="none">
          <path
            d="M575 70 C 520 200, 430 330, 330 250 S 200 120, 150 260 S 110 330, 60 320"
            fill="none" stroke="#E9A23B" strokeWidth="3" strokeLinecap="round" strokeDasharray="1200"
            style={{ ["--len" as string]: 1200, animation: "draw-thread 2.2s var(--ease-out-quint) 0.4s both" }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="absolute bottom-5 end-6 z-20 rounded-lg border-2 border-pistachio-500 bg-surface px-3 py-1.5 text-[13px] font-extrabold text-pistachio-600 shadow-card"
          style={{ animation: "stamp 500ms var(--ease-out-quint) 2.3s both" }}>
          قرارداد امضا شد ✓
        </div>
      </div>
    </div>
  );
}

function TimelineMock() {
  const items = [
    { i: "📞", t: "تماس پیگیری پیشنهاد", s: "نگار احمدی · ۱۰:۳۰", tone: "bg-sunken" },
    { i: "✎", t: "«مرحله» از ارسال پیشنهاد به مذاکره رفت", s: "آرش رحیمی · دیروز", tone: "bg-lapis-50 dark:bg-lapis-800" },
    { i: "✉", t: "ایمیل فرستاد: پیش‌فاکتور اصلاح‌شده", s: "مهسا کریمی · ۲ روز پیش", tone: "bg-[#E6F4F6] dark:bg-[#0A3A44]" },
  ];
  return (
    <div className="card p-5" aria-hidden>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name="سارا محمدی" color="#7A4FB5" size={44} />
        <div>
          <div className="font-bold">سارا محمدی</div>
          <div className="text-xs text-fg-subtle">مدیر بازرگانی · داروسازی مهرآفرین</div>
        </div>
        <span className="ms-auto rounded-full bg-pistachio-50 px-2.5 py-0.5 text-xs font-medium text-pistachio-700">مشتری</span>
      </div>
      <div className="mb-4 rounded-lg border border-saffron-100 bg-saffron-50/70 px-4 py-3 text-[13px] leading-7 dark:border-saffron-800/40 dark:bg-saffron-800/10">
        از دموی دیروز راضی بودند. پرداخت در دو قسط را پذیرفتند؛ قرارداد تا آخر هفته امضا می‌شود.
      </div>
      <ol className="relative space-y-4 before:absolute before:inset-y-1 before:start-[13px] before:w-px before:bg-line">
        {items.map((x) => (
          <li key={x.t} className="relative flex gap-3">
            <span className={cx("z-10 grid size-7 place-items-center rounded-full text-xs ring-4 ring-surface", x.tone)}>{x.i}</span>
            <div><div className="text-[13px] font-medium">{x.t}</div><div className="text-[11px] text-fg-subtle">{x.s}</div></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReportMock() {
  const bars = [["فروردین", 40], ["اردیبهشت", 55], ["خرداد", 48], ["تیر", 72], ["مرداد", 66], ["شهریور", 90]] as const;
  return (
    <div className="card p-5" aria-hidden>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[13px] text-fg-muted">درآمد برنده‌شده</div>
          <div className="num text-2xl font-extrabold">۱۲٫۸ میلیارد تومان</div>
        </div>
        <span className="rounded-full bg-pistachio-50 px-2 py-0.5 text-xs font-semibold text-pistachio-700">▲ ۲۴٪</span>
      </div>
      <div className="mt-6 flex items-end gap-3">
        {bars.map(([m, h], i) => (
          <div key={m} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative h-32 w-full">
              <div className="absolute inset-x-0 bottom-0 rounded-t-[4px]" style={{ height: `${h}%`, background: i === bars.length - 1 ? "var(--color-saffron-500)" : "var(--chart-1)", opacity: i === bars.length - 1 ? 1 : 0.35 + i * 0.1 }} />
            </div>
            <span className="text-[10.5px] text-fg-subtle">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const extras = [
  { icon: Radio, title: "هم‌زمان با تیم", body: "وقتی همکارتان معامله‌ای را جابه‌جا می‌کند، بورد شما هم همان لحظه به‌روز می‌شود." },
  { icon: Workflow, title: "اتوماسیون ساده", body: "«وقتی معامله به مرحله‌ی پیشنهاد رفت، یک کار پیگیری بساز» — بدون کدنویسی." },
  { icon: Mail, title: "ایمیل از داخل پرونده", body: "ایمیل را از صفحه‌ی مشتری بفرستید؛ خودش در تاریخچه ثبت می‌شود." },
  { icon: Command, title: "جستجو با Ctrl+K", body: "هر مخاطب، شرکت یا معامله با چند حرف پیدا می‌شود." },
  { icon: Layers, title: "فیلدهای سفارشی", body: "هر فیلدی که کسب‌وکارتان لازم دارد اضافه کنید: متن، عدد، تاریخ یا گزینه." },
  { icon: ShieldCheck, title: "فضای کاری و نقش‌ها", body: "مالک، مدیر و عضو؛ داده‌ی هر تیم کاملاً جدا از تیم‌های دیگر." },
  { icon: BellRing, title: "یادآوری و خلاصه‌ی روزانه", body: "قبل از هر تماس یادآوری می‌گیرید و هر صبح خلاصه‌ی کارهای امروز را." },
  { icon: CalendarDays, title: "شمسی و تومان", body: "تقویم شمسی، ارقام فارسی و مبالغ به تومان؛ از اول برای ایران ساخته شده." },
];

const plans = [
  { name: "آغاز", price: "رایگان", unit: "برای همیشه", body: "برای فریلنسرها و تیم‌های تازه‌کار.", features: ["تا ۳ کاربر", "۱ پایپ‌لاین", "۵۰۰ مخاطب", "ورود و خروج CSV"], cta: "شروع رایگان", featured: false },
  { name: "تیم", price: "۴۹۰ هزار", unit: "تومان / کاربر / ماه", body: "برای تیم‌های فروشی که هر روز با مشتری حرف می‌زنند.", features: ["کاربر نامحدود", "پایپ‌لاین و مرحله‌ی نامحدود", "اتوماسیون و یادآوری", "ایمیل از داخل پرونده", "گزارش‌های کامل"], cta: "۱۴ روز رایگان امتحان کنید", featured: true },
  { name: "سازمان", price: "تماس بگیرید", unit: "قیمت توافقی", body: "برای سازمان‌هایی با نیاز امنیتی و نصب اختصاصی.", features: ["نصب روی سرور خودتان", "پشتیبانی اختصاصی", "آموزش حضوری تیم", "قرارداد سطح خدمات"], cta: "گفت‌وگو با فروش", featured: false },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="لیدورا"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-[14px] text-fg-muted md:flex">
            <a href="#features" className="hover:text-fg">امکانات</a>
            <a href="#pricing" className="hover:text-fg">قیمت‌ها</a>
            <a href="#demo" className="hover:text-fg">دموی زنده</a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <Link to="/login" className="hidden h-9 items-center rounded-md px-3 text-[14px] font-medium text-fg-muted hover:text-fg sm:inline-flex">ورود</Link>
            <Link to="/register"><Button size="sm">شروع رایگان</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-20">
        <div style={{ animation: "rise 600ms var(--ease-out-quint) both" }}>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-fg-muted">
            <Sparkles className="size-3.5 text-saffron-600" /> CRM فارسی، ساخته‌شده برای تیم‌های فروش ایرانی
          </p>
          <h1 className="text-[42px] font-black leading-[1.15] tracking-[-0.025em] sm:text-[58px]">
            هر سرنخ،<br />تا امضای قرارداد.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-9 text-fg-muted">
            لیدورا مخاطبین، پایپ‌لاین معامله‌ها، تماس‌ها و گزارش‌های تیم فروش را یک‌جا نگه می‌دارد؛ راست‌به‌چپ، با تقویم شمسی و مبلغ به تومان.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={`/login?demo=1`}><Button size="lg" variant="saffron">ورود به دموی زنده<ArrowLeft className="size-4" /></Button></Link>
            <Link to="/register"><Button size="lg" variant="secondary">ساخت فضای کاری</Button></Link>
          </div>
          <p className="mt-5 text-[13px] text-fg-subtle">
            دمو با داده‌ی واقعی‌نما: ۱۵۰ مخاطب، ۸۰ معامله و ۹۰ روز تاریخچه. بدون نیاز به ثبت‌نام.
          </p>
        </div>
        <HeroMockup />
      </section>

      {/* Features */}
      <section id="features" className="border-t border-line bg-surface py-20">
        <div className="mx-auto max-w-6xl space-y-24 px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">پایپ‌لاینی که با کشیدن و رها کردن جلو می‌رود.</h2>
              <p className="mt-4 max-w-lg text-[16px] leading-8 text-fg-muted">
                معامله را از یک مرحله به مرحله‌ی بعد بکشید؛ مبلغ هر ستون، ارزش وزنی و معامله‌های راکد همیشه جلوی چشم است. می‌توانید چند پایپ‌لاین با مرحله‌های دلخواه داشته باشید.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px]">
                {["هشدار معامله‌ی بدون فعالیت بعد از ۱۴ روز", "ثبت دلیل باخت برای هر معامله‌ی از دست رفته", "نمای لیست برای مرتب‌سازی و فیلتر سریع"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5"><Check className="size-4 text-pistachio-500" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-canvas p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="h-3 w-1 rounded-full bg-[#2B3A9E]" />دموی محصول <span className="num font-normal text-fg-subtle">· ۶</span></div>
                  <MiniCard title="مهاجرت داده‌ها" company="کلود ایران‌زمین" value="۱۸۰ میلیون" owner="ترانه صادقی" color="#7A4FB5" />
                  <MiniCard title="یکپارچه‌سازی با انبار" company="پخش سراسری کیهان" value="۷۲۰ میلیون" owner="آرش رحیمی" color="#C23A55" days="۱۶ روز" className="border-saffron-300" />
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="h-3 w-1 rounded-full bg-[#E9A23B]" />مذاکره <span className="num font-normal text-fg-subtle">· ۴</span></div>
                  <MiniCard title="باشگاه مشتریان" company="هتل‌های آسمان" value="۴۱۰ میلیون" owner="کیان مرادی" color="#E9A23B" className="-rotate-2 shadow-lift" />
                  <div className="grid h-[78px] place-items-center rounded-[10px] border-2 border-dashed border-lapis-200 text-xs text-fg-subtle dark:border-lapis-700">اینجا رها کنید</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="lg:order-2">
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">کل ماجرای هر مشتری، روی یک صفحه.</h2>
              <p className="mt-4 max-w-lg text-[16px] leading-8 text-fg-muted">
                یادداشت‌ها، تماس‌ها، جلسه‌ها، ایمیل‌ها و هر تغییری که کسی در پرونده داده، به ترتیب زمان کنار هم می‌آید. اگر همکارتان مرخصی برود، کار از جایی که بود ادامه پیدا می‌کند.
              </p>
            </div>
            <div className="lg:order-1"><TimelineMock /></div>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">گزارش‌هایی که مدیر فروش هر هفته می‌خواهد.</h2>
              <p className="mt-4 max-w-lg text-[16px] leading-8 text-fg-muted">
                ارزش پایپ‌لاین به تفکیک مرحله، نرخ برد، پیش‌بینی درآمد ماه‌های آینده و فعالیت هر هم‌تیمی؛ با فیلتر بازه‌ی زمانی و مسئول.
              </p>
            </div>
            <ReportMock />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-xl text-[28px] font-extrabold leading-tight tracking-tight">و هر چیز دیگری که یک تیم فروش روزانه لازم دارد</h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((x) => (
              <div key={x.title}>
                <x.icon className="size-5 text-accent" strokeWidth={1.8} />
                <h3 className="mt-3 text-[15px] font-bold">{x.title}</h3>
                <p className="mt-1.5 text-[14px] leading-7 text-fg-muted">{x.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[36px]">قیمت‌ها</h2>
          <p className="mt-2 text-fg-muted">ماهانه یا سالانه؛ هر وقت خواستید، اشتراک را لغو کنید.</p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={cx("relative flex flex-col rounded-xl border p-7",
                p.featured ? "girih border-lapis-700 bg-lapis-900 text-white shadow-lift" : "border-line bg-surface")}>
                {p.featured && <span className="absolute -top-3 start-7 rounded-full bg-saffron-500 px-3 py-0.5 text-xs font-bold text-lapis-950">انتخاب بیشتر تیم‌ها</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={cx("mt-1 text-[13.5px]", p.featured ? "text-lapis-200" : "text-fg-muted")}>{p.body}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="num text-[34px] font-black tracking-tight">{p.price}</span>
                  <span className={cx("text-[13px]", p.featured ? "text-lapis-200" : "text-fg-subtle")}>{p.unit}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-[14px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5"><Check className={cx("size-4", p.featured ? "text-saffron-400" : "text-pistachio-500")} />{f}</li>
                  ))}
                </ul>
                <Link to="/register" className="mt-8">
                  <Button variant={p.featured ? "saffron" : "secondary"} className="w-full" size="lg">{p.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" className="px-4 py-20 sm:px-6">
        <div className="girih mx-auto flex max-w-6xl flex-col items-start gap-8 overflow-hidden rounded-2xl bg-lapis-900 px-7 py-12 text-white sm:px-12 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">دموی زنده را همین حالا ببینید.</h2>
            <p className="mt-3 max-w-xl text-lapis-200">با حساب نمایشی وارد شوید؛ یک فضای کاری پر از مخاطب، معامله و فعالیت منتظر شماست.</p>
          </div>
          <div className="w-full rounded-xl bg-white/8 p-5 ring-1 ring-white/10 lg:w-auto">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
              <dt className="text-lapis-200">ایمیل</dt><dd dir="ltr" className="text-end font-semibold">{demo.email}</dd>
              <dt className="text-lapis-200">رمز عبور</dt><dd dir="ltr" className="text-end font-semibold">{demo.password}</dd>
            </dl>
            <Link to="/login?demo=1" className="mt-4 block"><Button variant="saffron" className="w-full" size="lg">ورود به دمو</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 text-[13px] text-fg-subtle sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p>لیدورا یک پروژه‌ی نمونه‌کار است؛ پرداخت و صورت‌حساب واقعی ندارد.</p>
        </div>
      </footer>
    </div>
  );
}
