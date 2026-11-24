import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "py-14 px-6 text-center rounded-2xl border border-border bg-card space-y-3",
        className
      )}
    >
      {icon && (
        <div className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground mx-auto">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
