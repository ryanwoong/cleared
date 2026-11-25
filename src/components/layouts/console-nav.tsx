"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  ClipboardCheck,
  DoorOpen,
  House,
  Menu,
  QrCode,
  Settings,
  Smartphone,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ITEMS: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: "/console", label: "Home", icon: House },
  { href: "/console/faults", label: "Faults", icon: TriangleAlert },
  { href: "/console/checkups", label: "Checkups", icon: ClipboardCheck },
  { href: "/console/machines", label: "Machines", icon: Wrench },
  { href: "/console/members", label: "Members", icon: Users },
  { href: "/console/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/console/labels", label: "Labels", icon: QrCode },
  { href: "/console/certifications", label: "Certifications", icon: Award, adminOnly: true },
  { href: "/console/settings", label: "Settings", icon: Settings, adminOnly: true },
];

type NavProps = {
  /** Admin-only sections are listed for admins only (hiding is not security; services check). */
  isAdmin?: boolean;
  /** Open faults, shown next to "Faults" (as of the last full page load). */
  faultCount?: number | null;
  /** Overdue checkups, shown next to "Checkups" (as of the last full page load). */
  checkupCount?: number | null;
  onNavigate?: () => void;
  /** `bar`: the black top bar on desktop; `drawer`: the phone sheet. */
  variant?: "bar" | "drawer";
};

/** The current-item highlight reads the URL, so it streams in inside <Suspense> (dynamic routes). */
function NavList(props: NavProps) {
  return (
    <Suspense fallback={<NavItems pathname={null} {...props} />}>
      <NavListWithPathname {...props} />
    </Suspense>
  );
}

function NavListWithPathname(props: NavProps) {
  return <NavItems pathname={usePathname()} {...props} />;
}

function NavItems({
  pathname,
  isAdmin = false,
  faultCount,
  checkupCount,
  onNavigate,
  variant = "bar",
}: NavProps & { pathname: string | null }) {
  const bar = variant === "bar";
  return (
    <nav aria-label="Staff console" className={bar ? "h-full min-w-0" : "flex flex-col gap-1 p-3"}>
      <ul className={bar ? "flex h-full items-stretch overflow-x-auto [scrollbar-width:none]" : "flex flex-col gap-1"}>
        {ITEMS.filter((item) => isAdmin || !item.adminOnly).map(({ href, label, icon: Icon }) => {
          const active =
            pathname !== null &&
            (href === "/console" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
          const count =
            href === "/console/faults" && faultCount
              ? { n: faultCount, word: "open" }
              : href === "/console/checkups" && checkupCount
                ? { n: checkupCount, word: "overdue" }
                : null;
          return (
            <li key={href} className={bar ? "flex" : undefined}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-sign-yellow focus-visible:ring-inset",
                  bar
                    ? cn(
                        "gap-1.5 border-y-4 border-transparent px-2.5 text-[0.9375rem] transition-colors",
                        active ? "border-b-sign-yellow text-white" : "text-white/70 hover:text-white",
                      )
                    : cn(
                        "gap-3 rounded-md px-3 py-2.5 text-base",
                        active ? "bg-sign-yellow text-ink" : "text-white/85 hover:bg-white/10 hover:text-white",
                      ),
                )}
              >
                {bar ? null : <Icon aria-hidden="true" className="size-5" />}
                {label}
                {count ? (
                  <span
                    data-numeric
                    className={cn(
                      "min-w-5 rounded-[0.3125rem] px-1.5 text-center text-xs leading-5 font-bold",
                      bar || !active ? "bg-sign-yellow text-ink" : "bg-ink text-white",
                      bar ? null : "ml-auto",
                    )}
                  >
                    {count.n}
                    <span className="sr-only"> {count.word}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {bar ? null : (
        <Link
          href="/machines"
          prefetch={false}
          onClick={onNavigate}
          className="mt-4 flex items-center gap-3 rounded-md border-2 border-white/25 px-3 py-2.5 text-base font-semibold text-white outline-none hover:border-white focus-visible:ring-[3px] focus-visible:ring-sign-yellow"
        >
          <Smartphone aria-hidden="true" className="size-5" />
          Member app
        </Link>
      )}
    </nav>
  );
}

type Counts = { isAdmin?: boolean; faultCount?: number | null; checkupCount?: number | null };

/** Tab navigation in the black top bar (desktop). */
export function ConsoleNavBar(props: Counts) {
  return <NavList {...props} variant="bar" />;
}

/** Drawer navigation (phone). */
export function ConsoleDrawer(props: Counts) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="text-white hover:bg-white/10 hover:text-white focus-visible:ring-sign-yellow focus-visible:ring-offset-ink"
        >
          <Menu aria-hidden="true" className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-r-0 bg-ink p-0 text-white" aria-describedby={undefined}>
        <SheetTitle className="px-6 pt-6 font-sign text-2xl text-white">Staff console</SheetTitle>
        <NavList {...props} variant="drawer" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
