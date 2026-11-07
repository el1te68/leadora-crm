// Mirrors the Leadora API DTOs (camelCase JSON, enums as strings).

export type Guid = string;
export type RecordType = "Contact" | "Company" | "Deal";
export type WorkspaceRole = "Owner" | "Admin" | "Member";
export type DealStatus = "Open" | "Won" | "Lost";
export type ActivityType = "Task" | "Call" | "Meeting";
export type LifecycleStage = "Subscriber" | "Lead" | "Qualified" | "Opportunity" | "Customer";
export type CustomFieldType = "Text" | "Number" | "Date" | "Select";
export type TimelineKind =
  | "Created" | "FieldChanged" | "StageChanged" | "Note" | "ActivityCreated"
  | "ActivityCompleted" | "EmailSent" | "DealWon" | "DealLost" | "Automation";
export type AutomationTrigger = "DealCreated" | "DealStageChanged" | "DealWon" | "DealLost" | "ContactCreated";
export type AutomationAction = "CreateTask" | "AssignOwner" | "SendNotification";

export interface UserRef { id: Guid; fullName: string; avatarColor: string }
export interface NamedRef { id: Guid; name: string }
export interface TagDto { id: Guid; name: string; color: string }
export interface TagWithUsage extends TagDto { usage: number }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface WorkspaceSummary { id: Guid; name: string; slug: string; accentColor: string; role: WorkspaceRole; memberCount: number }
export interface Me { id: Guid; fullName: string; email: string; avatarColor: string; jobTitle?: string | null; workspaces: WorkspaceSummary[] }
export interface AuthResponse { token: string; user: Me }

export interface Workspace { id: Guid; name: string; slug: string; industry?: string | null; accentColor: string; currency: string; createdAt: string }
export interface Member { userId: Guid; fullName: string; email: string; avatarColor: string; jobTitle?: string | null; role: WorkspaceRole; joinedAt: string }
export interface Invitation { id: Guid; email: string; role: WorkspaceRole; expiresAt: string; link: string }
export interface InvitationPreview { workspaceName: string; email: string; role: WorkspaceRole; invitedBy: string; hasAccount: boolean }

export interface ContactListItem {
  id: Guid; firstName: string; lastName: string; fullName: string; email?: string | null; phone?: string | null;
  jobTitle?: string | null; city?: string | null; source?: string | null; lifecycle: LifecycleStage;
  company?: NamedRef | null; owner?: UserRef | null; tags: TagDto[]; customFields: Record<string, string>;
  createdAt: string; lastActivityAt?: string | null;
}
export interface ContactMini { id: Guid; fullName: string; jobTitle?: string | null; email?: string | null; phone?: string | null; lifecycle: LifecycleStage }
export interface ContactDetail { contact: ContactListItem; deals: DealCard[]; openActivities: number }

export interface CompanyListItem {
  id: Guid; name: string; domain?: string | null; industry?: string | null; size?: string | null; city?: string | null;
  phone?: string | null; address?: string | null; owner?: UserRef | null; tags: TagDto[]; contactCount: number;
  openDeals: number; openValue: number; customFields: Record<string, string>; createdAt: string; lastActivityAt?: string | null;
}
export interface CompanyDetail { company: CompanyListItem; contacts: ContactMini[]; deals: DealCard[]; wonValue: number }

export interface StageDto { id: Guid; name: string; order: number; probability: number; color: string }
export interface Pipeline { id: Guid; name: string; order: number; stages: StageDto[]; openDeals: number; openValue: number }

export interface DealCard {
  id: Guid; title: string; value: number; status: DealStatus; pipelineId: Guid; stageId: Guid; stageName: string; stageColor: string;
  probability: number; expectedCloseDate?: string | null; owner?: UserRef | null; contact?: NamedRef | null; company?: NamedRef | null;
  sortOrder: number; stageEnteredAt: string; updatedAt: string; isStale: boolean; tags: TagDto[]; openActivities: number;
}
export interface BoardColumn { stage: StageDto; deals: DealCard[]; totalValue: number; weightedValue: number }
export interface Board { pipeline: Pipeline; columns: BoardColumn[]; wonThisMonth: number; wonCountThisMonth: number }
export interface DealDetail {
  deal: DealCard; lostReason?: string | null; closedAt?: string | null; createdAt: string; customFields: Record<string, string>;
  stages: StageDto[]; pipelineName: string; contactInfo?: ContactMini | null;
}

export interface RecordRef { type: RecordType; id: Guid; title: string }
export interface Activity {
  id: Guid; type: ActivityType; subject: string; description?: string | null; dueAt?: string | null; durationMinutes?: number | null;
  assignee?: UserRef | null; isDone: boolean; doneAt?: string | null; record?: RecordRef | null; createdAt: string; isOverdue: boolean;
}
export interface MyDay { overdue: Activity[]; today: Activity[]; upcoming: Activity[]; doneToday: number; staleDeals: DealCard[]; closingSoon: DealCard[] }

export interface TimelineItem {
  id: Guid; kind: TimelineKind; title: string; body?: string | null; data: Record<string, string>; actor?: UserRef | null;
  occurredAt: string; recordType: RecordType; recordId: Guid; via?: string | null;
}

export interface CustomField { id: Guid; entityType: RecordType; key: string; label: string; type: CustomFieldType; options: string[]; order: number }
export interface SavedView { id: Guid; entityType: RecordType; name: string; query: string }

export interface Automation {
  id: Guid; name: string; trigger: AutomationTrigger; pipelineId?: Guid | null; stageId?: Guid | null; action: AutomationAction;
  config: Record<string, string>; isActive: boolean; runCount: number; lastRunAt?: string | null; createdAt: string;
}

export interface Notification { id: Guid; title: string; body?: string | null; link?: string | null; kind: string; createdAt: string; isRead: boolean }
export interface NotificationPage { items: Notification[]; unread: number }

export interface SearchHit { type: RecordType; id: Guid; title: string; subtitle?: string | null; meta?: string | null }
export interface SearchResult { contacts: SearchHit[]; companies: SearchHit[]; deals: SearchHit[] }

export interface Report {
  kpis: {
    openValue: number; weightedValue: number; wonValue: number; wonCount: number; lostCount: number; winRate: number; avgDealSize: number;
    avgDaysToClose: number; newContacts: number; activitiesDone: number; prevWonValue: number; prevWinRate: number;
  };
  pipeline: { stageId: Guid; stage: string; color: string; count: number; value: number; weighted: number }[];
  forecast: { month: string; expected: number; weighted: number; won: number }[];
  team: { user: UserRef; calls: number; meetings: number; tasks: number; notes: number; emails: number; dealsWon: number; wonValue: number }[];
  overTime: { week: string; created: number; won: number; lost: number; wonValue: number }[];
  lostReasons: { reason: string; count: number }[];
  recent: TimelineItem[];
  pipelineId: Guid;
}

export interface ImportResult { created: number; skipped: number; errors: string[] }
