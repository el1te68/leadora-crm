using System.ComponentModel.DataAnnotations;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Automations;

public sealed record AutomationDto(Guid Id, string Name, AutomationTrigger Trigger, Guid? PipelineId, Guid? StageId, AutomationAction Action,
    Dictionary<string, string> Config, bool IsActive, int RunCount, DateTime? LastRunAt, DateTime CreatedAt);

public sealed class AutomationRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(100, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    public AutomationTrigger Trigger { get; init; }
    public Guid? PipelineId { get; init; }
    public Guid? StageId { get; init; }
    public AutomationAction Action { get; init; }
    public Dictionary<string, string>? Config { get; init; }
    public bool IsActive { get; init; } = true;
}

public sealed class AutomationService(IAppDbContext db, RequestContext ctx)
{
    public async Task<IReadOnlyList<AutomationDto>> ListAsync(CancellationToken ct) =>
        (await db.Automations.AsNoTracking().OrderBy(a => a.CreatedAt).ToListAsync(ct)).Select(Map).ToList();

    public async Task<AutomationDto> CreateAsync(AutomationRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        await CheckAsync(req, ct);
        var a = new AutomationRule { TenantId = ctx.RequireTenant() };
        Apply(a, req);
        db.Automations.Add(a);
        await db.SaveChangesAsync(ct);
        return Map(a);
    }

    public async Task<AutomationDto> UpdateAsync(Guid id, AutomationRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        await CheckAsync(req, ct);
        var a = await db.Automations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("اتوماسیون");
        Apply(a, req);
        await db.SaveChangesAsync(ct);
        return Map(a);
    }

    public async Task<AutomationDto> ToggleAsync(Guid id, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var a = await db.Automations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("اتوماسیون");
        a.IsActive = !a.IsActive;
        await db.SaveChangesAsync(ct);
        return Map(a);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var a = await db.Automations.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("اتوماسیون");
        db.Automations.Remove(a);
        await db.SaveChangesAsync(ct);
    }

    private async Task CheckAsync(AutomationRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        if (req.StageId is { } s) Validate.Field(await db.Stages.AnyAsync(x => x.Id == s, ct), "stageId", "مرحله پیدا نشد.");
        var cfg = req.Config ?? [];
        switch (req.Action)
        {
            case AutomationAction.CreateTask:
                Validate.Field(!string.IsNullOrWhiteSpace(cfg.GetValueOrDefault("subject")), "config.subject", "عنوان کار را بنویسید.");
                break;
            case AutomationAction.AssignOwner:
                Validate.Field(Guid.TryParse(cfg.GetValueOrDefault("userId"), out var uid) && await Records.Members.IsMemberAsync(db, ctx.RequireTenant(), uid, ct),
                    "config.userId", "یک هم‌تیمی انتخاب کنید.");
                break;
            case AutomationAction.SendNotification:
                Validate.Field(!string.IsNullOrWhiteSpace(cfg.GetValueOrDefault("message")), "config.message", "متن اعلان را بنویسید.");
                break;
        }
    }

    private static void Apply(AutomationRule a, AutomationRequest r)
    {
        a.Name = r.Name.Trim();
        a.Trigger = r.Trigger;
        a.PipelineId = r.PipelineId;
        a.StageId = r.Trigger == AutomationTrigger.DealStageChanged ? r.StageId : null;
        a.Action = r.Action;
        a.Config = r.Config ?? [];
        a.IsActive = r.IsActive;
    }

    private static AutomationDto Map(AutomationRule a) =>
        new(a.Id, a.Name, a.Trigger, a.PipelineId, a.StageId, a.Action, a.Config, a.IsActive, a.RunCount, a.LastRunAt, a.CreatedAt);
}

/// <summary>Evaluates "when trigger then action" rules inside the caller's unit of work (no extra SaveChanges).</summary>
public sealed class AutomationEngine(IAppDbContext db, RequestContext ctx, ChangeFeed feed)
{
    public async Task RunForDealAsync(AutomationTrigger trigger, Deal deal, CancellationToken ct)
    {
        var rules = await db.Automations.Where(a => a.IsActive && a.Trigger == trigger).ToListAsync(ct);
        foreach (var r in rules)
        {
            if (r.PipelineId is { } p && p != deal.PipelineId) continue;
            if (trigger == AutomationTrigger.DealStageChanged && r.StageId is { } s && s != deal.StageId) continue;
            Execute(r, RecordType.Deal, deal.Id, deal.Title, deal.OwnerId, owner => deal.OwnerId = owner);
        }
    }

    public async Task RunForContactAsync(AutomationTrigger trigger, Contact contact, CancellationToken ct)
    {
        var rules = await db.Automations.Where(a => a.IsActive && a.Trigger == trigger).ToListAsync(ct);
        foreach (var r in rules)
            Execute(r, RecordType.Contact, contact.Id, contact.FullName, contact.OwnerId, owner => contact.OwnerId = owner);
    }

    private void Execute(AutomationRule r, RecordType type, Guid recordId, string title, Guid? ownerId, Action<Guid> setOwner)
    {
        var cfg = r.Config;
        var tenant = ctx.RequireTenant();
        Guid? Target() => Guid.TryParse(cfg.GetValueOrDefault("userId"), out var u) ? u : ownerId;

        switch (r.Action)
        {
            case AutomationAction.CreateTask:
                var days = int.TryParse(cfg.GetValueOrDefault("dueInDays"), out var dd) ? dd : 1;
                var task = new Activity
                {
                    TenantId = tenant, Type = ActivityType.Task, Subject = cfg.GetValueOrDefault("subject") ?? r.Name,
                    DueAt = DateTime.UtcNow.Date.AddDays(days).AddHours(6), AssigneeId = Target(), RecordType = type, RecordId = recordId,
                    CreatedById = ctx.UserId
                };
                db.Activities.Add(task);
                feed.Add(type, recordId, TimelineKind.Automation, $"اتوماسیون «{r.Name}» یک کار ساخت", task.Subject);
                if (task.AssigneeId is { } a)
                    feed.Notify(a, "کار جدید از اتوماسیون", task.Subject, ChangeFeed.Link(type, recordId), "task");
                break;

            case AutomationAction.AssignOwner:
                if (Guid.TryParse(cfg.GetValueOrDefault("userId"), out var newOwner))
                {
                    setOwner(newOwner);
                    feed.Add(type, recordId, TimelineKind.Automation, $"اتوماسیون «{r.Name}» مسئول را عوض کرد");
                    feed.Notify(newOwner, "رکوردی با اتوماسیون به شما سپرده شد", title, ChangeFeed.Link(type, recordId), "assign");
                }
                break;

            case AutomationAction.SendNotification:
                if (Target() is { } target)
                {
                    db.Notifications.Add(new Notification
                    {
                        TenantId = tenant, UserId = target, Title = cfg.GetValueOrDefault("message") ?? r.Name, Body = title,
                        Link = ChangeFeed.Link(type, recordId), Kind = "automation"
                    });
                    feed.Add(type, recordId, TimelineKind.Automation, $"اتوماسیون «{r.Name}» اعلان فرستاد");
                }
                break;
        }
        r.RunCount++;
        r.LastRunAt = DateTime.UtcNow;
    }
}
