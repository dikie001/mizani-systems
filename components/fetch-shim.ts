// This module patches `window.fetch` early on the client so that
// requests to /api/auth/session that accidentally return HTML (dev hiccups)
// are normalized to a JSON null response, preventing Auth.js parse errors.
if (typeof window !== "undefined" && !(window as any).__fetchShimApplied) {
  ;(window as any).__fetchShimApplied = true
  const originalFetch: typeof fetch = window.fetch.bind(window)

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    try {
      // Resolve request URL
      let requestUrl = ""
      if (typeof input === "string") requestUrl = input
      else if (input instanceof Request) requestUrl = input.url
      else requestUrl = String(input)

      const res = await originalFetch(input, init)

      const contentType = res.headers.get("content-type") || ""
      let pathname = ""
      try {
        pathname = new URL(requestUrl, window.location.origin).pathname
      } catch {
        pathname = ""
      }

      // Defensive: if /api/auth/session returns HTML (e.g. a redirect page),
      // return `null` JSON so Auth.js doesn't throw "Unexpected token '<'".
      if (pathname === "/api/auth/session" && contentType.includes("text/html")) {
        console.warn(
          "fetch-shim: /api/auth/session returned HTML; returning JSON null fallback"
        )
        return new Response("null", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Lightweight handling for 429 responses: if it's a global rate-limit,
      // redirect to the auth error page to keep behavior consistent.
      if (res.status === 429) {
        try {
          const clone = res.clone()
          const data: { message?: string } | null = await clone
            .json()
            .catch(() => null)
          const isGlobal =
            (
              res.headers.get("X-RateLimit-Scope") ||
              res.headers.get("x-ratelimit-scope")
            ) === "global" ||
            (data?.message &&
              data.message.toLowerCase().includes("global request limit"))

          if (isGlobal) {
            const retryAfter = res.headers.get("retry-after") || "900"
            window.location.href = `/auth?error=RateLimitExceeded&retryAfter=${retryAfter}`
            return res
          }
        } catch {
          // ignore
        }
      }

      return res
    } catch {
      // If the shim itself errors, fall back to original fetch
      return originalFetch(input, init)
    }
  }
}
