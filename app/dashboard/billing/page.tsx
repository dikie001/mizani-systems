"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Download,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatKES, PLANS } from "@/lib/plans"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cancelSubscription } from "@/lib/actions/subscription"
import { mutate } from "swr"

type PaymentSummary = {
  action?: "checkout" | "upgrade" | "downgrade" | "no_change"
  amount?: number
  amountLabel?: string
  headline?: string
  detail?: string
}

interface Subscription {
  id: string
  plan: {
    id: string
    displayName: string
    name: string
    monthlyPrice: number
  }
  status: string
  paymentStatus: string
  currentBillingCycleStart: string | null
  currentBillingCycleEnd: string | null
  nextBillingDate: string | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  amount: number
  status: string
  billingPeriodStart: string
  billingPeriodEnd: string
  paidAt: string | null
}

interface Payment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

export default function BillingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false)
  const [upgradeLoadingPlanId, setUpgradeLoadingPlanId] = useState<
    "basic" | "pro" | null
  >(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRedirectingToPaystack, setIsRedirectingToPaystack] = useState(false)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState<{
    authorizationUrl: string
    summary: PaymentSummary | null
  } | null>(null)

  const fetchBillingData = async () => {
    if (!(session?.user as any)?.workspaceId) return
    try {
      const [subRes, invoicesRes, paymentsRes] = await Promise.all([
        fetch("/api/subscriptions/current"),
        fetch("/api/invoices/list"),
        fetch("/api/payments/list"),
      ])

      if (subRes.ok) {
        const subData = await subRes.json()
        setSubscription(subData)
      } else {
        setSubscription(null)
      }

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json()
        setInvoices(invoicesData)
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        setPayments(paymentsData)
      }
    } catch (error) {
      console.error("Failed to fetch billing data:", error)
      toast.error("Failed to load billing information")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const workspaceId = (session?.user as any)?.workspaceId
    if (!workspaceId) {
      if (session) {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    fetchBillingData()
  }, [session, (session?.user as any)?.workspaceId])

  useEffect(() => {
    if (isUpgradeOpen) {
      const currentPlanName = subscription?.plan?.name || ""
      const isTrial = currentPlanName === "trial" || currentPlanName === "free"
      const isInactive =
        !subscription ||
        subscription.status === "cancelled" ||
        subscription.status === "expired"

      const plans = PLANS.filter(
        (p) => p.id === "basic" || p.id === "pro"
      ).filter((plan) => {
        if (isInactive || isTrial) {
          return true
        }
        return plan.id !== currentPlanName
      })

      if (plans.length > 0) {
        setExpandedPlanId(plans[0].id)
      }
    }
  }, [isUpgradeOpen, subscription])

  const handleUpgrade = async (planId: "basic" | "pro") => {
    setUpgradeLoadingPlanId(planId)

    try {
      const workspaceId = (session?.user as any)?.workspaceId
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, workspaceId }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Failed to initialize payment")
        return
      }

      // If API returned an authorization URL, confirm with user and redirect to Paystack
      if (data.authorizationUrl) {
        setPendingPayment({
          authorizationUrl: data.authorizationUrl,
          summary: data.paymentSummary || null,
        })
        setIsPaymentConfirmOpen(true)
        return
      }

      // Otherwise, the API applied the plan immediately or resolved the plan change without checkout.
      if (data.success) {
        const summary = data.paymentSummary
        toast.success(
          summary?.detail ||
            `Successfully updated to ${planId === "pro" ? "Professional" : "Basic"} plan!`
        )
        setIsUpgradeOpen(false)
        await fetchBillingData()
        mutate("/api/subscriptions/current")
        return
      }

      toast.error(data.error || "Failed to change plan")
    } catch (err) {
      console.error(err)
      toast.error("An unexpected error occurred")
    } finally {
      setUpgradeLoadingPlanId(null)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await cancelSubscription()
      if (res.success) {
        toast.success("Subscription cancelled successfully.")
        setIsCancelOpen(false)
        await fetchBillingData()
        mutate("/api/subscriptions/current")
      } else {
        toast.error(res.error || "Failed to cancel subscription")
      }
    } catch (err) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsCancelling(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "trial":
        return "bg-green-500/10 text-green-600"
      case "paid":
      case "success":
        return "bg-green-500/10 text-green-600"
      case "pending":
        return "bg-yellow-500/10 text-yellow-600"
      case "cancelled":
      case "failed":
        return "bg-red-500/10 text-red-600"
      default:
        return "bg-gray-500/10 text-gray-600"
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">
              Loading billing data
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we load your subscription and payment details.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment methods
        </p>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Plan
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {subscription.plan.displayName}
                  </span>
                  <Badge className={getStatusColor(subscription.status)}>
                    {subscription.status.charAt(0).toUpperCase() +
                      subscription.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Billing Amount
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {formatKES(subscription.plan.monthlyPrice)}/month
                </div>
              </div>

              {subscription.currentBillingCycleStart && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Current Cycle
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatDate(subscription.currentBillingCycleStart)} →{" "}
                      {formatDate(subscription.currentBillingCycleEnd)}
                    </span>
                  </div>
                </div>
              )}

              {subscription.nextBillingDate && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Next Billing
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(subscription.nextBillingDate)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUpgradeOpen(true)}
              >
                Upgrade / Change Plan
              </Button>
              {(subscription.status === "active" ||
                subscription.status === "trial") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setIsCancelOpen(true)}
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-600">
                No Active Subscription
              </p>
              <p className="mt-1 text-sm text-yellow-600/80">
                Choose a plan to get started with all the features
              </p>
            </div>
            <Button
              className="ml-auto"
              size="sm"
              onClick={() => setIsUpgradeOpen(true)}
            >
              Select Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Status */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {subscription.paymentStatus === "paid" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(subscription.paymentStatus)}>
              {subscription.paymentStatus === "paid"
                ? "All Payments Up to Date"
                : "Payment Pending"}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatKES(invoice.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.billingPeriodStart)} →{" "}
                        {formatDate(invoice.billingPeriodEnd)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(invoice.paidAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatKES(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status.charAt(0).toUpperCase() +
                            payment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade / Change Plan Dialog */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Select a Subscription Plan
            </DialogTitle>
            <DialogDescription>
              {subscription?.plan?.displayName ? (
                <>
                  You are currently on the{" "}
                  <span className="font-semibold text-foreground">
                    {subscription.plan.displayName}
                  </span>{" "}
                  plan. Switch to:
                </>
              ) : (
                "Choose the plan that fits your business needs."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {(() => {
              const currentPlanName = subscription?.plan?.name || ""
              const isTrial =
                currentPlanName === "trial" || currentPlanName === "free"
              const isInactive =
                !subscription ||
                subscription.status === "cancelled" ||
                subscription.status === "expired"

              const plansToShow = PLANS.filter(
                (p) => p.id === "basic" || p.id === "pro"
              ).filter((plan) => {
                if (isInactive || isTrial) {
                  return true
                }
                return plan.id !== currentPlanName
              })

              const isCollapsible = plansToShow.length > 1

              return plansToShow.map((plan) => {
                const isCurrent = subscription?.plan?.id === plan.id
                return (
                  <Card
                    key={plan.id}
                    className={`flex flex-col border-border/80 transition-all ${plan.highlight ? "bg-primary/5 ring-2 ring-primary" : ""} ${isCurrent ? "opacity-90" : ""}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold">
                            {plan.displayName}
                          </CardTitle>
                          {plan.badge && (
                            <Badge
                              variant="default"
                              className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                            >
                              {plan.badge}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-baseline">
                          <span className="text-xl font-bold text-foreground">
                            {formatKES(plan.monthlyPrice)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            /mo
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {plan.description}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                      {isCollapsible ? (
                        <>
                          <button
                            type="button"
                            className="mb-2 flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground/80 transition-colors hover:text-foreground"
                            onClick={() =>
                              setExpandedPlanId(
                                expandedPlanId === plan.id ? null : plan.id
                              )
                            }
                          >
                            <span>Features</span>
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandedPlanId === plan.id ? "rotate-180" : ""}`}
                            />
                          </button>

                          {expandedPlanId === plan.id && (
                            <ul className="grid animate-in grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground duration-200 fade-in slide-in-from-top-1">
                              {plan.features.map((feature, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center gap-1.5"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span className="truncate">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="mb-2 text-xs font-semibold text-foreground/80">
                            Features:
                          </div>
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {plan.features.map((feature, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="truncate">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {(() => {
                        let actionText = "Upgrade"
                        if (!isInactive && !isTrial) {
                          if (
                            currentPlanName === "pro" &&
                            plan.id === "basic"
                          ) {
                            actionText = "Downgrade"
                          } else if (
                            currentPlanName === "basic" &&
                            plan.id === "pro"
                          ) {
                            actionText = "Upgrade"
                          }
                        }

                        return (
                          <Button
                            className="mt-4 w-full"
                            variant={
                              isCurrent ? "outline" : (plan.variant as any)
                            }
                            disabled={
                              isCurrent || upgradeLoadingPlanId !== null
                            }
                            onClick={() =>
                              handleUpgrade(plan.id as "basic" | "pro")
                            }
                          >
                            {upgradeLoadingPlanId === plan.id ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing
                              </span>
                            ) : isCurrent ? (
                              "Current Plan"
                            ) : (
                              `${actionText} to ${plan.displayName}`
                            )}
                          </Button>
                        )
                      })()}
                    </CardContent>
                  </Card>
                )
              })
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentConfirmOpen}
        onOpenChange={(open) => {
          setIsPaymentConfirmOpen(open)
          if (!open) {
            setPendingPayment(null)
            setIsRedirectingToPaystack(false)
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
            <div className="rounded-lg border bg-muted/30 p-4">
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
              disabled={isRedirectingToPaystack}
              onClick={() => {
                setIsPaymentConfirmOpen(false)
                setPendingPayment(null)
                setIsRedirectingToPaystack(false)
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isRedirectingToPaystack}
              onClick={() => {
                if (!pendingPayment?.authorizationUrl) return

                setIsRedirectingToPaystack(true)
                window.location.href = pendingPayment.authorizationUrl
              }}
            >
              {isRedirectingToPaystack ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting
                </span>
              ) : (
                "Continue to Paystack"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm text-muted-foreground">
            <p>
              Your features will be suspended immediately. You will lose access
              to the dashboard, inventory tracking, alerts, and ordering
              systems.
            </p>
            <p className="font-medium text-destructive">
              Only the Billing page will remain accessible so you can resume
              your plan.
            </p>
          </div>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isCancelling}
              onClick={() => setIsCancelOpen(false)}
            >
              No, keep active
            </Button>
            <Button
              variant="destructive"
              disabled={isCancelling}
              onClick={handleCancel}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, cancel subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
