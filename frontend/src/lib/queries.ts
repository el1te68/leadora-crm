import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import { useAuth } from "@/store";
import type {
  Activity, Automation, Board, CompanyDetail, CompanyListItem, ContactDetail, ContactListItem, CustomField, DealCard, DealDetail,
  Invitation, Member, MyDay, NotificationPage, Paged, Pipeline, RecordType, Report, SavedView, SearchResult, TagWithUsage,
  TimelineItem, Workspace,
} from "./types";

/** Every tenant query key starts with the workspace id, so switching workspaces never shows stale rows. */
export const useWs = () => useAuth((s) => s.workspaceId) ?? "none";

export const keys = {
  all: (ws: string) => [ws] as const,
  contacts: (ws: string, q?: object) => [ws, "contacts", q ?? {}] as const,
  contact: (ws: string, id: string) => [ws, "contact", id] as const,
  companies: (ws: string, q?: object) => [ws, "companies", q ?? {}] as const,
  company: (ws: string, id: string) => [ws, "company", id] as const,
  pipelines: (ws: string) => [ws, "pipelines"] as const,
  board: (ws: string, q?: object) => [ws, "board", q ?? {}] as const,
  deals: (ws: string, q?: object) => [ws, "deals", q ?? {}] as const,
  deal: (ws: string, id: string) => [ws, "deal", id] as const,
  activities: (ws: string, q?: object) => [ws, "activities", q ?? {}] as const,
  myDay: (ws: string) => [ws, "my-day"] as const,
  timeline: (ws: string, type: RecordType, id: string, kind?: string) => [ws, "timeline", type, id, kind ?? "all"] as const,
  members: (ws: string) => [ws, "members"] as const,
  tags: (ws: string) => [ws, "tags"] as const,
  fields: (ws: string) => [ws, "custom-fields"] as const,
  views: (ws: string, type: RecordType) => [ws, "views", type] as const,
  automations: (ws: string) => [ws, "automations"] as const,
  notifications: (ws: string) => [ws, "notifications"] as const,
  report: (ws: string, q: object) => [ws, "report", q] as const,
  workspace: (ws: string) => [ws, "workspace"] as const,
  invitations: (ws: string) => [ws, "invitations"] as const,
  search: (ws: string, q: string) => [ws, "search", q] as const,
};

export const showError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "خطایی رخ داد.");

// ---------- reads ----------

export interface ContactFilters { q?: string; ownerId?: string; companyId?: string; tagId?: string; lifecycle?: string; source?: string; sort?: string; dir?: string; page?: number; pageSize?: number }
export interface CompanyFilters { q?: string; ownerId?: string; tagId?: string; industry?: string; city?: string; sort?: string; dir?: string; page?: number; pageSize?: number }

export const useContacts = (f: ContactFilters) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.contacts(ws, f), queryFn: () => api.get<Paged<ContactListItem>>("/contacts", { ...f }), placeholderData: keepPreviousData });
};
export const useContact = (id: string) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.contact(ws, id), queryFn: () => api.get<ContactDetail>(`/contacts/${id}`) });
};
export const useCompanies = (f: CompanyFilters) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.companies(ws, f), queryFn: () => api.get<Paged<CompanyListItem>>("/companies", { ...f }), placeholderData: keepPreviousData });
};
export const useCompany = (id: string) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.company(ws, id), queryFn: () => api.get<CompanyDetail>(`/companies/${id}`) });
};
export const usePipelines = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.pipelines(ws), queryFn: () => api.get<Pipeline[]>("/pipelines"), staleTime: 60_000 });
};
export const useBoard = (q: { pipelineId?: string; ownerId?: string; q?: string }) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.board(ws, q), queryFn: () => api.get<Board>("/deals/board", q), placeholderData: keepPreviousData });
};
export const useDeals = (q: Record<string, string | number | undefined>) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.deals(ws, q), queryFn: () => api.get<Paged<DealCard>>("/deals", q), placeholderData: keepPreviousData });
};
export const useDeal = (id: string) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.deal(ws, id), queryFn: () => api.get<DealDetail>(`/deals/${id}`) });
};
export const useActivities = (q: Record<string, string | number | boolean | undefined>) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.activities(ws, q), queryFn: () => api.get<Activity[]>("/activities", q), placeholderData: keepPreviousData });
};
export const useMyDay = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.myDay(ws), queryFn: () => api.get<MyDay>("/activities/my-day") });
};
export const useTimeline = (type: RecordType, id: string, kind?: string) => {
  const ws = useWs();
  return useQuery({
    queryKey: keys.timeline(ws, type, id, kind),
    queryFn: () => api.get<TimelineItem[]>(`/timeline/${type}/${id}`, { kind: kind === "all" ? undefined : kind }),
    placeholderData: keepPreviousData,
  });
};
export const useMembers = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.members(ws), queryFn: () => api.get<Member[]>("/workspace/members"), staleTime: 60_000 });
};
export const useTags = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.tags(ws), queryFn: () => api.get<TagWithUsage[]>("/tags"), staleTime: 60_000 });
};
export const useCustomFields = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.fields(ws), queryFn: () => api.get<CustomField[]>("/custom-fields"), staleTime: 60_000 });
};
export const useViews = (type: RecordType) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.views(ws, type), queryFn: () => api.get<SavedView[]>("/views", { entityType: type }) });
};
export const useAutomations = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.automations(ws), queryFn: () => api.get<Automation[]>("/automations") });
};
export const useNotifications = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.notifications(ws), queryFn: () => api.get<NotificationPage>("/notifications"), refetchInterval: 120_000 });
};
export const useReport = (q: { from?: string; to?: string; ownerId?: string; pipelineId?: string }) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.report(ws, q), queryFn: () => api.get<Report>("/reports/summary", q), placeholderData: keepPreviousData });
};
export const useWorkspace = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.workspace(ws), queryFn: () => api.get<Workspace>("/workspace") });
};
export const useInvitations = () => {
  const ws = useWs();
  return useQuery({ queryKey: keys.invitations(ws), queryFn: () => api.get<Invitation[]>("/workspace/invitations") });
};
export const useSearch = (q: string, enabled: boolean) => {
  const ws = useWs();
  return useQuery({ queryKey: keys.search(ws, q), queryFn: () => api.get<SearchResult>("/search", { q }), enabled, placeholderData: keepPreviousData, staleTime: 10_000 });
};

// ---------- writes ----------

/** Generic mutation that invalidates the whole workspace cache subtree(s) it touches. */
export function useAction<TArgs, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { invalidate?: string[]; success?: string | ((r: TResult) => string); silent?: boolean } = {},
) {
  const qc = useQueryClient();
  const ws = useWs();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: [ws, k] });
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r) : opts.success);
    },
    onError: (e) => {
      if (!opts.silent) showError(e);
    },
  });
}

/** Keys that change when a record (or anything on its timeline) changes. */
export const recordKeys = ["contacts", "contact", "companies", "company", "deals", "deal", "board", "timeline", "activities", "my-day", "report", "pipelines"];
