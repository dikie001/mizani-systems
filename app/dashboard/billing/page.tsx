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
import { formatKES } from "@/lib/plans"

interface Subscription {
  id: string
  plan: {
    id: string
    displayName: string
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

  useEffect(() => {
    if (!(session?.user as any)?.workspaceId) return

    const fetchBillingData = async () => {
      try {
        const [subRes, invoicesRes, paymentsRes] = await Promise.all([
          fetch("/api/subscriptions/current"),
          fetch("/api/invoices/list"),
          fetch("/api/payments/list"),
        ])

        if (subRes.ok) {
          const subData = await subRes.json()
          setSubscription(subData)
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

    fetchBillingData()
  }, [(session?.user as any)?.workspaceId])

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
        return "bg-green-500/10 text-green-600"
      case "paid":
        return "bg-green-500/10 text-green-600"
      case "success":
        return "bg-green-500/10 text-green-600"
      case "pending":
        return "bg-yellow-500/10 text-yellow-600"
      case "cancelled":
        return "bg-red-500/10 text-red-600"
      case "failed":
        return "bg-red-500/10 text-red-600"
      default:
        return "bg-gray-500/10 text-gray-600"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and payment methods
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
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

            {(subscription.status === "active" || subscription.status === "trial") && (
              <div className="flex gap-2 border-t pt-4">
                <Button variant="outline" size="sm" asChild>
                  <a href="/onboarding">Upgrade / Change Plan</a>
                </Button>
                {subscription.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => toast.success("Please contact support at billing@stockvault.com to cancel your paid plan.")}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-yellow-600">No Active Subscription</p>
              <p className="text-sm text-yellow-600/80 mt-1">
                Choose a plan to get started with all the features
              </p>
            </div>
            <Button className="ml-auto" size="sm" asChild>
              <a href="/pricing">View Plans</a>
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
    </div>
  )
}
