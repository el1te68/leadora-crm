import { useEffect } from "react";
import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MOCK } from "./api";
import { useAuth } from "@/store";
import type { Notification, RecordType } from "./types";

/**
 * One SignalR connection per signed-in tab. Server events only carry ids; we translate them into
 * TanStack Query invalidations so every open board/timeline refreshes for teammates.
 */
export function useRealtime() {
  const token = useAuth((s) => s.token);
  const workspaceId = useAuth((s) => s.workspaceId);
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (MOCK || !token || !workspaceId) return;
    const conn: HubConnection = new HubConnectionBuilder()
      .withUrl("/hubs/crm", { accessTokenFactory: () => useAuth.getState().token ?? "" })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const inv = (...k: string[]) => k.forEach((key) => qc.invalidateQueries({ queryKey: [workspaceId, key] }));

    conn.on("deal.changed", (e: { actorId?: string }) => {
      if (e.actorId === me) return; // our own optimistic update already happened
      inv("board", "deals", "deal", "report", "pipelines", "contact", "company");
    });
    conn.on("contact.changed", () => inv("contacts", "contact", "search"));
    conn.on("company.changed", () => inv("companies", "company", "search"));
    conn.on("activity.changed", () => inv("activities", "my-day", "board"));
    conn.on("timeline.changed", (e: { recordType: RecordType; recordId: string }) => {
      qc.invalidateQueries({ queryKey: [workspaceId, "timeline", e.recordType, e.recordId] });
      qc.invalidateQueries({ queryKey: [workspaceId, "timeline"] });
    });
    conn.on("notification", (n: Notification & { workspaceId?: string }) => {
      inv("notifications");
      if (!n.workspaceId || n.workspaceId === workspaceId) toast(n.title, { description: n.body ?? undefined });
    });

    conn.onreconnected(() => conn.invoke("JoinWorkspace", workspaceId).catch(() => undefined));
    let stopped = false;
    conn.start()
      .then(() => !stopped && conn.invoke("JoinWorkspace", workspaceId))
      .catch(() => undefined);

    return () => {
      stopped = true;
      conn.stop().catch(() => undefined);
    };
  }, [token, workspaceId, me, qc]);
}
