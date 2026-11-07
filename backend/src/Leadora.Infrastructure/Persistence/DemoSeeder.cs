using Leadora.Application.Auth;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Infrastructure.Persistence;

/// <summary>
/// Seeds one rich demo workspace (5 teammates, ~150 contacts, ~40 companies, ~80 deals, 90 days of history)
/// plus a tiny second workspace so the workspace switcher has something to switch to.
/// Deterministic: the same data every time.
/// </summary>
public sealed class DemoSeeder(AppDbContext db, IPasswordService passwords)
{
    public const string DemoEmail = "demo@leadora.ir";
    public const string DemoPassword = "Demo1234!";

    private readonly Random _r = new(1405);
    private readonly DateTime _now = DateTime.UtcNow;

    private static readonly (string fa, string en, bool female)[] FirstNames =
    [
        ("علی", "ali", false), ("محمد", "mohammad", false), ("رضا", "reza", false), ("حسین", "hossein", false), ("امیر", "amir", false),
        ("مهدی", "mahdi", false), ("سینا", "sina", false), ("پویا", "pouya", false), ("بهرام", "bahram", false), ("کامران", "kamran", false),
        ("فرهاد", "farhad", false), ("سعید", "saeed", false), ("مجید", "majid", false), ("بابک", "babak", false), ("نیما", "nima", false),
        ("داریوش", "dariush", false), ("هومن", "hooman", false), ("شهاب", "shahab", false), ("میلاد", "milad", false), ("یاسر", "yaser", false),
        ("زهرا", "zahra", true), ("مریم", "maryam", true), ("سارا", "sara", true), ("فاطمه", "fatemeh", true), ("نرگس", "narges", true),
        ("لیلا", "leila", true), ("شیما", "shima", true), ("الهام", "elham", true), ("پریسا", "parisa", true), ("مینا", "mina", true),
        ("آزاده", "azadeh", true), ("ریحانه", "reyhaneh", true), ("سمیرا", "samira", true), ("یلدا", "yalda", true), ("هستی", "hasti", true),
        ("رویا", "roya", true), ("بهاره", "bahareh", true), ("کتایون", "katayoun", true), ("نازنین", "nazanin", true), ("آیدا", "aida", true)
    ];

    private static readonly (string fa, string en)[] LastNames =
    [
        ("محمدی", "mohammadi"), ("حسینی", "hosseini"), ("رضایی", "rezaei"), ("موسوی", "mousavi"), ("جعفری", "jafari"), ("کاظمی", "kazemi"),
        ("نوری", "nouri"), ("قاسمی", "ghasemi"), ("زارعی", "zarei"), ("شریفی", "sharifi"), ("طاهری", "taheri"), ("یزدانی", "yazdani"),
        ("نجفی", "najafi"), ("عباسی", "abbasi"), ("سلطانی", "soltani"), ("فراهانی", "farahani"), ("بهرامی", "bahrami"), ("اکبری", "akbari"),
        ("پاکزاد", "pakzad"), ("ملکی", "maleki"), ("وکیلی", "vakili"), ("شجاعی", "shojaei"), ("دلاوری", "delavari"), ("خسروی", "khosravi"),
        ("نیک‌نام", "niknam"), ("صفوی", "safavi"), ("امینی", "amini"), ("کریمیان", "karimian"), ("توکلی", "tavakoli"), ("رستمی", "rostami")
    ];

    private static readonly (string name, string domain, string industry, string city, string size)[] CompanyData =
    [
        ("فولاد پارس‌گستر", "parsgostar-steel.ir", "صنایع فلزی", "اصفهان", "۲۰۱–۵۰۰"),
        ("داروسازی مهرآفرین", "mehrafarin-pharma.ir", "دارو و سلامت", "تهران", "۵۰۰+"),
        ("دیجی‌ساز", "digisaz.com", "فناوری اطلاعات", "تهران", "۵۱–۲۰۰"),
        ("نوآوران سپهر", "sepehr-tech.ir", "فناوری اطلاعات", "تهران", "۱۱–۵۰"),
        ("صنایع غذایی گلبرگ", "golbarg-food.ir", "صنایع غذایی", "مشهد", "۲۰۱–۵۰۰"),
        ("بیمه‌ی آسایش‌نو", "asayeshno.ir", "بیمه و مالی", "تهران", "۵۰۰+"),
        ("ساختمانی آرمان‌بنا", "armanbana.ir", "ساخت‌وساز", "شیراز", "۵۱–۲۰۰"),
        ("فرش دستباف کاشان‌نگار", "kashannegar.com", "صنایع دستی", "کاشان", "۱۱–۵۰"),
        ("لجستیک ره‌آورد", "rahavard-logistics.ir", "حمل‌ونقل", "بندرعباس", "۲۰۱–۵۰۰"),
        ("آموزشگاه دانش‌پژوه", "daneshpajooh.ir", "آموزش", "تبریز", "۱۱–۵۰"),
        ("کلینیک زیبایی رُزا", "roza-clinic.ir", "دارو و سلامت", "تهران", "۱۱–۵۰"),
        ("فروشگاه‌های زنجیره‌ای سبدینو", "sabadino.ir", "خرده‌فروشی", "تهران", "۵۰۰+"),
        ("نرم‌افزار ابرآوا", "abrava.io", "فناوری اطلاعات", "کرج", "۵۱–۲۰۰"),
        ("پتروشیمی خلیج‌نور", "khalijnoor.ir", "نفت و پتروشیمی", "بوشهر", "۵۰۰+"),
        ("هتل‌های زنجیره‌ای آسمان", "aseman-hotels.ir", "گردشگری", "اصفهان", "۲۰۱–۵۰۰"),
        ("کافه‌رستوران‌های تاک", "taak-cafe.ir", "رستوران و کافه", "تهران", "۵۱–۲۰۰"),
        ("استودیو طراحی خط‌وخال", "khatokhal.studio", "طراحی و تبلیغات", "تهران", "۱–۱۰"),
        ("قطعه‌سازان البرز", "alborz-parts.ir", "خودروسازی", "قزوین", "۲۰۱–۵۰۰"),
        ("مبلمان چوب‌ناب", "choobnab.ir", "مبلمان", "رشت", "۵۱–۲۰۰"),
        ("کشت و صنعت دشت‌سبز", "dashtesabz.ir", "کشاورزی", "کرمانشاه", "۵۱–۲۰۰"),
        ("انتشارات واژه‌نو", "vajehno.ir", "نشر", "تهران", "۱۱–۵۰"),
        ("کلود ایران‌زمین", "iranzamin.cloud", "فناوری اطلاعات", "تهران", "۵۱–۲۰۰"),
        ("پوشاک ماهور", "mahour-wear.ir", "پوشاک", "تهران", "۵۱–۲۰۰"),
        ("لوازم خانگی پارسیان", "parsian-home.ir", "خرده‌فروشی", "تبریز", "۲۰۱–۵۰۰"),
        ("آژانس مسافرتی سفرینه", "safarineh.ir", "گردشگری", "شیراز", "۱۱–۵۰"),
        ("شیرینی‌سرای نوبهار", "nobahar-sweets.ir", "صنایع غذایی", "یزد", "۱۱–۵۰"),
        ("صرافی ارزبان", "arzban.ir", "بیمه و مالی", "تهران", "۱۱–۵۰"),
        ("تجهیزات پزشکی آریا‌طب", "ariateb.ir", "دارو و سلامت", "تهران", "۵۱–۲۰۰"),
        ("پخش سراسری کیهان", "keyhan-pakhsh.ir", "پخش و توزیع", "تهران", "۵۰۰+"),
        ("فناوران آب‌نما", "abnama.ir", "تأسیسات", "اهواز", "۵۱–۲۰۰"),
        ("بازی‌سازی ققنوس", "ghoghnoos.games", "فناوری اطلاعات", "تهران", "۱۱–۵۰"),
        ("کارخانه کاشی سپیدار", "sepidar-tile.ir", "مصالح ساختمانی", "یزد", "۲۰۱–۵۰۰"),
        ("مدرسه‌ی آنلاین یادگار", "yadegar.academy", "آموزش", "مشهد", "۱۱–۵۰"),
        ("چاپ و بسته‌بندی نقش‌آفرین", "naghshafarin.ir", "چاپ و بسته‌بندی", "قم", "۵۱–۲۰۰"),
        ("مشاوران مدیریت راهبرد", "rahbord-consulting.ir", "مشاوره", "تهران", "۱–۱۰"),
        ("گالری نگارستان", "negarestan.gallery", "هنر", "اصفهان", "۱–۱۰"),
        ("زعفران قائنات طلایی", "talaei-saffron.ir", "کشاورزی", "بیرجند", "۵۱–۲۰۰"),
        ("ورزشی پرشین‌فیت", "persianfit.ir", "ورزش", "تهران", "۱۱–۵۰"),
        ("انرژی خورشیدی تابان", "taban-solar.ir", "انرژی", "کرمان", "۵۱–۲۰۰"),
        ("بازرگانی دریای پارس", "daryapars-trade.ir", "بازرگانی", "بندرعباس", "۱۱–۵۰")
    ];

    private static readonly string[] JobTitles =
    [
        "مدیرعامل", "مدیر فروش", "مدیر بازرگانی", "مدیر مالی", "مدیر فناوری اطلاعات", "کارشناس خرید", "مدیر بازاریابی",
        "سرپرست انبار", "مدیر عملیات", "کارشناس ارشد فروش", "مدیر منابع انسانی", "مدیر محصول", "رئیس هیئت‌مدیره", "مسئول دفتر"
    ];

    private static readonly string[] Sources = ["وب‌سایت", "معرفی مشتری", "نمایشگاه", "لینکدین", "تماس ورودی", "کمپین ایمیلی"];

    private static readonly string[] Products =
    [
        "لایسنس سالانه‌ی لیدورا", "پیاده‌سازی CRM", "پکیج آموزش تیم فروش", "قرارداد پشتیبانی ویژه", "یکپارچه‌سازی با انبار",
        "باشگاه مشتریان", "توسعه‌ی ماژول گزارش", "مهاجرت داده‌ها", "پنل پیامکی سازمانی", "مشاوره‌ی فرایند فروش"
    ];

    private static readonly string[] NoteTexts =
    [
        "در جلسه گفتند بودجه‌ی این فصل تصویب شده؛ تصمیم نهایی با هیئت‌مدیره است.",
        "خواستند نمونه‌ی گزارش ماهانه را ببینند. فایل نمونه را فرستادم.",
        "رقیب اصلی‌مان پیشنهاد ارزان‌تری داده ولی پشتیبانی ما برایشان مهم‌تر است.",
        "پیگیری بعد از تعطیلات؛ الان درگیر انبارگردانی هستند.",
        "مدیر فنی‌شان دنبال API و اتصال به نرم‌افزار حسابداری است.",
        "از دموی دیروز راضی بودند. باید پیش‌فاکتور اصلاح‌شده برود.",
        "تماس گرفتم، جواب ندادند. پیامک گذاشتم.",
        "قرار شد قرارداد را حقوقی‌شان تا آخر هفته بررسی کند.",
        "روی تخفیف ۱۰ درصدی پافشاری دارند. با مدیر فروش هماهنگ شود.",
        "مخاطب از نمایشگاه آمده؛ علاقه‌مند به نسخه‌ی تیمی است.",
        "نیاز به آموزش حضوری برای ۱۲ نفر از تیمشان دارند.",
        "پرداخت در دو قسط را پذیرفتند."
    ];

    private static readonly string[] LostReasons =
    [
        "قیمت بالاتر از بودجه", "انتخاب رقیب", "نبود بودجه در این فصل", "عدم پاسخ‌گویی مشتری", "نیاز با محصول تطبیق نداشت"
    ];

    private static readonly string[] CallSubjects =
    [
        "تماس پیگیری پیشنهاد", "تماس معرفی محصول", "هماهنگی زمان دمو", "پیگیری پرداخت", "تماس بررسی نیازها", "پیگیری قرارداد"
    ];

    private static readonly string[] MeetingSubjects =
    [
        "جلسه‌ی دموی آنلاین", "جلسه‌ی حضوری با تیم خرید", "جلسه‌ی مذاکره‌ی قیمت", "کارگاه نیازسنجی", "جلسه‌ی شروع پروژه"
    ];

    private static readonly string[] TaskSubjects =
    [
        "ارسال پیش‌فاکتور", "آماده‌کردن پروپوزال", "ارسال نمونه‌قرارداد", "به‌روزرسانی اطلاعات شرکت", "ارسال کاتالوگ محصولات", "بررسی شرایط پرداخت"
    ];

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(u => u.Email == DemoEmail, ct)) return;

        // ---- People ----
        var hash = passwords.Hash(DemoPassword);
        var team = new List<AppUser>
        {
            new() { Email = DemoEmail, FullName = "مهسا کریمی", JobTitle = "مدیر فروش", AvatarColor = "#2B3A9E", PasswordHash = hash },
            new() { Email = "arash@leadora.ir", FullName = "آرش رحیمی", JobTitle = "سرپرست تیم سازمانی", AvatarColor = "#C23A55", PasswordHash = hash },
            new() { Email = "negar@leadora.ir", FullName = "نگار احمدی", JobTitle = "کارشناس فروش", AvatarColor = "#5E9E6E", PasswordHash = hash },
            new() { Email = "kian@leadora.ir", FullName = "کیان مرادی", JobTitle = "کارشناس توسعه‌ی بازار", AvatarColor = "#E9A23B", PasswordHash = hash },
            new() { Email = "taraneh@leadora.ir", FullName = "ترانه صادقی", JobTitle = "کارشناس موفقیت مشتری", AvatarColor = "#7A4FB5", PasswordHash = hash },
        };
        foreach (var u in team) u.CreatedAt = _now.AddDays(-120);
        db.Users.AddRange(team);

        var ws = new Workspace { Name = "آرتا تجارت", Slug = "arta-demo", Industry = "نرم‌افزار و خدمات B2B", CreatedAt = _now.AddDays(-120) };
        db.Workspaces.Add(ws);
        WorkspaceRole[] roles = [WorkspaceRole.Owner, WorkspaceRole.Admin, WorkspaceRole.Member, WorkspaceRole.Member, WorkspaceRole.Member];
        for (var i = 0; i < team.Count; i++)
            db.Memberships.Add(new Membership { WorkspaceId = ws.Id, UserId = team[i].Id, Role = roles[i], JoinedAt = _now.AddDays(-118 + i) });
        var t = ws.Id;
        _t = t;

        // ---- Metadata ----
        var tags = new[]
        {
            new Tag { TenantId = t, Name = "VIP", Color = "#E9A23B" },
            new Tag { TenantId = t, Name = "پیگیری فوری", Color = "#C23A55" },
            new Tag { TenantId = t, Name = "همکار", Color = "#5E9E6E" },
            new Tag { TenantId = t, Name = "نمایشگاه ۱۴۰۵", Color = "#2B3A9E" },
            new Tag { TenantId = t, Name = "شریک بالقوه", Color = "#7A4FB5" },
        };
        db.Tags.AddRange(tags);

        var cfBirth = new CustomFieldDefinition { TenantId = t, EntityType = RecordType.Contact, Key = "f_birthday", Label = "تاریخ تولد", Type = CustomFieldType.Date, Order = 0 };
        var cfChannel = new CustomFieldDefinition { TenantId = t, EntityType = RecordType.Contact, Key = "f_channel", Label = "کانال ترجیحی", Type = CustomFieldType.Select, Options = ["تلفن", "ایمیل", "واتس‌اپ", "حضوری"], Order = 1 };
        var cfStaff = new CustomFieldDefinition { TenantId = t, EntityType = RecordType.Company, Key = "f_staff", Label = "تعداد کارکنان", Type = CustomFieldType.Number, Order = 0 };
        var cfTool = new CustomFieldDefinition { TenantId = t, EntityType = RecordType.Company, Key = "f_tool", Label = "نرم‌افزار فعلی", Type = CustomFieldType.Text, Order = 1 };
        var cfContract = new CustomFieldDefinition { TenantId = t, EntityType = RecordType.Deal, Key = "f_contract", Label = "نوع قرارداد", Type = CustomFieldType.Select, Options = ["سالانه", "ماهانه", "یک‌باره"], Order = 0 };
        db.CustomFields.AddRange(cfBirth, cfChannel, cfStaff, cfTool, cfContract);

        var sales = new Pipeline { TenantId = t, Name = "فروش سازمانی", Order = 0 };
        var partner = new Pipeline { TenantId = t, Name = "همکاری و نمایندگی", Order = 1 };
        db.Pipelines.AddRange(sales, partner);
        var salesStages = Stages(t, sales.Id, [("سرنخ جدید", 10, "#8C96C9"), ("ارزیابی نیاز", 25, "#5B6BC0"), ("دموی محصول", 40, "#2B3A9E"), ("ارسال پیشنهاد", 60, "#B07CC6"), ("مذاکره", 80, "#E9A23B")]);
        var partnerStages = Stages(t, partner.Id, [("معرفی", 15, "#8C96C9"), ("جلسه‌ی آشنایی", 35, "#2B3A9E"), ("پیش‌نویس قرارداد", 65, "#E9A23B"), ("امضا", 90, "#5E9E6E")]);

        // ---- Companies ----
        var companies = new List<Company>();
        string[] tools = ["اکسل", "دفتر کاغذی", "CRM داخلی", "هیچ‌کدام", "نرم‌افزار حسابداری"];
        foreach (var (name, domain, industry, city, size) in CompanyData)
        {
            var created = Ago(_r.Next(60, 120));
            var c = new Company
            {
                TenantId = t, Name = name, Domain = domain, Industry = industry, City = city, Size = size,
                Phone = $"0{_r.Next(21, 87)}-{_r.Next(3000_0000, 8999_9999)}", OwnerId = Pick(team).Id,
                Address = $"{city}، خیابان {Pick(["ولیعصر", "انقلاب", "آزادی", "شریعتی", "بهار", "فردوسی", "حافظ"])}، پلاک {_r.Next(3, 240)}",
                CreatedAt = created, UpdatedAt = created,
                CustomFields = new() { [cfStaff.Key] = _r.Next(8, 900).ToString(), [cfTool.Key] = Pick(tools) }
            };
            companies.Add(c);
            Event(RecordType.Company, c.Id, TimelineKind.Created, "شرکت ساخته شد", null, c.OwnerId, created);
        }
        db.Companies.AddRange(companies);

        // ---- Contacts ----
        var contacts = new List<Contact>();
        var usedEmails = new HashSet<string>();
        LifecycleStage[] lifeDist = [LifecycleStage.Subscriber, LifecycleStage.Lead, LifecycleStage.Lead, LifecycleStage.Lead, LifecycleStage.Qualified,
            LifecycleStage.Qualified, LifecycleStage.Opportunity, LifecycleStage.Opportunity, LifecycleStage.Customer, LifecycleStage.Customer];
        for (var i = 0; i < 150; i++)
        {
            var fn = Pick(FirstNames);
            var ln = Pick(LastNames);
            var company = i < 120 ? companies[i % companies.Count] : null;
            var mail = $"{fn.en}.{ln.en}@{company?.Domain ?? "gmail.com"}";
            if (!usedEmails.Add(mail)) mail = $"{fn.en}.{ln.en}{i}@{company?.Domain ?? "gmail.com"}";
            var created = Ago(_r.Next(0, 110), _r.Next(0, 23));
            var c = new Contact
            {
                TenantId = t, FirstName = fn.fa, LastName = ln.fa, Email = mail, Phone = $"09{_r.Next(10, 39)}{_r.Next(1000000, 9999999)}",
                JobTitle = Pick(JobTitles), City = company?.City ?? Pick(["تهران", "اصفهان", "مشهد", "شیراز", "تبریز"]),
                Source = Pick(Sources), Lifecycle = Pick(lifeDist), CompanyId = company?.Id, OwnerId = Pick(team).Id,
                CreatedAt = created, UpdatedAt = created,
                CustomFields = new() { [cfChannel.Key] = Pick(cfChannel.Options) }
            };
            if (_r.NextDouble() < 0.4)
                c.CustomFields[cfBirth.Key] = new DateOnly(_r.Next(1965, 2000), _r.Next(1, 13), _r.Next(1, 28)).ToString("yyyy-MM-dd");
            contacts.Add(c);
            Event(RecordType.Contact, c.Id, TimelineKind.Created, "مخاطب ساخته شد", c.Source is null ? null : $"منبع: {c.Source}", c.OwnerId, created);
            if (_r.NextDouble() < 0.3) db.RecordTags.Add(new RecordTag { TenantId = t, TagId = Pick(tags).Id, RecordType = RecordType.Contact, RecordId = c.Id });
        }
        db.Contacts.AddRange(contacts);
        foreach (var c in companies.Where(_ => _r.NextDouble() < 0.35))
            db.RecordTags.Add(new RecordTag { TenantId = t, TagId = Pick(tags).Id, RecordType = RecordType.Company, RecordId = c.Id });

        // ---- Deals with stage history ----
        var deals = new List<Deal>();
        for (var i = 0; i < 80; i++)
        {
            var isPartner = i % 4 == 3;
            var pipe = isPartner ? partner : sales;
            var stages = isPartner ? partnerStages : salesStages;
            var contact = contacts[_r.Next(120)];
            var company = companies.First(c => c.Id == contact.CompanyId);
            var created = Ago(_r.Next(2, 90), _r.Next(0, 20));
            var roll = _r.NextDouble();
            var status = roll < 0.3 ? DealStatus.Won : roll < 0.46 ? DealStatus.Lost : DealStatus.Open;
            var finalStageIdx = status == DealStatus.Won ? stages.Count - 1
                : status == DealStatus.Lost ? _r.Next(0, stages.Count)
                : WeightedStage(stages.Count);
            var value = (long)(Math.Round(_r.Next(2, 250) * (isPartner ? 4.0 : 1.0)) * 10_000_000);
            var owner = company.OwnerId is { } co && _r.NextDouble() < 0.6 ? team.First(u => u.Id == co) : Pick(team);

            var d = new Deal
            {
                TenantId = t,
                Title = isPartner ? $"نمایندگی {company.City} — {company.Name}" : $"{Pick(Products)} — {company.Name}",
                Value = value, PipelineId = pipe.Id, StageId = stages[finalStageIdx].Id, ContactId = contact.Id, CompanyId = company.Id,
                OwnerId = owner.Id, Status = status, CreatedAt = created, SortOrder = i,
                CustomFields = new() { [cfContract.Key] = Pick(cfContract.Options) }
            };

            // Walk the deal through its stages with timestamps between creation and close/now.
            var closeAt = status == DealStatus.Open ? _now : Min(created.AddDays(_r.Next(6, 50)), _now.AddHours(-_r.Next(2, 72)));
            var steps = finalStageIdx;
            var cursor = created;
            Event(RecordType.Deal, d.Id, TimelineKind.Created, "معامله ساخته شد", Fa.Toman(value), owner.Id, created);
            Event(RecordType.Contact, contact.Id, TimelineKind.Created, $"معامله‌ی «{d.Title}» ساخته شد", null, owner.Id, created, new() { ["dealId"] = d.Id.ToString() });
            for (var s = 1; s <= steps; s++)
            {
                var remaining = (closeAt - cursor).TotalHours;
                cursor = cursor.AddHours(Math.Max(1, remaining * _r.Next(20, 70) / 100.0 / Math.Max(1, steps - s + 1)));
                if (cursor > _now) cursor = _now.AddMinutes(-_r.Next(30, 600));
                Event(RecordType.Deal, d.Id, TimelineKind.StageChanged, $"از «{stages[s - 1].Name}» به «{stages[s].Name}» رفت", null, owner.Id, cursor,
                    new() { ["from"] = stages[s - 1].Name, ["to"] = stages[s].Name, ["color"] = stages[s].Color });
            }
            d.StageEnteredAt = cursor;
            d.UpdatedAt = cursor;

            if (status == DealStatus.Won)
            {
                d.ClosedAt = Max(closeAt, cursor.AddHours(2));
                if (d.ClosedAt > _now) d.ClosedAt = _now.AddHours(-1);
                Event(RecordType.Deal, d.Id, TimelineKind.DealWon, "معامله برنده شد 🎉", Fa.Toman(value), owner.Id, d.ClosedAt.Value);
                Event(RecordType.Contact, contact.Id, TimelineKind.DealWon, $"معامله‌ی «{d.Title}» برنده شد", Fa.Toman(value), owner.Id, d.ClosedAt.Value);
                contact.Lifecycle = LifecycleStage.Customer;
            }
            else if (status == DealStatus.Lost)
            {
                d.ClosedAt = Max(closeAt, cursor.AddHours(2));
                if (d.ClosedAt > _now) d.ClosedAt = _now.AddHours(-1);
                d.LostReason = Pick(LostReasons);
                Event(RecordType.Deal, d.Id, TimelineKind.DealLost, "معامله از دست رفت", d.LostReason, owner.Id, d.ClosedAt.Value);
            }
            else
            {
                d.ExpectedCloseDate = DateOnly.FromDateTime(_now.AddDays(_r.Next(-6, 120)));
                // A few deals left to go stale for the stale-deal job and "my day".
                if (_r.NextDouble() < 0.15) d.StageEnteredAt = _now.AddDays(-_r.Next(16, 40));
            }
            if (_r.NextDouble() < 0.25) db.RecordTags.Add(new RecordTag { TenantId = t, TagId = Pick(tags).Id, RecordType = RecordType.Deal, RecordId = d.Id });
            deals.Add(d);
        }
        db.Deals.AddRange(deals);

        // ---- Activities, notes, emails across the 90-day window ----
        foreach (var d in deals)
        {
            var owner = team.First(u => u.Id == d.OwnerId);
            var contact = contacts.First(c => c.Id == d.ContactId);
            var end = d.ClosedAt ?? _now;
            var count = _r.Next(2, 6);
            for (var k = 0; k < count; k++)
            {
                var at = Between(d.CreatedAt, end);
                var type = Pick([ActivityType.Call, ActivityType.Call, ActivityType.Meeting, ActivityType.Task]);
                AddActivity(t, type, owner.Id, RecordType.Deal, d.Id, at, done: true);
            }
            d.LastActivityAt = d.StageEnteredAt < _now.AddDays(-15) && d.Status == DealStatus.Open ? d.StageEnteredAt : end.AddHours(-_r.Next(1, 48));

            if (d.Status == DealStatus.Open)
            {
                // Upcoming / today / overdue work so "my day" is alive for everybody.
                var roll = _r.NextDouble();
                var due = roll < 0.25 ? TodayAt(_r.Next(9, 18)) : roll < 0.4 ? _now.AddDays(-_r.Next(1, 6)).Date.AddHours(7) : _now.AddDays(_r.Next(1, 10)).Date.AddHours(_r.Next(5, 13));
                AddActivity(t, Pick([ActivityType.Call, ActivityType.Meeting, ActivityType.Task]), owner.Id, RecordType.Deal, d.Id, due, done: false);
            }

            for (var k = 0; k < _r.Next(0, 3); k++)
            {
                var at = Between(d.CreatedAt, end);
                var body = Pick(NoteTexts);
                var note = new Note { TenantId = t, AuthorId = owner.Id, RecordType = RecordType.Deal, RecordId = d.Id, Body = body, CreatedAt = at };
                db.Notes.Add(note);
                Event(RecordType.Deal, d.Id, TimelineKind.Note, "یادداشت گذاشت", body, owner.Id, at, new() { ["noteId"] = note.Id.ToString() });
            }

            if (_r.NextDouble() < 0.5 && contact.Email is not null)
            {
                var at = Between(d.CreatedAt, end);
                var subject = Pick(["پیشنهاد قیمت لیدورا", "هماهنگی جلسه‌ی دمو", "پیش‌فاکتور اصلاح‌شده", "نمونه‌قرارداد همکاری", "تشکر بابت جلسه‌ی امروز"]);
                var body = $"{contact.FirstName} عزیز، سلام\n\nهمان‌طور که صحبت کردیم، {subject} را پیوست کرده‌ام. اگر سؤالی بود در خدمتم.\n\nبا احترام";
                var mail = new EmailMessage { TenantId = t, To = contact.Email, Subject = subject, Body = body, SentById = owner.Id, RecordType = RecordType.Contact, RecordId = contact.Id, Delivered = true, CreatedAt = at };
                db.Emails.Add(mail);
                Event(RecordType.Contact, contact.Id, TimelineKind.EmailSent, $"ایمیل فرستاد: {subject}", body, owner.Id, at, new() { ["to"] = contact.Email, ["emailId"] = mail.Id.ToString(), ["delivered"] = "true" });
            }
        }

        // Contact-level calls/notes for contacts without deals
        foreach (var c in contacts.Where(_ => _r.NextDouble() < 0.45))
        {
            var at = Between(c.CreatedAt, _now);
            AddActivity(t, ActivityType.Call, c.OwnerId!.Value, RecordType.Contact, c.Id, at, done: true);
            c.LastActivityAt = at;
            if (_r.NextDouble() < 0.4)
            {
                var body = Pick(NoteTexts);
                var note = new Note { TenantId = t, AuthorId = c.OwnerId!.Value, RecordType = RecordType.Contact, RecordId = c.Id, Body = body, CreatedAt = at.AddMinutes(20) };
                db.Notes.Add(note);
                Event(RecordType.Contact, c.Id, TimelineKind.Note, "یادداشت گذاشت", body, c.OwnerId, at.AddMinutes(20), new() { ["noteId"] = note.Id.ToString() });
            }
        }

        // Guaranteed agenda for the demo user today (first impression on "my day").
        var me = team[0];
        var meDeals = deals.Where(d => d.Status == DealStatus.Open).Take(4).ToList();
        AddActivity(t, ActivityType.Meeting, me.Id, RecordType.Deal, meDeals[0].Id, TodayAt(10, 30), false, "جلسه‌ی دموی آنلاین با تیم خرید", 45);
        AddActivity(t, ActivityType.Call, me.Id, RecordType.Deal, meDeals[1].Id, TodayAt(12), false, "تماس پیگیری پیشنهاد ارسالی");
        AddActivity(t, ActivityType.Task, me.Id, RecordType.Deal, meDeals[2].Id, TodayAt(15), false, "ارسال پیش‌فاکتور اصلاح‌شده");
        AddActivity(t, ActivityType.Task, me.Id, RecordType.Deal, meDeals[3].Id, _now.AddDays(-2).Date.AddHours(8), false, "آماده‌کردن پروپوزال فنی");
        AddActivity(t, ActivityType.Call, me.Id, RecordType.Contact, contacts[3].Id, TodayAt(9), true, "تماس معرفی محصول");

        // ---- Automations ----
        var proposal = salesStages[3];
        db.Automations.AddRange(
            new AutomationRule
            {
                TenantId = t, Name = "پیگیری خودکار پیشنهاد", Trigger = AutomationTrigger.DealStageChanged, PipelineId = sales.Id, StageId = proposal.Id,
                Action = AutomationAction.CreateTask, Config = new() { ["subject"] = "پیگیری پیشنهاد ارسالی", ["dueInDays"] = "2" }, RunCount = 17, LastRunAt = _now.AddDays(-1)
            },
            new AutomationRule
            {
                TenantId = t, Name = "تبریک برد به مسئول", Trigger = AutomationTrigger.DealWon, Action = AutomationAction.SendNotification,
                Config = new() { ["message"] = "تبریک! یک معامله‌ی دیگر برنده شد 🎉" }, RunCount = 24, LastRunAt = _now.AddDays(-3)
            },
            new AutomationRule
            {
                TenantId = t, Name = "تماس معرفی با مخاطب جدید", Trigger = AutomationTrigger.ContactCreated, Action = AutomationAction.CreateTask,
                Config = new() { ["subject"] = "تماس معرفی با مخاطب جدید", ["dueInDays"] = "1" }, RunCount = 41, LastRunAt = _now.AddHours(-20)
            },
            new AutomationRule
            {
                TenantId = t, Name = "معامله‌های بزرگ همکاری به آرش", Trigger = AutomationTrigger.DealCreated, PipelineId = partner.Id,
                Action = AutomationAction.AssignOwner, Config = new() { ["userId"] = team[1].Id.ToString() }, IsActive = false, RunCount = 6, LastRunAt = _now.AddDays(-12)
            });

        // ---- Notifications for the demo user ----
        (string title, string? body, string kind, int hoursAgo, bool read)[] notes =
        [
            ("«" + deals[5].Title + "» به مرحله‌ی مذاکره رفت", null, "stage", 1, false),
            ("آرش رحیمی در یک یادداشت از شما نام برد", deals[9].Title, "mention", 3, false),
            ("معامله‌ی «" + deals.First(d => d.Status == DealStatus.Won).Title + "» برنده شد", Fa.Toman(deals.First(d => d.Status == DealStatus.Won).Value), "won", 20, true),
            ("کار جدید از اتوماسیون", "پیگیری پیشنهاد ارسالی", "task", 26, true),
            ("مخاطب جدید به شما سپرده شد", contacts[7].FullName, "assign", 50, true),
        ];
        foreach (var n in notes)
            db.Notifications.Add(new Notification { TenantId = t, UserId = me.Id, Title = n.title, Body = n.body, Kind = n.kind, Link = "/app/deals", CreatedAt = _now.AddHours(-n.hoursAgo), ReadAt = n.read ? _now.AddHours(-n.hoursAgo + 1) : null });

        // ---- Saved views ----
        db.SavedViews.AddRange(
            new SavedView { TenantId = t, UserId = me.Id, EntityType = RecordType.Contact, Name = "مشتریان VIP", Query = $$"""{"lifecycle":"Customer","tagId":"{{tags[0].Id}}"}""" },
            new SavedView { TenantId = t, UserId = me.Id, EntityType = RecordType.Contact, Name = "سرنخ‌های من", Query = $$"""{"lifecycle":"Lead","ownerId":"{{me.Id}}"}""" },
            new SavedView { TenantId = t, UserId = me.Id, EntityType = RecordType.Company, Name = "فناوری اطلاعات", Query = """{"industry":"فناوری اطلاعات"}""" });

        // ---- A second, tiny workspace for the switcher ----
        var ws2 = new Workspace { Name = "استودیو پرگار", Slug = "pergar-demo", Industry = "طراحی", AccentColor = "#C23A55", CreatedAt = _now.AddDays(-30) };
        db.Workspaces.Add(ws2);
        db.Memberships.Add(new Membership { WorkspaceId = ws2.Id, UserId = me.Id, Role = WorkspaceRole.Admin, JoinedAt = _now.AddDays(-30) });
        db.Memberships.Add(new Membership { WorkspaceId = ws2.Id, UserId = team[4].Id, Role = WorkspaceRole.Owner, JoinedAt = _now.AddDays(-30) });
        WorkspaceFactory.AddDefaults(db, ws2.Id);
        for (var i = 0; i < 6; i++)
        {
            var fn = FirstNames[i * 5]; var ln = LastNames[i * 3];
            db.Contacts.Add(new Contact { TenantId = ws2.Id, FirstName = fn.fa, LastName = ln.fa, Email = $"{fn.en}@pergar.studio", OwnerId = me.Id, Lifecycle = LifecycleStage.Lead, CreatedAt = _now.AddDays(-i * 4) });
        }

        await db.SaveChangesAsync(ct);
    }

    // ---------- helpers ----------

    private List<Stage> Stages(Guid t, Guid pipelineId, (string name, int prob, string color)[] defs)
    {
        var list = defs.Select((s, i) => new Stage { TenantId = t, PipelineId = pipelineId, Name = s.name, Probability = s.prob, Color = s.color, Order = i }).ToList();
        db.Stages.AddRange(list);
        return list;
    }

    private void Event(RecordType type, Guid id, TimelineKind kind, string title, string? body, Guid? actor, DateTime at, Dictionary<string, string>? data = null) =>
        db.Timeline.Add(new TimelineEvent
        {
            TenantId = _t, RecordType = type, RecordId = id, Kind = kind, Title = title,
            Body = body, ActorId = actor, CreatedAt = at, Data = data ?? []
        });

    private Guid _t;

    private void AddActivity(Guid t, ActivityType type, Guid assignee, RecordType rt, Guid rid, DateTime due, bool done, string? subject = null, int? minutes = null)
    {
        subject ??= type switch
        {
            ActivityType.Call => Pick(CallSubjects),
            ActivityType.Meeting => Pick(MeetingSubjects),
            _ => Pick(TaskSubjects)
        };
        var a = new Activity
        {
            TenantId = t, Type = type, Subject = subject, DueAt = due, AssigneeId = assignee, CreatedById = assignee, RecordType = rt, RecordId = rid,
            IsDone = done, DoneAt = done ? due.AddMinutes(_r.Next(5, 90)) : null, CreatedAt = Min(due.AddDays(-_r.Next(1, 4)), _now.AddMinutes(-_r.Next(10, 600))),
            DurationMinutes = minutes ?? (type == ActivityType.Meeting ? 60 : type == ActivityType.Call ? 15 : null),
            ReminderSentAt = done || due < _now ? due : null
        };
        if (a.DoneAt > _now) a.DoneAt = _now.AddMinutes(-5);
        db.Activities.Add(a);
        Event(rt, rid, TimelineKind.ActivityCreated, $"{Fa.Activity(type)}: {subject}", null, assignee, a.CreatedAt,
            new() { ["activityId"] = a.Id.ToString(), ["type"] = type.ToString(), ["dueAt"] = due.ToString("O") });
        if (done)
            Event(rt, rid, TimelineKind.ActivityCompleted, $"{Fa.Activity(type)} انجام شد: {subject}", null, assignee, a.DoneAt!.Value,
                new() { ["activityId"] = a.Id.ToString(), ["type"] = type.ToString() });
    }

    private int WeightedStage(int count)
    {
        // Funnel shape: earlier stages have more open deals.
        var x = _r.NextDouble();
        return Math.Min(count - 1, (int)(Math.Pow(x, 1.4) * count));
    }

    private T Pick<T>(IReadOnlyList<T> items) => items[_r.Next(items.Count)];
    private DateTime Ago(int days, int hours = 0) => _now.AddDays(-days).AddHours(-hours);
    private DateTime Between(DateTime a, DateTime b) => b <= a ? a : a.AddSeconds(_r.NextDouble() * (b - a).TotalSeconds);

    /// <summary>Today at a given Tehran hour, in UTC.</summary>
    private DateTime TodayAt(int tehranHour, int minute = 0)
    {
        var (start, _) = Application.Engagement.ActivityService.TehranDay(_now);
        return start.AddHours(tehranHour).AddMinutes(minute);
    }

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;
    private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;
}
