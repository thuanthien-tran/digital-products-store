"use client"

import { useState } from "react"
import { ChevronDown, HelpCircle } from "lucide-react"

export interface FaqItem {
  q: string
  a: string
}

interface FaqAccordionProps {
  items: FaqItem[]
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  // Default first item is open (index 0)
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        const questionId = `faq-q-${idx}`
        const answerId = `faq-a-${idx}`

        return (
          <div
            key={idx}
            className={`rounded-2xl border transition-all duration-200 backdrop-blur-md overflow-hidden ${
              isOpen
                ? "border-teal-500/40 bg-card/90 shadow-md shadow-teal-950/20"
                : "border-border/75 bg-card/60 hover:border-teal-500/30 hover:bg-card/80"
            }`}
          >
            <h3>
              <button
                type="button"
                id={questionId}
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => toggleItem(idx)}
                className="w-full flex items-center justify-between gap-3.5 p-4 sm:p-5 text-left text-foreground transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-7 sm:size-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
                        : "border-border/70 bg-secondary/60 text-muted-foreground group-hover:text-teal-300 group-hover:border-teal-500/30"
                    }`}
                    aria-hidden="true"
                  >
                    <HelpCircle className="size-4" strokeWidth={2} />
                  </div>
                  <span
                    className={`text-sm sm:text-base font-semibold tracking-tight transition-colors ${
                      isOpen ? "text-teal-300" : "text-foreground group-hover:text-teal-200"
                    }`}
                  >
                    {item.q}
                  </span>
                </div>

                <div
                  className={`size-6 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-teal-400" : "text-muted-foreground group-hover:text-teal-300"
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown className="size-4" strokeWidth={2.5} />
                </div>
              </button>
            </h3>

            {isOpen && (
              <div
                id={answerId}
                role="region"
                aria-labelledby={questionId}
                className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-xs sm:text-sm text-muted-foreground/90 leading-relaxed border-t border-border/40 mt-1 pt-3 animate-fade-down"
              >
                <p className="pl-10 sm:pl-11">{item.a}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
