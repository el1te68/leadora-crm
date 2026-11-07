using Leadora.Application.Auth;
using Leadora.Application.Automations;
using Leadora.Application.Common;
using Leadora.Application.Deals;
using Leadora.Application.Engagement;
using Leadora.Application.Insights;
using Leadora.Application.Records;
using Leadora.Application.Workspaces;
using Leadora.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Leadora.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddLeadora(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(
            config.GetConnectionString("Default") ?? throw new InvalidOperationException("ConnectionStrings:Default is missing."),
            npgsql => npgsql.EnableRetryOnFailure(5)));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddScoped<RequestContext>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<RequestContext>());
        services.AddSingleton<IPasswordService, PasswordService>();
        services.Configure<SmtpOptions>(config.GetSection("Smtp"));
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        services.AddSingleton(new AppSettings(config["App:PublicUrl"] ?? "http://localhost:8080"));

        // Application services
        services.AddScoped<ChangeFeed>();
        services.AddScoped<AuthService>();
        services.AddScoped<WorkspaceService>();
        services.AddScoped<TagService>();
        services.AddScoped<CustomFieldService>();
        services.AddScoped<SavedViewService>();
        services.AddScoped<ContactService>();
        services.AddScoped<CompanyService>();
        services.AddScoped<PipelineService>();
        services.AddScoped<DealService>();
        services.AddScoped<ActivityService>();
        services.AddScoped<NoteService>();
        services.AddScoped<EmailService>();
        services.AddScoped<TimelineService>();
        services.AddScoped<AutomationService>();
        services.AddScoped<AutomationEngine>();
        services.AddScoped<NotificationService>();
        services.AddScoped<SearchService>();
        services.AddScoped<ReportService>();
        services.AddScoped<JobsService>();
        services.AddScoped<DemoSeeder>();

        services.AddHostedService<TaskReminderJob>();
        services.AddHostedService<StaleDealJob>();
        services.AddHostedService<DailyDigestJob>();
        return services;
    }

    /// <summary>
    /// First-run strategy:
    /// - If the assembly contains EF migrations (dotnet ef migrations add …), apply them with Migrate().
    /// - Otherwise create the schema from the model with EnsureCreated() so `docker compose up` works with zero tooling.
    /// Then seed the demo workspace once. Retries while Postgres is still starting.
    /// </summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider root, bool seedDemo, ILogger log, CancellationToken ct = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var scope = root.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                if (db.Database.GetMigrations().Any())
                {
                    log.LogInformation("Applying EF Core migrations…");
                    await db.Database.MigrateAsync(ct);
                }
                else
                {
                    log.LogInformation("No migrations in assembly → EnsureCreated()");
                    await db.Database.EnsureCreatedAsync(ct);
                }

                if (seedDemo)
                {
                    await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(ct);
                    log.LogInformation("Demo data ready ({Email} / {Password})", DemoSeeder.DemoEmail, DemoSeeder.DemoPassword);
                }
                return;
            }
            catch (Exception ex) when (attempt < 10 && ex is not OperationCanceledException)
            {
                log.LogWarning("Database not ready (attempt {Attempt}): {Message}", attempt, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3), ct);
            }
        }
    }
}
