using System.ComponentModel.DataAnnotations;
using Leadora.Application.Common;
using Leadora.Application.Deals;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Records;

public sealed record CompanyListItem(
    Guid Id, string Name, string? Domain, string? Industry, string? Size, string? City, string? Phone, string? Address,
    UserRef? Owner, IReadOnlyList<TagDto> Tags, int ContactCount, int OpenDeals, long OpenValue,
    Dictionary<string, string> CustomFields, DateTime CreatedAt, DateTime? LastActivityAt);

public sealed record ContactMini(Guid Id, string FullName, string? JobTitle, string? Email, string? Phone, LifecycleStage Lifecycle);
public sealed record CompanyDetail(CompanyListItem Company, IReadOnlyList<ContactMini> Contacts, IReadOnlyList<DealCard> Deals, long WonValue);

public sealed class CompanyQuery
{
    public string? Q { get; set; }
    public Guid? OwnerId { get; set; }
    public Guid? TagId { get; set; }
    public string? Industry { get; set; }
    public string? City { get; set; }
    public string? Sort { get; set; }
    public string? Dir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed class CompanyRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(120, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    [StringLength(120, ErrorMessage = Msg.TooLong)] public string? Domain { get; init; }
    [StringLength(60, ErrorMessage = Msg.TooLong)] public string? Industry { get; init; }
    [StringLength(30, ErrorMessage = Msg.TooLong)] public string? Size { get; init; }
    [StringLength(60, ErrorMessage = Msg.TooLong)] public string? City { get; init; }
    [StringLength(30, ErrorMessage = Msg.TooLong)] public string? Phone { get; init; }
    [StringLength(250, ErrorMessage = Msg.TooLong)] public string? Address { get; init; }
    public Guid? OwnerId { get; init; }
    public List<Guid>? TagIds { get; init; }
    public Dictionary<string, string>? CustomFields { get; init; }
}

public sealed class CompanyService(IAppDbContext db, RequestContext ctx, ChangeFeed feed, TagService tags, CustomFieldService fields, ContactService contacts)
{
    public async Task<PagedResult<CompanyListItem>> ListAsync(CompanyQuery q, CancellationToken ct)
    {
        var query = Filter(db.Companies.AsNoTracking(), q);
        var total = await query.CountAsync(ct);
        var desc = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        query = (q.Sort ?? "createdAt") switch
        {
            "name" => desc ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name),
            "industry" => desc ? query.OrderByDescending(c => c.Industry) : query.OrderBy(c => c.Industry),
            "city" => desc ? query.OrderByDescending(c => c.City) : query.OrderBy(c => c.City),
            "owner" => desc ? query.OrderByDescending(c => c.Owner!.FullName) : query.OrderBy(c => c.Owner!.FullName),
            "contacts" => desc ? query.OrderByDescending(c => c.Contacts.Count) : query.OrderBy(c => c.Contacts.Count),
            "openValue" => desc
                ? query.OrderByDescending(c => db.Deals.Where(d => d.CompanyId == c.Id && d.Status == DealStatus.Open).Sum(d => d.Value))
                : query.OrderBy(c => db.Deals.Where(d => d.CompanyId == c.Id && d.Status == DealStatus.Open).Sum(d => d.Value)),
            "lastActivityAt" => desc ? query.OrderByDescending(c => c.LastActivityAt) : query.OrderBy(c => c.LastActivityAt),
            _ => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt)
        };
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var rows = await query.Skip((page - 1) * size).Take(size).Include(c => c.Owner).ToListAsync(ct);
        return new PagedResult<CompanyListItem>(await MapManyAsync(rows, ct), total, page, size);
    }

    public async Task<string> ExportAsync(CompanyQuery q, CancellationToken ct)
    {
        var rows = await Filter(db.Companies.AsNoTracking(), q).OrderBy(c => c.Name).Include(c => c.Owner).Take(10_000).ToListAsync(ct);
        return Csv.Write(["name", "domain", "industry", "size", "city", "phone", "owner", "createdAt"],
            rows.Select(c => new[] { c.Name, c.Domain, c.Industry, c.Size, c.City, c.Phone, c.Owner?.FullName, c.CreatedAt.ToString("yyyy-MM-dd") }));
    }

    public async Task<ImportResult> ImportAsync(string csv, CancellationToken ct)
    {
        var rows = Csv.Read(csv);
        var names = (await db.Companies.Select(c => c.Name).ToListAsync(ct)).ToHashSet();
        int created = 0, skipped = 0; var errors = new List<string>();
        var line = 1;
        foreach (var r in rows)
        {
            line++;
            var name = Csv.Pick(r, "name", "company", "نام", "شرکت");
            if (name is null) { errors.Add($"ردیف {Fa.Digits(line.ToString())}: نام شرکت خالی است."); skipped++; continue; }
            if (!names.Add(name)) { skipped++; continue; }
            var c = new Company
            {
                TenantId = ctx.RequireTenant(), Name = name, Domain = Csv.Pick(r, "domain", "وبسایت", "دامنه"),
                Industry = Csv.Pick(r, "industry", "صنعت"), Size = Csv.Pick(r, "size", "اندازه"), City = Csv.Pick(r, "city", "شهر"),
                Phone = Csv.Pick(r, "phone", "تلفن"), OwnerId = ctx.UserId
            };
            db.Companies.Add(c);
            feed.Add(RecordType.Company, c.Id, TimelineKind.Created, "شرکت از فایل CSV وارد شد");
            created++;
        }
        await db.SaveChangesAsync(ct);
        await feed.PublishAsync();
        return new ImportResult(created, skipped, errors.Take(20).ToList());
    }

    public async Task<CompanyDetail> GetAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Companies.AsNoTracking().Include(x => x.Owner).FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("شرکت");
        var item = (await MapManyAsync([c], ct))[0];
        var people = await db.Contacts.AsNoTracking().Where(x => x.CompanyId == id).OrderBy(x => x.FirstName)
            .Select(x => new ContactMini(x.Id, x.FirstName + " " + x.LastName, x.JobTitle, x.Email, x.Phone, x.Lifecycle)).ToListAsync(ct);
        var deals = await DealProjection.Cards(db, db.Deals.Where(d => d.CompanyId == id), tags, ct);
        var won = deals.Where(d => d.Status == DealStatus.Won).Sum(d => d.Value);
        return new CompanyDetail(item, people, deals, won);
    }

    public async Task<CompanyListItem> CreateAsync(CompanyRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        if (req.OwnerId is { } o && !await Members.IsMemberAsync(db, ctx.RequireTenant(), o, ct))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["ownerId"] = ["مسئول باید عضو فضای کاری باشد."] });
        var c = new Company { TenantId = ctx.RequireTenant(), OwnerId = req.OwnerId ?? ctx.UserId };
        Apply(c, req);
        c.CustomFields = await fields.SanitizeAsync(RecordType.Company, req.CustomFields, null, ct);
        db.Companies.Add(c);
        await tags.SetAsync(RecordType.Company, c.Id, req.TagIds, ct);
        feed.Add(RecordType.Company, c.Id, TimelineKind.Created, "شرکت ساخته شد");
        await db.SaveChangesAsync(ct);
        feed.Emit("company.changed", new { id = c.Id });
        await feed.PublishAsync();
        return await ItemAsync(c.Id, ct);
    }

    public async Task<CompanyListItem> UpdateAsync(Guid id, CompanyRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var c = await db.Companies.Include(x => x.Owner).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("شرکت");
        feed.Diff(RecordType.Company, id, "نام", c.Name, req.Name);
        feed.Diff(RecordType.Company, id, "وب‌سایت", c.Domain, req.Domain);
        feed.Diff(RecordType.Company, id, "صنعت", c.Industry, req.Industry);
        feed.Diff(RecordType.Company, id, "اندازه", c.Size, req.Size);
        feed.Diff(RecordType.Company, id, "شهر", c.City, req.City);
        feed.Diff(RecordType.Company, id, "تلفن", c.Phone, req.Phone);
        feed.Diff(RecordType.Company, id, "نشانی", c.Address, req.Address);
        if (c.OwnerId != req.OwnerId && req.OwnerId is { } newOwner)
        {
            if (!await Members.IsMemberAsync(db, ctx.RequireTenant(), newOwner, ct))
                throw new ValidationFailedException(new Dictionary<string, string[]> { ["ownerId"] = ["مسئول باید عضو فضای کاری باشد."] });
            var name = await db.Users.Where(u => u.Id == newOwner).Select(u => u.FullName).FirstAsync(ct);
            feed.Diff(RecordType.Company, id, "مسئول", c.Owner?.FullName, name);
            feed.Notify(newOwner, "شرکتی به شما سپرده شد", c.Name, ChangeFeed.Link(RecordType.Company, id), "assign");
        }
        var custom = await fields.SanitizeAsync(RecordType.Company, req.CustomFields, c.CustomFields, ct);
        await contacts.DiffCustomAsync(RecordType.Company, id, c.CustomFields, custom, ct);
        Apply(c, req);
        c.OwnerId = req.OwnerId;
        c.CustomFields = custom;
        c.UpdatedAt = DateTime.UtcNow;
        await tags.SetAsync(RecordType.Company, id, req.TagIds, ct);
        await db.SaveChangesAsync(ct);
        feed.Emit("company.changed", new { id });
        await feed.PublishAsync();
        return await ItemAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Companies.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("شرکت");
        foreach (var p in await db.Contacts.Where(x => x.CompanyId == id).ToListAsync(ct)) p.CompanyId = null;
        foreach (var d in await db.Deals.Where(x => x.CompanyId == id).ToListAsync(ct)) d.CompanyId = null;
        db.RecordTags.RemoveRange(db.RecordTags.Where(rt => rt.RecordType == RecordType.Company && rt.RecordId == id));
        db.Companies.Remove(c);
        await db.SaveChangesAsync(ct);
        feed.Emit("company.changed", new { id });
        await feed.PublishAsync();
    }

    private async Task<CompanyListItem> ItemAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Companies.AsNoTracking().Include(x => x.Owner).FirstAsync(x => x.Id == id, ct);
        return (await MapManyAsync([c], ct))[0];
    }

    private async Task<List<CompanyListItem>> MapManyAsync(List<Company> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var tagMap = await tags.ForRecordsAsync(RecordType.Company, ids, ct);
        var contactCounts = await db.Contacts.Where(c => c.CompanyId != null && ids.Contains(c.CompanyId.Value))
            .GroupBy(c => c.CompanyId!.Value).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var deals = await db.Deals.Where(d => d.CompanyId != null && ids.Contains(d.CompanyId.Value) && d.Status == DealStatus.Open)
            .GroupBy(d => d.CompanyId!.Value).Select(g => new { g.Key, Count = g.Count(), Sum = g.Sum(d => d.Value) })
            .ToDictionaryAsync(x => x.Key, ct);
        return rows.Select(c => new CompanyListItem(c.Id, c.Name, c.Domain, c.Industry, c.Size, c.City, c.Phone, c.Address, c.Owner.Ref(),
            tagMap.GetValueOrDefault(c.Id) ?? [], contactCounts.GetValueOrDefault(c.Id),
            deals.TryGetValue(c.Id, out var d) ? d.Count : 0, deals.TryGetValue(c.Id, out var d2) ? d2.Sum : 0,
            c.CustomFields, c.CreatedAt, c.LastActivityAt)).ToList();
    }

    private static void Apply(Company c, CompanyRequest r)
    {
        c.Name = r.Name.Trim();
        c.Domain = r.Domain;
        c.Industry = r.Industry;
        c.Size = r.Size;
        c.City = r.City;
        c.Phone = r.Phone;
        c.Address = r.Address;
    }

    private IQueryable<Company> Filter(IQueryable<Company> query, CompanyQuery q)
    {
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(term) || (c.Domain != null && c.Domain.ToLower().Contains(term)));
        }
        if (q.OwnerId is { } owner) query = query.Where(c => c.OwnerId == owner);
        if (!string.IsNullOrWhiteSpace(q.Industry)) query = query.Where(c => c.Industry == q.Industry);
        if (!string.IsNullOrWhiteSpace(q.City)) query = query.Where(c => c.City == q.City);
        if (q.TagId is { } tag)
            query = query.Where(c => db.RecordTags.Any(rt => rt.TagId == tag && rt.RecordType == RecordType.Company && rt.RecordId == c.Id));
        return query;
    }
}
