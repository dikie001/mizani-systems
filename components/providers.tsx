"use client"

import { SessionProvider, signOut } from "next-auth/react"
import { ThemeProvider } from "./theme-provider"
import { TooltipProvider } from "./ui/tooltip"
import { useEffect } from "react"
import { toast } from "sonner"

let isRateLimitActive = false

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status === 429) {
        try {
          const clone = response.clone()
          const data = await clone.json()

          const isGlobalLimit =
            response.headers.get("X-RateLimit-Scope") === "global" ||
            response.headers.get("x-ratelimit-scope") === "global" ||
            (data.message && data.message.toLowerCase().includes("global request limit"))

          if (isGlobalLimit) {
            const retryAfter = response.headers.get("retry-after") || "900"
            if (!isRateLimitActive) {
              isRateLimitActive = true

              toast.error(
                "You have reached the global request limit. Please try again in 15 minutes...",
                {
                  duration: 5000,
                  onDismiss: () => {
                    isRateLimitActive = false
                  },
                  onAutoClose: () => {
                    isRateLimitActive = false
                  },
                }
              )

              // Hard redirect immediately to log out and show the timer
              window.location.href = `/auth?error=RateLimitExceeded&retryAfter=${retryAfter}`
            }
          }
        } catch (e) {
          // Ignore json parse error
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return (
    <SessionProvider>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
