using System.ComponentModel.DataAnnotations;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Workspaces;

public sealed record AppSettings(string PublicUrl);

public sealed record WorkspaceDto(Guid Id, string Name, string Slug, string? Industry, string AccentColor, string Currency, DateTime CreatedAt);
public sealed record MemberDto(Guid UserId, string FullName, string Email, string AvatarColor, string? JobTitle, WorkspaceRole Role, DateTime JoinedAt);
public sealed record InvitationDto(Guid Id, string Email, WorkspaceRole Role, DateTime ExpiresAt, string Link);

public sealed class UpdateWorkspaceRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(80, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    [StringLength(80, ErrorMessage = Msg.TooLong)]
    public string? Industry { get; init; }
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "رنگ باید به شکل HEX باشد.")]
    public string AccentColor { get; init; } = "#2B3A9E";
}

public sealed class InviteRequest
{
    [Required(ErrorMessage = Msg.Required), EmailAddress(ErrorMessage = Msg.Email)]
    public string Email { get; init; } = "";
    public WorkspaceRole Role { get; init; } = WorkspaceRole.Member;
}

public sealed class CreateWorkspaceRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(80, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
}

public sealed record ChangeRoleRequest(WorkspaceRole Role);

public sealed class WorkspaceService(IAppDbContext db, RequestContext ctx, IEmailSender email, AppSettings settings)
{
    public async Task<WorkspaceDto> GetAsync(CancellationToken ct)
    {
        var id = ctx.RequireTenant();
        var w = await db.Workspaces.AsNoTracking().FirstAsync(x => x.Id == id, ct);
        return Map(w);
    }

    public async Task<WorkspaceDto> UpdateAsync(UpdateWorkspaceRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        var id = ctx.RequireTenant();
        var w = await db.Workspaces.FirstAsync(x => x.Id == id, ct);
        w.Name = req.Name.Trim();
        w.Industry = req.Industry;
        w.AccentColor = req.AccentColor;
        await db.SaveChangesAsync(ct);
        return Map(w);
    }

    public async Task<WorkspaceDto> CreateAsync(CreateWorkspaceRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var userId = ctx.RequireUser();
        var ws = Auth.WorkspaceFactory.Create(req.Name.Trim());
        db.Workspaces.Add(ws);
        db.Memberships.Add(new Membership { WorkspaceId = ws.Id, UserId = userId, Role = WorkspaceRole.Owner });
        Auth.WorkspaceFactory.AddDefaults(db, ws.Id);
        await db.SaveChangesAsync(ct);
        return Map(ws);
    }

    public async Task<IReadOnlyList<MemberDto>> MembersAsync(CancellationToken ct)
    {
        var id = ctx.RequireTenant();
        return await db.Memberships.AsNoTracking()
            .Where(m => m.WorkspaceId == id)
            .OrderBy(m => m.Role).ThenBy(m => m.JoinedAt)
            .Select(m => new MemberDto(m.UserId, m.User!.FullName, m.User.Email, m.User.AvatarColor, m.User.JobTitle, m.Role, m.JoinedAt))
            .ToListAsync(ct);
    }

    public async Task ChangeRoleAsync(Guid userId, ChangeRoleRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var id = ctx.RequireTenant();
        var m = await db.Memberships.FirstOrDefaultAsync(x => x.WorkspaceId == id && x.UserId == userId, ct)
                ?? throw new NotFoundException("عضو");
        if (m.Role == WorkspaceRole.Owner || req.Role == WorkspaceRole.Owner)
        {
            if (ctx.Role != WorkspaceRole.Owner) throw new ForbiddenException("تغییر مالکیت فقط از مالک فضای کاری برمی‌آید.");
            if (m.Role == WorkspaceRole.Owner && await db.Memberships.CountAsync(x => x.WorkspaceId == id && x.Role == WorkspaceRole.Owner, ct) == 1)
                throw new ConflictException("فضای کاری باید دست‌کم یک مالک داشته باشد.");
        }
        m.Role = req.Role;
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveMemberAsync(Guid userId, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var id = ctx.RequireTenant();
        var m = await db.Memberships.FirstOrDefaultAsync(x => x.WorkspaceId == id && x.UserId == userId, ct)
                ?? throw new NotFoundException("عضو");
        if (m.Role == WorkspaceRole.Owner) throw new ConflictException("مالک فضای کاری را نمی‌توان حذف کرد.");
        db.Memberships.Remove(m);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<InvitationDto>> InvitationsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var list = await db.Invitations.AsNoTracking()
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt).ToListAsync(ct);
        return list.Select(MapInv).ToList();
    }

    public async Task<InvitationDto> InviteAsync(InviteRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        if (req.Role == WorkspaceRole.Owner && ctx.Role != WorkspaceRole.Owner)
            throw new ForbiddenException("فقط مالک می‌تواند مالک جدید دعوت کند.");

        var tenant = ctx.RequireTenant();
        var mail = req.Email.Trim().ToLowerInvariant();
        if (await db.Memberships.AnyAsync(m => m.WorkspaceId == tenant && m.User!.Email == mail, ct))
            throw new ConflictException("این شخص همین حالا عضو فضای کاری است.");

        var inv = new Invitation { TenantId = tenant, Email = mail, Role = req.Role, InvitedById = ctx.RequireUser() };
        db.Invitations.Add(inv);
        await db.SaveChangesAsync(ct);

        var ws = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == tenant, ct);
        var dto = MapInv(inv);
        try
        {
            await email.SendAsync(mail, $"دعوت به فضای کاری «{ws.Name}» در لیدورا",
                EmailTemplates.Wrap($"شما به فضای کاری <b>{ws.Name}</b> با نقش «{Fa.Role(inv.Role)}» دعوت شده‌اید.",
                    "پذیرفتن دعوت", dto.Link), ct);
        }
        catch
        {
            // The link is still returned and can be shared manually.
        }
        return dto;
    }

    public async Task RevokeInvitationAsync(Guid id, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var inv = await db.Invitations.FirstOrDefaultAsync(i => i.Id == id, ct) ?? throw new NotFoundException("دعوت‌نامه");
        db.Invitations.Remove(inv);
        await db.SaveChangesAsync(ct);
    }

    private InvitationDto MapInv(Invitation i) =>
        new(i.Id, i.Email, i.Role, i.ExpiresAt, $"{settings.PublicUrl.TrimEnd('/')}/invite/{i.Token}");

    private static WorkspaceDto Map(Workspace w) => new(w.Id, w.Name, w.Slug, w.Industry, w.AccentColor, w.Currency, w.CreatedAt);
}

public static class EmailTemplates
{
    /// <summary>Minimal RTL HTML shell used for every outgoing email.</summary>
    public static string Wrap(string bodyHtml, string? ctaText = null, string? ctaLink = null)
    {
        var cta = ctaText is null ? "" :
            $"<p style=\"margin:28px 0 8px\"><a href=\"{ctaLink}\" style=\"background:#2B3A9E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700\">{ctaText}</a></p>";
        return $"""
            <div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;background:#F5F6FA;padding:32px">
              <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E3E6F0">
                <div style="font-weight:800;font-size:20px;color:#2B3A9E;margin-bottom:20px">لیدورا<span style="color:#E9A23B">.</span></div>
                <div style="color:#1B2140;line-height:2;font-size:15px">{bodyHtml}</div>
                {cta}
              </div>
            </div>
            """;
    }
}
