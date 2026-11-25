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
    <div className="relative aspect-[16/9] max-h-[300px] w-full overflow-hidden rounded-xl bg-background border border-border/70 select-none">
      {imageUrl && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="eager"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
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
