import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Barlow + Barlow Condensed (SIL OFL), self-hosted: no external font requests. */
const barlow = localFont({
  src: [
    { path: "./fonts/barlow-400-latin.woff2", weight: "400" },
    { path: "./fonts/barlow-500-latin.woff2", weight: "500" },
    { path: "./fonts/barlow-600-latin.woff2", weight: "600" },
    { path: "./fonts/barlow-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = localFont({
  src: [
    { path: "./fonts/barlow-condensed-700-latin.woff2", weight: "700" },
    { path: "./fonts/barlow-condensed-800-latin.woff2", weight: "800" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cleared", template: "%s · Cleared" },
  description: "Machine access passes and status for makerspaces.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:font-semibold focus:text-primary-foreground focus:ring-[3px] focus:ring-ring"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
