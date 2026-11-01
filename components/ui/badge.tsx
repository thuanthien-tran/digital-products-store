import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variant === "default" && "border-primary/30 bg-primary/10 text-accent",
        variant === "secondary" && "border-border bg-secondary text-muted-foreground",
        variant === "destructive" && "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "outline" && "border-border text-foreground",
        variant === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        variant === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
