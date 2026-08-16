import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type BadgeVariant = "default" | "accent" | "success" | "danger" | "muted" | "warning";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-text-muted",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  muted: "bg-transparent text-text-muted border border-border",
  warning: "bg-warning-bg text-warning",
};

export function Badge({ variant = "default", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
