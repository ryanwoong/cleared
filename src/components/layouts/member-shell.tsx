import type { ReactNode } from "react";
import { LegalFooter } from "@/components/legal/legal-footer";
import { Logo } from "@/components/layouts/logo";
import { MemberTabBar } from "@/components/layouts/member-tab-bar";

/**
 * Member app frame: mobile-first (works at 320 px), header, footer (Help,
 * Terms, Privacy) and bottom tab bar. `banner` sits above the header (the
 * demo-data notice; the signed-in layout passes it inside <Suspense>).
 */
export function MemberShell({
  children,
  headerEnd,
  banner,
}: {
  children: ReactNode;
  headerEnd?: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {banner}
      <header className="sticky top-0 z-30 bg-ink text-white print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-2 px-4">
          <Logo href="/machines" />
          {headerEnd}
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-7 pb-12">
        {children}
      </main>
      {/* Bottom padding keeps the links clear of the fixed tab bar. */}
      <LegalFooter className="mx-auto w-full max-w-2xl border-t px-4 pt-1 pb-[calc(5rem+env(safe-area-inset-bottom))]" />
      <MemberTabBar />
    </div>
  );
}
