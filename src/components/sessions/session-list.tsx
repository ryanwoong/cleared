import { EndSessionButton } from "@/components/pass/session-controls";
import { formatDateTime, formatTimeOrDay } from "@/lib/format";
import type { SessionEndReason } from "@/server/domain/enums";
import type { SessionListItem } from "@/server/services/sessions";

const END_REASONS: Record<SessionEndReason, string> = {
  user: "Ended",
  staff: "Ended by staff",
  expired: "Ended automatically (time up)",
  machine_down: "Ended: machine out of service",
  authorization_removed: "Ended: certification removed",
};

/**
 * Recent sessions (FR-18): My certifications and the console member page.
 * Server component; times in the makerspace's time zone. Staff get an
 * "End session" button on active ones.
 */
export function SessionList({
  sessions,
  now,
  timeZone,
  label,
  canStaffEnd = false,
}: {
  sessions?: SessionListItem[];
  now: number;
  timeZone: string;
  label: string;
  canStaffEnd?: boolean;
}) {
  const rows = sessions ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No sessions yet.</p>;
  return (
    <ul aria-label={label} className="divide-y rounded-lg border">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="font-medium break-words">{s.machineName}</p>
            <p className="text-muted-foreground">
              {formatDateTime(s.startedAt, timeZone)} ·{" "}
              {s.active
                ? `in progress, est. end ${formatTimeOrDay(s.expectedEndAt, now, timeZone)}`
                : `${s.endReason ? END_REASONS[s.endReason] : "Ended"} ${formatTimeOrDay(s.endedAt ?? s.expectedEndAt, s.startedAt, timeZone)}`}
            </p>
          </div>
          {canStaffEnd && s.active ? <EndSessionButton sessionId={s.id} machineName={s.machineName} /> : null}
        </li>
      ))}
    </ul>
  );
}
