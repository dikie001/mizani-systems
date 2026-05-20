"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { ArrowLeft, LoaderCircle, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getPlanById } from "@/lib/plans"

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-foreground"
    >
      <path
        fill="currentColor"
        d="M24 9.5c3.54 0 6.71 1.22 9.23 3.6l6.9-6.9C35.99 2.66 30.52 0 24 0 14.62 0 6.53 5.38 2.62 13.22l8.04 6.26C12.55 13.59 17.77 9.5 24 9.5Z"
      />
      <path
        fill="currentColor"
        opacity="0.92"
        d="M46.5 24.5c0-1.55-.15-3.05-.42-4.5H24v9h12.93c-.6 3.16-2.45 5.84-5.11 7.64l7.9 6.13C43.98 38.1 46.5 31.93 46.5 24.5Z"
      />
      <path
        fill="currentColor"
        opacity="0.7"
        d="M10.66 28.98A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.33.84-4.82L2.3 12.92A24 24 0 0 0 0 24c0 3.86.92 7.51 2.54 10.74l8.12-5.76Z"
      />
      <path
        fill="currentColor"
        opacity="0.84"
        d="M24 48c6.48 0 11.94-2.12 15.92-5.77l-7.9-6.13c-2.2 1.48-5.01 2.35-8.02 2.35-6.16 0-11.35-4.15-13.2-9.76l-8.1 5.98C6.56 42.73 14.67 48 24 48Z"
      />
    </svg>
  )
}

function getAuthErrorMessage(error: string | null) {
  switch (error) {
    case "RateLimitExceeded":
      return null
    case "AccessDenied":
      return "Google sign-in was denied. Please try again and grant access."
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method."
    case "Configuration":
      return "Google sign-in is not configured correctly yet."
    default:
      return error
        ? "Google sign-in could not be completed. Please try again."
        : null
  }
}

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [googleAuthState, setGoogleAuthState] = useState<
    "idle" | "opening" | "signing-in"
  >("idle")
  const [logoLoading, setLogoLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null
    }

    const error = new URLSearchParams(window.location.search).get("error")
    if (window.opener || !error) {
      return null
    }

    return getAuthErrorMessage(error)
  })
  const popupCheckRef = useRef<number | null>(null)

  const planId = searchParams.get("plan")
  const selectedPlan = planId ? getPlanById(planId) : null

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const error = searchParams.get("error")
  const retryAfterParam = searchParams.get("retryAfter")

  useEffect(() => {
    if (error === "RateLimitExceeded" && retryAfterParam) {
      const seconds = parseInt(retryAfterParam, 10)
      if (!isNaN(seconds)) {
        setTimeLeft(seconds)
      }
    }
  }, [error, retryAfterParam])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTimeLeft = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error")
    if (!window.opener || !error) {
      return
    }

    window.opener.postMessage(
      {
        type: "google-auth:result",
        error,
      },
      window.location.origin
    )
    window.close()
  }, [])

  useEffect(() => {
    // Clear sessionStorage on visit and store selected plan if present in URL
    if (typeof window !== "undefined") {
      sessionStorage.clear()
      if (planId) {
        sessionStorage.setItem("selectedPlan", planId)
      }
    }
  }, [planId])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return
      }

      const payload = event.data
      if (!payload || payload.type !== "google-auth:result") {
        return
      }

      if (popupCheckRef.current) {
        window.clearInterval(popupCheckRef.current)
        popupCheckRef.current = null
      }

      if (payload.error) {
        setGoogleAuthState("idle")
        setErrorMessage(getAuthErrorMessage(payload.error))
        return
      }

      setGoogleAuthState("signing-in")

      const callbackUrl =
        typeof payload.callbackUrl === "string" &&
        payload.callbackUrl.length > 0
          ? payload.callbackUrl
          : "/dashboard"

      setErrorMessage(null)
      router.replace(callbackUrl)
      router.refresh()
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
      if (popupCheckRef.current) {
        window.clearInterval(popupCheckRef.current)
      }
    }
  }, [router])

  async function handleGoogleSignIn() {
    setGoogleAuthState("opening")
    setErrorMessage(null)

    const popupUrl = new URL("/auth/google", window.location.origin)
    // After auth, go to onboarding (with plan if present)
    const onboardingUrl = planId ? `/onboarding?plan=${planId}` : "/onboarding"
    popupUrl.searchParams.set("callbackUrl", onboardingUrl)
    if (planId) {
      popupUrl.searchParams.set("plan", planId)
    }

    const width = 520
    const height = 640
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2)

    const popup = window.open(
      popupUrl.toString(),
      "google-auth-popup",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`
    )

    if (!popup) {
      await signIn("google", {
        callbackUrl: onboardingUrl,
      })
      return
    }

    popup.focus()

    popupCheckRef.current = window.setInterval(() => {
      if (!popup.closed) {
        return
      }

      if (popupCheckRef.current) {
        window.clearInterval(popupCheckRef.current)
        popupCheckRef.current = null
      }

      setGoogleAuthState("idle")
    }, 500)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-6">
      <div className="w-full max-w-sm sm:max-w-md">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="mb-4 h-9 w-9 rounded-full"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <Card className="rounded-2xl border bg-card text-card-foreground shadow-sm">
          <CardHeader className="items-center gap-3 px-6 pt-6 text-center">
            <div className="relative mb-1 h-12 w-12 flex items-center justify-center rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {logoLoading && (
                <LoaderCircle className="absolute h-5 w-5 animate-spin text-primary" />
              )}
              <Image
                src="/mizani_logo.png"
                alt="Logo"
                width={48}
                height={48}
                className={`h-full w-full object-contain transition-opacity duration-200 ${
                  logoLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setLogoLoading(false)}
              />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">
                Continue to Mizani Systems
              </CardTitle>
              {selectedPlan && (
                <p className="text-sm text-muted-foreground">
                  Signing up for{" "}
                  <span className="font-semibold text-foreground">
                    {selectedPlan.displayName}
                  </span>
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="px-6 pt-0 pb-6">
            {selectedPlan && (
              <Alert className="mb-4 border-primary/30 bg-primary/5">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  You&apos;re signing up for the{" "}
                  <span className="font-semibold">
                    {selectedPlan.displayName}
                  </span>{" "}
                  plan —{" "}
                  {selectedPlan.monthlyPrice === 0
                    ? "Free"
                    : `KES ${selectedPlan.monthlyPrice.toLocaleString()}/mo`}
                </AlertDescription>
              </Alert>
            )}

            {timeLeft !== null && timeLeft > 0 && (
              <Alert className="mb-4 border-destructive/30 bg-destructive/5 text-destructive">
                <Info className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm font-medium">
                  You have reached the global request limit. Please try again in{" "}
                  <span className="font-mono font-bold">{formatTimeLeft(timeLeft)}</span>.
                  <br />
                  <a
                    href="https://errors.authjs.dev#autherror"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-xs text-muted-foreground hover:text-destructive transition-colors mt-1 inline-block"
                  >
                    Read more at AuthJS
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="h-11 w-full rounded-xl"
              onClick={handleGoogleSignIn}
              disabled={googleAuthState !== "idle" || (timeLeft !== null && timeLeft > 0)}
            >
              {googleAuthState !== "idle" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              {googleAuthState === "opening"
                ? "Opening Google..."
                : googleAuthState === "signing-in"
                  ? "Signing you in..."
                  : timeLeft !== null && timeLeft > 0
                    ? `Sign-In Blocked (${formatTimeLeft(timeLeft)})`
                    : "Continue with Google"}
            </Button>

            {errorMessage ? (
              <p className="mt-3 text-center text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-primary"></div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
