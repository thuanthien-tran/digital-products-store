import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface PriceDisplayProps {
  priceCents: number
  compareAtPriceCents?: number | null
  prefix?: string
  size?: "md" | "lg"
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
    <div className={cn("flex items-baseline gap-2 flex-wrap", className)}>
      {prefix && (
        <span className="text-xs font-medium text-muted-foreground">{prefix}</span>
      )}
      <span
        className={cn(
          "font-bold tracking-tight tabular-nums text-foreground leading-none",
          size === "lg" ? "text-2xl sm:text-[26px]" : "text-[22px] sm:text-2xl"
        )}
      >
        {formatPrice(priceCents)}
      </span>
      {hasValidCompare && compareAtPriceCents ? (
        <span className="line-through text-xs sm:text-[13px] text-muted-foreground tabular-nums">
          {formatPrice(compareAtPriceCents)}
        </span>
      ) : null}
    </div>
  )
}
