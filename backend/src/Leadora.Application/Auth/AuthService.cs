using System.ComponentModel.DataAnnotations;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Auth;

public sealed class RegisterRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(80, ErrorMessage = Msg.TooLong)]
    public string FullName { get; init; } = "";

    [Required(ErrorMessage = Msg.Required), EmailAddress(ErrorMessage = Msg.Email)]
    public string Email { get; init; } = "";

    [Required(ErrorMessage = Msg.Required), MinLength(8, ErrorMessage = Msg.Password)]
    public string Password { get; init; } = "";

    /// <summary>Required unless <see cref="InviteToken"/> is supplied.</summary>
    [StringLength(80, ErrorMessage = Msg.TooLong)]
    public string? WorkspaceName { get; init; }

    public string? InviteToken { get; init; }
}

public sealed class LoginRequest
{
    [Required(ErrorMessage = Msg.Required), EmailAddress(ErrorMessage = Msg.Email)]
    public string Email { get; init; } = "";

    [Required(ErrorMessage = Msg.Required)]
    public string Password { get; init; } = "";
}

public sealed record WorkspaceSummary(Guid Id, string Name, string Slug, string AccentColor, WorkspaceRole Role, int MemberCount);
public sealed record MeDto(Guid Id, string FullName, string Email, string AvatarColor, string? JobTitle, IReadOnlyList<WorkspaceSummary> Workspaces);
public sealed record AuthResponse(string Token, MeDto User);

public sealed class AuthService(IAppDbContext db, IPasswordService passwords, ITokenService tokens, RequestContext ctx)
{
    private static readonly string[] Palette = ["#2B3A9E", "#C23A55", "#5E9E6E", "#E9A23B", "#7A4FB5", "#1F8A9E", "#B5651D"];

    public async Task<AuthResponse> RegisterAsync(RegisterRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw new ConflictException("با این ایمیل قبلاً حساب ساخته شده است.");

        var user = new AppUser
        {
            Email = email,
            FullName = req.FullName.Trim(),
            PasswordHash = passwords.Hash(req.Password),
            AvatarColor = Palette[Random.Shared.Next(Palette.Length)]
        };
        db.Users.Add(user);

        if (!string.IsNullOrWhiteSpace(req.InviteToken))
        {
            var inv = await FindInvitationAsync(req.InviteToken, ct);
            db.Memberships.Add(new Membership { WorkspaceId = inv.TenantId, UserId = user.Id, Role = inv.Role });
            inv.AcceptedAt = DateTime.UtcNow;
        }
        else
        {
            Validate.Field(!string.IsNullOrWhiteSpace(req.WorkspaceName), "workspaceName", Msg.Required);
            var ws = WorkspaceFactory.Create(req.WorkspaceName!.Trim());
            db.Workspaces.Add(ws);
            db.Memberships.Add(new Membership { WorkspaceId = ws.Id, UserId = user.Id, Role = WorkspaceRole.Owner });
            WorkspaceFactory.AddDefaults(db, ws.Id);
        }

        await db.SaveChangesAsync(ct);
        return new AuthResponse(tokens.CreateToken(user), await MeAsync(user.Id, ct));
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !passwords.Verify(user.PasswordHash, req.Password))
            throw new UnauthorizedException("ایمیل یا رمز عبور اشتباه است.");
        return new AuthResponse(tokens.CreateToken(user), await MeAsync(user.Id, ct));
    }

    public Task<MeDto> MeAsync(CancellationToken ct) => MeAsync(ctx.RequireUser(), ct);

    public async Task<MeDto> MeAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw new UnauthorizedException();
        var workspaces = await db.Memberships.AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.JoinedAt)
            .Select(m => new WorkspaceSummary(m.WorkspaceId, m.Workspace!.Name, m.Workspace.Slug, m.Workspace.AccentColor,
                m.Role, m.Workspace.Members.Count))
            .ToListAsync(ct);
        return new MeDto(user.Id, user.FullName, user.Email, user.AvatarColor, user.JobTitle, workspaces);
    }

    public sealed record InvitationPreview(string WorkspaceName, string Email, WorkspaceRole Role, string InvitedBy, bool HasAccount);

    public async Task<InvitationPreview> PreviewInvitationAsync(string token, CancellationToken ct)
    {
        var inv = await FindInvitationAsync(token, ct);
        var ws = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == inv.TenantId, ct);
        var by = await db.Users.AsNoTracking().Where(u => u.Id == inv.InvitedById).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        var hasAccount = await db.Users.AnyAsync(u => u.Email == inv.Email, ct);
        return new InvitationPreview(ws.Name, inv.Email, inv.Role, by ?? "", hasAccount);
    }

    public async Task<MeDto> AcceptInvitationAsync(string token, CancellationToken ct)
    {
        var userId = ctx.RequireUser();
        var inv = await FindInvitationAsync(token, ct);
        if (!await db.Memberships.AnyAsync(m => m.UserId == userId && m.WorkspaceId == inv.TenantId, ct))
            db.Memberships.Add(new Membership { WorkspaceId = inv.TenantId, UserId = userId, Role = inv.Role });
        inv.AcceptedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return await MeAsync(userId, ct);
    }

    /// <summary>Invitations are looked up by secret token, before any workspace is selected.</summary>
    private async Task<Invitation> FindInvitationAsync(string token, CancellationToken ct)
    {
        var inv = await db.Invitations.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Token == token, ct)
                  ?? throw new NotFoundException("دعوت‌نامه");
        if (inv.AcceptedAt is not null) throw new AppException(410, "این دعوت‌نامه قبلاً استفاده شده است.");
        if (inv.ExpiresAt < DateTime.UtcNow) throw new AppException(410, "مهلت این دعوت‌نامه تمام شده است.");
        return inv;
    }
}

public static class WorkspaceFactory
{
    public static Workspace Create(string name) => new()
    {
        Name = name,
        Slug = Slugify(name)
    };

    public static string Slugify(string name)
    {
        var ascii = new string(name.ToLowerInvariant().Where(ch => ch is >= 'a' and <= 'z' or >= '0' and <= '9' or '-').ToArray());
        return (string.IsNullOrEmpty(ascii) ? "ws" : ascii) + "-" + Guid.NewGuid().ToString("N")[..6];
    }

    /// <summary>A fresh workspace gets a usable sales pipeline and a few tags.</summary>
    public static void AddDefaults(IAppDbContext db, Guid tenantId)
    {
        var p = new Pipeline { TenantId = tenantId, Name = "فروش", Order = 0 };
        db.Pipelines.Add(p);
        (string name, int prob, string color)[] stages =
        [
            ("سرنخ جدید", 10, "#8C96C9"), ("تماس اولیه", 25, "#5B6BC0"), ("ارسال پیشنهاد", 50, "#2B3A9E"),
            ("مذاکره", 75, "#E9A23B"), ("قرارداد", 90, "#5E9E6E")
        ];
        for (var i = 0; i < stages.Length; i++)
            db.Stages.Add(new Stage { TenantId = tenantId, PipelineId = p.Id, Name = stages[i].name, Probability = stages[i].prob, Color = stages[i].color, Order = i });

        db.Tags.AddRange(
            new Tag { TenantId = tenantId, Name = "VIP", Color = "#E9A23B" },
            new Tag { TenantId = tenantId, Name = "پیگیری فوری", Color = "#C23A55" },
            new Tag { TenantId = tenantId, Name = "همکار", Color = "#5E9E6E" });
    }
}
