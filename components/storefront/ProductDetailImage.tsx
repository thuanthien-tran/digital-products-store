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
    <div className="relative h-40 sm:h-48 w-full overflow-hidden rounded-xl bg-background border border-border/70 flex items-center justify-center p-4 select-none">
      {imageUrl && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="max-h-full max-w-full object-contain rounded-lg"
          onError={() => setHasError(true)}
          loading="eager"
        />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className="size-14 rounded-2xl bg-secondary border border-border flex items-center justify-center text-primary">
            <BrandIcon name={name} className="size-7" />
          </div>
          <span className="text-xs font-medium text-muted-foreground mt-2.5 tracking-wide uppercase">
            {groupName || "Sản phẩm số"}
          </span>
        </div>
      )}
    </div>
  )
}
