using System.ComponentModel.DataAnnotations;

namespace Leadora.Application.Common;

/// <summary>Domain/application error that maps to a ProblemDetails response with a Persian title.</summary>
public class AppException(int status, string title, IDictionary<string, string[]>? errors = null) : Exception(title)
{
    public int Status { get; } = status;
    public string Title { get; } = title;
    public IDictionary<string, string[]>? Errors { get; } = errors;
}

public sealed class NotFoundException(string what) : AppException(404, $"{what} پیدا نشد.");
public sealed class ForbiddenException(string? msg = null) : AppException(403, msg ?? "به این بخش دسترسی ندارید.");
public sealed class UnauthorizedException(string? msg = null) : AppException(401, msg ?? "لطفاً دوباره وارد شوید.");
public sealed class ConflictException(string msg) : AppException(409, msg);

public sealed class ValidationFailedException(IDictionary<string, string[]> errors)
    : AppException(400, "اطلاعات ارسالی معتبر نیست.", errors);

/// <summary>Built-in DataAnnotations validation, no third-party validator.</summary>
public static class Validate
{
    public static void Object(object model)
    {
        var results = new List<ValidationResult>();
        if (Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true))
            return;

        var errors = results
            .SelectMany(r => (r.MemberNames.Any() ? r.MemberNames : [""]).Select(m => (m, r.ErrorMessage ?? "نامعتبر")))
            .GroupBy(x => ToCamel(x.Item1))
            .ToDictionary(g => g.Key, g => g.Select(x => x.Item2).ToArray());
        throw new ValidationFailedException(errors);
    }

    public static void Field(bool ok, string field, string message)
    {
        if (!ok) throw new ValidationFailedException(new Dictionary<string, string[]> { [field] = [message] });
    }

    private static string ToCamel(string s) => string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
}

/// <summary>Persian messages for DataAnnotations.</summary>
public static class Msg
{
    public const string Required = "پر کردن این فیلد الزامی است.";
    public const string Email = "ایمیل معتبر نیست.";
    public const string TooLong = "متن واردشده بیش از حد طولانی است.";
    public const string Password = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
    public const string Range = "مقدار واردشده خارج از محدوده‌ی مجاز است.";
}
