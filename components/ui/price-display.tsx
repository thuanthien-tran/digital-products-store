import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  priceCents: number
  compareAtPriceCents?: number | null
  prefix?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PriceDisplay({
  priceCents,
  compareAtPriceCents,
  prefix,
  size = "md",
  className,
}: PriceDisplayProps) {
  const hasValidCompare = Boolean(
    compareAtPriceCents && compareAtPriceCents > priceCents
  )

  return (
    <div
      className={cn(
        "flex items-baseline min-w-0",
        size === "sm" ? "gap-1 sm:gap-1.5 flex-nowrap" : "gap-2 flex-wrap",
        className
      )}
    >
      {prefix && (
        <span
          className={cn(
            "font-medium text-muted-foreground shrink-0",
            size === "sm" ? "text-[10px] sm:text-xs" : "text-xs"
          )}
        >
          {prefix}
        </span>
      )}
      <span
        className={cn(
          "font-bold tracking-tight tabular-nums text-foreground leading-none whitespace-nowrap shrink-0",
          size === "lg"
            ? "text-2xl sm:text-[26px]"
            : size === "sm"
            ? "text-[15px] sm:text-xl"
            : "text-[22px] sm:text-2xl"
        )}
      >
        {formatPrice(priceCents)}
      </span>
      {hasValidCompare && compareAtPriceCents ? (
        <span
          className={cn(
            "line-through text-muted-foreground tabular-nums whitespace-nowrap truncate",
            size === "sm" ? "text-[10px] sm:text-xs" : "text-xs sm:text-[13px]"
          )}
        >
          {formatPrice(compareAtPriceCents)}
        </span>
      ) : null}
    </div>
  )
}
