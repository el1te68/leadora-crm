// Minimal in-memory implementation of the Leadora API for UI review without a backend (VITE_MOCK=true).
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store";
import * as db from "./data";
import type { MCompany, MContact, MDeal, MActivity, MEvent } from "./data";
import type { ActivityType, RecordType } from "@/lib/types";

const DAY = 86400_000;
const nowIso = () => new Date().toISOString();
const user = (id?: string | null) => { const u = db.users.find((x) => x.id === id); return u ? { id: u.id, fullName: u.fullName, avatarColor: u.avatarColor } : null; };
const tagDtos = (ids: string[]) => db.tags.filter((t) => ids.includes(t.id)).map(({ id, name, color }) => ({ id, name, color }));
const currentUserId = () => db.me.id;
const wsId = () => useAuth.getState().workspaceId ?? db.workspaces[0].id;

const me = () => ({
  id: db.me.id, fullName: db.me.fullName, email: db.me.email, avatarColor: db.me.avatarColor, jobTitle: db.me.jobTitle,
  workspaces: db.members.filter((m) => m.userId === db.me.id).map((m) => {
    const w = db.workspaces.find((x) => x.id === m.workspaceId)!;
    return { id: w.id, name: w.name, slug: w.slug, accentColor: w.accentColor, role: m.role, memberCount: db.members.filter((x) => x.workspaceId === w.id).length };
  }),
});

const contactDto = (c: MContact) => {
  const co = db.companies.find((x) => x.id === c.companyId);
  return { ...c, fullName: `${c.firstName} ${c.lastName}`.trim(), company: co ? { id: co.id, name: co.name } : null, owner: user(c.ownerId), tags: tagDtos(c.tagIds) };
};
const companyDto = (c: MCompany) => {
  const open = db.deals.filter((d) => d.companyId === c.id && d.status === "Open");
  return { ...c, owner: user(c.ownerId), tags: tagDtos(c.tagIds), contactCount: db.contacts.filter((x) => x.companyId === c.id).length, openDeals: open.length, openValue: open.reduce((s, d) => s + d.value, 0) };
};
const stale = (d: MDeal) => d.status === "Open" && Date.now() - new Date(d.stageEnteredAt).getTime() > 14 * DAY && (!d.lastActivityAt || Date.now() - new Date(d.lastActivityAt).getTime() > 14 * DAY);
const dealCard = (d: MDeal) => {
  const st = db.stages.find((s) => s.id === d.stageId)!;
  const c = db.contacts.find((x) => x.id === d.contactId);
  const co = db.companies.find((x) => x.id === d.companyId);
  return {
    id: d.id, title: d.title, value: d.value, status: d.status, pipelineId: d.pipelineId, stageId: d.stageId, stageName: st.name, stageColor: st.color,
    probability: d.probability ?? st.probability, expectedCloseDate: d.expectedCloseDate, owner: user(d.ownerId),
    contact: c ? { id: c.id, name: `${c.firstName} ${c.lastName}` } : null, company: co ? { id: co.id, name: co.name } : null,
    sortOrder: d.sortOrder, stageEnteredAt: d.stageEnteredAt, updatedAt: d.updatedAt, isStale: stale(d), tags: tagDtos(d.tagIds),
    openActivities: db.activities.filter((a) => a.recordType === "Deal" && a.recordId === d.id && !a.isDone).length,
  };
};
const recordTitle = (t: RecordType | null, id: string | null) => {
  if (!t || !id) return null;
  if (t === "Contact") { const c = db.contacts.find((x) => x.id === id); return c ? `${c.firstName} ${c.lastName}` : null; }
  if (t === "Company") return db.companies.find((x) => x.id === id)?.name ?? null;
  return db.deals.find((x) => x.id === id)?.title ?? null;
};
const activityDto = (a: MActivity) => {
  const title = recordTitle(a.recordType, a.recordId);
  return { ...a, assignee: user(a.assigneeId), record: title && a.recordType && a.recordId ? { type: a.recordType, id: a.recordId, title } : null, isOverdue: !a.isDone && !!a.dueAt && new Date(a.dueAt) < new Date() };
};
const eventDto = (e: MEvent, via?: string | null) => ({ id: e.id, kind: e.kind, title: e.title, body: e.body, data: e.data, actor: user(e.actorId), occurredAt: e.createdAt, recordType: e.recordType, recordId: e.recordId, via: via ?? null });
const addEvent = (recordType: RecordType, recordId: string, kind: MEvent["kind"], title: string, body: string | null = null, data: Record<string, string> = {}) => {
  const e: MEvent = { id: db.uid(), recordType, recordId, kind, title, body, data, actorId: currentUserId(), createdAt: nowIso() };
  db.events.push(e);
  return e;
};

function page<T>(items: T[], q: URLSearchParams) {
  const p = Math.max(1, Number(q.get("page") ?? 1));
  const size = Number(q.get("pageSize") ?? 25);
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, pageSize: size };
}
function sortBy<T>(items: T[], key: (x: T) => string | number | null | undefined, dir: string | null) {
  const m = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = key(a) ?? "", y = key(b) ?? "";
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fa")) * m;
  });
}
const has = (s: string | null | undefined, t: string) => !!s && s.toLowerCase().includes(t);

function contactsFiltered(q: URLSearchParams) {
  let xs = db.contacts;
  const t = q.get("q")?.toLowerCase();
  if (t) xs = xs.filter((c) => has(`${c.firstName} ${c.lastName}`, t) || has(c.email, t) || has(c.phone, t) || has(db.companies.find((x) => x.id === c.companyId)?.name, t));
  for (const k of ["ownerId", "companyId", "lifecycle", "source"] as const) { const v = q.get(k); if (v) xs = xs.filter((c) => c[k] === v); }
  const tag = q.get("tagId"); if (tag) xs = xs.filter((c) => c.tagIds.includes(tag));
  const key: Record<string, (c: MContact) => string | number | null> = {
    name: (c) => c.firstName, email: (c) => c.email, company: (c) => db.companies.find((x) => x.id === c.companyId)?.name ?? "", owner: (c) => user(c.ownerId)?.fullName ?? "",
    lifecycle: (c) => ["Subscriber", "Lead", "Qualified", "Opportunity", "Customer"].indexOf(c.lifecycle), lastActivityAt: (c) => c.lastActivityAt ?? "", createdAt: (c) => c.createdAt,
  };
  return sortBy(xs, key[q.get("sort") ?? "createdAt"] ?? key.createdAt, q.get("dir"));
}
function companiesFiltered(q: URLSearchParams) {
  let xs = db.companies;
  const t = q.get("q")?.toLowerCase();
  if (t) xs = xs.filter((c) => has(c.name, t) || has(c.domain, t));
  for (const k of ["ownerId", "industry", "city"] as const) { const v = q.get(k); if (v) xs = xs.filter((c) => c[k] === v); }
  const tag = q.get("tagId"); if (tag) xs = xs.filter((c) => c.tagIds.includes(tag));
  const key: Record<string, (c: MCompany) => string | number | null> = {
    name: (c) => c.name, industry: (c) => c.industry, city: (c) => c.city, owner: (c) => user(c.ownerId)?.fullName ?? "",
    contacts: (c) => db.contacts.filter((x) => x.companyId === c.id).length, openValue: (c) => companyDto(c).openValue, lastActivityAt: (c) => c.lastActivityAt ?? "", createdAt: (c) => c.createdAt,
  };
  return sortBy(xs, key[q.get("sort") ?? "name"] ?? key.name, q.get("dir") ?? "asc");
}
const csv = (rows: (string | null | undefined)[][]) => new Blob(["﻿" + rows.map((r) => r.map((v) => `"${(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });

function report(q: URLSearchParams) {
  const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59Z`).getTime() : Date.now();
  const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00Z`).getTime() : Date.now() - 89 * DAY;
  const owner = q.get("ownerId");
  const pipeline = db.pipelines.find((p) => p.id === q.get("pipelineId")) ?? db.pipelines[0];
  const deals = db.deals.filter((d) => !owner || d.ownerId === owner);
  const prob = (d: MDeal) => d.probability ?? db.stages.find((s) => s.id === d.stageId)!.probability;
  const open = deals.filter((d) => d.status === "Open");
  const inRange = (iso: string | null, a = from, b = to) => !!iso && new Date(iso).getTime() >= a && new Date(iso).getTime() <= b;
  const won = deals.filter((d) => d.status === "Won" && inRange(d.closedAt)), lost = deals.filter((d) => d.status === "Lost" && inRange(d.closedAt));
  const span = to - from;
  const prevWon = deals.filter((d) => d.status === "Won" && inRange(d.closedAt, from - span, from)), prevLost = deals.filter((d) => d.status === "Lost" && inRange(d.closedAt, from - span, from));
  const rate = (w: number, l: number) => (w + l ? Math.round((1000 * w) / (w + l)) / 10 : 0);
  const pf = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" });
  const monthKey = (t: number) => { const parts = pf.formatToParts(new Date(t)); const y = parts.find((p) => p.type === "year")!.value.replace(/\D/g, ""); const m = parts.find((p) => p.type === "month")!.value; return `${y}-${m.padStart(2, "0")}`; };
  const months: string[] = [];
  for (let i = 0; months.length < 6 && i < 220; i += 5) { const k = monthKey(Date.now() + i * DAY); if (!months.includes(k)) months.push(k); }
  const forecast = months.map((m) => {
    const inMonth = open.filter((d) => d.expectedCloseDate && monthKey(new Date(d.expectedCloseDate).getTime()) === m);
    return { month: m, expected: inMonth.reduce((s, d) => s + d.value, 0), weighted: inMonth.reduce((s, d) => s + (d.value * prob(d)) / 100, 0),
      won: deals.filter((d) => d.status === "Won" && d.closedAt && monthKey(new Date(d.closedAt).getTime()) === m).reduce((s, d) => s + d.value, 0) };
  });
  const overTime = [];
  for (let w = from; w <= to; w += 7 * DAY) overTime.push({
    week: new Date(w).toISOString().slice(0, 10),
    created: deals.filter((d) => inRange(d.createdAt, w, w + 7 * DAY)).length,
    won: deals.filter((d) => d.status === "Won" && inRange(d.closedAt, w, w + 7 * DAY)).length,
    lost: deals.filter((d) => d.status === "Lost" && inRange(d.closedAt, w, w + 7 * DAY)).length,
    wonValue: 0,
  });
  const done = db.activities.filter((a) => a.isDone && inRange(a.doneAt));
  const team = db.users.filter((u) => !owner || u.id === owner).map((u) => ({
    user: user(u.id)!, calls: done.filter((a) => a.assigneeId === u.id && a.type === "Call").length, meetings: done.filter((a) => a.assigneeId === u.id && a.type === "Meeting").length,
    tasks: done.filter((a) => a.assigneeId === u.id && a.type === "Task").length, notes: db.events.filter((e) => e.kind === "Note" && e.actorId === u.id && inRange(e.createdAt)).length,
    emails: db.events.filter((e) => e.kind === "EmailSent" && e.actorId === u.id && inRange(e.createdAt)).length,
    dealsWon: won.filter((d) => d.ownerId === u.id).length, wonValue: won.filter((d) => d.ownerId === u.id).reduce((s, d) => s + d.value, 0),
  })).sort((a, b) => b.wonValue - a.wonValue);
  const reasons = Object.entries(lost.reduce<Record<string, number>>((m, d) => ({ ...m, [d.lostReason ?? "نامشخص"]: (m[d.lostReason ?? "نامشخص"] ?? 0) + 1 }), {}))
    .map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  const sumWon = won.reduce((s, d) => s + d.value, 0);
  return {
    kpis: {
      openValue: open.reduce((s, d) => s + d.value, 0), weightedValue: open.reduce((s, d) => s + (d.value * prob(d)) / 100, 0), wonValue: sumWon, wonCount: won.length, lostCount: lost.length,
      winRate: rate(won.length, lost.length), avgDealSize: won.length ? sumWon / won.length : 0,
      avgDaysToClose: won.length ? Math.round((10 * won.reduce((s, d) => s + (new Date(d.closedAt!).getTime() - new Date(d.createdAt).getTime()) / DAY, 0)) / won.length) / 10 : 0,
      newContacts: db.contacts.filter((c) => inRange(c.createdAt)).length, activitiesDone: done.length, prevWonValue: prevWon.reduce((s, d) => s + d.value, 0), prevWinRate: rate(prevWon.length, prevLost.length),
    },
    pipeline: db.stages.filter((s) => s.pipelineId === pipeline.id).map((s) => {
      const xs = open.filter((d) => d.stageId === s.id);
      return { stageId: s.id, stage: s.name, color: s.color, count: xs.length, value: xs.reduce((a, d) => a + d.value, 0), weighted: xs.reduce((a, d) => a + (d.value * prob(d)) / 100, 0) };
    }),
    forecast, team, overTime, lostReasons: reasons.slice(0, 6), recent: recent(12), pipelineId: pipeline.id,
  };
}
const recent = (n: number) => [...db.events].filter((e) => e.kind !== "FieldChanged").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, n).map((e) => eventDto(e, recordTitle(e.recordType, e.recordId)));

function tehranDay() {
  const local = new Date(Date.now() + 3.5 * 3600_000); local.setUTCHours(0, 0, 0, 0);
  const start = local.getTime() - 3.5 * 3600_000;
  return [start, start + DAY] as const;
}

type Handler = (m: RegExpMatchArray, q: URLSearchParams, body: Record<string, unknown> & { [k: string]: never }) => unknown;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) => routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), h]);
const notFound = (w: string): never => { throw new ApiError(404, `${w} پیدا نشد.`); };

on("POST", "/auth/login", (_m, _q, b) => {
  if (String(b.email).toLowerCase() !== db.me.email || b.password !== "Demo1234!") throw new ApiError(401, "ایمیل یا رمز عبور اشتباه است.");
  return { token: "mock-token", user: me() };
});
on("POST", "/auth/register", () => ({ token: "mock-token", user: me() }));
on("GET", "/auth/me", () => me());
on("GET", "/invitations/:t", () => { throw new ApiError(404, "در حالت نمایشی دعوت‌نامه‌ای وجود ندارد."); });
on("POST", "/workspaces", (_m, _q, b) => { const w = { id: db.uid(), name: String(b.name), slug: "new", industry: "", accentColor: "#5E9E6E", currency: "IRT", createdAt: nowIso() }; db.workspaces.push(w); db.members.push({ workspaceId: w.id, userId: db.me.id, role: "Owner", joinedAt: nowIso() }); return w; });
on("GET", "/workspace", () => db.workspaces.find((w) => w.id === wsId()));
on("PUT", "/workspace", (_m, _q, b) => Object.assign(db.workspaces.find((w) => w.id === wsId())!, b));
on("GET", "/workspace/members", () => db.members.filter((m) => m.workspaceId === wsId()).map((m) => { const u = db.users.find((x) => x.id === m.userId)!; return { userId: u.id, fullName: u.fullName, email: u.email, avatarColor: u.avatarColor, jobTitle: u.jobTitle, role: m.role, joinedAt: m.joinedAt }; }));
on("PUT", "/workspace/members/:id/role", (m, _q, b) => { const x = db.members.find((y) => y.userId === m[1] && y.workspaceId === wsId()); if (x) x.role = b.role as never; });
on("DELETE", "/workspace/members/:id", (m) => { const i = db.members.findIndex((y) => y.userId === m[1] && y.workspaceId === wsId()); if (i >= 0) db.members.splice(i, 1); });
const invites: { id: string; email: string; role: string; expiresAt: string; link: string }[] = [];
on("GET", "/workspace/invitations", () => invites);
on("POST", "/workspace/invitations", (_m, _q, b) => { const i = { id: db.uid(), email: String(b.email), role: String(b.role), expiresAt: new Date(Date.now() + 7 * DAY).toISOString(), link: `${location.origin}/invite/${db.uid().replace(/-/g, "")}` }; invites.unshift(i); return i; });
on("DELETE", "/workspace/invitations/:id", (m) => { const i = invites.findIndex((x) => x.id === m[1]); if (i >= 0) invites.splice(i, 1); });

on("GET", "/contacts", (_m, q) => { const p = page(contactsFiltered(q), q); return { ...p, items: p.items.map(contactDto) }; });
on("GET", "/contacts/export", (_m, q) => csv([["firstName", "lastName", "email", "phone", "company"], ...contactsFiltered(q).map((c) => [c.firstName, c.lastName, c.email, c.phone, db.companies.find((x) => x.id === c.companyId)?.name])]));
on("POST", "/contacts/import", () => ({ created: 0, skipped: 0, errors: ["در حالت نمایشی ورود فایل غیرفعال است."] }));
on("GET", "/contacts/:id", (m) => {
  const c = db.contacts.find((x) => x.id === m[1]) ?? notFound("مخاطب");
  return { contact: contactDto(c), deals: db.deals.filter((d) => d.contactId === c.id).map(dealCard), openActivities: db.activities.filter((a) => a.recordId === c.id && !a.isDone).length };
});
const applyContact = (c: MContact, b: Record<string, unknown>) => Object.assign(c, { firstName: b.firstName, lastName: b.lastName ?? "", email: b.email || "", phone: b.phone || "", jobTitle: b.jobTitle ?? "", city: b.city ?? "", source: b.source ?? "", lifecycle: b.lifecycle, companyId: b.companyId ?? null, ownerId: b.ownerId ?? c.ownerId, tagIds: (b.tagIds as string[]) ?? c.tagIds, customFields: (b.customFields as Record<string, string>) ?? c.customFields, updatedAt: nowIso() });
on("POST", "/contacts", (_m, _q, b) => {
  if (!String(b.firstName ?? "").trim()) throw new ApiError(400, "اطلاعات ارسالی معتبر نیست.", { firstName: ["پر کردن این فیلد الزامی است."] });
  const c = applyContact({ id: db.uid(), createdAt: nowIso(), lastActivityAt: null, tagIds: [], customFields: {} } as unknown as MContact, b);
  db.contacts.unshift(c); addEvent("Contact", c.id, "Created", "مخاطب ساخته شد"); return contactDto(c);
});
on("PUT", "/contacts/:id", (m, _q, b) => { const c = db.contacts.find((x) => x.id === m[1]) ?? notFound("مخاطب"); if (c.email !== b.email) addEvent("Contact", c.id, "FieldChanged", "«ایمیل» تغییر کرد", null, { field: "ایمیل", old: c.email, new: String(b.email) }); return contactDto(applyContact(c, b)); });
on("DELETE", "/contacts/:id", (m) => { const i = db.contacts.findIndex((x) => x.id === m[1]); if (i >= 0) db.contacts.splice(i, 1); });

on("GET", "/companies", (_m, q) => { const p = page(companiesFiltered(q), q); return { ...p, items: p.items.map(companyDto) }; });
on("GET", "/companies/export", (_m, q) => csv([["name", "domain", "industry", "city"], ...companiesFiltered(q).map((c) => [c.name, c.domain, c.industry, c.city])]));
on("POST", "/companies/import", () => ({ created: 0, skipped: 0, errors: ["در حالت نمایشی ورود فایل غیرفعال است."] }));
on("GET", "/companies/:id", (m) => {
  const c = db.companies.find((x) => x.id === m[1]) ?? notFound("شرکت");
  const deals = db.deals.filter((d) => d.companyId === c.id);
  return { company: companyDto(c), contacts: db.contacts.filter((x) => x.companyId === c.id).map((x) => ({ id: x.id, fullName: `${x.firstName} ${x.lastName}`, jobTitle: x.jobTitle, email: x.email, phone: x.phone, lifecycle: x.lifecycle })),
    deals: deals.map(dealCard), wonValue: deals.filter((d) => d.status === "Won").reduce((s, d) => s + d.value, 0) };
});
on("POST", "/companies", (_m, _q, b) => { const c = { id: db.uid(), createdAt: nowIso(), updatedAt: nowIso(), lastActivityAt: null, tagIds: [], customFields: {}, ...b, ownerId: b.ownerId ?? db.me.id } as unknown as MCompany; db.companies.unshift(c); addEvent("Company", c.id, "Created", "شرکت ساخته شد"); return companyDto(c); });
on("PUT", "/companies/:id", (m, _q, b) => companyDto(Object.assign(db.companies.find((x) => x.id === m[1]) ?? notFound("شرکت"), b)));
on("DELETE", "/companies/:id", (m) => { const i = db.companies.findIndex((x) => x.id === m[1]); if (i >= 0) db.companies.splice(i, 1); });

const pipelineDto = (p: (typeof db.pipelines)[number]) => {
  const open = db.deals.filter((d) => d.pipelineId === p.id && d.status === "Open");
  return { ...p, stages: db.stages.filter((s) => s.pipelineId === p.id).sort((a, b) => a.order - b.order).map(({ id, name, order, probability, color }) => ({ id, name, order, probability, color })), openDeals: open.length, openValue: open.reduce((s, d) => s + d.value, 0) };
};
on("GET", "/pipelines", () => db.pipelines.map(pipelineDto));
on("POST", "/pipelines", (_m, _q, b) => { const p = { id: db.uid(), name: String(b.name), order: db.pipelines.length }; db.pipelines.push(p); (b.stages as { name: string; probability: number; color: string }[]).forEach((s, i) => db.stages.push({ id: db.uid(), pipelineId: p.id, order: i, ...s })); return pipelineDto(p); });
on("PUT", "/pipelines/:id", (m, _q, b) => {
  const p = db.pipelines.find((x) => x.id === m[1]) ?? notFound("پایپ‌لاین"); p.name = String(b.name);
  const input = b.stages as { id?: string; name: string; probability: number; color: string }[];
  for (let i = db.stages.length - 1; i >= 0; i--) if (db.stages[i].pipelineId === p.id && !input.some((s) => s.id === db.stages[i].id)) {
    if (db.deals.some((d) => d.stageId === db.stages[i].id)) throw new ApiError(409, `مرحله‌ی «${db.stages[i].name}» معامله دارد؛ اول معامله‌ها را جابه‌جا کنید.`);
    db.stages.splice(i, 1);
  }
  input.forEach((s, i) => { const ex = db.stages.find((x) => x.id === s.id); if (ex) Object.assign(ex, { ...s, order: i }); else db.stages.push({ id: db.uid(), pipelineId: p.id, order: i, name: s.name, probability: s.probability, color: s.color }); });
  return pipelineDto(p);
});
on("DELETE", "/pipelines/:id", (m) => { if (db.deals.some((d) => d.pipelineId === m[1])) throw new ApiError(409, "این پایپ‌لاین معامله دارد و حذف نمی‌شود."); });

on("GET", "/deals/board", (_m, q) => {
  const p = db.pipelines.find((x) => x.id === q.get("pipelineId")) ?? db.pipelines[0];
  const t = q.get("q")?.toLowerCase(); const owner = q.get("ownerId");
  const open = db.deals.filter((d) => d.pipelineId === p.id && d.status === "Open" && (!owner || d.ownerId === owner) && (!t || has(d.title, t))).sort((a, b) => a.sortOrder - b.sortOrder).map(dealCard);
  const dto = pipelineDto(p);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const won = db.deals.filter((d) => d.pipelineId === p.id && d.status === "Won" && d.closedAt && new Date(d.closedAt) >= monthStart);
  return { pipeline: dto, columns: dto.stages.map((s) => { const ds = open.filter((d) => d.stageId === s.id); return { stage: s, deals: ds, totalValue: ds.reduce((a, d) => a + d.value, 0), weightedValue: ds.reduce((a, d) => a + (d.value * d.probability) / 100, 0) }; }),
    wonThisMonth: won.reduce((s, d) => s + d.value, 0), wonCountThisMonth: won.length };
});
on("GET", "/deals", (_m, q) => {
  let xs = db.deals;
  for (const k of ["pipelineId", "status", "ownerId", "stageId"] as const) { const v = q.get(k); if (v) xs = xs.filter((d) => d[k] === v); }
  const t = q.get("q")?.toLowerCase(); if (t) xs = xs.filter((d) => has(d.title, t));
  const key: Record<string, (d: MDeal) => string | number | null> = { title: (d) => d.title, value: (d) => d.value, stage: (d) => db.stages.find((s) => s.id === d.stageId)!.order, owner: (d) => user(d.ownerId)?.fullName ?? "", expectedCloseDate: (d) => d.expectedCloseDate ?? "", updatedAt: (d) => d.updatedAt, createdAt: (d) => d.createdAt };
  const p = page(sortBy(xs, key[q.get("sort") ?? "createdAt"] ?? key.createdAt, q.get("dir")), q);
  return { ...p, items: p.items.map(dealCard) };
});
on("GET", "/deals/:id", (m) => {
  const d = db.deals.find((x) => x.id === m[1]) ?? notFound("معامله");
  const c = db.contacts.find((x) => x.id === d.contactId);
  return { deal: dealCard(d), lostReason: d.lostReason, closedAt: d.closedAt, createdAt: d.createdAt, customFields: d.customFields, stages: pipelineDto(db.pipelines.find((p) => p.id === d.pipelineId)!).stages,
    pipelineName: db.pipelines.find((p) => p.id === d.pipelineId)!.name, contactInfo: c ? { id: c.id, fullName: `${c.firstName} ${c.lastName}`, jobTitle: c.jobTitle, email: c.email, phone: c.phone, lifecycle: c.lifecycle } : null };
});
on("POST", "/deals", (_m, _q, b) => {
  if (!String(b.title ?? "").trim()) throw new ApiError(400, "اطلاعات ارسالی معتبر نیست.", { title: ["پر کردن این فیلد الزامی است."] });
  const d = { id: db.uid(), status: "Open", lostReason: null, closedAt: null, stageEnteredAt: nowIso(), sortOrder: -1, createdAt: nowIso(), updatedAt: nowIso(), lastActivityAt: null, tagIds: [], customFields: {}, ...b } as unknown as MDeal;
  db.deals.push(d); addEvent("Deal", d.id, "Created", "معامله ساخته شد"); return dealCard(d);
});
on("PUT", "/deals/:id", (m, _q, b) => dealCard(Object.assign(db.deals.find((x) => x.id === m[1]) ?? notFound("معامله"), b, { updatedAt: nowIso() })));
on("POST", "/deals/:id/move", (m, _q, b) => {
  const d = db.deals.find((x) => x.id === m[1]) ?? notFound("معامله");
  if (d.stageId !== b.stageId) {
    const from = db.stages.find((s) => s.id === d.stageId)!, to = db.stages.find((s) => s.id === b.stageId)!;
    addEvent("Deal", d.id, "StageChanged", `از «${from.name}» به «${to.name}» رفت`, null, { from: from.name, to: to.name, color: to.color });
    d.stageEnteredAt = nowIso();
  }
  Object.assign(d, { stageId: b.stageId, sortOrder: b.sortOrder ?? d.sortOrder, updatedAt: nowIso() });
  return dealCard(d);
});
on("POST", "/deals/:id/won", (m) => { const d = db.deals.find((x) => x.id === m[1]) ?? notFound("معامله"); Object.assign(d, { status: "Won", closedAt: nowIso() }); addEvent("Deal", d.id, "DealWon", "معامله برنده شد 🎉"); return dealCard(d); });
on("POST", "/deals/:id/lost", (m, _q, b) => { const d = db.deals.find((x) => x.id === m[1]) ?? notFound("معامله"); Object.assign(d, { status: "Lost", closedAt: nowIso(), lostReason: b.reason }); addEvent("Deal", d.id, "DealLost", "معامله از دست رفت", String(b.reason)); return dealCard(d); });
on("POST", "/deals/:id/reopen", (m) => { const d = db.deals.find((x) => x.id === m[1]) ?? notFound("معامله"); Object.assign(d, { status: "Open", closedAt: null, lostReason: null }); return dealCard(d); });
on("DELETE", "/deals/:id", (m) => { const i = db.deals.findIndex((x) => x.id === m[1]); if (i >= 0) db.deals.splice(i, 1); });

on("GET", "/activities", (_m, q) => {
  const [ds, de] = tehranDay(); const now = Date.now();
  let xs = db.activities;
  if (q.get("mine")) xs = xs.filter((a) => a.assigneeId === currentUserId());
  const aid = q.get("assigneeId"); if (aid) xs = xs.filter((a) => a.assigneeId === aid);
  const type = q.get("type"); if (type) xs = xs.filter((a) => a.type === type);
  const rid = q.get("recordId"); if (rid) xs = xs.filter((a) => a.recordId === rid);
  const t = (a: MActivity) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity);
  const st = q.get("status");
  if (st === "open") xs = xs.filter((a) => !a.isDone);
  if (st === "done") xs = xs.filter((a) => a.isDone);
  if (st === "overdue") xs = xs.filter((a) => !a.isDone && t(a) < now);
  if (st === "today") xs = xs.filter((a) => !a.isDone && t(a) >= ds && t(a) < de);
  if (st === "upcoming") xs = xs.filter((a) => !a.isDone && t(a) >= de);
  xs = st === "done" ? [...xs].sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")) : [...xs].sort((a, b) => t(a) - t(b));
  return xs.slice(0, Number(q.get("take") ?? 100)).map(activityDto);
});
on("GET", "/activities/my-day", () => {
  const [ds, de] = tehranDay(); const now = Date.now(); const mine = db.activities.filter((a) => a.assigneeId === currentUserId());
  const t = (a: MActivity) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity);
  const myDeals = db.deals.filter((d) => d.ownerId === currentUserId() && d.status === "Open");
  return {
    overdue: mine.filter((a) => !a.isDone && t(a) < Math.min(now, ds)).sort((a, b) => t(a) - t(b)).map(activityDto),
    today: mine.filter((a) => t(a) >= ds && t(a) < de).sort((a, b) => Number(a.isDone) - Number(b.isDone) || t(a) - t(b)).map(activityDto),
    upcoming: mine.filter((a) => !a.isDone && t(a) >= de).sort((a, b) => t(a) - t(b)).slice(0, 8).map(activityDto),
    doneToday: mine.filter((a) => a.isDone && a.doneAt && new Date(a.doneAt).getTime() >= ds).length,
    staleDeals: myDeals.filter(stale).slice(0, 4).map(dealCard),
    closingSoon: myDeals.filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate).getTime() < now + 14 * DAY).sort((a, b) => a.expectedCloseDate!.localeCompare(b.expectedCloseDate!)).slice(0, 6).map(dealCard),
  };
});
on("POST", "/activities", (_m, _q, b) => {
  const a: MActivity = { id: db.uid(), type: b.type as ActivityType, subject: String(b.subject), description: (b.description as string) ?? null, dueAt: (b.dueAt as string) ?? null, durationMinutes: (b.durationMinutes as number) ?? null,
    assigneeId: (b.assigneeId as string) ?? currentUserId(), isDone: false, doneAt: null, recordType: (b.recordType as RecordType) ?? null, recordId: (b.recordId as string) ?? null, createdAt: nowIso() };
  db.activities.push(a);
  if (a.recordType && a.recordId) addEvent(a.recordType, a.recordId, "ActivityCreated", `${a.type === "Call" ? "تماس" : a.type === "Meeting" ? "جلسه" : "کار"}: ${a.subject}`, null, { type: a.type });
  return activityDto(a);
});
on("PUT", "/activities/:id", (m, _q, b) => activityDto(Object.assign(db.activities.find((x) => x.id === m[1]) ?? notFound("فعالیت"), b)));
on("POST", "/activities/:id/toggle", (m) => {
  const a = db.activities.find((x) => x.id === m[1]) ?? notFound("فعالیت");
  a.isDone = !a.isDone; a.doneAt = a.isDone ? nowIso() : null;
  if (a.isDone && a.recordType && a.recordId) addEvent(a.recordType, a.recordId, "ActivityCompleted", `${a.type === "Call" ? "تماس" : a.type === "Meeting" ? "جلسه" : "کار"} انجام شد: ${a.subject}`, null, { type: a.type });
  return activityDto(a);
});
on("DELETE", "/activities/:id", (m) => { const i = db.activities.findIndex((x) => x.id === m[1]); if (i >= 0) db.activities.splice(i, 1); });

on("POST", "/notes", (_m, _q, b) => eventDto(addEvent(b.recordType as RecordType, String(b.recordId), "Note", "یادداشت گذاشت", String(b.body))));
on("DELETE", "/notes/:id", (m) => { const i = db.events.findIndex((x) => x.id === m[1]); if (i >= 0) db.events.splice(i, 1); });
on("POST", "/emails", (_m, _q, b) => { addEvent(b.recordType as RecordType, String(b.recordId), "EmailSent", `ایمیل فرستاد: ${b.subject}`, String(b.body), { to: String(b.to), delivered: "true" }); return { id: db.uid() }; });
on("GET", "/timeline/recent", () => recent(20));
on("GET", "/timeline/:type/:id", (m, q) => {
  const type = m[1] as RecordType, id = m[2];
  const dealIds = type === "Contact" ? db.deals.filter((d) => d.contactId === id).map((d) => d.id) : type === "Company" ? db.deals.filter((d) => d.companyId === id).map((d) => d.id) : [];
  const kind = q.get("kind");
  const kinds: Record<string, string[]> = { notes: ["Note"], activities: ["ActivityCreated", "ActivityCompleted"], emails: ["EmailSent"], changes: ["FieldChanged", "StageChanged", "Created", "DealWon", "DealLost", "Automation"] };
  return db.events.filter((e) => (e.recordType === type && e.recordId === id) || (e.recordType === "Deal" && dealIds.includes(e.recordId) && e.kind !== "Created"))
    .filter((e) => !kind || kinds[kind]?.includes(e.kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
    .map((e) => eventDto(e, e.recordId !== id ? recordTitle(e.recordType, e.recordId) : null));
});

on("GET", "/search", (_m, q) => {
  const t = q.get("q")?.toLowerCase();
  const cs = (t ? db.contacts.filter((c) => has(`${c.firstName} ${c.lastName}`, t) || has(c.email, t)) : db.contacts).slice(0, t ? 6 : 4);
  const cos = (t ? db.companies.filter((c) => has(c.name, t) || has(c.domain, t)) : db.companies).slice(0, t ? 5 : 3);
  const ds = (t ? db.deals.filter((d) => has(d.title, t)) : db.deals.filter((d) => d.status === "Open")).slice(0, t ? 6 : 4);
  return {
    contacts: cs.map((c) => ({ type: "Contact", id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.email, meta: db.companies.find((x) => x.id === c.companyId)?.name })),
    companies: cos.map((c) => ({ type: "Company", id: c.id, title: c.name, subtitle: c.industry, meta: c.city })),
    deals: ds.map((d) => ({ type: "Deal", id: d.id, title: d.title, subtitle: db.stages.find((s) => s.id === d.stageId)?.name, meta: String(d.value) })),
  };
});
on("GET", "/views", (_m, q) => db.views.filter((v) => v.entityType === q.get("entityType")));
on("POST", "/views", (_m, _q, b) => { const v = { id: db.uid(), userId: db.me.id, entityType: b.entityType as RecordType, name: String(b.name), query: String(b.query) }; db.views.push(v); return v; });
on("DELETE", "/views/:id", (m) => { const i = db.views.findIndex((x) => x.id === m[1]); if (i >= 0) db.views.splice(i, 1); });
on("GET", "/custom-fields", () => db.fields);
on("POST", "/custom-fields", (_m, _q, b) => { const f = { id: db.uid(), key: `f_${Date.now()}`, ...b } as unknown as (typeof db.fields)[number]; db.fields.push(f); return f; });
on("PUT", "/custom-fields/:id", (m, _q, b) => Object.assign(db.fields.find((x) => x.id === m[1]) ?? notFound("فیلد"), b));
on("DELETE", "/custom-fields/:id", (m) => { const i = db.fields.findIndex((x) => x.id === m[1]); if (i >= 0) db.fields.splice(i, 1); });
on("GET", "/tags", () => db.tags.map((t) => ({ ...t, usage: [...db.contacts, ...db.companies, ...db.deals].filter((r) => r.tagIds.includes(t.id)).length })));
on("POST", "/tags", (_m, _q, b) => { const t = { id: db.uid(), name: String(b.name), color: String(b.color) }; db.tags.push(t); return t; });
on("DELETE", "/tags/:id", (m) => { const i = db.tags.findIndex((x) => x.id === m[1]); if (i >= 0) db.tags.splice(i, 1); });
on("GET", "/automations", () => db.automations);
on("POST", "/automations", (_m, _q, b) => { const a = { id: db.uid(), runCount: 0, lastRunAt: null, createdAt: nowIso(), ...b } as unknown as (typeof db.automations)[number]; db.automations.push(a); return a; });
on("PUT", "/automations/:id", (m, _q, b) => Object.assign(db.automations.find((x) => x.id === m[1]) ?? notFound("اتوماسیون"), b));
on("POST", "/automations/:id/toggle", (m) => { const a = db.automations.find((x) => x.id === m[1]) ?? notFound("اتوماسیون"); a.isActive = !a.isActive; return a; });
on("DELETE", "/automations/:id", (m) => { const i = db.automations.findIndex((x) => x.id === m[1]); if (i >= 0) db.automations.splice(i, 1); });
on("GET", "/notifications", () => ({ items: db.notifications.map((n) => ({ ...n, isRead: !!n.readAt })), unread: db.notifications.filter((n) => !n.readAt).length }));
on("POST", "/notifications/read", (_m, q) => { db.notifications.filter((n) => !q.get("id") || n.id === q.get("id")).forEach((n) => (n.readAt = nowIso())); });
on("GET", "/reports/summary", (_m, q) => report(q));
on("POST", "/digest/send-now", () => ({ sent: true }));

export async function handle(method: string, path: string, body: unknown) {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 220));
  const [p, query = ""] = path.split("?");
  for (const [m, re, h] of routes) {
    if (m !== method) continue;
    const match = p.match(re);
    if (match) return structuredClone(h(match, new URLSearchParams(query), (body ?? {}) as never) ?? null);
  }
  throw new ApiError(404, `مسیر ${method} ${p} در حالت نمایشی پیاده نشده است.`);
}
