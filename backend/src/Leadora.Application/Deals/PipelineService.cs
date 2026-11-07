using System.ComponentModel.DataAnnotations;
using Leadora.Application.Common;
using Leadora.Domain;
using Microsoft.EntityFrameworkCore;

namespace Leadora.Application.Deals;

public sealed class PipelineRequest
{
    [Required(ErrorMessage = Msg.Required), StringLength(60, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    public List<StageInput>? Stages { get; init; }
}

public sealed class StageInput
{
    public Guid? Id { get; init; }
    [Required(ErrorMessage = Msg.Required), StringLength(40, ErrorMessage = Msg.TooLong)]
    public string Name { get; init; } = "";
    [Range(0, 100, ErrorMessage = Msg.Range)]
    public int Probability { get; init; }
    public string Color { get; init; } = "#2B3A9E";
}

public sealed class PipelineService(IAppDbContext db, RequestContext ctx)
{
    public async Task<IReadOnlyList<PipelineDto>> ListAsync(CancellationToken ct)
    {
        var pipelines = await db.Pipelines.AsNoTracking().Include(p => p.Stages).OrderBy(p => p.Order).ToListAsync(ct);
        var stats = await db.Deals.Where(d => d.Status == DealStatus.Open).GroupBy(d => d.PipelineId)
            .Select(g => new { g.Key, Count = g.Count(), Sum = g.Sum(d => d.Value) }).ToDictionaryAsync(x => x.Key, ct);
        return pipelines.Select(p => new PipelineDto(p.Id, p.Name, p.Order,
            p.Stages.OrderBy(s => s.Order).Select(DealService.MapStage).ToList(),
            stats.TryGetValue(p.Id, out var s) ? s.Count : 0, stats.TryGetValue(p.Id, out var s2) ? s2.Sum : 0)).ToList();
    }

    public async Task<PipelineDto> CreateAsync(PipelineRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        var stages = req.Stages ?? [];
        Validate.Field(stages.Count > 0, "stages", "پایپ‌لاین دست‌کم یک مرحله لازم دارد.");
        stages.ForEach(Validate.Object);
        var order = await db.Pipelines.CountAsync(ct);
        var p = new Pipeline { TenantId = ctx.RequireTenant(), Name = req.Name.Trim(), Order = order };
        db.Pipelines.Add(p);
        for (var i = 0; i < stages.Count; i++)
            db.Stages.Add(new Stage { TenantId = p.TenantId, PipelineId = p.Id, Name = stages[i].Name.Trim(), Probability = stages[i].Probability, Color = stages[i].Color, Order = i });
        await db.SaveChangesAsync(ct);
        return (await ListAsync(ct)).First(x => x.Id == p.Id);
    }

    /// <summary>Renames the pipeline and replaces its stage list (reorder / add / rename / remove empty stages).</summary>
    public async Task<PipelineDto> UpdateAsync(Guid id, PipelineRequest req, CancellationToken ct)
    {
        ctx.RequireAdmin();
        Validate.Object(req);
        var p = await db.Pipelines.Include(x => x.Stages).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("پایپ‌لاین");
        p.Name = req.Name.Trim();
        if (req.Stages is { } input)
        {
            Validate.Field(input.Count > 0, "stages", "پایپ‌لاین دست‌کم یک مرحله لازم دارد.");
            input.ForEach(Validate.Object);
            var keep = input.Where(s => s.Id != null).Select(s => s.Id!.Value).ToHashSet();
            foreach (var removed in p.Stages.Where(s => !keep.Contains(s.Id)).ToList())
            {
                if (await db.Deals.AnyAsync(d => d.StageId == removed.Id, ct))
                    throw new ConflictException($"مرحله‌ی «{removed.Name}» معامله دارد؛ اول معامله‌ها را جابه‌جا کنید.");
                db.Stages.Remove(removed);
            }
            for (var i = 0; i < input.Count; i++)
            {
                var s = input[i];
                var existing = s.Id is { } sid ? p.Stages.FirstOrDefault(x => x.Id == sid) : null;
                if (existing is null)
                    db.Stages.Add(new Stage { TenantId = p.TenantId, PipelineId = p.Id, Name = s.Name.Trim(), Probability = s.Probability, Color = s.Color, Order = i });
                else
                {
                    existing.Name = s.Name.Trim();
                    existing.Probability = s.Probability;
                    existing.Color = s.Color;
                    existing.Order = i;
                }
            }
        }
        await db.SaveChangesAsync(ct);
        return (await ListAsync(ct)).First(x => x.Id == id);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        ctx.RequireAdmin();
        var p = await db.Pipelines.Include(x => x.Stages).FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("پایپ‌لاین");
        if (await db.Deals.AnyAsync(d => d.PipelineId == id, ct)) throw new ConflictException("این پایپ‌لاین معامله دارد و حذف نمی‌شود.");
        if (await db.Pipelines.CountAsync(ct) == 1) throw new ConflictException("دست‌کم یک پایپ‌لاین لازم است.");
        db.Stages.RemoveRange(p.Stages);
        db.Pipelines.Remove(p);
        await db.SaveChangesAsync(ct);
    }
}
