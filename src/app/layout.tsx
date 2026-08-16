import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { NavPills } from "@/components/NavPills";

export const metadata: Metadata = {
  title: "FindIt",
  description: "Rangez et retrouvez vos documents automatiquement, en langage naturel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <div className="relative min-h-screen">
            <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-8 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-accent" />
                  <span className="text-[15px] font-semibold tracking-tight text-text">FindIt</span>
                </div>
                <NavPills />
              </div>
            </header>
            <main className="mx-auto w-full max-w-5xl px-8 pb-24">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
