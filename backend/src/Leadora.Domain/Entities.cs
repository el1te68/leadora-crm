namespace Leadora.Domain;

/// <summary>Every row that belongs to a workspace implements this. EF applies a global query filter on it.</summary>
public interface ITenantEntity
{
    Guid TenantId { get; set; }
}

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public abstract class TenantEntity : Entity, ITenantEntity
{
    public Guid TenantId { get; set; }
}

public enum WorkspaceRole { Owner = 0, Admin = 1, Member = 2 }
public enum RecordType { Contact = 0, Company = 1, Deal = 2 }
public enum DealStatus { Open = 0, Won = 1, Lost = 2 }
public enum ActivityType { Task = 0, Call = 1, Meeting = 2 }
public enum CustomFieldType { Text = 0, Number = 1, Date = 2, Select = 3 }
public enum LifecycleStage { Subscriber = 0, Lead = 1, Qualified = 2, Opportunity = 3, Customer = 4 }

public enum TimelineKind
{
    Created = 0, FieldChanged = 1, StageChanged = 2, Note = 3, ActivityCreated = 4,
    ActivityCompleted = 5, EmailSent = 6, DealWon = 7, DealLost = 8, Automation = 9
}

public enum AutomationTrigger { DealCreated = 0, DealStageChanged = 1, DealWon = 2, DealLost = 3, ContactCreated = 4 }
public enum AutomationAction { CreateTask = 0, AssignOwner = 1, SendNotification = 2 }

public class Workspace : Entity
{
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Industry { get; set; }
    public string AccentColor { get; set; } = "#2B3A9E";
    public string Currency { get; set; } = "IRT";
    public DateOnly? DigestLastSentOn { get; set; }
    public List<Membership> Members { get; set; } = [];
}

public class AppUser : Entity
{
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string AvatarColor { get; set; } = "#2B3A9E";
    public string? JobTitle { get; set; }
    public List<Membership> Memberships { get; set; } = [];
}

public class Membership
{
    public Guid WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public WorkspaceRole Role { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class Invitation : TenantEntity
{
    public string Email { get; set; } = "";
    public WorkspaceRole Role { get; set; } = WorkspaceRole.Member;
    public string Token { get; set; } = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
    public Guid InvitedById { get; set; }
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
    public DateTime? AcceptedAt { get; set; }
}

public class Company : TenantEntity
{
    public string Name { get; set; } = "";
    public string? Domain { get; set; }
    public string? Industry { get; set; }
    public string? Size { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public Guid? OwnerId { get; set; }
    public AppUser? Owner { get; set; }
    public Dictionary<string, string> CustomFields { get; set; } = [];
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastActivityAt { get; set; }
    public List<Contact> Contacts { get; set; } = [];
}

public class Contact : TenantEntity
{
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? JobTitle { get; set; }
    public string? City { get; set; }
    public string? Source { get; set; }
    public LifecycleStage Lifecycle { get; set; } = LifecycleStage.Lead;
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }
    public Guid? OwnerId { get; set; }
    public AppUser? Owner { get; set; }
    public Dictionary<string, string> CustomFields { get; set; } = [];
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastActivityAt { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}

public class Tag : TenantEntity
{
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#2B3A9E";
}

public class RecordTag : ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid TagId { get; set; }
    public Tag? Tag { get; set; }
    public RecordType RecordType { get; set; }
    public Guid RecordId { get; set; }
}

public class CustomFieldDefinition : TenantEntity
{
    public RecordType EntityType { get; set; }
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public CustomFieldType Type { get; set; }
    public List<string> Options { get; set; } = [];
    public int Order { get; set; }
}

public class Pipeline : TenantEntity
{
    public string Name { get; set; } = "";
    public int Order { get; set; }
    public List<Stage> Stages { get; set; } = [];
}

public class Stage : TenantEntity
{
    public Guid PipelineId { get; set; }
    public Pipeline? Pipeline { get; set; }
    public string Name { get; set; } = "";
    public int Order { get; set; }
    public int Probability { get; set; }
    public string Color { get; set; } = "#2B3A9E";
}

public class Deal : TenantEntity
{
    public string Title { get; set; } = "";
    public long Value { get; set; }
    public Guid PipelineId { get; set; }
    public Pipeline? Pipeline { get; set; }
    public Guid StageId { get; set; }
    public Stage? Stage { get; set; }
    public Guid? ContactId { get; set; }
    public Contact? Contact { get; set; }
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }
    public Guid? OwnerId { get; set; }
    public AppUser? Owner { get; set; }
    /// <summary>Null = use stage probability.</summary>
    public int? Probability { get; set; }
    public DateOnly? ExpectedCloseDate { get; set; }
    public DealStatus Status { get; set; }
    public string? LostReason { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime StageEnteredAt { get; set; } = DateTime.UtcNow;
    public DateTime? StaleNotifiedAt { get; set; }
    public double SortOrder { get; set; }
    public Dictionary<string, string> CustomFields { get; set; } = [];
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastActivityAt { get; set; }
}

public class Activity : TenantEntity
{
    public ActivityType Type { get; set; }
    public string Subject { get; set; } = "";
    public string? Description { get; set; }
    public DateTime? DueAt { get; set; }
    public int? DurationMinutes { get; set; }
    public Guid? AssigneeId { get; set; }
    public AppUser? Assignee { get; set; }
    public Guid? CreatedById { get; set; }
    public bool IsDone { get; set; }
    public DateTime? DoneAt { get; set; }
    public RecordType? RecordType { get; set; }
    public Guid? RecordId { get; set; }
    public DateTime? ReminderSentAt { get; set; }
}

public class Note : TenantEntity
{
    public string Body { get; set; } = "";
    public Guid AuthorId { get; set; }
    public AppUser? Author { get; set; }
    public RecordType RecordType { get; set; }
    public Guid RecordId { get; set; }
}

public class EmailMessage : TenantEntity
{
    public string To { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public Guid SentById { get; set; }
    public RecordType RecordType { get; set; }
    public Guid RecordId { get; set; }
    public bool Delivered { get; set; }
    public string? Error { get; set; }
}

public class TimelineEvent : TenantEntity
{
    public RecordType RecordType { get; set; }
    public Guid RecordId { get; set; }
    public TimelineKind Kind { get; set; }
    public Guid? ActorId { get; set; }
    public AppUser? Actor { get; set; }
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    /// <summary>Free-form details: field/old/new, stage ids, activity id …</summary>
    public Dictionary<string, string> Data { get; set; } = [];
}

public class SavedView : TenantEntity
{
    public Guid UserId { get; set; }
    public RecordType EntityType { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Serialized filter/sort state owned by the client.</summary>
    public string Query { get; set; } = "{}";
}

public class AutomationRule : TenantEntity
{
    public string Name { get; set; } = "";
    public AutomationTrigger Trigger { get; set; }
    /// <summary>Optional stage filter for stage-based triggers.</summary>
    public Guid? StageId { get; set; }
    public Guid? PipelineId { get; set; }
    public AutomationAction Action { get; set; }
    /// <summary>Action params: subject, dueInDays, userId, message.</summary>
    public Dictionary<string, string> Config { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public int RunCount { get; set; }
    public DateTime? LastRunAt { get; set; }
}

public class Notification : TenantEntity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    public string? Link { get; set; }
    public string Kind { get; set; } = "info";
    public DateTime? ReadAt { get; set; }
}
