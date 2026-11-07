using System.ComponentModel.DataAnnotations;
using Leadora.Application.Automations;
using Leadora.Application.Common;
using Leadora.Application.Records;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Deals;

public sealed record StageDto(Guid Id, string Name, int Order, int Probability, string Color);
public sealed record PipelineDto(Guid Id, string Name, int Order, IReadOnlyList<StageDto> Stages, int OpenDeals, long OpenValue);
public sealed record BoardColumn(StageDto Stage, IReadOnlyList<DealCard> Deals, long TotalValue, long WeightedValue);
public sealed record BoardDto(PipelineDto Pipeline, IReadOnlyList<BoardColumn> Columns, long WonThisMonth, int WonCountThisMonth);
public sealed record DealDetail(DealCard Deal, string? LostReason, DateTime? ClosedAt, DateTime CreatedAt, Dictionary<string, string> CustomFields,
    IReadOnlyList<StageDto> Stages, string PipelineName, ContactMini? ContactInfo);

public sealed class DealQuery
{
    public Guid? PipelineId { get; set; }
    public DealStatus? Status { get; set; }
    public Guid? OwnerId { get; set; }
    public Guid? StageId { get; set; }
    public string? Q { get; set; }
    public string? Sort { get; set; }
    public string? Dir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed class DealRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(140, ErrorMessage = Msg.TooLong)]
    public string Title { get; init; } = "";
    [Range(0, 1_000_000_000_000_000, ErrorMessage = Msg.Range)]
    public long Value { get; init; }
    public Guid PipelineId { get; init; }
    public Guid StageId { get; init; }
    public Guid? ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? OwnerId { get; init; }
    [Range(0, 100, ErrorMessage = Msg.Range)]
    public int? Probability { get; init; }
    public DateOnly? ExpectedCloseDate { get; init; }
    public List<Guid>? TagIds { get; init; }
    public Dictionary<string, string>? CustomFields { get; init; }
}

public sealed record MoveDealRequest(Guid StageId, double? SortOrder);
public sealed class LoseDealRequest
{
    [Required(ErrorMessage = "لطفاً دلیل از دست رفتن معامله را بنویسید."), StringLength(300, ErrorMessage = Msg.TooLong)]
    public string Reason { get; init; } = "";
}

public static class DealProjection
{
    public const int StaleDays = 14;

    public static async Task<List<DealCard>> Cards(IAppDbContext db, IQueryable<Deal> source, TagService tags, CancellationToken ct)
    {
        var staleBefore = DateTime.UtcNow.AddDays(-StaleDays);
        var rows = await source.AsNoTracking()
            .OrderBy(d => d.SortOrder)
            .Select(d => new
            {
                d.Id, d.Title, d.Value, d.Status, d.PipelineId, d.StageId, StageName = d.Stage!.Name, StageColor = d.Stage.Color,
                Probability = d.Probability ?? d.Stage.Probability, d.ExpectedCloseDate,
                Owner = d.Owner == null ? null : new UserRef(d.Owner.Id, d.Owner.FullName, d.Owner.AvatarColor),
                Contact = d.Contact == null ? null : new NamedRef(d.Contact.Id, d.Contact.FirstName + " " + d.Contact.LastName),
                Company = d.Company == null ? null : new NamedRef(d.Company.Id, d.Company.Name),
                d.SortOrder, d.StageEnteredAt, d.UpdatedAt, d.LastActivityAt,
                Open = db.Activities.Count(a => a.RecordType == RecordType.Deal && a.RecordId == d.Id && !a.IsDone)
            })
            .ToListAsync(ct);
        var tagMap = await tags.ForRecordsAsync(RecordType.Deal, rows.Select(r => r.Id).ToList(), ct);
        return rows.Select(r => new DealCard(r.Id, r.Title, r.Value, r.Status, r.PipelineId, r.StageId, r.StageName, r.StageColor,
            r.Probability, r.ExpectedCloseDate, r.Owner, r.Contact, r.Company, r.SortOrder, r.StageEnteredAt, r.UpdatedAt,
            r.Status == DealStatus.Open && r.StageEnteredAt < staleBefore && (r.LastActivityAt == null || r.LastActivityAt < staleBefore),
            tagMap.GetValueOrDefault(r.Id) ?? [], r.Open)).ToList();
    }
}

public sealed class DealService(
    IAppDbContext db, RequestContext ctx, ChangeFeed feed, TagService tags, CustomFieldService fields, AutomationEngine automations)
{
    public async Task<BoardDto> BoardAsync(Guid? pipelineId, Guid? ownerId, string? q, CancellationToken ct)
    {
        var pipeline = await db.Pipelines.AsNoTracking().Include(p => p.Stages)
                           .Where(p => pipelineId == null || p.Id == pipelineId).OrderBy(p => p.Order).FirstOrDefaultAsync(ct)
                       ?? throw new NotFoundException("پایپ‌لاین");
        var source = db.Deals.Where(d => d.PipelineId == pipeline.Id && d.Status == DealStatus.Open);
        if (ownerId is { } o) source = source.Where(d => d.OwnerId == o);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            source = source.Where(d => d.Title.ToLower().Contains(term) || (d.Company != null && d.Company.Name.ToLower().Contains(term)));
        }
        var cards = await DealProjection.Cards(db, source, tags, ct);
        var stages = pipeline.Stages.OrderBy(s => s.Order).Select(MapStage).ToList();
        var columns = stages.Select(s =>
        {
            var list = cards.Where(c => c.StageId == s.Id).ToList();
            return new BoardColumn(s, list, list.Sum(c => c.Value), list.Sum(c => c.Value * c.Probability / 100));
        }).ToList();

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var wonQuery = db.Deals.Where(d => d.PipelineId == pipeline.Id && d.Status == DealStatus.Won && d.ClosedAt >= monthStart);
        var wonSum = await wonQuery.SumAsync(d => d.Value, ct);
        var wonCount = await wonQuery.CountAsync(ct);
        var pDto = new PipelineDto(pipeline.Id, pipeline.Name, pipeline.Order, stages, cards.Count, cards.Sum(c => c.Value));
        return new BoardDto(pDto, columns, wonSum, wonCount);
    }

    public async Task<PagedResult<DealCard>> ListAsync(DealQuery q, CancellationToken ct)
    {
        var query = db.Deals.AsQueryable();
        if (q.PipelineId is { } p) query = query.Where(d => d.PipelineId == p);
        if (q.Status is { } s) query = query.Where(d => d.Status == s);
        if (q.OwnerId is { } o) query = query.Where(d => d.OwnerId == o);
        if (q.StageId is { } st) query = query.Where(d => d.StageId == st);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().ToLower();
            query = query.Where(d => d.Title.ToLower().Contains(term) || (d.Company != null && d.Company.Name.ToLower().Contains(term)));
        }
        var total = await query.CountAsync(ct);
        var desc = !string.Equals(q.Dir, "asc", StringComparison.OrdinalIgnoreCase);
        query = (q.Sort ?? "createdAt") switch
        {
            "title" => desc ? query.OrderByDescending(d => d.Title) : query.OrderBy(d => d.Title),
            "value" => desc ? query.OrderByDescending(d => d.Value) : query.OrderBy(d => d.Value),
            "stage" => desc ? query.OrderByDescending(d => d.Stage!.Order) : query.OrderBy(d => d.Stage!.Order),
            "owner" => desc ? query.OrderByDescending(d => d.Owner!.FullName) : query.OrderBy(d => d.Owner!.FullName),
            "expectedCloseDate" => desc ? query.OrderByDescending(d => d.ExpectedCloseDate) : query.OrderBy(d => d.ExpectedCloseDate),
            "updatedAt" => desc ? query.OrderByDescending(d => d.UpdatedAt) : query.OrderBy(d => d.UpdatedAt),
            _ => desc ? query.OrderByDescending(d => d.CreatedAt) : query.OrderBy(d => d.CreatedAt)
        };
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var ids = await query.Skip((page - 1) * size).Take(size).Select(d => d.Id).ToListAsync(ct);
        var cards = await DealProjection.Cards(db, db.Deals.Where(d => ids.Contains(d.Id)), tags, ct);
        var ordered = ids.Select(id => cards.First(c => c.Id == id)).ToList();
        return new PagedResult<DealCard>(ordered, total, page, size);
    }

    public async Task<DealDetail> GetAsync(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.AsNoTracking().Include(x => x.Pipeline).ThenInclude(p => p!.Stages)
                    .Include(x => x.Contact).FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("معامله");
        var card = (await DealProjection.Cards(db, db.Deals.Where(x => x.Id == id), tags, ct))[0];
        var c = d.Contact;
        return new DealDetail(card, d.LostReason, d.ClosedAt, d.CreatedAt, d.CustomFields,
            d.Pipeline!.Stages.OrderBy(s => s.Order).Select(MapStage).ToList(), d.Pipeline.Name,
            c is null ? null : new ContactMini(c.Id, c.FullName, c.JobTitle, c.Email, c.Phone, c.Lifecycle));
    }

    public async Task<DealCard> CreateAsync(DealRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await EnsureRefsAsync(req, ct);
        var maxOrder = await db.Deals.Where(x => x.StageId == req.StageId).Select(x => (double?)x.SortOrder).MinAsync(ct) ?? 1000;
        var d = new Deal
        {
            TenantId = ctx.RequireTenant(), OwnerId = req.OwnerId ?? ctx.UserId, SortOrder = maxOrder - 1, StageEnteredAt = DateTime.UtcNow
        };
        Apply(d, req);
        d.CustomFields = await fields.SanitizeAsync(RecordType.Deal, req.CustomFields, null, ct);
        db.Deals.Add(d);
        await tags.SetAsync(RecordType.Deal, d.Id, req.TagIds, ct);
        feed.Add(RecordType.Deal, d.Id, TimelineKind.Created, "معامله ساخته شد", Fa.Toman(d.Value));
        if (d.ContactId is { } cid) feed.Add(RecordType.Contact, cid, TimelineKind.Created, $"معامله‌ی «{d.Title}» ساخته شد", null, new() { ["dealId"] = d.Id.ToString() });
        if (d.CompanyId is { } coid) feed.Add(RecordType.Company, coid, TimelineKind.Created, $"معامله‌ی «{d.Title}» ساخته شد", null, new() { ["dealId"] = d.Id.ToString() });
        if (d.OwnerId is { } owner) feed.Notify(owner, "معامله‌ی جدید به شما سپرده شد", d.Title, ChangeFeed.Link(RecordType.Deal, d.Id), "assign");
        await automations.RunForDealAsync(AutomationTrigger.DealCreated, d, ct);
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(d.Id, ct);
    }

    public async Task<DealCard> UpdateAsync(Guid id, DealRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await EnsureRefsAsync(req, ct);
        var d = await db.Deals.Include(x => x.Owner).Include(x => x.Contact).Include(x => x.Company).Include(x => x.Stage)
                    .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");

        feed.Diff(RecordType.Deal, id, "عنوان", d.Title, req.Title);
        feed.Diff(RecordType.Deal, id, "مبلغ", Fa.Toman(d.Value), Fa.Toman(req.Value));
        feed.Diff(RecordType.Deal, id, "احتمال", d.Probability?.ToString(), req.Probability?.ToString());
        feed.Diff(RecordType.Deal, id, "تاریخ بستن", Fa.Date(d.ExpectedCloseDate), Fa.Date(req.ExpectedCloseDate));
        if (d.ContactId != req.ContactId)
            feed.Diff(RecordType.Deal, id, "مخاطب", d.Contact?.FullName,
                req.ContactId is null ? null : await db.Contacts.Where(c => c.Id == req.ContactId).Select(c => c.FirstName + " " + c.LastName).FirstAsync(ct));
        if (d.CompanyId != req.CompanyId)
            feed.Diff(RecordType.Deal, id, "شرکت", d.Company?.Name,
                req.CompanyId is null ? null : await db.Companies.Where(c => c.Id == req.CompanyId).Select(c => c.Name).FirstAsync(ct));
        if (d.OwnerId != req.OwnerId && req.OwnerId is { } newOwner)
        {
            feed.Diff(RecordType.Deal, id, "مسئول", d.Owner?.FullName, await db.Users.Where(u => u.Id == newOwner).Select(u => u.FullName).FirstAsync(ct));
            feed.Notify(newOwner, "معامله‌ای به شما سپرده شد", d.Title, ChangeFeed.Link(RecordType.Deal, id), "assign");
        }
        var stageChanged = d.StageId != req.StageId;
        var oldStage = d.Stage!.Name;

        var custom = await fields.SanitizeAsync(RecordType.Deal, req.CustomFields, d.CustomFields, ct);
        Apply(d, req);
        d.OwnerId = req.OwnerId;
        d.CustomFields = custom;
        d.UpdatedAt = DateTime.UtcNow;
        await tags.SetAsync(RecordType.Deal, id, req.TagIds, ct);
        if (stageChanged)
        {
            d.Stage = await db.Stages.FirstAsync(s => s.Id == req.StageId, ct);
            await RecordStageChangeAsync(d, oldStage, ct);
        }
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(id, ct);
    }

    public async Task<DealCard> MoveAsync(Guid id, MoveDealRequest req, CancellationToken ct)
    {
        var d = await db.Deals.Include(x => x.Stage).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");
        var stage = await db.Stages.FirstOrDefaultAsync(s => s.Id == req.StageId, ct) ?? throw new NotFoundException("مرحله");
        if (stage.PipelineId != d.PipelineId) throw new AppException(400, "مرحله متعلق به پایپ‌لاین این معامله نیست.");

        var oldStage = d.Stage!.Name;
        var changed = d.StageId != stage.Id;
        d.StageId = stage.Id;
        d.Stage = stage;
        d.SortOrder = req.SortOrder ?? d.SortOrder;
        d.UpdatedAt = DateTime.UtcNow;
        if (changed) await RecordStageChangeAsync(d, oldStage, ct);
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(id, ct);
    }

    public async Task<DealCard> WinAsync(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");
        d.Status = DealStatus.Won;
        d.ClosedAt = DateTime.UtcNow;
        d.LostReason = null;
        d.UpdatedAt = DateTime.UtcNow;
        feed.Add(RecordType.Deal, id, TimelineKind.DealWon, "معامله برنده شد 🎉", Fa.Toman(d.Value));
        if (d.ContactId is { } cid) feed.Add(RecordType.Contact, cid, TimelineKind.DealWon, $"معامله‌ی «{d.Title}» برنده شد", Fa.Toman(d.Value));
        if (d.CompanyId is { } coid) feed.Add(RecordType.Company, coid, TimelineKind.DealWon, $"معامله‌ی «{d.Title}» برنده شد", Fa.Toman(d.Value));
        await NotifyTeamAsync($"معامله‌ی «{d.Title}» برنده شد", Fa.Toman(d.Value), ChangeFeed.Link(RecordType.Deal, id), "won", ct);
        await automations.RunForDealAsync(AutomationTrigger.DealWon, d, ct);
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(id, ct);
    }

    public async Task<DealCard> LoseAsync(Guid id, LoseDealRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var d = await db.Deals.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");
        d.Status = DealStatus.Lost;
        d.ClosedAt = DateTime.UtcNow;
        d.LostReason = req.Reason.Trim();
        d.UpdatedAt = DateTime.UtcNow;
        feed.Add(RecordType.Deal, id, TimelineKind.DealLost, "معامله از دست رفت", d.LostReason);
        if (d.ContactId is { } cid) feed.Add(RecordType.Contact, cid, TimelineKind.DealLost, $"معامله‌ی «{d.Title}» از دست رفت", d.LostReason);
        await automations.RunForDealAsync(AutomationTrigger.DealLost, d, ct);
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(id, ct);
    }

    public async Task<DealCard> ReopenAsync(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");
        d.Status = DealStatus.Open;
        d.ClosedAt = null;
        d.LostReason = null;
        d.UpdatedAt = DateTime.UtcNow;
        d.StageEnteredAt = DateTime.UtcNow;
        feed.Add(RecordType.Deal, id, TimelineKind.FieldChanged, "معامله دوباره باز شد");
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
        return await CardAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("معامله");
        db.RecordTags.RemoveRange(db.RecordTags.Where(rt => rt.RecordType == RecordType.Deal && rt.RecordId == id));
        db.Deals.Remove(d);
        await db.SaveChangesAsync(ct);
        EmitChanged(d);
        await feed.PublishAsync();
    }

    private async Task RecordStageChangeAsync(Deal d, string oldStage, CancellationToken ct)
    {
        var stage = d.Stage ?? await db.Stages.FirstAsync(s => s.Id == d.StageId, ct);
        d.StageEnteredAt = DateTime.UtcNow;
        d.StaleNotifiedAt = null;
        feed.Add(RecordType.Deal, d.Id, TimelineKind.StageChanged, $"از «{oldStage}» به «{stage.Name}» رفت", null,
            new() { ["from"] = oldStage, ["to"] = stage.Name, ["color"] = stage.Color });
        if (d.OwnerId is { } owner)
            feed.Notify(owner, $"«{d.Title}» به مرحله‌ی «{stage.Name}» رفت", null, ChangeFeed.Link(RecordType.Deal, d.Id), "stage");
        await automations.RunForDealAsync(AutomationTrigger.DealStageChanged, d, ct);
    }

    private async Task NotifyTeamAsync(string title, string? body, string link, string kind, CancellationToken ct)
    {
        var tenant = ctx.RequireTenant();
        var users = await db.Memberships.Where(m => m.WorkspaceId == tenant).Select(m => m.UserId).ToListAsync(ct);
        foreach (var u in users) feed.Notify(u, title, body, link, kind);
    }

    private void EmitChanged(Deal d) => feed.Emit("deal.changed", new { id = d.Id, pipelineId = d.PipelineId, actorId = ctx.UserId });

    private async Task<DealCard> CardAsync(Guid id, CancellationToken ct) =>
        (await DealProjection.Cards(db, db.Deals.Where(x => x.Id == id), tags, ct))[0];

    private async Task EnsureRefsAsync(DealRequest req, CancellationToken ct)
    {
        var stage = await db.Stages.FirstOrDefaultAsync(s => s.Id == req.StageId, ct);
        Validate.Field(stage is not null && stage.PipelineId == req.PipelineId, "stageId", "مرحله‌ی انتخاب‌شده معتبر نیست.");
        if (req.ContactId is { } c) Validate.Field(await db.Contacts.AnyAsync(x => x.Id == c, ct), "contactId", "مخاطب پیدا نشد.");
        if (req.CompanyId is { } co) Validate.Field(await db.Companies.AnyAsync(x => x.Id == co, ct), "companyId", "شرکت پیدا نشد.");
        if (req.OwnerId is { } o) Validate.Field(await Members.IsMemberAsync(db, ctx.RequireTenant(), o, ct), "ownerId", "مسئول باید عضو فضای کاری باشد.");
    }

    private static void Apply(Deal d, DealRequest r)
    {
        d.Title = r.Title.Trim();
        d.Value = r.Value;
        d.PipelineId = r.PipelineId;
        d.StageId = r.StageId;
        d.ContactId = r.ContactId;
        d.CompanyId = r.CompanyId;
        d.Probability = r.Probability;
        d.ExpectedCloseDate = r.ExpectedCloseDate;
    }

    internal static StageDto MapStage(Stage s) => new(s.Id, s.Name, s.Order, s.Probability, s.Color);
}
