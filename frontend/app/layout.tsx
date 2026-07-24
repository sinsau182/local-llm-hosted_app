import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { appConfig } from "../config/app-config";

export const metadata: Metadata = {
  title: "BreachLabz LLM Agent",
  description: "Chat-first interface for LiteLLM routing and direct local model access",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-ink/10 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-display text-lg font-semibold tracking-wide">
                BreachLabz Agent
              </Link>
              <nav className="flex items-center gap-4 text-sm text-ink/70">
                <Link href="/">Chat</Link>
                <Link href="/storage">Media</Link>
                {appConfig.features.audioPage && (
                  <Link href="/audio">Audio</Link>
                )}
                {appConfig.features.dashboardTab && (
                  <Link href="/dashboard">Dashboard</Link>
                )}
                <Link href="/login">Login</Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="mx-auto max-w-7xl px-4 pb-6 text-xs text-ink/45">
            LiteLLM router, FastAPI gateway, and direct local model runners.
          </footer>
        </div>
      </body>
    </html>
  );
}
