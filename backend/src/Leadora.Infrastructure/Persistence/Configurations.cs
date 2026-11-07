using Leadora.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Leadora.Infrastructure.Persistence;

internal static class Cfg
{
    public static void Json(this PropertyBuilder<Dictionary<string, string>> p) =>
        p.HasConversion(JsonColumns.DictConverter, JsonColumns.DictComparer).HasColumnType("jsonb");
}

internal sealed class WorkspaceCfg : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> b)
    {
        b.Property(x => x.Name).HasMaxLength(80).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(120).IsRequired();
        b.HasIndex(x => x.Slug).IsUnique();
        b.Property(x => x.AccentColor).HasMaxLength(9);
        b.Property(x => x.Currency).HasMaxLength(5);
    }
}

internal sealed class UserCfg : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.ToTable("Users");
        b.Property(x => x.Email).HasMaxLength(160).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.FullName).HasMaxLength(80).IsRequired();
        b.Property(x => x.AvatarColor).HasMaxLength(9);
    }
}

internal sealed class MembershipCfg : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> b)
    {
        b.HasKey(x => new { x.WorkspaceId, x.UserId });
        b.HasOne(x => x.Workspace).WithMany(w => w.Members).HasForeignKey(x => x.WorkspaceId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany(u => u.Memberships).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class InvitationCfg : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> b)
    {
        b.Property(x => x.Email).HasMaxLength(160);
        b.Property(x => x.Token).HasMaxLength(64);
        b.HasIndex(x => x.Token).IsUnique();
    }
}

internal sealed class CompanyCfg : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> b)
    {
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.CustomFields).Json();
        b.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.Name });
    }
}

internal sealed class ContactCfg : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> b)
    {
        b.Property(x => x.FirstName).HasMaxLength(60).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(60);
        b.Property(x => x.Email).HasMaxLength(120);
        b.Ignore(x => x.FullName);
        b.Property(x => x.CustomFields).Json();
        b.HasOne(x => x.Company).WithMany(c => c.Contacts).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.CreatedAt });
    }
}

internal sealed class TagCfg : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> b) => b.Property(x => x.Name).HasMaxLength(40).IsRequired();
}

internal sealed class RecordTagCfg : IEntityTypeConfiguration<RecordTag>
{
    public void Configure(EntityTypeBuilder<RecordTag> b)
    {
        b.HasKey(x => new { x.TagId, x.RecordType, x.RecordId });
        b.HasOne(x => x.Tag).WithMany().HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.RecordType, x.RecordId });
    }
}

internal sealed class CustomFieldCfg : IEntityTypeConfiguration<CustomFieldDefinition>
{
    public void Configure(EntityTypeBuilder<CustomFieldDefinition> b)
    {
        b.Property(x => x.Key).HasMaxLength(40);
        b.Property(x => x.Label).HasMaxLength(60);
        b.Property(x => x.Options).HasConversion(JsonColumns.ListConverter, JsonColumns.ListComparer).HasColumnType("jsonb");
    }
}

internal sealed class PipelineCfg : IEntityTypeConfiguration<Pipeline>
{
    public void Configure(EntityTypeBuilder<Pipeline> b)
    {
        b.Property(x => x.Name).HasMaxLength(60);
        b.HasMany(x => x.Stages).WithOne(s => s.Pipeline).HasForeignKey(s => s.PipelineId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class StageCfg : IEntityTypeConfiguration<Stage>
{
    public void Configure(EntityTypeBuilder<Stage> b) => b.Property(x => x.Name).HasMaxLength(40);
}

internal sealed class DealCfg : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> b)
    {
        b.Property(x => x.Title).HasMaxLength(140).IsRequired();
        b.Property(x => x.CustomFields).Json();
        b.HasOne(x => x.Pipeline).WithMany().HasForeignKey(x => x.PipelineId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Stage).WithMany().HasForeignKey(x => x.StageId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Contact).WithMany().HasForeignKey(x => x.ContactId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.PipelineId, x.Status });
    }
}

internal sealed class ActivityCfg : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> b)
    {
        b.Property(x => x.Subject).HasMaxLength(160);
        b.HasOne(x => x.Assignee).WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.AssigneeId, x.IsDone, x.DueAt });
        b.HasIndex(x => new { x.RecordType, x.RecordId });
    }
}

internal sealed class NoteCfg : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> b)
    {
        b.HasOne(x => x.Author).WithMany().HasForeignKey(x => x.AuthorId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.RecordType, x.RecordId });
    }
}

internal sealed class EmailCfg : IEntityTypeConfiguration<EmailMessage>
{
    public void Configure(EntityTypeBuilder<EmailMessage> b)
    {
        b.ToTable("Emails");
        b.Property(x => x.To).HasMaxLength(160);
        b.Property(x => x.Subject).HasMaxLength(200);
    }
}

internal sealed class TimelineCfg : IEntityTypeConfiguration<TimelineEvent>
{
    public void Configure(EntityTypeBuilder<TimelineEvent> b)
    {
        b.ToTable("Timeline");
        b.Property(x => x.Title).HasMaxLength(300);
        b.Property(x => x.Data).Json();
        b.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.TenantId, x.RecordType, x.RecordId, x.CreatedAt });
    }
}

internal sealed class SavedViewCfg : IEntityTypeConfiguration<SavedView>
{
    public void Configure(EntityTypeBuilder<SavedView> b) => b.Property(x => x.Name).HasMaxLength(60);
}

internal sealed class AutomationCfg : IEntityTypeConfiguration<AutomationRule>
{
    public void Configure(EntityTypeBuilder<AutomationRule> b)
    {
        b.ToTable("Automations");
        b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.Config).Json();
    }
}

internal sealed class NotificationCfg : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.Property(x => x.Title).HasMaxLength(300);
        b.Property(x => x.Kind).HasMaxLength(20);
        b.HasIndex(x => new { x.TenantId, x.UserId, x.ReadAt });
    }
}
