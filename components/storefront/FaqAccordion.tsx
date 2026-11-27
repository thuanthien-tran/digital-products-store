"use client"

import { useState } from "react"

export interface FaqItem {
  q: string
  a: string
}

interface FaqAccordionProps {
  items: FaqItem[]
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="w-full space-y-1">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        const questionId = `faq-q-${idx}`
        const answerId = `faq-a-${idx}`

        return (
          <div
            key={idx}
            className={`relative rounded-xl transition-[background-color,border-color] duration-200 ${
              isOpen
                ? "bg-gradient-to-r from-primary/[0.07] via-card/70 to-transparent"
                : "hover:bg-card/45"
            }`}
          >
            {/* Animated Caramel Left Accent Bar */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-primary transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] origin-top ${
                isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
              }`}
            />

            {/* Subtle bottom hairline separator for closed rows */}
            {!isOpen && idx < items.length - 1 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-border/60"
              />
            )}

            <h3>
              <button
                type="button"
                id={questionId}
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => toggleItem(idx)}
                className="group w-full flex items-center justify-between gap-3 sm:gap-5 px-3 sm:px-5 py-3 sm:py-4 text-left text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <span
                  className={`text-[13.5px] sm:text-base font-semibold leading-snug transition-[color,transform] duration-150 ${
                    isOpen
                      ? "text-primary"
                      : "text-foreground group-hover:text-primary group-hover:translate-x-0.5"
                  }`}
                >
                  {item.q}
                </span>

                {/* Smooth Morphing + / − Circular Glass Control */}
                <span
                  aria-hidden="true"
                  className={`relative inline-flex size-7 sm:size-8 items-center justify-center rounded-full border shrink-0 transition-[background-color,border-color,transform,box-shadow] duration-200 ${
                    isOpen
                      ? "bg-primary/15 border-primary/45 shadow-[0_0_14px_-4px_rgba(230,166,111,0.55)]"
                      : "bg-card/80 border-border/80 group-hover:border-primary/45 group-hover:bg-secondary/80 group-hover:scale-105"
                  }`}
                >
                  {/* Horizontal bar */}
                  <span
                    className={`absolute h-[1.5px] w-2.5 sm:w-3 rounded-full transition-colors duration-200 ${
                      isOpen ? "bg-primary" : "bg-muted-foreground group-hover:text-foreground group-hover:bg-foreground"
                    }`}
                  />
                  {/* Vertical bar (rotates 90deg & fades into horizontal bar when open) */}
                  <span
                    className={`absolute h-2.5 sm:h-3 w-[1.5px] rounded-full transition-[transform,opacity,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isOpen
                        ? "rotate-90 opacity-0 bg-primary"
                        : "rotate-0 opacity-100 bg-muted-foreground group-hover:bg-foreground"
                    }`}
                  />
                </span>
              </button>
            </h3>

            <div
              id={answerId}
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!isOpen}
              className="accordion-grid"
              data-open={isOpen ? "true" : "false"}
            >
              <div className="accordion-grid-inner">
                <div className="px-3 sm:px-5 pb-3 sm:pb-4 pt-0 pr-8 sm:pr-12 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
