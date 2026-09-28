// One JSON line per successful admin mutation, so a log drain can index
// who did what to which record, and when. Failed or rejected attempts are
// not logged: they did not change persisted state.

export type AdminAuditAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "tag.create"
  | "tag.update"
  | "tag.delete"
  | "division.update"
  | "jurisdiction.update";

export type AdminAuditEvent = {
  actorId: string;
  action: AdminAuditAction;
  target: Record<string, unknown>;
};

export function logAdminAudit(event: AdminAuditEvent): void {
  console.info(
    JSON.stringify({
      type: "audit",
      timestamp: new Date().toISOString(),
      actorId: event.actorId,
      action: event.action,
      target: event.target,
    }),
  );
}
