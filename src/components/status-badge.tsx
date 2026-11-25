import {
  CalendarCheck,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock,
  Eye,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Every status is shown as colour + icon + word (PRD 8), never colour alone.
 * Colours come from the status tokens in globals.css.
 */
export const STATUSES = {
  cleared: {
    label: "Cleared",
    icon: ShieldCheck,
    className: "bg-status-cleared text-status-cleared-foreground",
  },
  supervision: {
    label: "Supervision required",
    icon: Eye,
    className: "bg-status-supervision text-status-supervision-foreground",
  },
  "not-cleared": {
    label: "Not cleared",
    icon: CircleX,
    className: "bg-status-not-cleared text-status-not-cleared-foreground",
  },
  "out-of-service": {
    label: "Out of service",
    icon: Wrench,
    className: "bg-status-out-of-service text-status-out-of-service-foreground",
  },
  "in-use": {
    label: "In use",
    icon: Clock,
    className: "bg-status-in-use text-status-in-use-foreground",
  },
  available: {
    label: "Available",
    icon: CircleCheck,
    className: "bg-status-cleared text-status-cleared-foreground",
  },
  /** Checkups (Phase 6). Advisory: staff-facing only. */
  overdue: {
    label: "Overdue",
    icon: CircleAlert,
    className: "bg-status-not-cleared text-status-not-cleared-foreground",
  },
  "due-soon": {
    label: "Due soon",
    icon: CalendarClock,
    className: "bg-status-supervision text-status-supervision-foreground",
  },
  "on-schedule": {
    label: "On schedule",
    icon: CalendarCheck,
    className: "bg-status-cleared text-status-cleared-foreground",
  },
  inactive: {
    label: "Inactive",
    icon: CircleSlash,
    className: "bg-muted text-muted-foreground",
  },
} as const satisfies Record<string, { label: string; icon: LucideIcon; className: string }>;

export type Status = keyof typeof STATUSES;

export function StatusBadge({
  status,
  label,
  size = "default",
  flip = size === "block",
  className,
}: {
  status: Status;
  /** Replaces the default word, e.g. "In use · est. free 3:10 pm". Must still name the status. */
  label?: string;
  /** `block`: the machine pass's full-width status block, readable from 1–2 m. */
  size?: "default" | "lg" | "block";
  /** Sign flip when the status changes (on by default for `block`). Instant under reduced motion. */
  flip?: boolean;
  className?: string;
}) {
  const { label: defaultLabel, icon: Icon, className: tone } = STATUSES[status];
  return (
    <span
      // A new key per status remounts the sign, so the flip plays on each change.
      key={flip ? status : undefined}
      data-status={status}
      className={cn(
        size === "block"
          ? "flex w-full items-center gap-3 rounded-[0.875rem] border-[3px] border-ink px-4 py-6 font-sign text-[clamp(1.75rem,9vw,3.25rem)] sm:gap-4 sm:px-6"
          : "inline-flex items-center gap-1.5 rounded-[0.3125rem] font-bold tracking-[0.04em] whitespace-nowrap uppercase",
        size === "lg" ? "px-3.5 py-1.5 text-base" : size === "default" ? "px-2 py-0.5 text-xs" : null,
        flip && "origin-top animate-sign-flip",
        tone,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={size === "block" ? 2.5 : 2.25}
        className={size === "block" ? "size-10 shrink-0 sm:size-14" : size === "lg" ? "size-5" : "size-3.5"}
      />
      {size === "block" ? <span className="min-w-0 [overflow-wrap:anywhere]">{label ?? defaultLabel}</span> : (label ?? defaultLabel)}
    </span>
  );
}
