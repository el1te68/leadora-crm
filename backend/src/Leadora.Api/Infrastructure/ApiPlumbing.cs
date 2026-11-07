using System.Security.Claims;
using System.Text;
using Leadora.Application.Common;
using Leadora.Domain;
using Leadora.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Leadora.Api.Infrastructure;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "leadora";
    public string Audience { get; set; } = "leadora-web";
    public string Key { get; set; } = "";
    public int ExpiryDays { get; set; } = 7;

    public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
}

public sealed class TokenService(JwtOptions options) : ITokenService
{
    public string CreateToken(AppUser user)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Expires = DateTime.UtcNow.AddDays(options.ExpiryDays),
            Subject = new ClaimsIdentity([
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Name, user.FullName)
            ]),
            SigningCredentials = new SigningCredentials(options.SigningKey(), SecurityAlgorithms.HmacSha256)
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}

/// <summary>
/// Resolves the caller and the active workspace. The workspace id comes from the X-Workspace-Id header and is only
/// accepted after checking the membership table for the user id from the JWT.
/// </summary>
public sealed class TenantMiddleware(RequestDelegate next)
{
    public const string Header = "X-Workspace-Id";

    public async Task InvokeAsync(HttpContext http, RequestContext ctx, AppDbContext db)
    {
        if (http.User.Identity?.IsAuthenticated == true && Guid.TryParse(http.User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var userId))
        {
            ctx.UserId = userId;
            if (http.Request.Headers.TryGetValue(Header, out var raw) && Guid.TryParse(raw.ToString(), out var wsId))
            {
                var role = await db.Memberships.AsNoTracking()
                    .Where(m => m.UserId == userId && m.WorkspaceId == wsId)
                    .Select(m => (WorkspaceRole?)m.Role).FirstOrDefaultAsync(http.RequestAborted);
                if (role is null) throw new ForbiddenException("عضو این فضای کاری نیستید.");
                ctx.TenantId = wsId;
                ctx.Role = role;
            }
        }
        await next(http);
    }
}

/// <summary>Endpoint filter for everything that lives inside a workspace.</summary>
public sealed class RequireWorkspace(RequestContext ctx) : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (ctx.TenantId is null) throw new AppException(400, "فضای کاری انتخاب نشده است (هدر X-Workspace-Id).");
        return next(context);
    }
}

/// <summary>Maps exceptions to RFC 7807 ProblemDetails with Persian titles.</summary>
public sealed class ProblemExceptionHandler(IProblemDetailsService problems, ILogger<ProblemExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception ex, CancellationToken ct)
    {
        var (status, title, errors) = ex switch
        {
            AppException a => (a.Status, a.Title, a.Errors),
            BadHttpRequestException b => (400, "درخواست نامعتبر است؛ قالب داده‌ها را بررسی کنید.", (IDictionary<string, string[]>?)null),
            DbUpdateConcurrencyException => (409, "این رکورد هم‌زمان توسط شخص دیگری تغییر کرد. صفحه را تازه کنید.", null),
            _ => (500, "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.", null)
        };
        if (status >= 500) log.LogError(ex, "Unhandled error");

        http.Response.StatusCode = status;
        var pd = errors is null
            ? new ProblemDetails { Status = status, Title = title }
            : new HttpValidationProblemDetails(errors) { Status = status, Title = title };
        pd.Instance = http.Request.Path;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = pd, Exception = ex });
    }
}

public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default) =>
        await db.Database.CanConnectAsync(ct) ? HealthCheckResult.Healthy("PostgreSQL reachable") : HealthCheckResult.Unhealthy("PostgreSQL unreachable");
}

[Authorize]
public sealed class CrmHub(AppDbContext db) : Hub
{
    public static string UserGroup(Guid id) => $"user:{id}";
    public static string WorkspaceGroup(Guid id) => $"ws:{id}";

    public override async Task OnConnectedAsync()
    {
        if (Guid.TryParse(Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub), out var uid))
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(uid));
        await base.OnConnectedAsync();
    }

    /// <summary>Client joins the board/timeline channel of its active workspace (membership verified).</summary>
    public async Task JoinWorkspace(Guid workspaceId)
    {
        if (!Guid.TryParse(Context.User?.FindFirstValue(JwtRegisteredClaimNames.Sub), out var uid)) throw new HubException("unauthorized");
        if (!await db.Memberships.AnyAsync(m => m.UserId == uid && m.WorkspaceId == workspaceId)) throw new HubException("عضو این فضای کاری نیستید.");
        await Groups.AddToGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId));
    }

    public Task LeaveWorkspace(Guid workspaceId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId));
}

public sealed class SignalRRealtime(IHubContext<CrmHub> hub) : IRealtime
{
    public Task ToWorkspaceAsync(Guid workspaceId, string evt, object payload) =>
        hub.Clients.Group(CrmHub.WorkspaceGroup(workspaceId)).SendAsync(evt, payload);

    public Task ToUserAsync(Guid userId, string evt, object payload) =>
        hub.Clients.Group(CrmHub.UserGroup(userId)).SendAsync(evt, payload);
}
