import { Suspense } from "react";
import { Toaster } from "sonner";
import { HeaderAccount } from "@/components/layouts/header-account";
import { ConsoleDrawer, ConsoleNavBar } from "@/components/layouts/console-nav";
import { DemoBanner } from "@/components/layouts/demo-banner";
import { Logo } from "@/components/layouts/logo";
import { LegalFooter } from "@/components/legal/legal-footer";
import { getOverdueCheckupCount } from "@/data/checkups";
import { getOpenFaultCount } from "@/data/faults";
import { getMe } from "@/data/me";

async function isAdmin(): Promise<boolean> {
  const me = await getMe();
  return me.membership?.status === "active" && me.membership.role === "admin";
}

async function navProps() {
  const [admin, faultCount, checkupCount] = await Promise.all([isAdmin(), getOpenFaultCount(), getOverdueCheckupCount()]);
  return { isAdmin: admin, faultCount, checkupCount };
}

async function NavBarForRole() {
  return <ConsoleNavBar {...await navProps()} />;
}

async function DrawerForRole() {
  return <ConsoleDrawer {...await navProps()} />;
}

/**
 * Staff console: a black top bar with tabs on desktop, a drawer on phone.
 * Each page renders `<Gate area="staff">` (or "admin") itself, since this
 * layout doesn't re-render on client navigation.
 */
export default function ConsoleLayout({ children }: LayoutProps<"/console">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={null}>
        <DemoBanner />
      </Suspense>
      <header className="sticky top-0 z-30 flex h-[4.25rem] items-stretch gap-3 bg-ink px-2 text-white sm:px-4 xl:gap-6 xl:px-8 print:hidden">
        <div className="flex items-center xl:hidden">
          <Suspense fallback={<ConsoleDrawer />}>
            <DrawerForRole />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center">
          <Logo href="/console" suffix="Staff" />
        </div>
        <div className="hidden min-w-0 flex-1 xl:block">
          <Suspense fallback={<ConsoleNavBar />}>
            <NavBarForRole />
          </Suspense>
        </div>
        <div className="ml-auto flex shrink-0 items-center">
          <Suspense fallback={null}>
            <HeaderAccount side="console" />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6 xl:px-8 print:p-0">
        {children}
      </main>
      <LegalFooter className="mx-auto w-full max-w-[90rem] border-t border-border px-4 sm:px-6 xl:px-8 print:hidden" />
      <Toaster position="top-center" richColors={false} closeButton />
    </div>
  );
}
