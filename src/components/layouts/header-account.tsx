import Link from "next/link";
import { LayoutDashboard, Smartphone, UserRound } from "lucide-react";
import { getMe } from "@/data/me";
import { roleCan } from "@/lib/permissions";

/** Sits on the black top bar of both shells. */
const linkClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-[3px] focus-visible:ring-sign-yellow";

/**
 * Header links for the signed-in user: the Member app ⇄ Staff console switch
 * (staff and admins, PRD 8) and the account page. Reads the session, so
 * layouts render it inside <Suspense>.
 */
export async function HeaderAccount({ side }: { side: "member" | "console" }) {
  const me = await getMe();
  const membership = me.membership;
  if (!me.user) return null;
  const showSwitch = membership?.status === "active" && roleCan(membership.role, "viewConsole");
  // The console bar carries the tab nav from xl up, so its links go icon-only until 2xl.
  const text = side === "console" ? "sr-only sm:not-sr-only xl:sr-only 2xl:not-sr-only" : "sr-only sm:not-sr-only";
  return (
    <nav aria-label="Account" className="flex items-center gap-1">
      {showSwitch && side === "member" ? (
        <Link href="/console" prefetch={false} className={linkClass}>
          <LayoutDashboard aria-hidden="true" className="size-4" />
          <span className={text}>Staff console</span>
        </Link>
      ) : null}
      {showSwitch && side === "console" ? (
        <Link href="/machines" prefetch={false} className={linkClass}>
          <Smartphone aria-hidden="true" className="size-4" />
          <span className={text}>Member app</span>
        </Link>
      ) : null}
      <Link href="/me/account" prefetch={false} className={linkClass}>
        <UserRound aria-hidden="true" className="size-4" />
        <span className={text}>Account</span>
      </Link>
    </nav>
  );
}
