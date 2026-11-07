using Leadora.Application.Common;
using Leadora.Application.Engagement;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Insights;

// ---------- Notifications ----------

public sealed record NotificationDto(Guid Id, string Title, string? Body, string? Link, string Kind, DateTime CreatedAt, bool IsRead);
public sealed record NotificationPage(IReadOnlyList<NotificationDto> Items, int Unread);

public sealed class NotificationService(IAppDbContext db, RequestContext ctx)
{
    public async Task<NotificationPage> ListAsync(int take, CancellationToken ct)
    {
        var me = ctx.RequireUser();
        var items = await db.Notifications.AsNoTracking().Where(n => n.UserId == me).OrderByDescending(n => n.CreatedAt)
            .Take(Math.Clamp(take, 1, 100))
            .Select(n => new NotificationDto(n.Id, n.Title, n.Body, n.Link, n.Kind, n.CreatedAt, n.ReadAt != null)).ToListAsync(ct);
        var unread = await db.Notifications.CountAsync(n => n.UserId == me && n.ReadAt == null, ct);
        return new NotificationPage(items, unread);
    }

    public async Task MarkReadAsync(Guid? id, CancellationToken ct)
    {
        var me = ctx.RequireUser();
        var q = db.Notifications.Where(n => n.UserId == me && n.ReadAt == null);
        if (id is { } nid) q = q.Where(n => n.Id == nid);
        foreach (var n in await q.ToListAsync(ct)) n.ReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}

// ---------- Global search ----------

public sealed record SearchHit(RecordType Type, Guid Id, string Title, string? Subtitle, string? Meta);
public sealed record SearchResult(IReadOnlyList<SearchHit> Contacts, IReadOnlyList<SearchHit> Companies, IReadOnlyList<SearchHit> Deals);

public sealed class SearchService(IAppDbContext db)
{
    public async Task<SearchResult> SearchAsync(string? q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            // Empty query → recently updated records so the palette is never blank.
            var rc = await db.Contacts.AsNoTracking().OrderByDescending(c => c.UpdatedAt).Take(4)
                .Select(c => new SearchHit(RecordType.Contact, c.Id, c.FirstName + " " + c.LastName, c.JobTitle, c.Company != null ? c.Company.Name : null)).ToListAsync(ct);
            var rco = await db.Companies.AsNoTracking().OrderByDescending(c => c.UpdatedAt).Take(3)
                .Select(c => new SearchHit(RecordType.Company, c.Id, c.Name, c.Industry, c.City)).ToListAsync(ct);
            var rd = await db.Deals.AsNoTracking().Where(d => d.Status == DealStatus.Open).OrderByDescending(d => d.UpdatedAt).Take(4)
                .Select(d => new SearchHit(RecordType.Deal, d.Id, d.Title, d.Stage!.Name, d.Value.ToString())).ToListAsync(ct);
            return new SearchResult(rc, rco, rd);
        }

        var term = q.Trim().ToLower();
        var contacts = await db.Contacts.AsNoTracking()
            .Where(c => (c.FirstName + " " + c.LastName).ToLower().Contains(term) || (c.Email != null && c.Email.Contains(term)) || (c.Phone != null && c.Phone.Contains(term)))
            .OrderBy(c => c.FirstName).Take(6)
            .Select(c => new SearchHit(RecordType.Contact, c.Id, c.FirstName + " " + c.LastName, c.Email ?? c.JobTitle, c.Company != null ? c.Company.Name : null))
            .ToListAsync(ct);
        var companies = await db.Companies.AsNoTracking()
            .Where(c => c.Name.ToLower().Contains(term) || (c.Domain != null && c.Domain.ToLower().Contains(term)))
            .OrderBy(c => c.Name).Take(5)
            .Select(c => new SearchHit(RecordType.Company, c.Id, c.Name, c.Domain ?? c.Industry, c.City)).ToListAsync(ct);
        var deals = await db.Deals.AsNoTracking()
            .Where(d => d.Title.ToLower().Contains(term) || (d.Company != null && d.Company.Name.ToLower().Contains(term)))
            .OrderByDescending(d => d.UpdatedAt).Take(6)
            .Select(d => new SearchHit(RecordType.Deal, d.Id, d.Title, d.Stage!.Name, d.Value.ToString())).ToListAsync(ct);
        return new SearchResult(contacts, companies, deals);
    }
}

// ---------- Reports ----------

public sealed record StageValue(Guid StageId, string Stage, string Color, int Count, long Value, long Weighted);
public sealed record MonthValue(string Month, long Expected, long Weighted, long Won);
public sealed record TeammateActivity(UserRef User, int Calls, int Meetings, int Tasks, int Notes, int Emails, int DealsWon, long WonValue);
public sealed record PeriodPoint(DateOnly Week, int Created, int Won, int Lost, long WonValue);
public sealed record LostReason(string Reason, int Count);
public sealed record Kpis(long OpenValue, long WeightedValue, long WonValue, int WonCount, int LostCount, double WinRate, long AvgDealSize,
    double AvgDaysToClose, int NewContacts, int ActivitiesDone, long PrevWonValue, double PrevWinRate);

public sealed record ReportDto(Kpis Kpis, IReadOnlyList<StageValue> Pipeline, IReadOnlyList<MonthValue> Forecast,
    IReadOnlyList<TeammateActivity> Team, IReadOnlyList<PeriodPoint> OverTime, IReadOnlyList<LostReason> LostReasons,
    IReadOnlyList<TimelineItem> Recent, Guid PipelineId);

public sealed class ReportService(IAppDbContext db, RequestContext ctx, TimelineService timeline)
{
    public async Task<ReportDto> SummaryAsync(DateOnly? from, DateOnly? to, Guid? ownerId, Guid? pipelineId, CancellationToken ct)
    {
        var end = (to ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var start = (from ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-89))).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var span = end - start;
        var prevStart = start - span;

        var pipeline = await db.Pipelines.AsNoTracking().Include(p => p.Stages).Where(p => pipelineId == null || p.Id == pipelineId)
            .OrderBy(p => p.Order).FirstOrDefaultAsync(ct) ?? throw new NotFoundException("پایپ‌لاین");

        // Small per-tenant datasets → aggregate in memory; keeps the query layer portable.
        var deals = await db.Deals.AsNoTracking().Where(d => ownerId == null || d.OwnerId == ownerId)
            .Select(d => new { d.Id, d.PipelineId, d.StageId, d.Value, d.Status, d.Probability, d.ExpectedCloseDate, d.CreatedAt, d.ClosedAt, d.LostReason, d.OwnerId })
            .ToListAsync(ct);
        var stageProb = pipeline.Stages.ToDictionary(s => s.Id, s => s.Probability);
        var allStageProb = await db.Stages.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.Probability, ct);
        int Prob(Guid stageId, int? p) => p ?? allStageProb.GetValueOrDefault(stageId);

        var open = deals.Where(d => d.Status == DealStatus.Open).ToList();
        var closedIn = deals.Where(d => d.ClosedAt >= start && d.ClosedAt <= end).ToList();
        var closedPrev = deals.Where(d => d.ClosedAt >= prevStart && d.ClosedAt < start).ToList();
        var won = closedIn.Where(d => d.Status == DealStatus.Won).ToList();
        var lost = closedIn.Where(d => d.Status == DealStatus.Lost).ToList();
        var prevWon = closedPrev.Where(d => d.Status == DealStatus.Won).ToList();
        double Rate(int w, int l) => w + l == 0 ? 0 : Math.Round(100.0 * w / (w + l), 1);

        var newContacts = await db.Contacts.CountAsync(c => c.CreatedAt >= start && c.CreatedAt <= end && (ownerId == null || c.OwnerId == ownerId), ct);
        var actsDone = await db.Activities.CountAsync(a => a.IsDone && a.DoneAt >= start && a.DoneAt <= end && (ownerId == null || a.AssigneeId == ownerId), ct);

        var kpis = new Kpis(
            open.Sum(d => d.Value),
            open.Sum(d => d.Value * Prob(d.StageId, d.Probability) / 100),
            won.Sum(d => d.Value), won.Count, lost.Count, Rate(won.Count, lost.Count),
            won.Count == 0 ? 0 : won.Sum(d => d.Value) / won.Count,
            won.Count == 0 ? 0 : Math.Round(won.Average(d => (d.ClosedAt!.Value - d.CreatedAt).TotalDays), 1),
            newContacts, actsDone, prevWon.Sum(d => d.Value), Rate(prevWon.Count, closedPrev.Count(d => d.Status == DealStatus.Lost)));

        var pipelineByStage = pipeline.Stages.OrderBy(s => s.Order).Select(s =>
        {
            var inStage = open.Where(d => d.StageId == s.Id).ToList();
            return new StageValue(s.Id, s.Name, s.Color, inStage.Count, inStage.Sum(d => d.Value), inStage.Sum(d => d.Value * Prob(d.StageId, d.Probability) / 100));
        }).ToList();

        // Forecast: next 6 Persian months by expected close date.
        var pc = new System.Globalization.PersianCalendar();
        var nowLocal = DateTime.UtcNow.AddHours(3.5);
        var forecast = new List<MonthValue>();
        for (var i = 0; i < 6; i++)
        {
            var mStart = pc.AddMonths(new DateTime(pc.GetYear(nowLocal), pc.GetMonth(nowLocal), 1, pc), i);
            var mEnd = pc.AddMonths(mStart, 1);
            var label = $"{pc.GetYear(mStart)}-{pc.GetMonth(mStart):00}";
            var inMonth = open.Where(d => d.ExpectedCloseDate is { } e && e.ToDateTime(TimeOnly.MinValue) >= mStart && e.ToDateTime(TimeOnly.MinValue) < mEnd).ToList();
            var wonInMonth = deals.Where(d => d.Status == DealStatus.Won && d.ClosedAt is { } c && c.AddHours(3.5) >= mStart && c.AddHours(3.5) < mEnd).Sum(d => d.Value);
            forecast.Add(new MonthValue(label, inMonth.Sum(d => d.Value), inMonth.Sum(d => d.Value * Prob(d.StageId, d.Probability) / 100), wonInMonth));
        }

        var tenant = ctx.RequireTenant();
        var members = await db.Memberships.AsNoTracking().Where(m => m.WorkspaceId == tenant).Select(m => m.User!).ToListAsync(ct);
        var acts = await db.Activities.AsNoTracking().Where(a => a.IsDone && a.DoneAt >= start && a.DoneAt <= end)
            .GroupBy(a => new { a.AssigneeId, a.Type }).Select(g => new { g.Key.AssigneeId, g.Key.Type, Count = g.Count() }).ToListAsync(ct);
        var notes = await db.Notes.AsNoTracking().Where(n => n.CreatedAt >= start && n.CreatedAt <= end)
            .GroupBy(n => n.AuthorId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var emails = await db.Emails.AsNoTracking().Where(n => n.CreatedAt >= start && n.CreatedAt <= end)
            .GroupBy(n => n.SentById).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var team = members.Where(u => ownerId == null || u.Id == ownerId).Select(u => new TeammateActivity(u.Ref()!,
            acts.Where(a => a.AssigneeId == u.Id && a.Type == ActivityType.Call).Sum(a => a.Count),
            acts.Where(a => a.AssigneeId == u.Id && a.Type == ActivityType.Meeting).Sum(a => a.Count),
            acts.Where(a => a.AssigneeId == u.Id && a.Type == ActivityType.Task).Sum(a => a.Count),
            notes.Where(n => n.Key == u.Id).Sum(n => n.Count), emails.Where(e => e.Key == u.Id).Sum(e => e.Count),
            won.Count(d => d.OwnerId == u.Id), won.Where(d => d.OwnerId == u.Id).Sum(d => d.Value)))
            .OrderByDescending(t => t.WonValue).ThenByDescending(t => t.Calls + t.Meetings).ToList();

        var overTime = new List<PeriodPoint>();
        var weekStart = DateOnly.FromDateTime(start);
        while (weekStart.ToDateTime(TimeOnly.MinValue) <= end)
        {
            var ws = weekStart.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var we = ws.AddDays(7);
            overTime.Add(new PeriodPoint(weekStart,
                deals.Count(d => d.CreatedAt >= ws && d.CreatedAt < we),
                deals.Count(d => d.Status == DealStatus.Won && d.ClosedAt >= ws && d.ClosedAt < we),
                deals.Count(d => d.Status == DealStatus.Lost && d.ClosedAt >= ws && d.ClosedAt < we),
                deals.Where(d => d.Status == DealStatus.Won && d.ClosedAt >= ws && d.ClosedAt < we).Sum(d => d.Value)));
            weekStart = weekStart.AddDays(7);
        }

        var reasons = lost.GroupBy(d => d.LostReason ?? "نامشخص").Select(g => new LostReason(g.Key, g.Count()))
            .OrderByDescending(r => r.Count).Take(6).ToList();

        return new ReportDto(kpis, pipelineByStage, forecast, team, overTime, reasons, await timeline.RecentAsync(12, ct), pipeline.Id);
    }
}
