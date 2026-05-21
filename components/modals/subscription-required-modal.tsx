"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PLANS, formatKES } from "@/lib/plans"
import { CreditCard, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface SubscriptionRequiredModalProps {
  isOpen: boolean
  workspaceId: string
  selectedPlanName?: string
}

type PaymentSummary = {
  headline?: string
  detail?: string
  amountLabel?: string
}

export function SubscriptionRequiredModal({
  isOpen,
  workspaceId,
  selectedPlanName,
}: SubscriptionRequiredModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<{
    authorizationUrl: string
    summary: PaymentSummary | null
  } | null>(null)

  const handleSelectPlan = async (planId: string) => {
    setIsLoading(planId)
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          workspaceId,
        }),
      })

      const data = await response.json()

      if (data.success && data.authorizationUrl) {
        setPendingPayment({
          authorizationUrl: data.authorizationUrl,
          summary: data.paymentSummary || null,
        })
        setIsConfirmOpen(true)
      } else if (data.success && !data.authorizationUrl) {
        // Free trial fallback (though normally they wouldn't see this modal for trial)
        window.location.reload()
      } else {
        toast.error(data.error || "Failed to initialize payment")
        setIsLoading(null)
      }
    } catch (error) {
      console.error("Payment error:", error)
      toast.error("Failed to process payment. Please try again.")
      setIsLoading(null)
    }
  }

  // Determine which plans to show
  let plansToShow = PLANS.filter((plan) => plan.monthlyPrice > 0)
  const userPlan = selectedPlanName
    ? PLANS.find((p) => p.name === selectedPlanName)
    : null

  if (userPlan && userPlan.monthlyPrice > 0) {
    plansToShow = [userPlan]
  }

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-4xl overflow-hidden border-border/50 bg-background/95 p-0 backdrop-blur-xl">
        <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/5 via-background to-secondary/5" />
        <AlertDialogHeader className="px-8 pt-8 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shadow-inner ring-1 ring-primary/20">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <AlertDialogTitle className="text-3xl font-bold tracking-tight">
            Active Subscription Required
          </AlertDialogTitle>
          <AlertDialogDescription className="mx-auto mt-2 max-w-lg text-base text-muted-foreground">
            Your workspace subscription has expired or is inactive. Please
            choose a plan below to unlock your dashboard and continue managing
            your inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/30 p-8 pt-2">
          <div
            className={`grid gap-6 ${plansToShow.length === 1 ? "mx-auto max-w-md" : "md:grid-cols-2"}`}
          >
            {plansToShow.map((plan) => {
              const isGold = plan.highlight

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg ${
                    isGold
                      ? "border-primary/50 bg-card/80 shadow-md ring-1 ring-primary/20 backdrop-blur-sm"
                      : "border-border bg-card/50"
                  }`}
                >
                  {isGold && (
                    <div className="absolute top-0 right-0 p-2">
                      <Badge
                        variant="default"
                        className="bg-primary font-bold text-primary-foreground shadow-sm"
                      >
                        {plan.badge || "Popular"}
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle
                      className={`text-xl ${isGold ? "text-primary" : "text-foreground"}`}
                    >
                      {plan.displayName}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4 flex items-baseline text-3xl font-bold">
                      {formatKES(plan.monthlyPrice)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-end">
                    <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                      {plan.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 shrink-0 text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="h-11 w-full text-base font-semibold"
                      variant={isGold ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isLoading !== null}
                    >
                      {isLoading === plan.id ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : null}
                      {isLoading === plan.id
                        ? "Processing..."
                        : `Complete ${plan.displayName} Payment`}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </AlertDialogContent>

      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          setIsConfirmOpen(open)
          if (!open) {
            setPendingPayment(null)
            setIsLoading(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Confirm Payment
            </DialogTitle>
            <DialogDescription>
              Review the payment details before we send you to Paystack.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">
                {pendingPayment?.summary?.headline || "Proceed to Paystack"}
              </p>
              <p className="mt-2 whitespace-pre-line">
                {pendingPayment?.summary?.detail ||
                  "You will be redirected to Paystack to complete the transaction."}
              </p>
              {pendingPayment?.summary?.amountLabel && (
                <p className="mt-3 text-base font-semibold text-foreground">
                  Amount due: {pendingPayment.summary.amountLabel}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmOpen(false)
                setPendingPayment(null)
                setIsLoading(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingPayment?.authorizationUrl) {
                  window.location.href = pendingPayment.authorizationUrl
                }
              }}
            >
              Continue to Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AlertDialog>
  )
}
