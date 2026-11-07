using System.ComponentModel.DataAnnotations;
using Leadora.Application.Automations;
using Leadora.Application.Common;
using Leadora.Application.Deals;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Records;

public sealed record ContactListItem(
    Guid Id, string FirstName, string LastName, string FullName, string? Email, string? Phone, string? JobTitle,
    string? City, string? Source, LifecycleStage Lifecycle, NamedRef? Company, UserRef? Owner, IReadOnlyList<TagDto> Tags,
    Dictionary<string, string> CustomFields, DateTime CreatedAt, DateTime? LastActivityAt);

public sealed record ContactDetail(ContactListItem Contact, IReadOnlyList<DealCard> Deals, int OpenActivities);

/// <summary>Compact deal used in side panels and Kanban.</summary>
public sealed record DealCard(Guid Id, string Title, long Value, DealStatus Status, Guid PipelineId, Guid StageId, string StageName,
    string StageColor, int Probability, DateOnly? ExpectedCloseDate, UserRef? Owner, NamedRef? Contact, NamedRef? Company,
    double SortOrder, DateTime StageEnteredAt, DateTime UpdatedAt, bool IsStale, IReadOnlyList<TagDto> Tags, int OpenActivities);

public sealed class ContactQuery
{
    public string? Q { get; set; }
    public Guid? OwnerId { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? TagId { get; set; }
    public LifecycleStage? Lifecycle { get; set; }
    public string? Source { get; set; }
    public string? Sort { get; set; }
    public string? Dir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed class ContactRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(60, ErrorMessage = Msg.TooLong)]
    public string FirstName { get; init; } = "";
    [StringLength(60, ErrorMessage = Msg.TooLong)]
    public string LastName { get; init; } = "";
    [EmailAddress(ErrorMessage = Msg.Email), StringLength(120, ErrorMessage = Msg.TooLong)]
    public string? Email { get; init; }
    [StringLength(30, ErrorMessage = Msg.TooLong)]
    public string? Phone { get; init; }
    [StringLength(80, ErrorMessage = Msg.TooLong)]
    public string? JobTitle { get; init; }
    [StringLength(60, ErrorMessage = Msg.TooLong)]
    public string? City { get; init; }
    [StringLength(60, ErrorMessage = Msg.TooLong)]
    public string? Source { get; init; }
    public LifecycleStage Lifecycle { get; init; } = LifecycleStage.Lead;
    public Guid? CompanyId { get; init; }
    public Guid? OwnerId { get; init; }
    public List<Guid>? TagIds { get; init; }
    public Dictionary<string, string>? CustomFields { get; init; }
}

public sealed class ContactService(
    IAppDbContext db, RequestContext ctx, ChangeFeed feed, TagService tags, CustomFieldService fields, AutomationEngine automations)
{
    public async Task<PagedResult<ContactListItem>> ListAsync(ContactQuery q, CancellationToken ct)
    {
        var query = Filter(db.Contacts.AsNoTracking(), q);
        var total = await query.CountAsync(ct);
        var desc = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        query = (q.Sort ?? "createdAt") switch
        {
            "name" => desc ? query.OrderByDescending(c => c.FirstName).ThenByDescending(c => c.LastName) : query.OrderBy(c => c.FirstName).ThenBy(c => c.LastName),
            "email" => desc ? query.OrderByDescending(c => c.Email) : query.OrderBy(c => c.Email),
            "company" => desc ? query.OrderByDescending(c => c.Company!.Name) : query.OrderBy(c => c.Company!.Name),
            "owner" => desc ? query.OrderByDescending(c => c.Owner!.FullName) : query.OrderBy(c => c.Owner!.FullName),
            "lifecycle" => desc ? query.OrderByDescending(c => c.Lifecycle) : query.OrderBy(c => c.Lifecycle),
            "lastActivityAt" => desc ? query.OrderByDescending(c => c.LastActivityAt) : query.OrderBy(c => c.LastActivityAt),
            _ => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt)
        };
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var rows = await query.Skip((page - 1) * size).Take(size).Include(c => c.Company).Include(c => c.Owner).ToListAsync(ct);
        var tagMap = await tags.ForRecordsAsync(RecordType.Contact, rows.Select(r => r.Id).ToList(), ct);
        return new PagedResult<ContactListItem>(rows.Select(r => Map(r, tagMap)).ToList(), total, page, size);
    }

    public async Task<string> ExportAsync(ContactQuery q, CancellationToken ct)
    {
        var rows = await Filter(db.Contacts.AsNoTracking(), q).OrderBy(c => c.FirstName)
            .Include(c => c.Company).Include(c => c.Owner).Take(10_000).ToListAsync(ct);
        return Csv.Write(
            ["firstName", "lastName", "email", "phone", "jobTitle", "city", "company", "lifecycle", "owner", "source", "createdAt"],
            rows.Select(c => new[] { c.FirstName, c.LastName, c.Email, c.Phone, c.JobTitle, c.City, c.Company?.Name,
                Fa.Lifecycle(c.Lifecycle), c.Owner?.FullName, c.Source, c.CreatedAt.ToString("yyyy-MM-dd") }));
    }

    public async Task<ImportResult> ImportAsync(string csv, CancellationToken ct)
    {
        var rows = Csv.Read(csv);
        var created = 0; var skipped = 0; var errors = new List<string>();
        var tenant = ctx.RequireTenant();
        var companies = (await db.Companies.ToListAsync(ct)).GroupBy(c => c.Name).ToDictionary(g => g.Key, g => g.First());
        var emails = (await db.Contacts.Where(c => c.Email != null).Select(c => c.Email!).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var line = 1;
        foreach (var r in rows)
        {
            line++;
            var first = Csv.Pick(r, "firstName", "first name", "نام");
            if (first is null) { errors.Add($"ردیف {Fa.Digits(line.ToString())}: نام خالی است."); skipped++; continue; }
            var mail = Csv.Pick(r, "email", "ایمیل")?.ToLowerInvariant();
            if (mail is not null && !emails.Add(mail)) { skipped++; continue; }

            Guid? companyId = null;
            if (Csv.Pick(r, "company", "شرکت") is { } companyName)
            {
                if (!companies.TryGetValue(companyName, out var co))
                {
                    co = new Company { TenantId = tenant, Name = companyName, OwnerId = ctx.UserId };
                    db.Companies.Add(co);
                    companies[companyName] = co;
                }
                companyId = co.Id;
            }

            var c = new Contact
            {
                TenantId = tenant,
                FirstName = first,
                LastName = Csv.Pick(r, "lastName", "last name", "نام خانوادگی") ?? "",
                Email = mail,
                Phone = Csv.Pick(r, "phone", "تلفن", "موبایل"),
                JobTitle = Csv.Pick(r, "jobTitle", "title", "سمت"),
                City = Csv.Pick(r, "city", "شهر"),
                Source = Csv.Pick(r, "source", "منبع") ?? "ورود از CSV",
                CompanyId = companyId,
                OwnerId = ctx.UserId
            };
            db.Contacts.Add(c);
            feed.Add(RecordType.Contact, c.Id, TimelineKind.Created, "مخاطب از فایل CSV وارد شد");
            created++;
        }
        await db.SaveChangesAsync(ct);
        await feed.PublishAsync();
        return new ImportResult(created, skipped, errors.Take(20).ToList());
    }

    public async Task<ContactDetail> GetAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Contacts.AsNoTracking().Include(x => x.Company).Include(x => x.Owner).FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("مخاطب");
        var tagMap = await tags.ForRecordsAsync(RecordType.Contact, [id], ct);
        var deals = await DealProjection.Cards(db, db.Deals.Where(d => d.ContactId == id), tags, ct);
        var open = await db.Activities.CountAsync(a => a.RecordType == RecordType.Contact && a.RecordId == id && !a.IsDone, ct);
        return new ContactDetail(Map(c, tagMap), deals, open);
    }

    public async Task<ContactListItem> CreateAsync(ContactRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await EnsureRefsAsync(req, ct);
        var c = new Contact { TenantId = ctx.RequireTenant(), OwnerId = req.OwnerId ?? ctx.UserId };
        Apply(c, req);
        c.CustomFields = await fields.SanitizeAsync(RecordType.Contact, req.CustomFields, null, ct);
        db.Contacts.Add(c);
        await tags.SetAsync(RecordType.Contact, c.Id, req.TagIds, ct);
        feed.Add(RecordType.Contact, c.Id, TimelineKind.Created, "مخاطب ساخته شد");
        if (c.OwnerId is { } owner) feed.Notify(owner, "مخاطب جدید به شما سپرده شد", c.FullName, ChangeFeed.Link(RecordType.Contact, c.Id), "assign");
        await automations.RunForContactAsync(AutomationTrigger.ContactCreated, c, ct);
        await db.SaveChangesAsync(ct);
        feed.Emit("contact.changed", new { id = c.Id });
        await feed.PublishAsync();
        return await ItemAsync(c.Id, ct);
    }

    public async Task<ContactListItem> UpdateAsync(Guid id, ContactRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await EnsureRefsAsync(req, ct);
        var c = await db.Contacts.Include(x => x.Company).Include(x => x.Owner).FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("مخاطب");

        // Field-level audit log
        feed.Diff(RecordType.Contact, id, "نام", c.FullName, $"{req.FirstName} {req.LastName}".Trim());
        feed.Diff(RecordType.Contact, id, "ایمیل", c.Email, req.Email);
        feed.Diff(RecordType.Contact, id, "تلفن", c.Phone, req.Phone);
        feed.Diff(RecordType.Contact, id, "سمت", c.JobTitle, req.JobTitle);
        feed.Diff(RecordType.Contact, id, "شهر", c.City, req.City);
        feed.Diff(RecordType.Contact, id, "منبع", c.Source, req.Source);
        feed.Diff(RecordType.Contact, id, "مرحله‌ی چرخه", Fa.Lifecycle(c.Lifecycle), Fa.Lifecycle(req.Lifecycle));
        if (c.CompanyId != req.CompanyId)
            feed.Diff(RecordType.Contact, id, "شرکت", c.Company?.Name,
                req.CompanyId is null ? null : await db.Companies.Where(x => x.Id == req.CompanyId).Select(x => x.Name).FirstAsync(ct));
        if (c.OwnerId != req.OwnerId && req.OwnerId is { } newOwner)
        {
            var name = await db.Users.Where(u => u.Id == newOwner).Select(u => u.FullName).FirstAsync(ct);
            feed.Diff(RecordType.Contact, id, "مسئول", c.Owner?.FullName, name);
            feed.Notify(newOwner, "مخاطبی به شما سپرده شد", c.FullName, ChangeFeed.Link(RecordType.Contact, id), "assign");
        }

        var newCustom = await fields.SanitizeAsync(RecordType.Contact, req.CustomFields, c.CustomFields, ct);
        await DiffCustomAsync(RecordType.Contact, id, c.CustomFields, newCustom, ct);
        Apply(c, req);
        c.OwnerId = req.OwnerId;
        c.CustomFields = newCustom;
        c.UpdatedAt = DateTime.UtcNow;
        await tags.SetAsync(RecordType.Contact, id, req.TagIds, ct);
        await db.SaveChangesAsync(ct);
        feed.Emit("contact.changed", new { id });
        await feed.PublishAsync();
        return await ItemAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Contacts.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("مخاطب");
        foreach (var d in await db.Deals.Where(d => d.ContactId == id).ToListAsync(ct)) d.ContactId = null;
        db.RecordTags.RemoveRange(db.RecordTags.Where(rt => rt.RecordType == RecordType.Contact && rt.RecordId == id));
        db.Contacts.Remove(c);
        await db.SaveChangesAsync(ct);
        feed.Emit("contact.changed", new { id });
        await feed.PublishAsync();
    }

    internal async Task DiffCustomAsync(RecordType type, Guid id, Dictionary<string, string> oldValues, Dictionary<string, string> newValues, CancellationToken ct)
    {
        var defs = await db.CustomFields.AsNoTracking().Where(f => f.EntityType == type).ToListAsync(ct);
        foreach (var d in defs)
            feed.Diff(type, id, d.Label, oldValues.GetValueOrDefault(d.Key), newValues.GetValueOrDefault(d.Key));
    }

    private async Task<ContactListItem> ItemAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Contacts.AsNoTracking().Include(x => x.Company).Include(x => x.Owner).FirstAsync(x => x.Id == id, ct);
        return Map(c, await tags.ForRecordsAsync(RecordType.Contact, [id], ct));
    }

    private async Task EnsureRefsAsync(ContactRequest req, CancellationToken ct)
    {
        if (req.CompanyId is { } co && !await db.Companies.AnyAsync(x => x.Id == co, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["companyId"] = ["شرکت انتخاب‌شده پیدا نشد."] });
        if (req.OwnerId is { } o && !await Members.IsMemberAsync(db, ctx.RequireTenant(), o, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["ownerId"] = ["مسئول باید عضو فضای کاری باشد."] });
    }

    private static void Apply(Contact c, ContactRequest r)
    {
        c.FirstName = r.FirstName.Trim();
        c.LastName = r.LastName.Trim();
        c.Email = string.IsNullOrWhiteSpace(r.Email) ? null : r.Email.Trim().ToLowerInvariant();
        c.Phone = r.Phone;
        c.JobTitle = r.JobTitle;
        c.City = r.City;
        c.Source = r.Source;
        c.Lifecycle = r.Lifecycle;
        c.CompanyId = r.CompanyId;
    }

    private IQueryable<Contact> Filter(IQueryable<Contact> query, ContactQuery q)
    {
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().ToLower();
            // Portable LINQ (no provider-specific functions in this layer).
            query = query.Where(c => (c.FirstName + " " + c.LastName).ToLower().Contains(term)
                                     || (c.Email != null && c.Email.Contains(term))
                                     || (c.Phone != null && c.Phone.Contains(term))
                                     || (c.Company != null && c.Company.Name.ToLower().Contains(term)));
        }
        if (q.OwnerId is { } owner) query = query.Where(c => c.OwnerId == owner);
        if (q.CompanyId is { } company) query = query.Where(c => c.CompanyId == company);
        if (q.Lifecycle is { } lc) query = query.Where(c => c.Lifecycle == lc);
        if (!string.IsNullOrWhiteSpace(q.Source)) query = query.Where(c => c.Source == q.Source);
        if (q.TagId is { } tag)
            query = query.Where(c => db.RecordTags.Any(rt => rt.TagId == tag && rt.RecordType == RecordType.Contact && rt.RecordId == c.Id));
        return query;
    }

    private static ContactListItem Map(Contact c, Dictionary<Guid, List<TagDto>> tagMap) => new(
        c.Id, c.FirstName, c.LastName, c.FullName, c.Email, c.Phone, c.JobTitle, c.City, c.Source, c.Lifecycle,
        c.Company is null ? null : new NamedRef(c.Company.Id, c.Company.Name), c.Owner.Ref(),
        tagMap.GetValueOrDefault(c.Id) ?? [], c.CustomFields, c.CreatedAt, c.LastActivityAt);
}

public static class Members
{
    public static Task<bool> IsMemberAsync(IAppDbContext db, Guid tenantId, Guid userId, CancellationToken ct) =>
        db.Memberships.AnyAsync(m => m.WorkspaceId == tenantId && m.UserId == userId, ct);
}
