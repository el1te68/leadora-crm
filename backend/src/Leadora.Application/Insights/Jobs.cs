using System.Net;
using Leadora.Application.Common;
using Leadora.Application.Engagement;
using Leadora.Application.Workspaces;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Insights;

/// <summary>
/// Work done by background hosted services. These run outside a request, so they deliberately
/// use IgnoreQueryFilters() and always set TenantId explicitly on what they write.
/// </summary>
public sealed class JobsService(IAppDbContext db, IEmailSender email, AppSettings settings)
{
    /// <summary>Activities due within the next 15 minutes (or already due) get one reminder.</summary>
    public async Task<int> SendRemindersAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var due = await db.Activities.IgnoreQueryFilters()
            .Where(a => !a.IsDone && a.ReminderSentAt == null && a.AssigneeId != null && a.DueAt != null
                        && a.DueAt <= now.AddMinutes(15) && a.DueAt >= now.AddHours(-1))
            .Take(200).ToListAsync(ct);
        foreach (var a in due)
        {
            a.ReminderSentAt = now;
            var link = a.RecordType is { } t && a.RecordId is { } id ? ChangeFeed.Link(t, id) : "/app/my-day";
            db.Notifications.Add(new Notification
            {
                TenantId = a.TenantId, UserId = a.AssigneeId!.Value, Kind = "reminder",
                Title = $"یادآوری: {Fa.Activity(a.Type)} «{a.Subject}»",
                Body = a.DueAt <= now ? "زمانش رسیده است." : "کمتر از ۱۵ دقیقه‌ی دیگر.", Link = link
            });
        }
        await db.SaveChangesAsync(ct);
        return due.Count;
    }

    /// <summary>Open deals untouched for <see cref="Deals.DealProjection.StaleDays"/> days notify their owner once.</summary>
    public async Task<int> DetectStaleDealsAsync(CancellationToken ct)
    {
        var before = DateTime.UtcNow.AddDays(-Deals.DealProjection.StaleDays);
        var stale = await db.Deals.IgnoreQueryFilters()
            .Where(d => d.Status == DealStatus.Open && d.OwnerId != null && d.StaleNotifiedAt == null && d.StageEnteredAt < before
                        && (d.LastActivityAt == null || d.LastActivityAt < before))
            .Take(200).ToListAsync(ct);
        foreach (var d in stale)
        {
            d.StaleNotifiedAt = DateTime.UtcNow;
            db.Notifications.Add(new Notification
            {
                TenantId = d.TenantId, UserId = d.OwnerId!.Value, Kind = "stale",
                Title = $"معامله‌ی «{d.Title}» راکد مانده است",
                Body = $"بیش از {Fa.Digits(Deals.DealProjection.StaleDays.ToString())} روز بدون تغییر مرحله یا فعالیت.",
                Link = ChangeFeed.Link(RecordType.Deal, d.Id)
            });
        }
        await db.SaveChangesAsync(ct);
        return stale.Count;
    }

    /// <summary>Sends the daily digest once per workspace per Tehran day after 08:00 (or immediately when forced).</summary>
    public async Task<int> SendDailyDigestsAsync(bool force, CancellationToken ct)
    {
        var local = DateTime.UtcNow.AddHours(3.5);
        if (!force && local.Hour < 8) return 0;
        var today = DateOnly.FromDateTime(local);
        var workspaces = await db.Workspaces.Where(w => force || w.DigestLastSentOn == null || w.DigestLastSentOn < today).ToListAsync(ct);
        var sent = 0;
        foreach (var ws in workspaces)
        {
            var userIds = await db.Memberships.Where(m => m.WorkspaceId == ws.Id).Select(m => m.UserId).ToListAsync(ct);
            foreach (var uid in userIds)
            {
                if (await SendDigestAsync(ws, uid, ct)) sent++;
            }
            ws.DigestLastSentOn = today;
        }
        await db.SaveChangesAsync(ct);
        return sent;
    }

    public async Task<bool> SendDigestAsync(Workspace ws, Guid userId, CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        var now = DateTime.UtcNow;
        var (dayStart, dayEnd) = ActivityService.TehranDay(now);
        var acts = db.Activities.IgnoreQueryFilters().Where(a => a.TenantId == ws.Id && a.AssigneeId == userId && !a.IsDone);
        var today = await acts.Where(a => a.DueAt >= dayStart && a.DueAt < dayEnd).OrderBy(a => a.DueAt).Take(10).ToListAsync(ct);
        var overdue = await acts.CountAsync(a => a.DueAt < dayStart, ct);
        var weekEnd = DateOnly.FromDateTime(now.AddDays(7));
        var closing = await db.Deals.IgnoreQueryFilters()
            .Where(d => d.TenantId == ws.Id && d.OwnerId == userId && d.Status == DealStatus.Open && d.ExpectedCloseDate != null && d.ExpectedCloseDate <= weekEnd)
            .OrderBy(d => d.ExpectedCloseDate).Take(5).ToListAsync(ct);
        var wonYesterday = await db.Deals.IgnoreQueryFilters()
            .Where(d => d.TenantId == ws.Id && d.Status == DealStatus.Won && d.ClosedAt >= dayStart.AddDays(-1) && d.ClosedAt < dayStart)
            .SumAsync(d => d.Value, ct);

        var li = string.Join("", today.Select(a =>
            $"<li>{WebUtility.HtmlEncode(Fa.Activity(a.Type))}: {WebUtility.HtmlEncode(a.Subject)} <span style=\"color:#6B7393\">— {Fa.Digits(a.DueAt!.Value.AddHours(3.5).ToString("HH:mm"))}</span></li>"));
        var deals = string.Join("", closing.Select(d =>
            $"<li>{WebUtility.HtmlEncode(d.Title)} — <b>{Fa.Toman(d.Value)}</b> ({Fa.Date(d.ExpectedCloseDate)})</li>"));
        var body = $"""
            <p>سلام {WebUtility.HtmlEncode(user.FullName)}، این خلاصه‌ی امروز شما در «{WebUtility.HtmlEncode(ws.Name)}» است.</p>
            <p><b>کارهای امروز ({Fa.Digits(today.Count.ToString())})</b></p><ul>{(li.Length > 0 ? li : "<li>کاری برای امروز ندارید.</li>")}</ul>
            {(overdue > 0 ? $"<p style=\"color:#C23A55\"><b>{Fa.Digits(overdue.ToString())} کار عقب‌افتاده</b> منتظر شماست.</p>" : "")}
            <p><b>معامله‌هایی که این هفته بسته می‌شوند</b></p><ul>{(deals.Length > 0 ? deals : "<li>موردی نیست.</li>")}</ul>
            {(wonYesterday > 0 ? $"<p>تیم دیروز <b>{Fa.Toman(wonYesterday)}</b> معامله‌ی برنده داشت. 🎉</p>" : "")}
            """;
        try
        {
            await email.SendAsync(user.Email, $"خلاصه‌ی روزانه‌ی لیدورا — {Fa.Date(now)}",
                EmailTemplates.Wrap(body, "باز کردن «روز من»", settings.PublicUrl.TrimEnd('/') + "/app/my-day"), ct);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
