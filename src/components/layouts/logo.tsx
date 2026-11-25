import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** The Cleared mark: a safe-condition sign plate and the condensed wordmark. */
export function Logo({ href, className, suffix }: { href?: string; className?: string; suffix?: string }) {
  const mark = (
    <>
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-sign-green text-white">
        <ShieldCheck className="size-5" strokeWidth={2.5} />
      </span>
      <span className="font-sign text-[1.625rem] leading-none">Cleared</span>
      {suffix ? (
        <span className="rounded-sm bg-sign-yellow px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.08em] text-ink uppercase">
          {suffix}
        </span>
      ) : null}
    </>
  );
  const cls = cn("inline-flex items-center gap-2.5", className);
  return href ? (
    <Link href={href} prefetch={false} className={cn(cls, "rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-sign-yellow")}>
      {mark}
    </Link>
  ) : (
    <span className={cls}>{mark}</span>
  );
}
