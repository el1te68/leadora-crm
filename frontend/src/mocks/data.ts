// In-browser demo dataset (only used with VITE_MOCK=true). Mirrors the backend DemoSeeder closely enough to review the UI.
import type { ActivityType, AutomationAction, AutomationTrigger, CustomFieldType, DealStatus, LifecycleStage, RecordType, TimelineKind, WorkspaceRole } from "@/lib/types";

let seed = 1405;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a));
const pick = <T,>(xs: readonly T[]) => xs[int(0, xs.length)];
export const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = int(0, 16); return (c === "x" ? r : (r & 3) | 8).toString(16); });

const now = Date.now();
const DAY = 86400_000;
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 3600_000).toISOString();
const tehranMidnightUtc = () => { const local = new Date(now + 3.5 * 3600_000); local.setUTCHours(0, 0, 0, 0); return local.getTime() - 3.5 * 3600_000; };
const todayAt = (h: number, m = 0) => new Date(tehranMidnightUtc() + h * 3600_000 + m * 60_000).toISOString();

export interface MUser { id: string; email: string; fullName: string; avatarColor: string; jobTitle: string }
export interface MWorkspace { id: string; name: string; slug: string; industry: string; accentColor: string; currency: string; createdAt: string }
export interface MMember { workspaceId: string; userId: string; role: WorkspaceRole; joinedAt: string }
export interface MTag { id: string; name: string; color: string }
export interface MCompany { id: string; name: string; domain: string; industry: string; city: string; size: string; phone: string; address: string; ownerId: string; customFields: Record<string, string>; createdAt: string; updatedAt: string; lastActivityAt: string | null; tagIds: string[] }
export interface MContact { id: string; firstName: string; lastName: string; email: string; phone: string; jobTitle: string; city: string; source: string; lifecycle: LifecycleStage; companyId: string | null; ownerId: string; customFields: Record<string, string>; createdAt: string; updatedAt: string; lastActivityAt: string | null; tagIds: string[] }
export interface MStage { id: string; pipelineId: string; name: string; order: number; probability: number; color: string }
export interface MPipeline { id: string; name: string; order: number }
export interface MDeal { id: string; title: string; value: number; pipelineId: string; stageId: string; contactId: string | null; companyId: string | null; ownerId: string; probability: number | null; expectedCloseDate: string | null; status: DealStatus; lostReason: string | null; closedAt: string | null; stageEnteredAt: string; sortOrder: number; customFields: Record<string, string>; createdAt: string; updatedAt: string; lastActivityAt: string | null; tagIds: string[] }
export interface MActivity { id: string; type: ActivityType; subject: string; description: string | null; dueAt: string | null; durationMinutes: number | null; assigneeId: string | null; isDone: boolean; doneAt: string | null; recordType: RecordType | null; recordId: string | null; createdAt: string }
export interface MEvent { id: string; recordType: RecordType; recordId: string; kind: TimelineKind; actorId: string | null; title: string; body: string | null; data: Record<string, string>; createdAt: string }
export interface MField { id: string; entityType: RecordType; key: string; label: string; type: CustomFieldType; options: string[]; order: number }
export interface MAutomation { id: string; name: string; trigger: AutomationTrigger; pipelineId: string | null; stageId: string | null; action: AutomationAction; config: Record<string, string>; isActive: boolean; runCount: number; lastRunAt: string | null; createdAt: string }
export interface MNotification { id: string; userId: string; title: string; body: string | null; link: string | null; kind: string; createdAt: string; readAt: string | null }
export interface MView { id: string; userId: string; entityType: RecordType; name: string; query: string }

const firstNames = [["علی", "ali"], ["محمد", "mohammad"], ["رضا", "reza"], ["حسین", "hossein"], ["امیر", "amir"], ["مهدی", "mahdi"], ["سینا", "sina"], ["پویا", "pouya"], ["بهرام", "bahram"], ["کامران", "kamran"], ["فرهاد", "farhad"], ["سعید", "saeed"], ["بابک", "babak"], ["نیما", "nima"], ["هومن", "hooman"], ["میلاد", "milad"], ["زهرا", "zahra"], ["مریم", "maryam"], ["سارا", "sara"], ["فاطمه", "fatemeh"], ["نرگس", "narges"], ["لیلا", "leila"], ["شیما", "shima"], ["الهام", "elham"], ["پریسا", "parisa"], ["مینا", "mina"], ["آزاده", "azadeh"], ["ریحانه", "reyhaneh"], ["سمیرا", "samira"], ["یلدا", "yalda"], ["هستی", "hasti"], ["رویا", "roya"], ["بهاره", "bahareh"], ["نازنین", "nazanin"], ["آیدا", "aida"]] as const;
const lastNames = [["محمدی", "mohammadi"], ["حسینی", "hosseini"], ["رضایی", "rezaei"], ["موسوی", "mousavi"], ["جعفری", "jafari"], ["کاظمی", "kazemi"], ["نوری", "nouri"], ["قاسمی", "ghasemi"], ["زارعی", "zarei"], ["شریفی", "sharifi"], ["طاهری", "taheri"], ["یزدانی", "yazdani"], ["نجفی", "najafi"], ["عباسی", "abbasi"], ["سلطانی", "soltani"], ["فراهانی", "farahani"], ["بهرامی", "bahrami"], ["اکبری", "akbari"], ["پاکزاد", "pakzad"], ["ملکی", "maleki"], ["وکیلی", "vakili"], ["خسروی", "khosravi"], ["صفوی", "safavi"], ["امینی", "amini"], ["توکلی", "tavakoli"], ["رستمی", "rostami"]] as const;
const companyData = [
  ["فولاد پارس‌گستر", "parsgostar-steel.ir", "صنایع فلزی", "اصفهان", "۲۰۱–۵۰۰"], ["داروسازی مهرآفرین", "mehrafarin-pharma.ir", "دارو و سلامت", "تهران", "۵۰۰+"],
  ["دیجی‌ساز", "digisaz.com", "فناوری اطلاعات", "تهران", "۵۱–۲۰۰"], ["نوآوران سپهر", "sepehr-tech.ir", "فناوری اطلاعات", "تهران", "۱۱–۵۰"],
  ["صنایع غذایی گلبرگ", "golbarg-food.ir", "صنایع غذایی", "مشهد", "۲۰۱–۵۰۰"], ["بیمه‌ی آسایش‌نو", "asayeshno.ir", "بیمه و مالی", "تهران", "۵۰۰+"],
  ["ساختمانی آرمان‌بنا", "armanbana.ir", "ساخت‌وساز", "شیراز", "۵۱–۲۰۰"], ["فرش دستباف کاشان‌نگار", "kashannegar.com", "صنایع دستی", "کاشان", "۱۱–۵۰"],
  ["لجستیک ره‌آورد", "rahavard-logistics.ir", "حمل‌ونقل", "بندرعباس", "۲۰۱–۵۰۰"], ["آموزشگاه دانش‌پژوه", "daneshpajooh.ir", "آموزش", "تبریز", "۱۱–۵۰"],
  ["کلینیک زیبایی رُزا", "roza-clinic.ir", "دارو و سلامت", "تهران", "۱۱–۵۰"], ["فروشگاه‌های زنجیره‌ای سبدینو", "sabadino.ir", "خرده‌فروشی", "تهران", "۵۰۰+"],
  ["نرم‌افزار ابرآوا", "abrava.io", "فناوری اطلاعات", "کرج", "۵۱–۲۰۰"], ["پتروشیمی خلیج‌نور", "khalijnoor.ir", "نفت و پتروشیمی", "بوشهر", "۵۰۰+"],
  ["هتل‌های زنجیره‌ای آسمان", "aseman-hotels.ir", "گردشگری", "اصفهان", "۲۰۱–۵۰۰"], ["کافه‌رستوران‌های تاک", "taak-cafe.ir", "رستوران و کافه", "تهران", "۵۱–۲۰۰"],
  ["استودیو طراحی خط‌وخال", "khatokhal.studio", "طراحی و تبلیغات", "تهران", "۱–۱۰"], ["قطعه‌سازان البرز", "alborz-parts.ir", "خودروسازی", "قزوین", "۲۰۱–۵۰۰"],
  ["مبلمان چوب‌ناب", "choobnab.ir", "مبلمان", "رشت", "۵۱–۲۰۰"], ["کشت و صنعت دشت‌سبز", "dashtesabz.ir", "کشاورزی", "کرمانشاه", "۵۱–۲۰۰"],
  ["انتشارات واژه‌نو", "vajehno.ir", "نشر", "تهران", "۱۱–۵۰"], ["کلود ایران‌زمین", "iranzamin.cloud", "فناوری اطلاعات", "تهران", "۵۱–۲۰۰"],
  ["پوشاک ماهور", "mahour-wear.ir", "پوشاک", "تهران", "۵۱–۲۰۰"], ["لوازم خانگی پارسیان", "parsian-home.ir", "خرده‌فروشی", "تبریز", "۲۰۱–۵۰۰"],
  ["آژانس مسافرتی سفرینه", "safarineh.ir", "گردشگری", "شیراز", "۱۱–۵۰"], ["شیرینی‌سرای نوبهار", "nobahar-sweets.ir", "صنایع غذایی", "یزد", "۱۱–۵۰"],
  ["صرافی ارزبان", "arzban.ir", "بیمه و مالی", "تهران", "۱۱–۵۰"], ["تجهیزات پزشکی آریا‌طب", "ariateb.ir", "دارو و سلامت", "تهران", "۵۱–۲۰۰"],
  ["پخش سراسری کیهان", "keyhan-pakhsh.ir", "پخش و توزیع", "تهران", "۵۰۰+"], ["فناوران آب‌نما", "abnama.ir", "تأسیسات", "اهواز", "۵۱–۲۰۰"],
  ["بازی‌سازی ققنوس", "ghoghnoos.games", "فناوری اطلاعات", "تهران", "۱۱–۵۰"], ["کارخانه کاشی سپیدار", "sepidar-tile.ir", "مصالح ساختمانی", "یزد", "۲۰۱–۵۰۰"],
  ["مدرسه‌ی آنلاین یادگار", "yadegar.academy", "آموزش", "مشهد", "۱۱–۵۰"], ["چاپ و بسته‌بندی نقش‌آفرین", "naghshafarin.ir", "چاپ و بسته‌بندی", "قم", "۵۱–۲۰۰"],
  ["مشاوران مدیریت راهبرد", "rahbord-consulting.ir", "مشاوره", "تهران", "۱–۱۰"], ["گالری نگارستان", "negarestan.gallery", "هنر", "اصفهان", "۱–۱۰"],
  ["زعفران قائنات طلایی", "talaei-saffron.ir", "کشاورزی", "بیرجند", "۵۱–۲۰۰"], ["ورزشی پرشین‌فیت", "persianfit.ir", "ورزش", "تهران", "۱۱–۵۰"],
  ["انرژی خورشیدی تابان", "taban-solar.ir", "انرژی", "کرمان", "۵۱–۲۰۰"], ["بازرگانی دریای پارس", "daryapars-trade.ir", "بازرگانی", "بندرعباس", "۱۱–۵۰"],
] as const;
const titles = ["مدیرعامل", "مدیر فروش", "مدیر بازرگانی", "مدیر مالی", "مدیر فناوری اطلاعات", "کارشناس خرید", "مدیر بازاریابی", "مدیر عملیات", "کارشناس ارشد فروش", "مدیر محصول"];
const sources = ["وب‌سایت", "معرفی مشتری", "نمایشگاه", "لینکدین", "تماس ورودی", "کمپین ایمیلی"];
const products = ["لایسنس سالانه‌ی لیدورا", "پیاده‌سازی CRM", "پکیج آموزش تیم فروش", "قرارداد پشتیبانی ویژه", "یکپارچه‌سازی با انبار", "باشگاه مشتریان", "توسعه‌ی ماژول گزارش", "مهاجرت داده‌ها"];
const notes = ["در جلسه گفتند بودجه‌ی این فصل تصویب شده؛ تصمیم نهایی با هیئت‌مدیره است.", "خواستند نمونه‌ی گزارش ماهانه را ببینند. فایل نمونه را فرستادم.", "رقیب اصلی‌مان پیشنهاد ارزان‌تری داده ولی پشتیبانی ما برایشان مهم‌تر است.", "مدیر فنی‌شان دنبال API و اتصال به نرم‌افزار حسابداری است.", "از دموی دیروز راضی بودند. باید پیش‌فاکتور اصلاح‌شده برود.", "قرار شد قرارداد را حقوقی‌شان تا آخر هفته بررسی کند.", "روی تخفیف ۱۰ درصدی پافشاری دارند. با مدیر فروش هماهنگ شود.", "پرداخت در دو قسط را پذیرفتند."];
const lostReasons = ["قیمت بالاتر از بودجه", "انتخاب رقیب", "نبود بودجه در این فصل", "عدم پاسخ‌گویی مشتری", "نیاز با محصول تطبیق نداشت"];
const subjects: Record<ActivityType, string[]> = {
  Call: ["تماس پیگیری پیشنهاد", "تماس معرفی محصول", "هماهنگی زمان دمو", "پیگیری پرداخت", "تماس بررسی نیازها"],
  Meeting: ["جلسه‌ی دموی آنلاین", "جلسه‌ی حضوری با تیم خرید", "جلسه‌ی مذاکره‌ی قیمت", "کارگاه نیازسنجی"],
  Task: ["ارسال پیش‌فاکتور", "آماده‌کردن پروپوزال", "ارسال نمونه‌قرارداد", "ارسال کاتالوگ محصولات"],
};

export const users: MUser[] = [
  { id: uid(), email: "demo@leadora.ir", fullName: "مهسا کریمی", jobTitle: "مدیر فروش", avatarColor: "#2B3A9E" },
  { id: uid(), email: "arash@leadora.ir", fullName: "آرش رحیمی", jobTitle: "سرپرست تیم سازمانی", avatarColor: "#C23A55" },
  { id: uid(), email: "negar@leadora.ir", fullName: "نگار احمدی", jobTitle: "کارشناس فروش", avatarColor: "#5E9E6E" },
  { id: uid(), email: "kian@leadora.ir", fullName: "کیان مرادی", jobTitle: "کارشناس توسعه‌ی بازار", avatarColor: "#E9A23B" },
  { id: uid(), email: "taraneh@leadora.ir", fullName: "ترانه صادقی", jobTitle: "کارشناس موفقیت مشتری", avatarColor: "#7A4FB5" },
];
export const me = users[0];
export const workspaces: MWorkspace[] = [
  { id: uid(), name: "آرتا تجارت", slug: "arta-demo", industry: "نرم‌افزار و خدمات B2B", accentColor: "#2B3A9E", currency: "IRT", createdAt: ago(120) },
  { id: uid(), name: "استودیو پرگار", slug: "pergar-demo", industry: "طراحی", accentColor: "#C23A55", currency: "IRT", createdAt: ago(30) },
];
const roles: WorkspaceRole[] = ["Owner", "Admin", "Member", "Member", "Member"];
export const members: MMember[] = [
  ...users.map((u, i) => ({ workspaceId: workspaces[0].id, userId: u.id, role: roles[i], joinedAt: ago(118 - i) })),
  { workspaceId: workspaces[1].id, userId: me.id, role: "Admin" as WorkspaceRole, joinedAt: ago(30) },
];

export const tags: MTag[] = [
  { id: uid(), name: "VIP", color: "#E9A23B" }, { id: uid(), name: "پیگیری فوری", color: "#C23A55" }, { id: uid(), name: "همکار", color: "#5E9E6E" },
  { id: uid(), name: "نمایشگاه ۱۴۰۵", color: "#2B3A9E" }, { id: uid(), name: "شریک بالقوه", color: "#7A4FB5" },
];
export const fields: MField[] = [
  { id: uid(), entityType: "Contact", key: "f_birthday", label: "تاریخ تولد", type: "Date", options: [], order: 0 },
  { id: uid(), entityType: "Contact", key: "f_channel", label: "کانال ترجیحی", type: "Select", options: ["تلفن", "ایمیل", "واتس‌اپ", "حضوری"], order: 1 },
  { id: uid(), entityType: "Company", key: "f_staff", label: "تعداد کارکنان", type: "Number", options: [], order: 0 },
  { id: uid(), entityType: "Company", key: "f_tool", label: "نرم‌افزار فعلی", type: "Text", options: [], order: 1 },
  { id: uid(), entityType: "Deal", key: "f_contract", label: "نوع قرارداد", type: "Select", options: ["سالانه", "ماهانه", "یک‌باره"], order: 0 },
];

export const pipelines: MPipeline[] = [{ id: uid(), name: "فروش سازمانی", order: 0 }, { id: uid(), name: "همکاری و نمایندگی", order: 1 }];
const mkStages = (p: MPipeline, defs: [string, number, string][]) => defs.map(([name, probability, color], i) => ({ id: uid(), pipelineId: p.id, name, probability, color, order: i }));
export const stages: MStage[] = [
  ...mkStages(pipelines[0], [["سرنخ جدید", 10, "#8C96C9"], ["ارزیابی نیاز", 25, "#5B6BC0"], ["دموی محصول", 40, "#2B3A9E"], ["ارسال پیشنهاد", 60, "#B07CC6"], ["مذاکره", 80, "#E9A23B"]]),
  ...mkStages(pipelines[1], [["معرفی", 15, "#8C96C9"], ["جلسه‌ی آشنایی", 35, "#2B3A9E"], ["پیش‌نویس قرارداد", 65, "#E9A23B"], ["امضا", 90, "#5E9E6E"]]),
];

export const events: MEvent[] = [];
const ev = (recordType: RecordType, recordId: string, kind: TimelineKind, title: string, actorId: string | null, createdAt: string, body: string | null = null, data: Record<string, string> = {}) =>
  events.push({ id: uid(), recordType, recordId, kind, title, body, data, actorId, createdAt });

export const companies: MCompany[] = companyData.map(([name, domain, industry, city, size]) => {
  const created = ago(int(60, 120));
  const c: MCompany = { id: uid(), name, domain, industry, city, size, phone: `0${int(21, 87)}-${int(30000000, 89999999)}`, address: `${city}، خیابان ${pick(["ولیعصر", "انقلاب", "آزادی", "شریعتی", "بهار"])}، پلاک ${int(3, 240)}`,
    ownerId: pick(users).id, customFields: { f_staff: String(int(8, 900)), f_tool: pick(["اکسل", "دفتر کاغذی", "CRM داخلی", "هیچ‌کدام"]) }, createdAt: created, updatedAt: created, lastActivityAt: null,
    tagIds: rnd() < 0.35 ? [pick(tags).id] : [] };
  ev("Company", c.id, "Created", "شرکت ساخته شد", c.ownerId, created);
  return c;
});

const lifeDist: LifecycleStage[] = ["Subscriber", "Lead", "Lead", "Lead", "Qualified", "Qualified", "Opportunity", "Opportunity", "Customer", "Customer"];
export const contacts: MContact[] = Array.from({ length: 150 }, (_, i) => {
  const [ff, fe] = pick(firstNames); const [lf, le] = pick(lastNames);
  const company = i < 120 ? companies[i % companies.length] : null;
  const created = ago(int(0, 110), int(0, 23));
  const c: MContact = { id: uid(), firstName: ff, lastName: lf, email: `${fe}.${le}${i}@${company?.domain ?? "gmail.com"}`, phone: `09${int(10, 39)}${int(1000000, 9999999)}`,
    jobTitle: pick(titles), city: company?.city ?? "تهران", source: pick(sources), lifecycle: pick(lifeDist), companyId: company?.id ?? null, ownerId: pick(users).id,
    customFields: { f_channel: pick(["تلفن", "ایمیل", "واتس‌اپ", "حضوری"]) }, createdAt: created, updatedAt: created, lastActivityAt: null, tagIds: rnd() < 0.3 ? [pick(tags).id] : [] };
  ev("Contact", c.id, "Created", "مخاطب ساخته شد", c.ownerId, created, `منبع: ${c.source}`);
  return c;
});

export const activities: MActivity[] = [];
const act = (type: ActivityType, assigneeId: string, recordType: RecordType, recordId: string, due: string, done: boolean, subject = pick(subjects[type])) => {
  const createdAt = new Date(Math.min(new Date(due).getTime() - int(1, 4) * DAY, now - 600_000)).toISOString();
  const doneAt = done ? new Date(Math.min(new Date(due).getTime() + int(5, 90) * 60_000, now - 300_000)).toISOString() : null;
  activities.push({ id: uid(), type, subject, description: null, dueAt: due, durationMinutes: type === "Meeting" ? 60 : type === "Call" ? 15 : null, assigneeId, isDone: done, doneAt, recordType, recordId, createdAt });
  const label = type === "Call" ? "تماس" : type === "Meeting" ? "جلسه" : "کار";
  ev(recordType, recordId, "ActivityCreated", `${label}: ${subject}`, assigneeId, createdAt, null, { type });
  if (done && doneAt) ev(recordType, recordId, "ActivityCompleted", `${label} انجام شد: ${subject}`, assigneeId, doneAt, null, { type });
};

export const deals: MDeal[] = Array.from({ length: 80 }, (_, i) => {
  const partner = i % 4 === 3;
  const pipe = partner ? pipelines[1] : pipelines[0];
  const st = stages.filter((s) => s.pipelineId === pipe.id);
  const contact = contacts[int(0, 120)];
  const company = companies.find((c) => c.id === contact.companyId)!;
  const createdMs = now - int(2, 90) * DAY - int(0, 20) * 3600_000;
  const r = rnd();
  const status: DealStatus = r < 0.3 ? "Won" : r < 0.46 ? "Lost" : "Open";
  const finalIdx = status === "Won" ? st.length - 1 : status === "Lost" ? int(0, st.length) : Math.min(st.length - 1, Math.floor(Math.pow(rnd(), 1.4) * st.length));
  const value = Math.round(int(2, 250) * (partner ? 4 : 1)) * 10_000_000;
  const owner = rnd() < 0.6 ? users.find((u) => u.id === company.ownerId)! : pick(users);
  const d: MDeal = { id: uid(), title: partner ? `نمایندگی ${company.city} — ${company.name}` : `${pick(products)} — ${company.name}`, value, pipelineId: pipe.id, stageId: st[finalIdx].id,
    contactId: contact.id, companyId: company.id, ownerId: owner.id, probability: null, expectedCloseDate: null, status, lostReason: null, closedAt: null,
    stageEnteredAt: "", sortOrder: i, customFields: { f_contract: pick(["سالانه", "ماهانه", "یک‌باره"]) }, createdAt: new Date(createdMs).toISOString(), updatedAt: "", lastActivityAt: null,
    tagIds: rnd() < 0.25 ? [pick(tags).id] : [] };
  const closeMs = status === "Open" ? now : Math.min(createdMs + int(6, 50) * DAY, now - int(2, 72) * 3600_000);
  ev("Deal", d.id, "Created", "معامله ساخته شد", owner.id, d.createdAt);
  let cursor = createdMs;
  for (let s = 1; s <= finalIdx; s++) {
    cursor = Math.min(cursor + Math.max(3600_000, ((closeMs - cursor) * int(20, 70)) / 100 / Math.max(1, finalIdx - s + 1)), now - int(30, 600) * 60_000);
    ev("Deal", d.id, "StageChanged", `از «${st[s - 1].name}» به «${st[s].name}» رفت`, owner.id, new Date(cursor).toISOString(), null, { from: st[s - 1].name, to: st[s].name, color: st[s].color });
  }
  d.stageEnteredAt = new Date(cursor).toISOString();
  d.updatedAt = d.stageEnteredAt;
  if (status !== "Open") {
    d.closedAt = new Date(Math.min(Math.max(closeMs, cursor + 7200_000), now - 3600_000)).toISOString();
    if (status === "Won") { ev("Deal", d.id, "DealWon", "معامله برنده شد 🎉", owner.id, d.closedAt); contact.lifecycle = "Customer"; }
    else { d.lostReason = pick(lostReasons); ev("Deal", d.id, "DealLost", "معامله از دست رفت", owner.id, d.closedAt, d.lostReason); }
  } else {
    d.expectedCloseDate = new Date(now + int(-6, 120) * DAY).toISOString().slice(0, 10);
    if (rnd() < 0.15) d.stageEnteredAt = ago(int(16, 40));
  }
  const end = d.closedAt ? new Date(d.closedAt).getTime() : now;
  for (let k = 0; k < int(2, 6); k++) act(pick(["Call", "Call", "Meeting", "Task"] as ActivityType[]), owner.id, "Deal", d.id, new Date(createdMs + rnd() * (end - createdMs)).toISOString(), true);
  for (let k = 0; k < int(0, 3); k++) ev("Deal", d.id, "Note", "یادداشت گذاشت", owner.id, new Date(createdMs + rnd() * (end - createdMs)).toISOString(), pick(notes));
  if (status === "Open") {
    const rr = rnd();
    const due = rr < 0.25 ? todayAt(int(9, 18)) : rr < 0.4 ? new Date(tehranMidnightUtc() - int(1, 6) * DAY + 10 * 3600_000).toISOString() : new Date(tehranMidnightUtc() + int(1, 10) * DAY + int(9, 16) * 3600_000).toISOString();
    act(pick(["Call", "Meeting", "Task"] as ActivityType[]), owner.id, "Deal", d.id, due, false);
  }
  if (rnd() < 0.5) {
    const subject = pick(["پیشنهاد قیمت لیدورا", "هماهنگی جلسه‌ی دمو", "پیش‌فاکتور اصلاح‌شده", "تشکر بابت جلسه‌ی امروز"]);
    ev("Contact", contact.id, "EmailSent", `ایمیل فرستاد: ${subject}`, owner.id, new Date(createdMs + rnd() * (end - createdMs)).toISOString(),
      `${contact.firstName} عزیز، سلام\n\nهمان‌طور که صحبت کردیم، ${subject} را پیوست کرده‌ام. اگر سؤالی بود در خدمتم.\n\nبا احترام`, { to: contact.email, delivered: "true" });
  }
  d.lastActivityAt = new Date(end - int(1, 48) * 3600_000).toISOString();
  return d;
});

for (const c of contacts) if (rnd() < 0.45) {
  const at = new Date(new Date(c.createdAt).getTime() + rnd() * (now - new Date(c.createdAt).getTime())).toISOString();
  act("Call", c.ownerId, "Contact", c.id, at, true);
  c.lastActivityAt = at;
  if (rnd() < 0.4) ev("Contact", c.id, "Note", "یادداشت گذاشت", c.ownerId, at, pick(notes));
}
const open4 = deals.filter((d) => d.status === "Open").slice(0, 4);
act("Meeting", me.id, "Deal", open4[0].id, todayAt(10, 30), false, "جلسه‌ی دموی آنلاین با تیم خرید");
act("Call", me.id, "Deal", open4[1].id, todayAt(12), false, "تماس پیگیری پیشنهاد ارسالی");
act("Task", me.id, "Deal", open4[2].id, todayAt(15), false, "ارسال پیش‌فاکتور اصلاح‌شده");
act("Task", me.id, "Deal", open4[3].id, new Date(tehranMidnightUtc() - 2 * DAY + 11 * 3600_000).toISOString(), false, "آماده‌کردن پروپوزال فنی");
act("Call", me.id, "Contact", contacts[3].id, todayAt(9), true, "تماس معرفی محصول");
for (const d of deals.slice(0, 18)) if (d.status === "Open") d.ownerId = me.id;

export const automations: MAutomation[] = [
  { id: uid(), name: "پیگیری خودکار پیشنهاد", trigger: "DealStageChanged", pipelineId: pipelines[0].id, stageId: stages[3].id, action: "CreateTask", config: { subject: "پیگیری پیشنهاد ارسالی", dueInDays: "2" }, isActive: true, runCount: 17, lastRunAt: ago(1), createdAt: ago(80) },
  { id: uid(), name: "تبریک برد به مسئول", trigger: "DealWon", pipelineId: null, stageId: null, action: "SendNotification", config: { message: "تبریک! یک معامله‌ی دیگر برنده شد 🎉" }, isActive: true, runCount: 24, lastRunAt: ago(3), createdAt: ago(80) },
  { id: uid(), name: "تماس معرفی با مخاطب جدید", trigger: "ContactCreated", pipelineId: null, stageId: null, action: "CreateTask", config: { subject: "تماس معرفی با مخاطب جدید", dueInDays: "1" }, isActive: true, runCount: 41, lastRunAt: ago(0, 20), createdAt: ago(70) },
  { id: uid(), name: "معامله‌های همکاری به آرش", trigger: "DealCreated", pipelineId: pipelines[1].id, stageId: null, action: "AssignOwner", config: { userId: users[1].id }, isActive: false, runCount: 6, lastRunAt: ago(12), createdAt: ago(60) },
];

export const notifications: MNotification[] = [
  { id: uid(), userId: me.id, title: `«${deals[5].title}» به مرحله‌ی مذاکره رفت`, body: null, link: `/app/deals/${deals[5].id}`, kind: "stage", createdAt: ago(0, 1), readAt: null },
  { id: uid(), userId: me.id, title: "آرش رحیمی در یک یادداشت از شما نام برد", body: deals[9].title, link: `/app/deals/${deals[9].id}`, kind: "mention", createdAt: ago(0, 3), readAt: null },
  { id: uid(), userId: me.id, title: "یادآوری: جلسه «جلسه‌ی دموی آنلاین با تیم خرید»", body: "کمتر از ۱۵ دقیقه‌ی دیگر.", link: "/app/my-day", kind: "reminder", createdAt: ago(0, 5), readAt: null },
  { id: uid(), userId: me.id, title: "کار جدید از اتوماسیون", body: "پیگیری پیشنهاد ارسالی", link: "/app/activities", kind: "task", createdAt: ago(1, 2), readAt: ago(1) },
  { id: uid(), userId: me.id, title: "مخاطب جدید به شما سپرده شد", body: `${contacts[7].firstName} ${contacts[7].lastName}`, link: `/app/contacts/${contacts[7].id}`, kind: "assign", createdAt: ago(2), readAt: ago(2) },
];
export const views: MView[] = [
  { id: uid(), userId: me.id, entityType: "Contact", name: "مشتریان VIP", query: JSON.stringify({ lifecycle: "Customer", tagId: tags[0].id }) },
  { id: uid(), userId: me.id, entityType: "Contact", name: "سرنخ‌های من", query: JSON.stringify({ lifecycle: "Lead", ownerId: me.id }) },
  { id: uid(), userId: me.id, entityType: "Company", name: "فناوری اطلاعات", query: JSON.stringify({ industry: "فناوری اطلاعات" }) },
];
