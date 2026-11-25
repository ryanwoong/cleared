"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleCheck, ClipboardCheck, RefreshCw, TriangleAlert, WifiOff, Wrench, type LucideIcon } from "lucide-react";
import { EndSessionButton } from "@/components/pass/session-controls";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { usePoll } from "@/components/use-poll";
import { formatTime, formatTimeOrDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConsoleData } from "@/server/domain/console";
import type { OutOfServiceReason } from "@/server/domain/enums";

const OOS_REASONS: Record<OutOfServiceReason, string> = {
  issue_reported: "issue reported",
  maintenance: "maintenance",
  other: "other",
};

const MISSING_STATE = { never: "not held", expired: "expired", revoked: "revoked" } as const;

/** After this long without a successful check, the header says it's not updating. */
const STALE_MS = 2 * 60_000;

/**
 * The console home's live part (FR-17, Phase 6 §6). Starts from the
 * server-rendered snapshot and polls `GET /api/console` every 30 s with its
 * ETag (an unchanged console costs a 304), only while the tab is visible.
 * Times are formatted in the browser (they re-render on polls), so time text
 * has `suppressHydrationWarning`.
 */
export function ConsoleLive({ initial, etag }: { initial: ConsoleData; etag: string }) {
  const { data, error, lastUpdated, refresh } = usePoll<ConsoleData>("/api/console", {
    initialData: initial,
    initialEtag: etag,
  });
  const c = data ?? initial;
  const tz = c.timezone;
  const now = useNow(15_000);
  const lastSuccess = lastUpdated?.getTime() ?? Date.parse(initial.generatedAt);
  const stale = now - lastSuccess > STALE_MS;
  const time = (iso: string) => formatTimeOrDay(Date.parse(iso), now, tz);

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm font-semibold text-muted-foreground" aria-live="off">
        Updated <time suppressHydrationWarning>{formatTime(lastSuccess, tz)}</time>
      </p>

      {error?.status === 503 ? (
        <Banner icon={TriangleAlert}>
          Cleared is over its free daily limit. The console is back after the daily reset (00:00 UTC).
        </Banner>
      ) : error && (error.status === 401 || error.status === 403) ? (
        <Banner icon={TriangleAlert}>
          Your access changed. <a href="/console" className="underline underline-offset-4">Reload the page</a>.
        </Banner>
      ) : stale ? (
        <Banner icon={WifiOff}>
          Not updating. Check your connection.{" "}
          <Button type="button" size="sm" variant="outline" onClick={refresh} className="ml-1">
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </Banner>
      ) : null}

      <ul aria-label="Summary" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <CountCard
          href="/console/faults"
          icon={TriangleAlert}
          label="Open faults"
          count={c.counts.openFaults}
          detail={c.counts.outOfServiceFaults > 0 ? `${c.counts.outOfServiceFaults} took a machine out` : null}
          sign="red"
        />
        <CountCard
          href="#out-of-service"
          icon={Wrench}
          label="Out of service"
          count={c.outOfServiceMachines.length}
          sign="yellow"
        />
        <CountCard
          href="/console/checkups?tab=soon"
          icon={CalendarClock}
          label="Checkups due soon"
          detail="Advisory"
          count={c.counts.checkupsDueSoon}
          sign="blue"
          signWhenClear="blue"
        />
        <CountCard
          href="/console/checkups?tab=overdue"
          icon={ClipboardCheck}
          label="Checkups overdue"
          detail="Advisory"
          count={c.counts.checkupsOverdue}
          sign="red"
        />
      </ul>

      {c.noLongerAuthorized.length > 0 ? (
        <section aria-labelledby="unauthorized-title" className="plate">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-sign-yellow px-4 py-3 text-ink sm:px-5">
            <h2 id="unauthorized-title" className="flex items-center gap-2.5 font-sign text-2xl">
              <TriangleAlert aria-hidden="true" className="size-6" strokeWidth={2.5} />
              No longer authorized
            </h2>
            <p className="text-sm font-semibold">
              These sessions are still running, but the member no longer holds every certification the machine requires.
            </p>
          </div>
          <ul aria-label="Sessions no longer authorized" className="divide-y divide-border">
            {c.noLongerAuthorized.map((s) => (
              <li
                key={s.sessionId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium break-words">
                    <Link href={`/console/members/${s.member.id}`} prefetch={false} className="font-semibold underline-offset-4 hover:underline">
                      {s.member.displayName}
                    </Link>{" "}
                    on {s.machine.name}
                  </p>
                  <p className="text-muted-foreground" suppressHydrationWarning>
                    {s.missing
                      .map((m) => `${m.name} ${MISSING_STATE[m.state]}${m.since ? ` ${time(m.since)}` : ""}`)
                      .join(" · ")}
                  </p>
                </div>
                <EndSessionButton sessionId={s.sessionId} machineName={s.machine.name} onEnded={refresh} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-4">
      <section aria-labelledby="sessions-title" className="plate lg:col-span-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[3px] border-ink px-4 py-3.5 sm:px-5">
          <h2 id="sessions-title" className="font-sign text-2xl">
            Active sessions
          </h2>
          <p className="text-sm font-medium text-muted-foreground">Self-reported by members</p>
          {c.activeSessions.length > 0 ? (
            <span data-numeric className="ml-auto rounded-[0.3125rem] bg-sign-blue px-2 text-sm leading-6 font-bold text-white">
              {c.activeSessions.length}
              <span className="sr-only"> running</span>
            </span>
          ) : null}
        </div>
        {c.activeSessions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-medium text-muted-foreground sm:px-5">No recorded sessions right now.</p>
        ) : (
          <ul aria-label="Active sessions" className="divide-y divide-border">
            {c.activeSessions.map((s) => (
              <li
                key={s.id}
                className="grid gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_auto]"
              >
                <Link
                  href={`/console/members/${s.member.id}`}
                  prefetch={false}
                  className="min-w-0 font-semibold break-words underline-offset-4 hover:underline"
                >
                  {s.member.displayName}
                </Link>
                <p className="min-w-0 text-sm break-words sm:col-start-1 md:col-start-auto">
                  <Link href={`/console/machines/${s.machine.id}`} prefetch={false} className="font-medium underline-offset-4 hover:underline">
                    {s.machine.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">({s.machine.roomName})</span>
                </p>
                <p className="text-sm text-muted-foreground sm:col-start-1 md:col-start-auto" suppressHydrationWarning>
                  since {time(s.startedAt)} · est. end {time(s.expectedEndAt)}
                  {s.supervisionAcknowledged ? " · supervision acknowledged" : ""}
                </p>
                <div className="pt-1 sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:pt-0 md:col-start-4 md:row-span-1">
                  <EndSessionButton sessionId={s.id} machineName={s.machine.name} onEnded={refresh} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {c.activeSessionsTruncated ? (
          <p className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground sm:px-5">
            Showing the {c.activeSessions.length} most recent sessions.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="out-of-service" className="plate scroll-mt-24">
        {c.outOfServiceMachines.length > 0 ? <div aria-hidden="true" className="hazard-stripe h-3" /> : null}
        <h2 id="out-of-service" className="border-b-[3px] border-ink px-4 py-3.5 font-sign text-2xl sm:px-5">
          Out of service
        </h2>
        {c.outOfServiceMachines.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm font-semibold sm:px-5">
            <CircleCheck aria-hidden="true" className="size-5 text-sign-green" strokeWidth={2.5} />
            Every machine is in service.
          </p>
        ) : (
          <ul aria-label="Machines out of service" className="divide-y divide-border">
            {c.outOfServiceMachines.map((m) => (
              <li key={m.id} className="space-y-1.5 px-4 py-3 text-sm sm:px-5">
                <StatusBadge status="out-of-service" />
                <p>
                  <Link href={`/console/machines/${m.id}`} prefetch={false} className="text-base font-semibold break-words underline-offset-4 hover:underline">
                    {m.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">({m.roomName})</span>
                </p>
                <p className="text-muted-foreground" suppressHydrationWarning>
                  Since {time(m.since)} · {OOS_REASONS[m.reason]}
                  {m.openFaultCount > 0 ? ` · ${m.openFaultCount} open fault${m.openFaultCount === 1 ? "" : "s"}` : ""}
                  {m.expectedBackAt ? ` · expected back ${time(m.expectedBackAt)} (estimate)` : ""}
                </p>
                {m.note ? <p className="break-words">&ldquo;{m.note}&rdquo;</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

type Sign = "red" | "yellow" | "blue" | "green";

const BANDS: Record<Sign, string> = {
  red: "bg-sign-red text-white",
  yellow: "bg-sign-yellow text-ink",
  blue: "bg-sign-blue text-white",
  green: "bg-sign-green text-white",
};

/**
 * A count as a safety sign: the band takes its warning colour while the count
 * is above zero and turns safe-condition green at zero (unless `signWhenClear`).
 */
function CountCard({
  href,
  icon: Icon,
  label,
  count,
  detail,
  sign,
  signWhenClear = "green",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count: number;
  detail?: string | null;
  sign: Sign;
  signWhenClear?: Sign;
}) {
  const tone = count > 0 ? sign : signWhenClear;
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        className="plate group flex h-full flex-col shadow-[0_1px_0_rgb(17_17_17/0.06)] transition-[transform,box-shadow] duration-200 ease-out outline-none hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgb(17_17_17/0.35)] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className={cn("flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold tracking-[0.04em] uppercase transition-colors", BANDS[tone])}>
          <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.5} />
          {label}
        </span>
        <span className="flex flex-1 flex-col justify-end gap-1 px-4 pt-3 pb-4">
          <span
            className="font-sign text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.85]"
            data-numeric
            data-testid={`count-${label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {count}
          </span>
          <span className="min-h-5 text-sm font-medium text-muted-foreground">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

function Banner({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div role="status" className="plate flex items-center gap-3 px-4 py-3 text-sm font-medium">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-sign-yellow text-ink">
        <Icon className="size-5" strokeWidth={2.5} />
      </span>
      <div>{children}</div>
    </div>
  );
}

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
