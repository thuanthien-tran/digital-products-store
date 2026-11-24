"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

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
    <div className="w-full max-w-3xl mx-auto divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        const questionId = `faq-q-${idx}`
        const answerId = `faq-a-${idx}`

        return (
          <div key={idx} className="transition-colors duration-150">
            <h3>
              <button
                type="button"
                id={questionId}
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => toggleItem(idx)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-foreground hover:bg-secondary/60 transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="text-sm sm:text-[15px] font-semibold leading-snug">
                  {item.q}
                </span>

                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-primary" : ""
                  }`}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </h3>

            {isOpen && (
              <div
                id={answerId}
                role="region"
                aria-labelledby={questionId}
                className="px-5 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed animate-fade-in"
              >
                <p>{item.a}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
