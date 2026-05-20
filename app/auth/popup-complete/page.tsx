"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PopupCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackUrl = params.get("callbackUrl") || "/dashboard"
    const error = params.get("error")

    if (window.opener) {
      try {
        window.opener.postMessage(
          {
            type: "google-auth:result",
            callbackUrl,
            error,
          },
          window.location.origin
        )
        window.close()
        return
      } catch {
        // If cross-origin protections block opener access, fall back to redirect.
      }
    }

    router.replace(callbackUrl)
    router.refresh()
  }, [router])

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Sign-in complete. You can close this window.
      </p>
    </main>
  )
}
