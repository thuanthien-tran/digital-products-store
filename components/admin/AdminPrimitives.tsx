import * as React from "react"
import { cn } from "@/lib/utils"

interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export function AdminPageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border",
        className
      )}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-heading text-2xl sm:text-[26px] font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  )
}

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger"

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-muted-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/35",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/35",
  danger: "bg-rose-500/10 text-rose-300 border-rose-500/35",
}

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: StatusTone
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  helper?: React.ReactNode
  icon?: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger"
  className?: string
}

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  const valueTone =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
      ? "text-amber-300"
      : tone === "danger"
      ? "text-rose-400"
      : "text-foreground"

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 space-y-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon && (
          <div className="size-8 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className={cn("text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums leading-none", valueTone)}>
        {value}
      </div>
      {helper && (
        <div className="text-xs text-muted-foreground leading-snug">{helper}</div>
      )}
    </div>
  )
}
