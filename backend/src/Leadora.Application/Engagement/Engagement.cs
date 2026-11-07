using System.ComponentModel.DataAnnotations;
using System.Net;
using Leadora.Application.Common;
using Leadora.Application.Records;
using Leadora.Application.Workspaces;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Engagement;

public sealed record RecordRef(RecordType Type, Guid Id, string Title);

public sealed record ActivityDto(Guid Id, ActivityType Type, string Subject, string? Description, DateTime? DueAt, int? DurationMinutes,
    UserRef? Assignee, bool IsDone, DateTime? DoneAt, RecordRef? Record, DateTime CreatedAt, bool IsOverdue);

public sealed record MyDayDto(IReadOnlyList<ActivityDto> Overdue, IReadOnlyList<ActivityDto> Today, IReadOnlyList<ActivityDto> Upcoming,
    int DoneToday, IReadOnlyList<DealCard> StaleDeals, IReadOnlyList<DealCard> ClosingSoon);

public sealed class ActivityQuery
{
    public Guid? AssigneeId { get; set; }
    public bool Mine { get; set; }
    /// <summary>open | done | overdue | today | upcoming</summary>
    public string? Status { get; set; }
    public ActivityType? Type { get; set; }
    public RecordType? RecordType { get; set; }
    public Guid? RecordId { get; set; }
    public int Take { get; set; } = 100;
}

public sealed class ActivityRequest
{
    public ActivityType Type { get; init; }
    [Required(ErrorMessage = Msg.Required), StringLength(160, ErrorMessage = Msg.TooLong)]
    public string Subject { get; init; } = "";
    [StringLength(2000, ErrorMessage = Msg.TooLong)]
    public string? Description { get; init; }
    public DateTime? DueAt { get; init; }
    [Range(0, 1440, ErrorMessage = Msg.Range)]
    public int? DurationMinutes { get; init; }
    public Guid? AssigneeId { get; init; }
    public RecordType? RecordType { get; init; }
    public Guid? RecordId { get; init; }
}

public sealed class NoteRequest
{
    public RecordType RecordType { get; init; }
    public Guid RecordId { get; init; }
    [Required(ErrorMessage = "یادداشت خالی است."), StringLength(5000, ErrorMessage = Msg.TooLong)]
    public string Body { get; init; } = "";
}

public sealed class EmailRequest
{
    public RecordType RecordType { get; init; }
    public Guid RecordId { get; init; }
    [Required(ErrorMessage = Msg.Required), EmailAddress(ErrorMessage = Msg.Email)]
    public string To { get; init; } = "";
    [Required(ErrorMessage = Msg.Required), StringLength(200, ErrorMessage = Msg.TooLong)]
    public string Subject { get; init; } = "";
    [Required(ErrorMessage = Msg.Required), StringLength(20000, ErrorMessage = Msg.TooLong)]
    public string Body { get; init; } = "";
}

public sealed record EmailDto(Guid Id, string To, string Subject, string Body, UserRef? SentBy, bool Delivered, string? Error, DateTime CreatedAt);

public sealed record TimelineItem(Guid Id, TimelineKind Kind, string Title, string? Body, Dictionary<string, string> Data, UserRef? Actor,
    DateTime OccurredAt, RecordType RecordType, Guid RecordId, string? Via);

public sealed class ActivityService(IAppDbContext db, RequestContext ctx, ChangeFeed feed)
{
    public async Task<IReadOnlyList<ActivityDto>> ListAsync(ActivityQuery q, CancellationToken ct)
    {
        var query = db.Activities.AsNoTracking().AsQueryable();
        var now = DateTime.UtcNow;
        var (dayStart, dayEnd) = TehranDay(now);
        if (q.Mine) query = query.Where(a => a.AssigneeId == ctx.UserId);
        if (q.AssigneeId is { } aid) query = query.Where(a => a.AssigneeId == aid);
        if (q.Type is { } t) query = query.Where(a => a.Type == t);
        if (q.RecordType is { } rt && q.RecordId is { } rid) query = query.Where(a => a.RecordType == rt && a.RecordId == rid);
        query = q.Status switch
        {
            "open" => query.Where(a => !a.IsDone),
            "done" => query.Where(a => a.IsDone),
            "overdue" => query.Where(a => !a.IsDone && a.DueAt < now),
            "today" => query.Where(a => !a.IsDone && a.DueAt >= dayStart && a.DueAt < dayEnd),
            "upcoming" => query.Where(a => !a.IsDone && a.DueAt >= dayEnd),
            _ => query
        };
        query = q.Status == "done" ? query.OrderByDescending(a => a.DoneAt) : query.OrderBy(a => a.IsDone).ThenBy(a => a.DueAt);
        var rows = await query.Include(a => a.Assignee).Take(Math.Clamp(q.Take, 1, 500)).ToListAsync(ct);
        return await MapAsync(rows, ct);
    }

    public async Task<MyDayDto> MyDayAsync(TagService tags, CancellationToken ct)
    {
        var me = ctx.RequireUser();
        var now = DateTime.UtcNow;
        var (dayStart, dayEnd) = TehranDay(now);
        var mine = db.Activities.AsNoTracking().Include(a => a.Assignee).Where(a => a.AssigneeId == me);
        var overdue = await mine.Where(a => !a.IsDone && a.DueAt < now && a.DueAt < dayStart).OrderBy(a => a.DueAt).Take(50).ToListAsync(ct);
        var today = await mine.Where(a => a.DueAt >= dayStart && a.DueAt < dayEnd).OrderBy(a => a.IsDone).ThenBy(a => a.DueAt).ToListAsync(ct);
        var upcoming = await mine.Where(a => !a.IsDone && a.DueAt >= dayEnd).OrderBy(a => a.DueAt).Take(15).ToListAsync(ct);
        var doneToday = await db.Activities.CountAsync(a => a.AssigneeId == me && a.IsDone && a.DoneAt >= dayStart, ct);

        var staleBefore = now.AddDays(-Deals.DealProjection.StaleDays);
        var stale = await Deals.DealProjection.Cards(db, db.Deals.Where(d => d.OwnerId == me && d.Status == DealStatus.Open
            && d.StageEnteredAt < staleBefore && (d.LastActivityAt == null || d.LastActivityAt < staleBefore)), tags, ct);
        var soon = DateOnly.FromDateTime(now.AddDays(14));
        var closing = await Deals.DealProjection.Cards(db, db.Deals.Where(d => d.OwnerId == me && d.Status == DealStatus.Open
            && d.ExpectedCloseDate != null && d.ExpectedCloseDate <= soon), tags, ct);

        return new MyDayDto(await MapAsync(overdue, ct), await MapAsync(today, ct), await MapAsync(upcoming, ct), doneToday,
            stale.Take(6).ToList(), closing.OrderBy(c => c.ExpectedCloseDate).Take(6).ToList());
    }

    public async Task<ActivityDto> CreateAsync(ActivityRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        if (req.RecordType is { } rt && req.RecordId is { } rid) await feed.EnsureRecordExistsAsync(rt, rid, ct);
        if (req.AssigneeId is { } aid)
            Validate.Field(await Members.IsMemberAsync(db, ctx.RequireTenant(), aid, ct), "assigneeId", "مسئول باید عضو فضای کاری باشد.");
        var a = new Activity
        {
            TenantId = ctx.RequireTenant(), Type = req.Type, Subject = req.Subject.Trim(), Description = req.Description,
            DueAt = ToUtc(req.DueAt), DurationMinutes = req.DurationMinutes, AssigneeId = req.AssigneeId ?? ctx.UserId,
            RecordType = req.RecordType, RecordId = req.RecordId, CreatedById = ctx.UserId
        };
        db.Activities.Add(a);
        if (a.RecordType is { } t && a.RecordId is { } id)
        {
            feed.Add(t, id, TimelineKind.ActivityCreated, $"{Fa.Activity(a.Type)}: {a.Subject}", a.Description,
                new() { ["activityId"] = a.Id.ToString(), ["type"] = a.Type.ToString(), ["dueAt"] = a.DueAt?.ToString("O") ?? "" });
            await feed.TouchAsync(t, id, ct);
        }
        if (a.AssigneeId is { } assignee)
            feed.Notify(assignee, $"{Fa.Activity(a.Type)} جدید برای شما", a.Subject,
                a.RecordType is { } t2 && a.RecordId is { } id2 ? ChangeFeed.Link(t2, id2) : "/app/activities", "task");
        await db.SaveChangesAsync(ct);
        feed.Emit("activity.changed", new { id = a.Id });
        await feed.PublishAsync();
        return (await MapAsync([await db.Activities.Include(x => x.Assignee).FirstAsync(x => x.Id == a.Id, ct)], ct))[0];
    }

    public async Task<ActivityDto> UpdateAsync(Guid id, ActivityRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var a = await db.Activities.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("فعالیت");
        if (req.AssigneeId is { } aid && aid != a.AssigneeId)
        {
            Validate.Field(await Members.IsMemberAsync(db, ctx.RequireTenant(), aid, ct), "assigneeId", "مسئول باید عضو فضای کاری باشد.");
            feed.Notify(aid, $"{Fa.Activity(req.Type)} به شما سپرده شد", req.Subject, "/app/activities", "task");
        }
        a.Type = req.Type;
        a.Subject = req.Subject.Trim();
        a.Description = req.Description;
        if (ToUtc(req.DueAt) != a.DueAt) a.ReminderSentAt = null;
        a.DueAt = ToUtc(req.DueAt);
        a.DurationMinutes = req.DurationMinutes;
        a.AssigneeId = req.AssigneeId ?? a.AssigneeId;
        await db.SaveChangesAsync(ct);
        feed.Emit("activity.changed", new { id });
        await feed.PublishAsync();
        return (await MapAsync([await db.Activities.Include(x => x.Assignee).FirstAsync(x => x.Id == id, ct)], ct))[0];
    }

    public async Task<ActivityDto> ToggleDoneAsync(Guid id, CancellationToken ct)
    {
        var a = await db.Activities.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("فعالیت");
        a.IsDone = !a.IsDone;
        a.DoneAt = a.IsDone ? DateTime.UtcNow : null;
        if (a.IsDone && a.RecordType is { } t && a.RecordId is { } rid)
        {
            feed.Add(t, rid, TimelineKind.ActivityCompleted, $"{Fa.Activity(a.Type)} انجام شد: {a.Subject}", null,
                new() { ["activityId"] = a.Id.ToString(), ["type"] = a.Type.ToString() });
            await feed.TouchAsync(t, rid, ct);
        }
        await db.SaveChangesAsync(ct);
        feed.Emit("activity.changed", new { id });
        await feed.PublishAsync();
        return (await MapAsync([await db.Activities.Include(x => x.Assignee).FirstAsync(x => x.Id == id, ct)], ct))[0];
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var a = await db.Activities.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("فعالیت");
        db.Activities.Remove(a);
        await db.SaveChangesAsync(ct);
        feed.Emit("activity.changed", new { id });
        await feed.PublishAsync();
    }

    /// <summary>Start/end of "today" in Tehran time expressed in UTC.</summary>
    public static (DateTime start, DateTime end) TehranDay(DateTime utcNow)
    {
        var offset = TimeSpan.FromHours(3.5);
        var localDate = (utcNow + offset).Date;
        var start = DateTime.SpecifyKind(localDate - offset, DateTimeKind.Utc);
        return (start, start.AddDays(1));
    }

    private static DateTime? ToUtc(DateTime? d) => d is null ? null : d.Value.Kind == DateTimeKind.Utc ? d : d.Value.ToUniversalTime();

    private async Task<List<ActivityDto>> MapAsync(List<Activity> rows, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var titles = await RecordTitles.LoadAsync(db, rows.Where(r => r.RecordType != null && r.RecordId != null)
            .Select(r => (r.RecordType!.Value, r.RecordId!.Value)), ct);
        return rows.Select(a => new ActivityDto(a.Id, a.Type, a.Subject, a.Description, a.DueAt, a.DurationMinutes, a.Assignee.Ref(), a.IsDone, a.DoneAt,
            a.RecordType is { } t && a.RecordId is { } id && titles.TryGetValue(id, out var title) ? new RecordRef(t, id, title) : null,
            a.CreatedAt, !a.IsDone && a.DueAt < now)).ToList();
    }
}

public static class RecordTitles
{
    public static async Task<Dictionary<Guid, string>> LoadAsync(IAppDbContext db, IEnumerable<(RecordType type, Guid id)> refs, CancellationToken ct)
    {
        var list = refs.ToList();
        var contactIds = list.Where(r => r.type == RecordType.Contact).Select(r => r.id).Distinct().ToList();
        var companyIds = list.Where(r => r.type == RecordType.Company).Select(r => r.id).Distinct().ToList();
        var dealIds = list.Where(r => r.type == RecordType.Deal).Select(r => r.id).Distinct().ToList();
        var result = new Dictionary<Guid, string>();
        if (contactIds.Count > 0)
            foreach (var x in await db.Contacts.Where(c => contactIds.Contains(c.Id)).Select(c => new { c.Id, Name = c.FirstName + " " + c.LastName }).ToListAsync(ct))
                result[x.Id] = x.Name;
        if (companyIds.Count > 0)
            foreach (var x in await db.Companies.Where(c => companyIds.Contains(c.Id)).Select(c => new { c.Id, c.Name }).ToListAsync(ct))
                result[x.Id] = x.Name;
        if (dealIds.Count > 0)
            foreach (var x in await db.Deals.Where(c => dealIds.Contains(c.Id)).Select(c => new { c.Id, c.Title }).ToListAsync(ct))
                result[x.Id] = x.Title;
        return result;
    }
}

public sealed class NoteService(IAppDbContext db, RequestContext ctx, ChangeFeed feed)
{
    public async Task<TimelineItem> CreateAsync(NoteRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await feed.EnsureRecordExistsAsync(req.RecordType, req.RecordId, ct);
        var n = new Note { TenantId = ctx.RequireTenant(), AuthorId = ctx.RequireUser(), RecordType = req.RecordType, RecordId = req.RecordId, Body = req.Body.Trim() };
        db.Notes.Add(n);
        var e = feed.Add(req.RecordType, req.RecordId, TimelineKind.Note, "یادداشت گذاشت", n.Body, new() { ["noteId"] = n.Id.ToString() });
        await feed.TouchAsync(req.RecordType, req.RecordId, ct);

        // @mentions → notification. Format in body: @[Full Name](userId)
        foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(n.Body, @"@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)"))
            if (Guid.TryParse(m.Groups[1].Value, out var uid) && await Members.IsMemberAsync(db, ctx.RequireTenant(), uid, ct))
                feed.Notify(uid, "در یک یادداشت از شما نام برده شد", await feed.RecordTitleAsync(req.RecordType, req.RecordId, ct),
                    ChangeFeed.Link(req.RecordType, req.RecordId), "mention");

        await db.SaveChangesAsync(ct);
        await feed.PublishAsync();
        var actor = await db.Users.AsNoTracking().FirstAsync(u => u.Id == n.AuthorId, ct);
        return new TimelineItem(e.Id, e.Kind, e.Title, e.Body, e.Data, actor.Ref(), e.CreatedAt, e.RecordType, e.RecordId, null);
    }

    public async Task DeleteAsync(Guid timelineId, CancellationToken ct)
    {
        var e = await db.Timeline.FirstOrDefaultAsync(x => x.Id == timelineId && x.Kind == TimelineKind.Note, ct) ?? throw new NotFoundException("یادداشت");
        if (e.ActorId != ctx.UserId && ctx.Role == WorkspaceRole.Member) throw new ForbiddenException("فقط نویسنده یا مدیر می‌تواند یادداشت را حذف کند.");
        if (e.Data.TryGetValue("noteId", out var nid) && Guid.TryParse(nid, out var noteId))
        {
            var note = await db.Notes.FirstOrDefaultAsync(n => n.Id == noteId, ct);
            if (note is not null) db.Notes.Remove(note);
        }
        db.Timeline.Remove(e);
        await db.SaveChangesAsync(ct);
        feed.Emit("timeline.changed", new { recordType = e.RecordType, recordId = e.RecordId });
        await feed.PublishAsync();
    }
}

public sealed class EmailService(IAppDbContext db, RequestContext ctx, ChangeFeed feed, IEmailSender sender)
{
    public async Task<EmailDto> SendAsync(EmailRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        await feed.EnsureRecordExistsAsync(req.RecordType, req.RecordId, ct);
        var me = await db.Users.AsNoTracking().FirstAsync(u => u.Id == ctx.RequireUser(), ct);
        var msg = new EmailMessage
        {
            TenantId = ctx.RequireTenant(), To = req.To.Trim(), Subject = req.Subject.Trim(), Body = req.Body,
            SentById = me.Id, RecordType = req.RecordType, RecordId = req.RecordId
        };
        var html = EmailTemplates.Wrap(WebUtility.HtmlEncode(req.Body).Replace("\n", "<br>") +
                                       $"<p style=\"color:#6B7393;margin-top:24px\">— {WebUtility.HtmlEncode(me.FullName)}</p>");
        try
        {
            await sender.SendAsync(msg.To, msg.Subject, html, ct);
            msg.Delivered = true;
        }
        catch (Exception ex)
        {
            msg.Delivered = false;
            msg.Error = "ارسال ایمیل ناموفق بود: " + ex.Message;
        }
        db.Emails.Add(msg);
        feed.Add(req.RecordType, req.RecordId, TimelineKind.EmailSent, $"ایمیل فرستاد: {msg.Subject}", msg.Body,
            new() { ["to"] = msg.To, ["emailId"] = msg.Id.ToString(), ["delivered"] = msg.Delivered ? "true" : "false" });
        await feed.TouchAsync(req.RecordType, req.RecordId, ct);
        await db.SaveChangesAsync(ct);
        await feed.PublishAsync();
        if (!msg.Delivered) throw new AppException(502, msg.Error!);
        return new EmailDto(msg.Id, msg.To, msg.Subject, msg.Body, me.Ref(), msg.Delivered, msg.Error, msg.CreatedAt);
    }
}

public sealed class TimelineService(IAppDbContext db)
{
    public async Task<IReadOnlyList<TimelineItem>> ForRecordAsync(RecordType type, Guid id, string? kind, int take, CancellationToken ct)
    {
        // Contacts/companies also show events of their deals.
        var related = new List<(RecordType, Guid)> { (type, id) };
        if (type == RecordType.Contact)
            related.AddRange((await db.Deals.Where(d => d.ContactId == id).Select(d => d.Id).ToListAsync(ct)).Select(d => (RecordType.Deal, d)));
        if (type == RecordType.Company)
            related.AddRange((await db.Deals.Where(d => d.CompanyId == id).Select(d => d.Id).ToListAsync(ct)).Select(d => (RecordType.Deal, d)));
        var dealIds = related.Where(r => r.Item1 == RecordType.Deal && r.Item2 != id).Select(r => r.Item2).ToList();

        var query = db.Timeline.AsNoTracking().Include(t => t.Actor)
            .Where(t => (t.RecordType == type && t.RecordId == id) || (t.RecordType == RecordType.Deal && dealIds.Contains(t.RecordId)));
        // Deal "created" events are duplicated onto the contact/company; hide the deal-side copy there.
        if (type != RecordType.Deal) query = query.Where(t => !(t.RecordType == RecordType.Deal && t.Kind == TimelineKind.Created));
        query = kind switch
        {
            "notes" => query.Where(t => t.Kind == TimelineKind.Note),
            "activities" => query.Where(t => t.Kind == TimelineKind.ActivityCreated || t.Kind == TimelineKind.ActivityCompleted),
            "emails" => query.Where(t => t.Kind == TimelineKind.EmailSent),
            "changes" => query.Where(t => t.Kind == TimelineKind.FieldChanged || t.Kind == TimelineKind.StageChanged || t.Kind == TimelineKind.Created
                                          || t.Kind == TimelineKind.DealWon || t.Kind == TimelineKind.DealLost || t.Kind == TimelineKind.Automation),
            _ => query
        };
        var rows = await query.OrderByDescending(t => t.CreatedAt).Take(Math.Clamp(take, 1, 300)).ToListAsync(ct);
        var titles = await RecordTitles.LoadAsync(db, rows.Where(r => r.RecordType == RecordType.Deal && r.RecordId != id).Select(r => (r.RecordType, r.RecordId)), ct);
        return rows.Select(t => new TimelineItem(t.Id, t.Kind, t.Title, t.Body, t.Data, t.Actor.Ref(), t.CreatedAt, t.RecordType, t.RecordId,
            t.RecordId != id ? titles.GetValueOrDefault(t.RecordId) : null)).ToList();
    }

    public async Task<IReadOnlyList<TimelineItem>> RecentAsync(int take, CancellationToken ct)
    {
        var rows = await db.Timeline.AsNoTracking().Include(t => t.Actor)
            .Where(t => t.Kind != TimelineKind.FieldChanged)
            .OrderByDescending(t => t.CreatedAt).Take(Math.Clamp(take, 1, 100)).ToListAsync(ct);
        var titles = await RecordTitles.LoadAsync(db, rows.Select(r => (r.RecordType, r.RecordId)), ct);
        return rows.Select(t => new TimelineItem(t.Id, t.Kind, t.Title, t.Body, t.Data, t.Actor.Ref(), t.CreatedAt, t.RecordType, t.RecordId,
            titles.GetValueOrDefault(t.RecordId))).ToList();
    }
}
