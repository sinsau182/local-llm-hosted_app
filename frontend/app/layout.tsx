import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Inference Platform",
  description: "Orchestration and admin dashboard for local multimodal inference",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
