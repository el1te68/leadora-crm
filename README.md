<div dir="rtl">

# لیدورا (Leadora)

CRM چندمستاجری فارسی برای تیم‌های فروش، با الهام از HubSpot CRM و Pipedrive. رابط کاربری راست‌به‌چپ است، تاریخ‌ها شمسی، ارقام فارسی و مبالغ به تومان.

**پشته:** ‎.NET 10 (Clean Architecture) + EF Core + PostgreSQL + JWT + SignalR / React 19 + TypeScript + Vite + Tailwind v4 + TanStack Query + Zustand + dnd-kit + Recharts / Docker Compose + nginx + MailHog

---

## اجرا با Docker

```bash
cp .env.example .env      # اختیاری؛ همه‌ی مقادیر پیش‌فرض دارند
docker compose up -d --build
```

| سرویس | نشانی |
|---|---|
| اپلیکیشن (لندینگ + پنل) | http://localhost:8080 |
| مستندات API (Scalar) | http://localhost:8080/docs |
| صندوق ایمیل MailHog | http://localhost:8025 |
| سلامت سرویس | http://localhost:8080/health |

در اولین اجرا، API منتظر می‌ماند تا PostgreSQL بالا بیاید. بعد اسکیمای دیتابیس را می‌سازد و داده‌ی نمایشی را وارد می‌کند. این کار چند ثانیه طول می‌کشد.

### حساب‌های نمایشی

| نقش | ایمیل | رمز عبور |
|---|---|---|
| مالک (مهسا کریمی) | `demo@leadora.ir` | `Demo1234!` |
| مدیر (آرش رحیمی) | `arash@leadora.ir` | `Demo1234!` |
| عضو | `negar@leadora.ir` · `kian@leadora.ir` · `taraneh@leadora.ir` | `Demo1234!` |

داده‌ی نمایشی شامل این‌هاست:
- فضای کاری «آرتا تجارت» با ۵ هم‌تیمی
- ۱۵۰ مخاطب و ۴۰ شرکت
- ۸۰ معامله در دو پایپ‌لاین
- فعالیت‌ها، یادداشت‌ها و ایمیل‌ها در بازه‌ی ۹۰ روز گذشته
- ۴ اتوماسیون، فیلدهای سفارشی و نماهای ذخیره‌شده
- یک فضای کاری کوچک دوم («استودیو پرگار») برای امتحان تعویض فضای کاری

برای اینکه تغییرات هم‌زمان (SignalR) را ببینید، اپ را در دو مرورگر با دو حساب مختلف باز کنید و یک معامله را در بورد جابه‌جا کنید.

## اجرا در Visual Studio 2026 (توسعه)

1. فقط دیتابیس و MailHog را بالا بیاورید: `docker compose up -d db mailhog`
2. فایل `backend/Leadora.slnx` را باز کنید و پروژه‌ی `Leadora.Api` را اجرا کنید. پورت آن ‎5080 است و Scalar روی `/docs` در دسترس است.
3. فرانت‌اند را اجرا کنید:
   ```bash
   cd frontend && npm install && npm run dev
   ```
   اپ روی http://localhost:5173 بالا می‌آید و `/api` و `/hubs` به‌طور خودکار به API پروکسی می‌شوند.

بدون بک‌اند هم می‌شود رابط کاربری را دید: `npm run dev:mock` یک API نمایشی داخل خود مرورگر بالا می‌آورد.

## راهبرد دیتابیس (Migration)

- اگر داخل اسمبلی migration وجود داشته باشد، در شروع برنامه `Migrate()` اجرا می‌شود.
- اگر migration نباشد (حالتی که پروژه الان تحویل داده شده)، `EnsureCreated()` اسکیما را از روی مدل می‌سازد. به همین دلیل اولین `docker compose up` بدون هیچ ابزار اضافه‌ای کار می‌کند.
- برای رفتن به migration‌ها:
  ```bash
  cd backend
  dotnet tool install -g dotnet-ef
  dotnet ef migrations add Initial -p src/Leadora.Infrastructure -s src/Leadora.Api
  ```
  از اجرای بعد، برنامه خودش `Migrate()` را اجرا می‌کند. اگر قبلاً دیتابیسی با `EnsureCreated` ساخته‌اید، یک بار volume را پاک کنید: `docker compose down -v`

## معماری

```
backend/src
├─ Leadora.Domain          موجودیت‌ها و enumها (بدون وابستگی)
├─ Leadora.Application     سرویس‌ها، DTOها، اعتبارسنجی DataAnnotations، خطاهای فارسی
│                          فقط به پکیج Microsoft.EntityFrameworkCore وابسته است (بدون API مخصوص Npgsql)
├─ Leadora.Infrastructure  DbContext + فیلتر سراسری tenant، پیکربندی EF/Npgsql، SMTP، جاب‌های پس‌زمینه، داده‌ی نمایشی
└─ Leadora.Api             Minimal API، JWT، SignalR Hub، ProblemDetails، Rate limiting، Health checks، OpenAPI + Scalar
```

**چندمستاجری:**
- هر رکورد `TenantId` دارد و روی همه‌ی آن‌ها یک global query filter به شکل `e.TenantId == CurrentTenantId` اعمال می‌شود.
- شناسه‌ی فضای کاری از هدر `X-Workspace-Id` خوانده می‌شود، ولی فقط بعد از اینکه عضویت کاربرِ داخل JWT در جدول `Memberships` تأیید شد.
- اگر فضای کاری انتخاب نشده باشد، فیلتر با `Guid.Empty` مقایسه می‌کند و هیچ ردیفی برنمی‌گرداند.
- `SaveChanges` هر تلاش برای نوشتن روی ردیفِ فضای کاری دیگر را رد می‌کند.

**جاب‌های پس‌زمینه (HostedService، بدون پکیج پولی):**
- یادآوری کارها: هر دقیقه
- تشخیص معامله‌های راکد: هر ساعت
- خلاصه‌ی روزانه: هر روز بعد از ساعت ۸ صبح تهران

دکمه‌ی «ارسال خلاصه‌ی امروز» در صفحه‌ی گزارش‌ها خلاصه را همان لحظه به MailHog می‌فرستد.

## امکانات

- **ثبت‌نام و فضای کاری:** هر کاربر می‌تواند عضو چند فضای کاری باشد و بین آن‌ها جابه‌جا شود. نقش‌ها: مالک، مدیر، عضو. دعوت با لینک یا ایمیل انجام می‌شود.
- **مخاطبین و شرکت‌ها:**
  - جستجو، فیلتر، مرتب‌سازی ستون‌ها و نماهای ذخیره‌شده
  - فیلدهای سفارشی (متن، عدد، تاریخ، انتخابی)
  - برچسب و مسئول برای هر رکورد
  - ورود و خروج CSV
- **معامله‌ها:**
  - چند پایپ‌لاین با مرحله‌های قابل ویرایش
  - کانبان با drag & drop و به‌روزرسانی خوش‌بینانه (optimistic UI)
  - نمای لیست
  - ثبت برد، یا باخت همراه با دلیل
  - هشدار معامله‌ی راکد
- **فعالیت‌ها:** کار، تماس و جلسه، صفحه‌ی «روز من» و برجسته‌شدن کارهای عقب‌افتاده
- **تاریخچه‌ی یکپارچه:** یادداشت، فعالیت، ایمیل، تغییر مرحله و تغییر تک‌تک فیلدها (audit log)
- **جستجوی سراسری:** با Ctrl+K، به‌علاوه‌ی میان‌برهای صفحه‌کلید (برای دیدن فهرست، `?` را بزنید)
- **بلادرنگ:** به‌روزرسانی بورد و تاریخچه و اعلان‌های درون‌برنامه‌ای با SignalR
- **ایمیل:** ارسال SMTP از داخل پرونده که در MailHog قابل مشاهده است
- **اتوماسیون:** قانون‌های ساده‌ی «وقتی … آنگاه …»
- **گزارش‌ها:** ارزش پایپ‌لاین، نرخ برد، پیش‌بینی درآمد، فعالیت هم‌تیمی‌ها، روند معامله‌ها و دلایل باخت
- **ظاهر:** حالت روشن و تاریک، و واکنش‌گرا تا عرض ۳۷۵ پیکسل

</div>

---

## English summary (for international clients)

**Leadora** is a multi-tenant CRM in the spirit of HubSpot CRM and Pipedrive, with a Persian (RTL) interface.

**Run it**

```bash
docker compose up -d --build
```

| What | Where |
|---|---|
| App | http://localhost:8080 |
| API docs (Scalar) | http://localhost:8080/docs |
| MailHog inbox | http://localhost:8025 |

**Demo login:** `demo@leadora.ir` / `Demo1234!`

**Highlights**

- **Clean Architecture on .NET 10.** EF Core and PostgreSQL are wired with a global tenant query filter. The workspace comes from the `X-Workspace-Id` header and is only accepted after a membership check against the JWT user.
- **API behaviour.** Errors are returned as ProblemDetails with Persian messages. Auth endpoints are rate limited. The API exposes health checks and OpenAPI with Scalar.
- **Real-time and background work.** SignalR pushes board, timeline and notification updates. Plain hosted services handle reminders, stale-deal detection and the daily digest. Email goes over SMTP to MailHog.
- **Frontend.** React 19, strict TypeScript, Tailwind v4 design tokens, light and dark themes, a dnd-kit Kanban with optimistic updates, Recharts reports, a Ctrl+K command palette and a Jalali date picker.
- **First-run database.** The app uses `Migrate()` when the assembly contains migrations and `EnsureCreated()` when it does not, so the first `docker compose up` needs no extra tooling. Demo data is seeded once.
- **UI without a backend.** `npm run dev:mock` serves the frontend against an in-browser demo API.
