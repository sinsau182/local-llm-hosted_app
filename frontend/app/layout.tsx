import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Inference Platform",
  description: "Orchestration and admin dashboard for local multimodal inference",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-ink/10 bg-white/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-display text-lg font-semibold tracking-wide">
                AI Inference Platform
              </Link>
              <nav className="flex items-center gap-4 text-sm text-ink/70">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/inference">Inference</Link>
                <Link href="/storage">Storage</Link>
                <Link href="/system">System</Link>
                <Link href="/login">Login</Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-ink/50">
            FastAPI gateway, Next.js console, PostgreSQL/Redis data plane, and local inference runtimes.
          </footer>
        </div>
      </body>
    </html>
  );
}
