"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"

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
    <div className="w-full border-t border-border divide-y divide-border">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        const questionId = `faq-q-${idx}`
        const answerId = `faq-a-${idx}`

        return (
          <div key={idx}>
            <h3>
              <button
                type="button"
                id={questionId}
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => toggleItem(idx)}
                className="group w-full flex items-center justify-between gap-6 py-5 text-left text-foreground hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                <span className="text-[15px] sm:text-base font-semibold leading-snug">
                  {item.q}
                </span>

                <span
                  className={`inline-flex size-7 items-center justify-center rounded-lg shrink-0 transition-colors duration-200 ${
                    isOpen
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground group-hover:text-foreground group-hover:bg-secondary/70"
                  }`}
                  aria-hidden="true"
                >
                  {isOpen ? (
                    <Minus className="size-4" strokeWidth={2} />
                  ) : (
                    <Plus className="size-4" strokeWidth={2} />
                  )}
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
                <div className="pb-5 pr-10 text-sm text-muted-foreground leading-relaxed">
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
