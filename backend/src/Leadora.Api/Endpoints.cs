using System.Text;
using Leadora.Api.Infrastructure;
using Leadora.Application.Auth;
using Leadora.Application.Automations;
using Leadora.Application.Common;
using Leadora.Application.Deals;
using Leadora.Application.Engagement;
using Leadora.Application.Insights;
using Leadora.Application.Records;
using Leadora.Application.Workspaces;
using Leadora.Domain;
using Leadora.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Api;

public static class Endpoints
{
    public static void MapLeadora(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        // ---------- Auth (anonymous, rate limited) ----------
        var auth = api.MapGroup("/auth").WithTags("Auth");
        auth.MapPost("/register", (RegisterRequest req, AuthService s, CancellationToken ct) => s.RegisterAsync(req, ct)).RequireRateLimiting("auth");
        auth.MapPost("/login", (LoginRequest req, AuthService s, CancellationToken ct) => s.LoginAsync(req, ct)).RequireRateLimiting("auth");
        auth.MapGet("/me", (AuthService s, CancellationToken ct) => s.MeAsync(ct)).RequireAuthorization();

        api.MapGet("/invitations/{token}", (string token, AuthService s, CancellationToken ct) => s.PreviewInvitationAsync(token, ct))
            .WithTags("Auth").RequireRateLimiting("auth");
        api.MapPost("/invitations/{token}/accept", (string token, AuthService s, CancellationToken ct) => s.AcceptInvitationAsync(token, ct))
            .WithTags("Auth").RequireAuthorization();
        api.MapPost("/workspaces", (CreateWorkspaceRequest req, WorkspaceService s, CancellationToken ct) => s.CreateAsync(req, ct))
            .WithTags("Workspace").RequireAuthorization();

        // ---------- Everything below is scoped to one workspace ----------
        var t = api.MapGroup("").RequireAuthorization().AddEndpointFilter<RequireWorkspace>();

        var ws = t.MapGroup("/workspace").WithTags("Workspace");
        ws.MapGet("", (WorkspaceService s, CancellationToken ct) => s.GetAsync(ct));
        ws.MapPut("", (UpdateWorkspaceRequest req, WorkspaceService s, CancellationToken ct) => s.UpdateAsync(req, ct));
        ws.MapGet("/members", (WorkspaceService s, CancellationToken ct) => s.MembersAsync(ct));
        ws.MapPut("/members/{userId:guid}/role", async (Guid userId, ChangeRoleRequest req, WorkspaceService s, CancellationToken ct) =>
        {
            await s.ChangeRoleAsync(userId, req, ct);
            return Results.NoContent();
        });
        ws.MapDelete("/members/{userId:guid}", async (Guid userId, WorkspaceService s, CancellationToken ct) =>
        {
            await s.RemoveMemberAsync(userId, ct);
            return Results.NoContent();
        });
        ws.MapGet("/invitations", (WorkspaceService s, CancellationToken ct) => s.InvitationsAsync(ct));
        ws.MapPost("/invitations", (InviteRequest req, WorkspaceService s, CancellationToken ct) => s.InviteAsync(req, ct));
        ws.MapDelete("/invitations/{id:guid}", async (Guid id, WorkspaceService s, CancellationToken ct) =>
        {
            await s.RevokeInvitationAsync(id, ct);
            return Results.NoContent();
        });

        // Contacts
        var contacts = t.MapGroup("/contacts").WithTags("Contacts");
        contacts.MapGet("", ([AsParameters] ContactQuery q, ContactService s, CancellationToken ct) => s.ListAsync(q, ct));
        contacts.MapGet("/export", async ([AsParameters] ContactQuery q, ContactService s, CancellationToken ct) =>
            Results.File(Encoding.UTF8.GetBytes(await s.ExportAsync(q, ct)), "text/csv; charset=utf-8", "contacts.csv"));
        contacts.MapPost("/import", async (HttpRequest req, ContactService s, CancellationToken ct) => await s.ImportAsync(await ReadBody(req), ct));
        contacts.MapGet("/{id:guid}", (Guid id, ContactService s, CancellationToken ct) => s.GetAsync(id, ct));
        contacts.MapPost("", (ContactRequest req, ContactService s, CancellationToken ct) => s.CreateAsync(req, ct));
        contacts.MapPut("/{id:guid}", (Guid id, ContactRequest req, ContactService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        contacts.MapDelete("/{id:guid}", async (Guid id, ContactService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Companies
        var companies = t.MapGroup("/companies").WithTags("Companies");
        companies.MapGet("", ([AsParameters] CompanyQuery q, CompanyService s, CancellationToken ct) => s.ListAsync(q, ct));
        companies.MapGet("/export", async ([AsParameters] CompanyQuery q, CompanyService s, CancellationToken ct) =>
            Results.File(Encoding.UTF8.GetBytes(await s.ExportAsync(q, ct)), "text/csv; charset=utf-8", "companies.csv"));
        companies.MapPost("/import", async (HttpRequest req, CompanyService s, CancellationToken ct) => await s.ImportAsync(await ReadBody(req), ct));
        companies.MapGet("/{id:guid}", (Guid id, CompanyService s, CancellationToken ct) => s.GetAsync(id, ct));
        companies.MapPost("", (CompanyRequest req, CompanyService s, CancellationToken ct) => s.CreateAsync(req, ct));
        companies.MapPut("/{id:guid}", (Guid id, CompanyRequest req, CompanyService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        companies.MapDelete("/{id:guid}", async (Guid id, CompanyService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Pipelines
        var pipelines = t.MapGroup("/pipelines").WithTags("Pipelines");
        pipelines.MapGet("", (PipelineService s, CancellationToken ct) => s.ListAsync(ct));
        pipelines.MapPost("", (PipelineRequest req, PipelineService s, CancellationToken ct) => s.CreateAsync(req, ct));
        pipelines.MapPut("/{id:guid}", (Guid id, PipelineRequest req, PipelineService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        pipelines.MapDelete("/{id:guid}", async (Guid id, PipelineService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Deals
        var deals = t.MapGroup("/deals").WithTags("Deals");
        deals.MapGet("/board", (Guid? pipelineId, Guid? ownerId, string? q, DealService s, CancellationToken ct) => s.BoardAsync(pipelineId, ownerId, q, ct));
        deals.MapGet("", ([AsParameters] DealQuery q, DealService s, CancellationToken ct) => s.ListAsync(q, ct));
        deals.MapGet("/{id:guid}", (Guid id, DealService s, CancellationToken ct) => s.GetAsync(id, ct));
        deals.MapPost("", (DealRequest req, DealService s, CancellationToken ct) => s.CreateAsync(req, ct));
        deals.MapPut("/{id:guid}", (Guid id, DealRequest req, DealService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        deals.MapPost("/{id:guid}/move", (Guid id, MoveDealRequest req, DealService s, CancellationToken ct) => s.MoveAsync(id, req, ct));
        deals.MapPost("/{id:guid}/won", (Guid id, DealService s, CancellationToken ct) => s.WinAsync(id, ct));
        deals.MapPost("/{id:guid}/lost", (Guid id, LoseDealRequest req, DealService s, CancellationToken ct) => s.LoseAsync(id, req, ct));
        deals.MapPost("/{id:guid}/reopen", (Guid id, DealService s, CancellationToken ct) => s.ReopenAsync(id, ct));
        deals.MapDelete("/{id:guid}", async (Guid id, DealService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Activities, notes, emails, timeline
        var acts = t.MapGroup("/activities").WithTags("Activities");
        acts.MapGet("", ([AsParameters] ActivityQuery q, ActivityService s, CancellationToken ct) => s.ListAsync(q, ct));
        acts.MapGet("/my-day", (ActivityService s, TagService tags, CancellationToken ct) => s.MyDayAsync(tags, ct));
        acts.MapPost("", (ActivityRequest req, ActivityService s, CancellationToken ct) => s.CreateAsync(req, ct));
        acts.MapPut("/{id:guid}", (Guid id, ActivityRequest req, ActivityService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        acts.MapPost("/{id:guid}/toggle", (Guid id, ActivityService s, CancellationToken ct) => s.ToggleDoneAsync(id, ct));
        acts.MapDelete("/{id:guid}", async (Guid id, ActivityService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        t.MapPost("/notes", (NoteRequest req, NoteService s, CancellationToken ct) => s.CreateAsync(req, ct)).WithTags("Timeline");
        t.MapDelete("/notes/{timelineId:guid}", async (Guid timelineId, NoteService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(timelineId, ct);
            return Results.NoContent();
        }).WithTags("Timeline");
        t.MapPost("/emails", (EmailRequest req, EmailService s, CancellationToken ct) => s.SendAsync(req, ct)).WithTags("Timeline");
        t.MapGet("/timeline/recent", (int? take, TimelineService s, CancellationToken ct) => s.RecentAsync(take ?? 20, ct)).WithTags("Timeline");
        t.MapGet("/timeline/{type}/{id:guid}", (RecordType type, Guid id, string? kind, int? take, TimelineService s, CancellationToken ct) =>
            s.ForRecordAsync(type, id, kind, take ?? 100, ct)).WithTags("Timeline");

        // Search, views, metadata
        t.MapGet("/search", (string? q, SearchService s, CancellationToken ct) => s.SearchAsync(q, ct)).WithTags("Search");

        var views = t.MapGroup("/views").WithTags("Views");
        views.MapGet("", (RecordType entityType, SavedViewService s, CancellationToken ct) => s.ListAsync(entityType, ct));
        views.MapPost("", (SavedViewRequest req, SavedViewService s, CancellationToken ct) => s.CreateAsync(req, ct));
        views.MapDelete("/{id:guid}", async (Guid id, SavedViewService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var fields = t.MapGroup("/custom-fields").WithTags("Settings");
        fields.MapGet("", (RecordType? entityType, CustomFieldService s, CancellationToken ct) => s.ListAsync(entityType, ct));
        fields.MapPost("", (CustomFieldRequest req, CustomFieldService s, CancellationToken ct) => s.CreateAsync(req, ct));
        fields.MapPut("/{id:guid}", (Guid id, CustomFieldRequest req, CustomFieldService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        fields.MapDelete("/{id:guid}", async (Guid id, CustomFieldService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var tags = t.MapGroup("/tags").WithTags("Settings");
        tags.MapGet("", (TagService s, CancellationToken ct) => s.ListAsync(ct));
        tags.MapPost("", (TagRequest req, TagService s, CancellationToken ct) => s.CreateAsync(req, ct));
        tags.MapPut("/{id:guid}", (Guid id, TagRequest req, TagService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        tags.MapDelete("/{id:guid}", async (Guid id, TagService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var autos = t.MapGroup("/automations").WithTags("Automations");
        autos.MapGet("", (AutomationService s, CancellationToken ct) => s.ListAsync(ct));
        autos.MapPost("", (AutomationRequest req, AutomationService s, CancellationToken ct) => s.CreateAsync(req, ct));
        autos.MapPut("/{id:guid}", (Guid id, AutomationRequest req, AutomationService s, CancellationToken ct) => s.UpdateAsync(id, req, ct));
        autos.MapPost("/{id:guid}/toggle", (Guid id, AutomationService s, CancellationToken ct) => s.ToggleAsync(id, ct));
        autos.MapDelete("/{id:guid}", async (Guid id, AutomationService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        var notifications = t.MapGroup("/notifications").WithTags("Notifications");
        notifications.MapGet("", (int? take, NotificationService s, CancellationToken ct) => s.ListAsync(take ?? 30, ct));
        notifications.MapPost("/read", async (Guid? id, NotificationService s, CancellationToken ct) =>
        {
            await s.MarkReadAsync(id, ct);
            return Results.NoContent();
        });

        t.MapGet("/reports/summary", (DateOnly? from, DateOnly? to, Guid? ownerId, Guid? pipelineId, ReportService s, CancellationToken ct) =>
            s.SummaryAsync(from, to, ownerId, pipelineId, ct)).WithTags("Reports");

        // Demo helper: send today's digest to me right now (view it in MailHog).
        t.MapPost("/digest/send-now", async (RequestContext ctx, JobsService jobs, AppDbContext db, CancellationToken ct) =>
        {
            var tenant = ctx.RequireTenant();
            var wsEntity = await db.Workspaces.FirstAsync(w => w.Id == tenant, ct);
            var ok = await jobs.SendDigestAsync(wsEntity, ctx.RequireUser(), ct);
            return ok ? Results.Ok(new { sent = true }) : throw new AppException(502, "ارسال ایمیل خلاصه ناموفق بود؛ SMTP را بررسی کنید.");
        }).WithTags("Reports");
    }

    private static async Task<string> ReadBody(HttpRequest req)
    {
        using var reader = new StreamReader(req.Body, Encoding.UTF8);
        var text = await reader.ReadToEndAsync();
        if (text.Length > 5_000_000) throw new AppException(413, "فایل بزرگ‌تر از ۵ مگابایت است.");
        return text;
    }
}
