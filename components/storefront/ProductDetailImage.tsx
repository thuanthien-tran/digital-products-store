"use client"

import { useState } from "react"
import { BrandIcon } from "@/components/storefront/BrandIcons"

interface ProductDetailImageProps {
  imageUrl: string | null
  name: string
  groupName?: string
}

export function ProductDetailImage({
  imageUrl,
  name,
  groupName,
}: ProductDetailImageProps) {
  const [hasError, setHasError] = useState(false)

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted/20 border-b border-border/50 select-none">
      {imageUrl && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-102"
          onError={() => setHasError(true)}
          loading="eager"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background">
          <div className="size-14 rounded-2xl bg-secondary/80 border border-border/80 flex items-center justify-center text-primary shadow-inner">
            <BrandIcon name={name} className="size-7" />
          </div>
          <span className="text-xs font-medium text-muted-foreground/80 mt-2.5 tracking-wide uppercase">
            {groupName || "Sản phẩm số"}
          </span>
        </div>
      )}
    </div>
  )
}
