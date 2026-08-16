import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "FindIt",
  description: "Rangez et retrouvez vos documents automatiquement, en langage naturel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <Link href="/" className="text-base font-semibold tracking-tight text-text">
                  FindIt
                </Link>
                <nav>
                  <Link
                    href="/settings"
                    className="text-sm text-text-muted transition-colors hover:text-text"
                  >
                    Réglages
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
