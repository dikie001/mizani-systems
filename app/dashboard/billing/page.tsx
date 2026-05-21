"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { mutate as swrMutate } from "swr"
import jsPDF from "jspdf"
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Download,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Receipt,
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

// ─── Types ────────────────────────────────────────────────────────────────────
type PaymentSummary = {
  action?: "checkout" | "upgrade" | "downgrade" | "no_change"
  amount?: number
  amountLabel?: string
  headline?: string
  detail?: string
}

interface Subscription {
  id: string
  plan: { id: string; displayName: string; name: string; monthlyPrice: number }
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
  currency: string
  status: string
  billingPeriodStart: string
  billingPeriodEnd: string
  dueDate: string
  paidAt: string | null
  description: string | null
  notes: string | null
  createdAt: string
}

interface Payment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json())

const fmtDate = (value: string | null) => {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "active":
    case "trial":
    case "paid":
    case "success":
      return "bg-green-500/10 text-green-700 dark:text-green-400"
    case "pending":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
    case "cancelled":
    case "failed":
      return "bg-red-500/10 text-red-700 dark:text-red-400"
    default:
      return "bg-gray-500/10 text-gray-600"
  }
}

// ─── PDF: Payment Receipt ──────────────────────────────────────────────────────
const generateReceiptPdf = async ({
  invoice,
  workspaceName,
}: {
  invoice: Invoice
  workspaceName: string
}) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const M = 50

  // ── Header band ──
  doc.setFillColor(109, 40, 217)
  doc.rect(0, 0, W, 72, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(workspaceName || "Mizani", M, 30)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(216, 180, 254)
  doc.text("PAYMENT RECEIPT", M, 46)

  const receiptNum = invoice.invoiceNumber.startsWith("INV-")
    ? "RCP-" + invoice.invoiceNumber.slice(4)
    : invoice.invoiceNumber

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(receiptNum, W - M, 30, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(216, 180, 254)
  doc.text(fmtDate(invoice.paidAt ?? invoice.createdAt), W - M, 46, {
    align: "right",
  })

  // ── Amount block ──
  let y = 100

  doc.setFont("helvetica", "bold")
  doc.setFontSize(30)
  doc.setTextColor(15, 10, 30)
  doc.text(formatKES(invoice.amount), W / 2, y, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(130, 120, 150)
  doc.text("AMOUNT PAID", W / 2, y + 16, { align: "center" })

  // PAID pill
  doc.setFillColor(220, 252, 231)
  doc.roundedRect(W / 2 - 20, y + 24, 40, 14, 4, 4, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(21, 128, 61)
  doc.text("PAID", W / 2, y + 33, { align: "center" })

  y += 62

  // ── Divider ──
  doc.setDrawColor(225, 220, 240)
  doc.line(M, y, W - M, y)
  y += 20

  // ── Details grid ──
  const col2 = W / 2 + 12

  const label = (text: string, x: number, ry: number) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(130, 120, 150)
    doc.text(text.toUpperCase(), x, ry)
  }
  const value = (text: string, x: number, ry: number, maxW?: number) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(15, 10, 30)
    if (maxW) {
      doc.text(text, x, ry + 12, { maxWidth: maxW })
    } else {
      doc.text(text, x, ry + 12)
    }
  }

  label("Billed To", M, y)
  label("Plan", col2, y)
  value(workspaceName || "Workspace", M, y, col2 - M - 16)
  value(invoice.description || "Subscription Plan", col2, y, W - col2 - M)

  y += 40

  const period =
    invoice.billingPeriodStart && invoice.billingPeriodEnd
      ? `${fmtDate(invoice.billingPeriodStart)} – ${fmtDate(invoice.billingPeriodEnd)}`
      : "—"

  label("Billing Period", M, y)
  label("Date Paid", col2, y)
  value(period, M, y, col2 - M - 16)
  value(invoice.paidAt ? fmtDate(invoice.paidAt) : "—", col2, y)

  y += 40

  doc.setDrawColor(225, 220, 240)
  doc.line(M, y, W - M, y)
  y += 18

  // ── Footer ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(160, 150, 175)
  doc.text(
    "This receipt confirms your payment. Please retain it for your records.",
    W / 2,
    y,
    { align: "center" }
  )
  doc.text("mizani.app", W / 2, y + 13, { align: "center" })

  doc.save(`receipt-${receiptNum}.pdf`)
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-6 w-40" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t pt-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-36" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b pb-3 last:border-0"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-8 w-28 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { data: session, status: sessionStatus } = useSession()
  const workspaceId = session?.user?.workspaceId

  // All three requests fire in parallel — much faster than sequential awaits
  const {
    data: subscription,
    isLoading: subLoading,
    mutate: mutateSubscription,
  } = useSWR<Subscription | null>(
    workspaceId ? "/api/subscriptions/current" : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const {
    data: rawInvoices,
    isLoading: invoicesLoading,
    mutate: mutateInvoices,
  } = useSWR<Invoice[]>(workspaceId ? "/api/invoices/list" : null, fetcher, {
    revalidateOnFocus: false,
  })
  const {
    data: rawPayments,
    isLoading: paymentsLoading,
    mutate: mutatePayments,
  } = useSWR<Payment[]>(workspaceId ? "/api/payments/list" : null, fetcher, {
    revalidateOnFocus: false,
  })

  const invoices: Invoice[] = rawInvoices ?? []
  const payments: Payment[] = rawPayments ?? []
  // Only paid invoices become receipts
  const receipts = invoices.filter((i) => i.status === "paid")

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
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

  const isLoading =
    sessionStatus === "loading" ||
    (!!workspaceId && (subLoading || invoicesLoading || paymentsLoading))

  useEffect(() => {
    if (!isUpgradeOpen) return
    const currentPlanName = subscription?.plan?.name ?? ""
    const isTrial = currentPlanName === "trial" || currentPlanName === "free"
    const isInactive =
      !subscription ||
      subscription.status === "cancelled" ||
      subscription.status === "expired"
    const plans = PLANS.filter(
      (p) => p.id === "basic" || p.id === "pro"
    ).filter((plan) =>
      isInactive || isTrial ? true : plan.id !== currentPlanName
    )
    if (plans.length > 0) setExpandedPlanId(plans[0].id)
  }, [isUpgradeOpen, subscription])

  const refreshAll = () =>
    Promise.all([mutateSubscription(), mutateInvoices(), mutatePayments()])

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await cancelSubscription()
      if (res.success) {
        toast.success("Subscription cancelled.")
        setIsCancelOpen(false)
        await refreshAll()
        swrMutate("/api/subscriptions/current")
      } else {
        toast.error(res.error ?? "Failed to cancel subscription")
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsCancelling(false)
    }
  }

  const handleUpgrade = async (planId: "basic" | "pro") => {
    if (!workspaceId) {
      toast.error("Workspace not found")
      return
    }
    setUpgradeLoadingPlanId(planId)
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, workspaceId }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Failed to initialize payment")
      if (data.authorizationUrl) {
        setPendingPayment({
          authorizationUrl: data.authorizationUrl,
          summary: data.paymentSummary ?? null,
        })
        setIsPaymentConfirmOpen(true)
        return
      }
      toast.success(data.message ?? "Plan updated successfully")
      await refreshAll()
      swrMutate("/api/subscriptions/current")
      setIsUpgradeOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update plan"
      )
    } finally {
      setUpgradeLoadingPlanId(null)
    }
  }

  const handleDownloadReceipt = async (invoice: Invoice) => {
    setDownloadingId(invoice.id)
    try {
      await generateReceiptPdf({
        invoice,
        workspaceName: session?.user?.workspaceName ?? "Mizani",
      })
      toast.success("Receipt downloaded")
    } catch {
      toast.error("Failed to generate receipt")
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Render: loading skeleton ──
  if (isLoading) return <BillingSkeleton />

  // ── Render: page ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and view payment receipts
        </p>
      </div>

      {/* ── Current Subscription ── */}
      {subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Plan
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {subscription.plan.displayName}
                  </span>
                  <Badge className={statusBadgeClass(subscription.status)}>
                    {subscription.status.charAt(0).toUpperCase() +
                      subscription.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Billing Amount
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatKES(subscription.plan.monthlyPrice)}/month
                </p>
              </div>

              {subscription.currentBillingCycleStart && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Current Cycle
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {fmtDate(subscription.currentBillingCycleStart)} →{" "}
                      {fmtDate(subscription.currentBillingCycleEnd)}
                    </span>
                  </div>
                </div>
              )}

              {subscription.nextBillingDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Next Billing
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span>{fmtDate(subscription.nextBillingDate)}</span>
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
                  className="text-destructive hover:text-destructive"
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
              <p className="font-medium text-yellow-700">
                No Active Subscription
              </p>
              <p className="mt-0.5 text-sm text-yellow-700/70">
                Choose a plan to access all features
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

      {/* ── Payment Receipts ── */}
      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              Payment Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt No.</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Plan Period</TableHead>
                    <TableHead>Date Paid</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((invoice) => {
                    const receiptNum = invoice.invoiceNumber.startsWith("INV-")
                      ? "RCP-" + invoice.invoiceNumber.slice(4)
                      : invoice.invoiceNumber
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-sm">
                          {receiptNum}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatKES(invoice.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmtDate(invoice.billingPeriodStart)} –{" "}
                          {fmtDate(invoice.billingPeriodEnd)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmtDate(invoice.paidAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-primary"
                            onClick={() => handleDownloadReceipt(invoice)}
                            disabled={downloadingId === invoice.id}
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            {downloadingId === invoice.id
                              ? "Generating…"
                              : "Receipt"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Payment History ── */}
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
                        {fmtDate(payment.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatKES(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass(payment.status)}>
                          {payment.status.charAt(0).toUpperCase() +
                            payment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmtDate(payment.paidAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Upgrade / Change Plan Dialog ── */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Select a Subscription Plan
            </DialogTitle>
            <DialogDescription>
              {subscription?.plan?.displayName ? (
                <>
                  Currently on{" "}
                  <span className="font-semibold text-foreground">
                    {subscription.plan.displayName}
                  </span>
                  . Switch to:
                </>
              ) : (
                "Choose the plan that fits your business needs."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {(() => {
              const currentPlanName = subscription?.plan?.name ?? ""
              const isTrial =
                currentPlanName === "trial" || currentPlanName === "free"
              const isInactive =
                !subscription ||
                subscription.status === "cancelled" ||
                subscription.status === "expired"
              const plansToShow = PLANS.filter(
                (p) => p.id === "basic" || p.id === "pro"
              ).filter((plan) =>
                isInactive || isTrial ? true : plan.id !== currentPlanName
              )
              const isCollapsible = plansToShow.length > 1

              return plansToShow.map((plan) => {
                const isCurrent = subscription?.plan?.id === plan.id
                return (
                  <Card
                    key={plan.id}
                    className={`border-border/80 transition-all ${plan.highlight ? "bg-primary/5 ring-2 ring-primary" : ""} ${isCurrent ? "opacity-80" : ""}`}
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
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl font-bold">
                            {formatKES(plan.monthlyPrice)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            /mo
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                      {isCollapsible ? (
                        <>
                          <button
                            type="button"
                            className="mb-2 flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground"
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
                          <p className="mb-2 text-xs font-semibold text-foreground/80">
                            Features:
                          </p>
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
                          if (currentPlanName === "pro" && plan.id === "basic")
                            actionText = "Downgrade"
                          else if (
                            currentPlanName === "basic" &&
                            plan.id === "pro"
                          )
                            actionText = "Upgrade"
                        }
                        return (
                          <Button
                            className="mt-4 w-full"
                            variant={
                              isCurrent
                                ? "outline"
                                : (plan.variant as
                                    | "default"
                                    | "outline"
                                    | "secondary")
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

      {/* ── Payment Confirmation Dialog ── */}
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
              Review the details before we send you to Paystack.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium text-foreground">
                {pendingPayment?.summary?.headline ?? "Proceed to Paystack"}
              </p>
              <p className="mt-2 whitespace-pre-line">
                {pendingPayment?.summary?.detail ??
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
                  Redirecting…
                </span>
              ) : (
                "Continue to Paystack"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Subscription Dialog ── */}
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
              to inventory tracking, alerts, and ordering systems.
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
                  Cancelling…
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
