"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const DESTINATIONS = [
  { href: "/", label: "Documents" },
  { href: "/settings", label: "Réglages" },
] as const;

export function NavPills() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-border bg-surface p-[3px]">
      {DESTINATIONS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex h-7 items-center rounded-[7px] px-3 text-[13px] font-medium transition-colors",
              active ? "bg-text text-bg" : "text-text-muted hover:text-text"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
