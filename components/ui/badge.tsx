import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-medium leading-tight whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-foreground",
        primary: "border-primary/35 bg-primary/15 text-primary",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        warning: "border-amber-500/35 bg-amber-500/10 text-amber-300",
        destructive: "border-rose-500/35 bg-rose-500/10 text-rose-300",
        muted: "border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
