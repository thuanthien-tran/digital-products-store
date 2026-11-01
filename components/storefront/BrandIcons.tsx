import React from "react"
import { Bot, Sparkles, Palette, Video, Briefcase, GraduationCap, Shield, Box } from "lucide-react"

export function BrandIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const n = name.toLowerCase()

  if (n.includes("chatgpt") || n.includes("gpt") || n.includes("grok")) {
    return <Bot className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("gemini") || n.includes("google") || n.includes("muse")) {
    return <Sparkles className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("canva") || n.includes("figma") || n.includes("meitu")) {
    return <Palette className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("capcut") || n.includes("video")) {
    return <Video className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("office") || n.includes("microsoft")) {
    return <Briefcase className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("duolingo") || n.includes("memrise") || n.includes("study")) {
    return <GraduationCap className={className} strokeWidth={1.75} aria-hidden="true" />
  }
  if (n.includes("vpn") || n.includes("nord")) {
    return <Shield className={className} strokeWidth={1.75} aria-hidden="true" />
  }

  return <Box className={className} strokeWidth={1.75} aria-hidden="true" />
}
