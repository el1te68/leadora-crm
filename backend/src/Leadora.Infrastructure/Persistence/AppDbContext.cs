using System.Linq.Expressions;
using System.Text.Json;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Leadora.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser, IRealtime realtime)
    : DbContext(options), IAppDbContext
{
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<RecordTag> RecordTags => Set<RecordTag>();
    public DbSet<CustomFieldDefinition> CustomFields => Set<CustomFieldDefinition>();
    public DbSet<Pipeline> Pipelines => Set<Pipeline>();
    public DbSet<Stage> Stages => Set<Stage>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<EmailMessage> Emails => Set<EmailMessage>();
    public DbSet<TimelineEvent> Timeline => Set<TimelineEvent>();
    public DbSet<SavedView> SavedViews => Set<SavedView>();
    public DbSet<AutomationRule> Automations => Set<AutomationRule>();
    public DbSet<Notification> Notifications => Set<Notification>();

    /// <summary>
    /// Referenced by every global query filter. EF re-reads it per query, so the filter always uses the
    /// caller's workspace. No workspace selected → Guid.Empty → no tenant rows at all.
    /// </summary>
    public Guid CurrentTenantId => currentUser.TenantId ?? Guid.Empty;

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var et in b.Model.GetEntityTypes().Where(t => typeof(ITenantEntity).IsAssignableFrom(t.ClrType)))
        {
            // e => e.TenantId == this.CurrentTenantId
            var p = Expression.Parameter(et.ClrType, "e");
            var body = Expression.Equal(
                Expression.Property(p, nameof(ITenantEntity.TenantId)),
                Expression.Property(Expression.Constant(this), nameof(CurrentTenantId)));
            b.Entity(et.ClrType).HasQueryFilter(Expression.Lambda(body, p));
            b.Entity(et.ClrType).HasIndex(nameof(ITenantEntity.TenantId));
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var tenant = currentUser.TenantId;
        foreach (var entry in ChangeTracker.Entries<ITenantEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = tenant ?? throw new InvalidOperationException("Tenant row created without a workspace.");
            }

            // Inside a request, writing to another workspace's row is a bug → fail loudly.
            if (tenant is { } t && entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                                && entry.Entity.TenantId != t)
                throw new ForbiddenException();
        }

        var newNotifications = ChangeTracker.Entries<Notification>().Where(e => e.State == EntityState.Added).Select(e => e.Entity).ToList();
        var result = await base.SaveChangesAsync(cancellationToken);

        foreach (var n in newNotifications)
        {
            try
            {
                await realtime.ToUserAsync(n.UserId, "notification", new
                {
                    n.Id, n.Title, n.Body, n.Link, n.Kind, n.CreatedAt, isRead = false, workspaceId = n.TenantId
                });
            }
            catch
            {
                // Real-time delivery is best effort; the notification is persisted either way.
            }
        }
        return result;
    }
}

internal static class JsonColumns
{
    private static readonly JsonSerializerOptions Opts = new(JsonSerializerDefaults.Web);

    public static readonly ValueConverter<Dictionary<string, string>, string> DictConverter = new(
        v => JsonSerializer.Serialize(v, Opts),
        v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, Opts) ?? new Dictionary<string, string>());

    public static readonly ValueComparer<Dictionary<string, string>> DictComparer = new(
        (a, b) => JsonSerializer.Serialize(a, Opts) == JsonSerializer.Serialize(b, Opts),
        v => JsonSerializer.Serialize(v, Opts).GetHashCode(),
        v => new Dictionary<string, string>(v));

    public static readonly ValueConverter<List<string>, string> ListConverter = new(
        v => JsonSerializer.Serialize(v, Opts),
        v => JsonSerializer.Deserialize<List<string>>(v, Opts) ?? new List<string>());

    public static readonly ValueComparer<List<string>> ListComparer = new(
        (a, b) => JsonSerializer.Serialize(a, Opts) == JsonSerializer.Serialize(b, Opts),
        v => JsonSerializer.Serialize(v, Opts).GetHashCode(),
        v => v.ToList());
}
