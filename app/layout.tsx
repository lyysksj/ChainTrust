import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "ChainTrust — on-chain company registry",
  description:
    "An on-chain company identity and reputation layer for Web3 teams. Claim gives voice, not control.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-5xl px-6 pb-24 pt-8">{children}</main>
          <footer className="border-t border-ink-200 py-8 text-center text-xs uppercase tracking-wider text-ink-500">
            ChainTrust · Public on-chain company registry · Demo build
          </footer>
        </Providers>
      </body>
    </html>
  );
}
