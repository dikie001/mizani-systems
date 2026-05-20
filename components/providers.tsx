"use client"

import { SessionProvider, signOut } from "next-auth/react"
import { ThemeProvider } from "./theme-provider"
import { TooltipProvider } from "./ui/tooltip"
import { useEffect } from "react"
import { toast } from "sonner"

let isRateLimitActive = false
let hasLoggedAuthSessionHtmlWarning = false

function getRequestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  if (input instanceof Request) {
    return input.url
  }

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const requestUrl = getRequestUrl(args[0])
      const response = await originalFetch(...args)

      if (requestUrl) {
        const url = new URL(requestUrl, window.location.origin)
        const isSessionEndpoint = url.pathname === "/api/auth/session"
        const contentType = response.headers.get("content-type") || ""

        if (isSessionEndpoint && contentType.includes("text/html")) {
          if (!hasLoggedAuthSessionHtmlWarning) {
            hasLoggedAuthSessionHtmlWarning = true
            console.warn(
              "Expected JSON from /api/auth/session but received HTML. Returning null session fallback to prevent client parse errors."
            )
          }

          return new Response("null", {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        }
      }

      if (response.status === 429) {
        try {
          const clone = response.clone()
          const data = await clone.json()

          const isGlobalLimit =
            response.headers.get("X-RateLimit-Scope") === "global" ||
            response.headers.get("x-ratelimit-scope") === "global" ||
            (data.message &&
              data.message.toLowerCase().includes("global request limit"))

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
                    window.location.href = `/auth?error=RateLimitExceeded&retryAfter=${retryAfter}`
                  },
                  onAutoClose: () => {
                    isRateLimitActive = false
                    window.location.href = `/auth?error=RateLimitExceeded&retryAfter=${retryAfter}`
                  },
                }
              )
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
