"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, CircleHelp, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/machines", label: "Machines", icon: Wrench },
  { href: "/me/certifications", label: "My certs", icon: Award },
  { href: "/help", label: "Help", icon: CircleHelp },
];

/**
 * Bottom tab bar of the member app. Links don't prefetch (each prefetch is a Worker request).
 * The current-tab highlight reads the URL, so it streams in inside <Suspense>
 * (required on dynamic routes such as /m/[token]).
 */
export function MemberTabBar() {
  return (
    <Suspense fallback={<TabBar pathname={null} />}>
      <TabBarWithPathname />
    </Suspense>
  );
}

function TabBarWithPathname() {
  return <TabBar pathname={usePathname()} />;
}

function TabBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-ink pb-[env(safe-area-inset-bottom)] text-white print:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-3">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 border-t-4 text-xs font-semibold tracking-[0.04em] uppercase outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sign-yellow focus-visible:ring-inset",
                  active ? "border-sign-yellow text-sign-yellow" : "border-transparent text-white/75 hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
