using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Common;

/// <summary>
/// Collects timeline (audit) events and notifications during a unit of work and broadcasts
/// them after <see cref="IAppDbContext.SaveChangesAsync"/>.
/// </summary>
public sealed class ChangeFeed(IAppDbContext db, RequestContext ctx, IRealtime rt)
{
    private readonly HashSet<(RecordType, Guid)> _touched = [];
    private readonly List<(string evt, object payload)> _events = [];

    public TimelineEvent Add(RecordType type, Guid recordId, TimelineKind kind, string title, string? body = null,
        Dictionary<string, string>? data = null, Guid? actorId = null)
    {
        var e = new TimelineEvent
        {
            TenantId = ctx.RequireTenant(),
            RecordType = type,
            RecordId = recordId,
            Kind = kind,
            Title = title,
            Body = body,
            Data = data ?? [],
            ActorId = actorId ?? ctx.UserId,
        };
        db.Timeline.Add(e);
        _touched.Add((type, recordId));
        return e;
    }

    /// <summary>Audit a single field change when the value actually changed.</summary>
    public void Diff(RecordType type, Guid recordId, string label, string? oldValue, string? newValue)
    {
        if ((oldValue ?? "") == (newValue ?? "")) return;
        Add(type, recordId, TimelineKind.FieldChanged, $"«{label}» تغییر کرد", null,
            new() { ["field"] = label, ["old"] = oldValue ?? "", ["new"] = newValue ?? "" });
    }

    public void Notify(Guid userId, string title, string? body = null, string? link = null, string kind = "info")
    {
        // Don't notify people about their own actions.
        if (userId == ctx.UserId && kind != "reminder") return;
        db.Notifications.Add(new Notification
        {
            TenantId = ctx.RequireTenant(), UserId = userId, Title = title, Body = body, Link = link, Kind = kind
        });
    }

    public void Emit(string evt, object payload) => _events.Add((evt, payload));

    public async Task PublishAsync()
    {
        if (ctx.TenantId is not { } tenant) return;
        foreach (var (type, id) in _touched)
            await rt.ToWorkspaceAsync(tenant, "timeline.changed", new { recordType = type, recordId = id, actorId = ctx.UserId });
        foreach (var (evt, payload) in _events)
            await rt.ToWorkspaceAsync(tenant, evt, payload);
        _touched.Clear();
        _events.Clear();
    }

    /// <summary>Bumps LastActivityAt on the record a note/activity/email is attached to.</summary>
    public async Task TouchAsync(RecordType type, Guid id, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        switch (type)
        {
            case RecordType.Contact:
                var c = await db.Contacts.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (c is not null) c.LastActivityAt = now;
                break;
            case RecordType.Company:
                var co = await db.Companies.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (co is not null) co.LastActivityAt = now;
                break;
            case RecordType.Deal:
                var d = await db.Deals.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (d is not null) d.LastActivityAt = now;
                break;
        }
    }

    public async Task EnsureRecordExistsAsync(RecordType type, Guid id, CancellationToken ct)
    {
        var exists = type switch
        {
            RecordType.Contact => await db.Contacts.AnyAsync(x => x.Id == id, ct),
            RecordType.Company => await db.Companies.AnyAsync(x => x.Id == id, ct),
            RecordType.Deal => await db.Deals.AnyAsync(x => x.Id == id, ct),
            _ => false
        };
        if (!exists) throw new NotFoundException("رکورد");
    }

    public async Task<string?> RecordTitleAsync(RecordType type, Guid id, CancellationToken ct) => type switch
    {
        RecordType.Contact => await db.Contacts.Where(x => x.Id == id).Select(x => x.FirstName + " " + x.LastName).FirstOrDefaultAsync(ct),
        RecordType.Company => await db.Companies.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(ct),
        RecordType.Deal => await db.Deals.Where(x => x.Id == id).Select(x => x.Title).FirstOrDefaultAsync(ct),
        _ => null
    };

    public static string Link(RecordType type, Guid id) => type switch
    {
        RecordType.Contact => $"/app/contacts/{id}",
        RecordType.Company => $"/app/companies/{id}",
        _ => $"/app/deals/{id}"
    };
}

public static class Fa
{
    private static readonly System.Globalization.CultureInfo FaCulture = new("fa-IR");

    public static string Digits(string s)
    {
        var chars = s.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
            if (chars[i] is >= '0' and <= '9') chars[i] = (char)('۰' + (chars[i] - '0'));
        return new string(chars);
    }

    public static string Toman(long v) => Digits(v.ToString("N0", System.Globalization.CultureInfo.InvariantCulture)).Replace(",", "٬") + " تومان";

    public static string Date(DateTime utc)
    {
        var pc = new System.Globalization.PersianCalendar();
        var local = utc.AddHours(3.5);
        return Digits($"{pc.GetYear(local)}/{pc.GetMonth(local):00}/{pc.GetDayOfMonth(local):00}");
    }

    public static string Date(DateOnly? d) => d is null ? "" : Date(d.Value.ToDateTime(TimeOnly.MinValue));

    public static string Lifecycle(LifecycleStage s) => s switch
    {
        LifecycleStage.Subscriber => "مشترک",
        LifecycleStage.Lead => "سرنخ",
        LifecycleStage.Qualified => "واجد شرایط",
        LifecycleStage.Opportunity => "فرصت",
        _ => "مشتری"
    };

    public static string Activity(ActivityType t) => t switch
    {
        ActivityType.Call => "تماس",
        ActivityType.Meeting => "جلسه",
        _ => "کار"
    };

    public static string Role(WorkspaceRole r) => r switch
    {
        WorkspaceRole.Owner => "مالک",
        WorkspaceRole.Admin => "مدیر",
        _ => "عضو"
    };

    public static System.Globalization.CultureInfo Culture => FaCulture;
}
