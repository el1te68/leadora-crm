using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Records;

// ---------- Tags ----------

public sealed class TagRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(40, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    [RegularExpression("^#[0-9A-Fa-f]{6}$", ErrorMessage = "رنگ باید به شکل HEX باشد.")]
    public string Color { get; init; } = "#2B3A9E";
}

public sealed record TagWithUsage(Guid Id, string Name, string Color, int Usage);

public sealed class TagService(IAppDbContext db, RequestContext ctx)
{
    public async Task<IReadOnlyList<TagWithUsage>> ListAsync(CancellationToken ct) =>
        await db.Tags.AsNoTracking().OrderBy(t => t.Name)
            .Select(t => new TagWithUsage(t.Id, t.Name, t.Color, db.RecordTags.Count(rt => rt.TagId == t.Id)))
            .ToListAsync(ct);

    public async Task<TagDto> CreateAsync(TagRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        if (await db.Tags.AnyAsync(t => t.Name == req.Name.Trim(), ct)) throw new ConflictException("برچسبی با این نام وجود دارد.");
        var t = new Tag { TenantId = ctx.RequireTenant(), Name = req.Name.Trim(), Color = req.Color };
        db.Tags.Add(t);
        await db.SaveChangesAsync(ct);
        return new TagDto(t.Id, t.Name, t.Color);
    }

    public async Task<TagDto> UpdateAsync(Guid id, TagRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var t = await db.Tags.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("برچسب");
        t.Name = req.Name.Trim();
        t.Color = req.Color;
        await db.SaveChangesAsync(ct);
        return new TagDto(t.Id, t.Name, t.Color);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var t = await db.Tags.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("برچسب");
        db.RecordTags.RemoveRange(db.RecordTags.Where(rt => rt.TagId == id));
        db.Tags.Remove(t);
        await db.SaveChangesAsync(ct);
    }

    public async Task SetAsync(RecordType type, Guid recordId, IEnumerable<Guid>? tagIds, CancellationToken ct)
    {
        if (tagIds is null) return;
        var wanted = tagIds.Distinct().ToList();
        var valid = await db.Tags.Where(t => wanted.Contains(t.Id)).Select(t => t.Id).ToListAsync(ct);
        var existing = await db.RecordTags.Where(rt => rt.RecordType == type && rt.RecordId == recordId).ToListAsync(ct);
        db.RecordTags.RemoveRange(existing.Where(e => !valid.Contains(e.TagId)));
        foreach (var id in valid.Where(v => existing.All(e => e.TagId != v)))
            db.RecordTags.Add(new RecordTag { TenantId = ctx.RequireTenant(), TagId = id, RecordType = type, RecordId = recordId });
    }

    public async Task<Dictionary<Guid, List<TagDto>>> ForRecordsAsync(RecordType type, IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        var rows = await db.RecordTags.AsNoTracking()
            .Where(rt => rt.RecordType == type && ids.Contains(rt.RecordId))
            .Select(rt => new { rt.RecordId, rt.TagId, rt.Tag!.Name, rt.Tag.Color })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.RecordId)
            .ToDictionary(g => g.Key, g => g.Select(r => new TagDto(r.TagId, r.Name, r.Color)).OrderBy(t => t.Name).ToList());
    }
}

// ---------- Custom fields ----------

public sealed record CustomFieldDto(Guid Id, RecordType EntityType, string Key, string Label, CustomFieldType Type, IReadOnlyList<string> Options, int Order);

public sealed class CustomFieldRequest
{
    public RecordType EntityType { get; init; }
    [Required(ErrorMessage = Msg.Required), StringLength(60, ErrorMessage = Msg.TooLong)]
    public string Label { get; init; } = "";
    public CustomFieldType Type { get; init; }
    public List<string>? Options { get; init; }
    public int Order { get; init; }
}

public sealed class CustomFieldService(IAppDbContext db, RequestContext ctx)
{
    public async Task<IReadOnlyList<CustomFieldDto>> ListAsync(RecordType? type, CancellationToken ct) =>
        (await db.CustomFields.AsNoTracking()
            .Where(f => type == null || f.EntityType == type)
            .OrderBy(f => f.EntityType).ThenBy(f => f.Order).ToListAsync(ct))
        .Select(Map).ToList();

    public async Task<CustomFieldDto> CreateAsync(CustomFieldRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        var options = Clean(req);
        var f = new CustomFieldDefinition
        {
            TenantId = ctx.RequireTenant(), EntityType = req.EntityType, Label = req.Label.Trim(), Type = req.Type,
            Options = options, Order = req.Order, Key = "f_" + Guid.NewGuid().ToString("N")[..8]
        };
        db.CustomFields.Add(f);
        await db.SaveChangesAsync(ct);
        return Map(f);
    }

    public async Task<CustomFieldDto> UpdateAsync(Guid id, CustomFieldRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        var f = await db.CustomFields.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("فیلد سفارشی");
        f.Label = req.Label.Trim();
        f.Type = req.Type;
        f.Options = Clean(req);
        f.Order = req.Order;
        await db.SaveChangesAsync(ct);
        return Map(f);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var f = await db.CustomFields.FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("فیلد سفارشی");
        db.CustomFields.Remove(f);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Keeps only known keys and validates values against their type.</summary>
    public async Task<Dictionary<string, string>> SanitizeAsync(RecordType type, Dictionary<string, string>? input,
        Dictionary<string, string>? current, CancellationToken ct)
    {
        var result = new Dictionary<string, string>(current ?? []);
        if (input is null) return result;
        var defs = await db.CustomFields.AsNoTracking().Where(f => f.EntityType == type).ToListAsync(ct);
        foreach (var (key, raw) in input)
        {
            var def = defs.FirstOrDefault(d => d.Key == key);
            if (def is null) continue;
            var value = raw?.Trim() ?? "";
            if (value.Length == 0) { result.Remove(key); continue; }
            var ok = def.Type switch
            {
                CustomFieldType.Number => decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _),
                CustomFieldType.Date => DateOnly.TryParseExact(value, "yyyy-MM-dd", out _),
                CustomFieldType.Select => def.Options.Contains(value),
                _ => value.Length <= 500
            };
            Validate.Field(ok, $"customFields.{key}", $"مقدار «{def.Label}» معتبر نیست.");
            result[key] = value;
        }
        return result;
    }

    private static List<string> Clean(CustomFieldRequest req)
    {
        var options = (req.Options ?? []).Select(o => o.Trim()).Where(o => o.Length > 0).Distinct().ToList();
        Validate.Field(req.Type != CustomFieldType.Select || options.Count > 0, "options", "فیلد انتخابی دست‌کم یک گزینه لازم دارد.");
        return req.Type == CustomFieldType.Select ? options : [];
    }

    private static CustomFieldDto Map(CustomFieldDefinition f) => new(f.Id, f.EntityType, f.Key, f.Label, f.Type, f.Options, f.Order);
}

// ---------- Saved views ----------

public sealed record SavedViewDto(Guid Id, RecordType EntityType, string Name, string Query);

public sealed class SavedViewRequest
{
    public RecordType EntityType { get; init; }
    [Required(ErrorMessage = Msg.Required), StringLength(60, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    [Required(ErrorMessage = Msg.Required), StringLength(4000, ErrorMessage = Msg.TooLong)]
    public string Query { get; init; } = "{}";
}

public sealed class SavedViewService(IAppDbContext db, RequestContext ctx)
{
    public async Task<IReadOnlyList<SavedViewDto>> ListAsync(RecordType type, CancellationToken ct)
    {
        var me = ctx.RequireUser();
        return await db.SavedViews.AsNoTracking().Where(v => v.UserId == me && v.EntityType == type)
            .OrderBy(v => v.CreatedAt).Select(v => new SavedViewDto(v.Id, v.EntityType, v.Name, v.Query)).ToListAsync(ct);
    }

    public async Task<SavedViewDto> CreateAsync(SavedViewRequest req, CancellationToken ct)
    {
        Validate.Object(req);
        var v = new SavedView { TenantId = ctx.RequireTenant(), UserId = ctx.RequireUser(), EntityType = req.EntityType, Name = req.Name.Trim(), Query = req.Query };
        db.SavedViews.Add(v);
        await db.SaveChangesAsync(ct);
        return new SavedViewDto(v.Id, v.EntityType, v.Name, v.Query);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var me = ctx.RequireUser();
        var v = await db.SavedViews.FirstOrDefaultAsync(x => x.Id == id && x.UserId == me, ct) ?? throw new NotFoundException("نما");
        db.SavedViews.Remove(v);
        await db.SaveChangesAsync(ct);
    }
}

// ---------- CSV ----------

public static class Csv
{
    public static string Write(IEnumerable<string> header, IEnumerable<IEnumerable<string?>> rows)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append('﻿'); // BOM so Excel opens Persian text correctly
        sb.AppendLine(string.Join(",", header.Select(Escape)));
        foreach (var r in rows) sb.AppendLine(string.Join(",", r.Select(Escape)));
        return sb.ToString();
    }

    private static string Escape(string? v)
    {
        v ??= "";
        return v.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
    }

    /// <summary>RFC-4180-ish parser: quotes, escaped quotes, CRLF.</summary>
    public static List<Dictionary<string, string>> Read(string text)
    {
        text = text.TrimStart('﻿');
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (inQuotes)
            {
                if (ch == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (ch == '"') inQuotes = false;
                else cell.Append(ch);
            }
            else if (ch == '"') inQuotes = true;
            else if (ch == ',') { row.Add(cell.ToString()); cell.Clear(); }
            else if (ch is '\n' or '\r')
            {
                if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString()); cell.Clear();
                if (row.Any(c => c.Length > 0)) rows.Add(row);
                row = [];
            }
            else cell.Append(ch);
        }
        row.Add(cell.ToString());
        if (row.Any(c => c.Length > 0)) rows.Add(row);
        if (rows.Count == 0) return [];

        var header = rows[0].Select(h => h.Trim().ToLowerInvariant()).ToList();
        return rows.Skip(1).Select(r =>
        {
            var d = new Dictionary<string, string>();
            for (var c = 0; c < header.Count; c++) d[header[c]] = c < r.Count ? r[c].Trim() : "";
            return d;
        }).ToList();
    }

    public static string? Pick(Dictionary<string, string> row, params string[] keys)
    {
        foreach (var k in keys)
            if (row.TryGetValue(k.ToLowerInvariant(), out var v) && !string.IsNullOrWhiteSpace(v)) return v;
        return null;
    }
}

public sealed record ImportResult(int Created, int Skipped, IReadOnlyList<string> Errors);
