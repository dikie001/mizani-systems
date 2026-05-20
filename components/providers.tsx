"use client"

import "./fetch-shim"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "./theme-provider"
import { TooltipProvider } from "./ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
