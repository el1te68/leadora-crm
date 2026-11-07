using System.Net;
using System.Net.Mail;
using Leadora.Application.Common;
using Leadora.Application.Insights;
using Leadora.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Leadora.Infrastructure;

/// <summary>PBKDF2 hasher from the ASP.NET Core shared framework (no extra package).</summary>
public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<AppUser> _hasher = new();
    private static readonly AppUser Dummy = new();

    public string Hash(string password) => _hasher.HashPassword(Dummy, password);

    public bool Verify(string hash, string password) =>
        _hasher.VerifyHashedPassword(Dummy, hash, password) != PasswordVerificationResult.Failed;
}

public sealed class SmtpOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public bool EnableSsl { get; set; }
    public string? User { get; set; }
    public string? Password { get; set; }
    public string From { get; set; } = "no-reply@leadora.local";
    public string FromName { get; set; } = "لیدورا";
}

/// <summary>Plain SMTP via System.Net.Mail — talks to MailHog in docker compose.</summary>
public sealed class SmtpEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpEmailSender> log) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        var o = options.Value;
        using var client = new SmtpClient(o.Host, o.Port) { EnableSsl = o.EnableSsl, DeliveryMethod = SmtpDeliveryMethod.Network };
        if (!string.IsNullOrEmpty(o.User)) client.Credentials = new NetworkCredential(o.User, o.Password);
        using var msg = new MailMessage
        {
            From = new MailAddress(o.From, o.FromName, System.Text.Encoding.UTF8),
            Subject = subject,
            SubjectEncoding = System.Text.Encoding.UTF8,
            Body = htmlBody,
            BodyEncoding = System.Text.Encoding.UTF8,
            IsBodyHtml = true
        };
        msg.To.Add(to);
        await client.SendMailAsync(msg, ct);
        log.LogInformation("Email sent to {To}: {Subject}", to, subject);
    }
}

/// <summary>Base for periodic jobs: own DI scope per tick, never crashes the host.</summary>
public abstract class PeriodicJob(IServiceScopeFactory scopes, ILogger log, TimeSpan interval, TimeSpan initialDelay) : BackgroundService
{
    protected abstract Task<int> RunAsync(JobsService jobs, CancellationToken ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(initialDelay, stoppingToken); } catch (OperationCanceledException) { return; }
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var n = await RunAsync(scope.ServiceProvider.GetRequiredService<JobsService>(), stoppingToken);
                if (n > 0) log.LogInformation("{Job}: processed {Count}", GetType().Name, n);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogWarning(ex, "{Job} failed", GetType().Name);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }
}

public sealed class TaskReminderJob(IServiceScopeFactory s, ILogger<TaskReminderJob> l)
    : PeriodicJob(s, l, TimeSpan.FromMinutes(1), TimeSpan.FromSeconds(20))
{
    protected override Task<int> RunAsync(JobsService jobs, CancellationToken ct) => jobs.SendRemindersAsync(ct);
}

public sealed class StaleDealJob(IServiceScopeFactory s, ILogger<StaleDealJob> l)
    : PeriodicJob(s, l, TimeSpan.FromHours(1), TimeSpan.FromSeconds(45))
{
    protected override Task<int> RunAsync(JobsService jobs, CancellationToken ct) => jobs.DetectStaleDealsAsync(ct);
}

public sealed class DailyDigestJob(IServiceScopeFactory s, ILogger<DailyDigestJob> l)
    : PeriodicJob(s, l, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(1))
{
    protected override Task<int> RunAsync(JobsService jobs, CancellationToken ct) => jobs.SendDailyDigestsAsync(force: false, ct);
}
