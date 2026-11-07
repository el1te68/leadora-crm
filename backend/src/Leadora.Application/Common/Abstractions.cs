using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Common;

public interface IAppDbContext
{
    DbSet<Workspace> Workspaces { get; }
    DbSet<AppUser> Users { get; }
    DbSet<Membership> Memberships { get; }
    DbSet<Invitation> Invitations { get; }
    DbSet<Company> Companies { get; }
    DbSet<Contact> Contacts { get; }
    DbSet<Tag> Tags { get; }
    DbSet<RecordTag> RecordTags { get; }
    DbSet<CustomFieldDefinition> CustomFields { get; }
    DbSet<Pipeline> Pipelines { get; }
    DbSet<Stage> Stages { get; }
    DbSet<Deal> Deals { get; }
    DbSet<Activity> Activities { get; }
    DbSet<Note> Notes { get; }
    DbSet<EmailMessage> Emails { get; }
    DbSet<TimelineEvent> Timeline { get; }
    DbSet<SavedView> SavedViews { get; }
    DbSet<AutomationRule> Automations { get; }
    DbSet<Notification> Notifications { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

/// <summary>Who is calling and in which workspace. Filled by the Api layer per request.</summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid? TenantId { get; }
    WorkspaceRole? Role { get; }
}

public sealed class RequestContext : ICurrentUser
{
    public Guid? UserId { get; set; }
    public Guid? TenantId { get; set; }
    public WorkspaceRole? Role { get; set; }

    public Guid RequireUser() => UserId ?? throw new UnauthorizedException();
    public Guid RequireTenant() => TenantId ?? throw new AppException(400, "فضای کاری انتخاب نشده است.");

    public void RequireAdmin()
    {
        if (Role is not (WorkspaceRole.Owner or WorkspaceRole.Admin))
            throw new ForbiddenException("این کار فقط از مدیر فضای کاری برمی‌آید.");
    }
}

/// <summary>Real-time fan-out (SignalR in the Api layer).</summary>
public interface IRealtime
{
    Task ToWorkspaceAsync(Guid workspaceId, string evt, object payload);
    Task ToUserAsync(Guid userId, string evt, object payload);
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public interface ITokenService
{
    string CreateToken(AppUser user);
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record UserRef(Guid Id, string FullName, string AvatarColor);
public sealed record NamedRef(Guid Id, string Name);
public sealed record TagDto(Guid Id, string Name, string Color);

public static class Mapping
{
    public static UserRef? Ref(this AppUser? u) => u is null ? null : new UserRef(u.Id, u.FullName, u.AvatarColor);
}
