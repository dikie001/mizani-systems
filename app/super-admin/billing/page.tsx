"use client"

import { useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CreditCard,
  DollarSign,
  FileText,
  ReceiptText,
  Users,
  CheckCircle2,
  Shield,
  Loader2,
} from "lucide-react"

import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatKES, PLANS } from "@/lib/plans"

type BillingWorkspace = {
  id: string
  name: string
  slug: string
  planName: string | null
  subscriptionStatus: string | null
  paymentStatus: string | null
  monthlyPrice: number | null
  nextBillingDate: string | null
  lastPaymentStatus: string | null
  createdAt: string
}

type BillingSummary = {
  totalWorkspaces: number
  activeSubscriptions: number
  pendingPayments: number
  totalMonthlyRevenue: number
  paidThisMonth: number
}

type BillingPlan = (typeof PLANS)[number] & {
  activeSubscriptions: number
}

type BillingPayment = {
  id: string
  workspaceName: string
  workspaceSlug: string
  subscriptionStatus: string | null
  planName: string | null
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  reference: string | null
  paidAt: string | null
  createdAt: string
  invoiceNumber: string | null
  invoiceStatus: string | null
}

type BillingInvoice = {
  id: string
  workspaceName: string
  workspaceSlug: string
  subscriptionStatus: string | null
  planName: string | null
  invoiceNumber: string
  amount: number
  currency: string
  status: string
  dueDate: string
  paidAt: string | null
  billingPeriodStart: string
  billingPeriodEnd: string
  description: string | null
  notes: string | null
  createdAt: string
}

type BillingResponse = {
  workspaces: BillingWorkspace[]
  summary: BillingSummary
  plans: BillingPlan[]
  payments: BillingPayment[]
  invoices: BillingInvoice[]
}

function getBadgeClass(status: string | null) {
  switch (status) {
    case "active":
    case "paid":
    case "success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    case "pending":
    case "draft":
    case "issued":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    case "cancelled":
    case "failed":
    case "expired":
    case "overdue":
      return "border-destructive/20 bg-destructive/10 text-destructive"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

function formatDate(value: string | null) {
  if (!value) return "—"

  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(value: string | null) {
  if (!value) return "—"

  return new Date(value).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

const PLAN_COLORS: Record<string, string> = {
  trial: "#8b5cf6",
  basic: "#3b82f6",
  pro: "#10b981",
  unassigned: "#6b7280",
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Failed to load billing data")
  }
  return res.json()
}

export default function SuperAdminBillingPage() {
  const { data, error, isLoading, mutate } = useSWR<BillingResponse>(
    "/api/super-admin/billing",
    fetcher,
    { revalidateOnFocus: false }
  )

  const summary = data?.summary
  const plans = data?.plans ?? []
  const workspaces = data?.workspaces ?? []
  const payments = data?.payments ?? []
  const invoices = data?.invoices ?? []

  const billingHealth = useMemo(() => {
    const overdueInvoices = invoices.filter(
      (invoice) => invoice.status === "overdue"
    ).length
    const unpaidPayments = payments.filter(
      (payment) => payment.status === "pending" || payment.status === "failed"
    ).length
    return { overdueInvoices, unpaidPayments }
  }, [invoices, payments])

  // Build plan distribution data for the pie chart
  const planChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    workspaces.forEach((ws) => {
      const key = ws.planName?.toLowerCase() ?? "unassigned"
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({
      name:
        name === "free trial"
          ? "Free Trial"
          : name.charAt(0).toUpperCase() + name.slice(1),
      value,
      key: name.toLowerCase().includes("trial")
        ? "trial"
        : name.toLowerCase().includes("basic")
          ? "basic"
          : name.toLowerCase().includes("pro")
            ? "pro"
            : "unassigned",
    }))
  }, [workspaces])

  const latestPayment = payments[0]

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Failed to Load Billing Console
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {error.message}
          </p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Billing Console
        </h1>
        <p className="text-sm text-muted-foreground">
          Track subscriptions, invoices, payments, revenue, and plan features
          across every workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Workspaces"
          value={summary?.totalWorkspaces ?? workspaces.length}
          icon={Users}
          valColor="text-blue-500"
          iconColor="text-blue-500"
          description="Billing-enabled tenants"
        />
        <StatCard
          title="Active Subscriptions"
          value={summary?.activeSubscriptions ?? 0}
          icon={CheckCircle2}
          valColor="text-emerald-500"
          iconColor="text-emerald-500"
          description="Live paid subscriptions"
        />
        <StatCard
          title="Pending Billing"
          value={
            (summary?.pendingPayments ?? 0) + billingHealth.overdueInvoices
          }
          icon={AlertTriangle}
          valColor="text-amber-500"
          iconColor="text-amber-500"
          description="Unpaid or overdue records"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatKES(summary?.totalMonthlyRevenue ?? 0)}
          icon={DollarSign}
          valColor="text-violet-500"
          iconColor="text-violet-500"
          description={
            latestPayment
              ? `Latest payment ${formatKES(latestPayment.amount)}`
              : "No payment history yet"
          }
        />
      </div>

      {/* Plan Distribution Chart + Table side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Workspaces by Plan
            </CardTitle>
            <CardDescription>
              Distribution of active workspaces across subscription tiers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No workspace data yet.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {planChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={PLAN_COLORS[entry.key] ?? "#6b7280"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [
                        `${value} workspace${Number(value) !== 1 ? "s" : ""}`,
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-muted-foreground">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Plan Entitlements
            </CardTitle>
            <CardDescription>
              Subscription tiers, pricing, and active workspace counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price / mo</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                PLAN_COLORS[plan.name] ?? "#6b7280",
                            }}
                          />
                          <div>
                            <p className="font-medium text-foreground">
                              {plan.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {plan.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap text-foreground">
                        {plan.monthlyPrice === 0
                          ? "Free"
                          : formatKES(plan.monthlyPrice)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getBadgeClass(
                            plan.activeSubscriptions > 0 ? "active" : "pending"
                          )}
                        >
                          {plan.activeSubscriptions}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="h-5 w-5" />
              Workspace Billing Records
            </CardTitle>
            <CardDescription>
              Subscription, payment, and renewal status for each workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {workspace.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {workspace.slug}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBadgeClass(workspace.planName)}>
                          {workspace.planName || "No Plan"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            className={getBadgeClass(
                              workspace.subscriptionStatus
                            )}
                          >
                            {workspace.subscriptionStatus || "No Subscription"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground">
                            Payment: {workspace.paymentStatus || "Unknown"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {formatDate(workspace.nextBillingDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ReceiptText className="h-5 w-5" />
              Payments and Invoices
            </CardTitle>
            <CardDescription>
              Recent payment activity and invoice records pulled from the
              billing ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Payments
                </h3>
                <Badge
                  variant="outline"
                  className="border-border bg-muted/30 text-[10px] text-muted-foreground uppercase"
                >
                  Latest {payments.length}
                </Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">
                              {payment.workspaceName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.planName || payment.workspaceSlug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap text-foreground">
                          {formatKES(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getBadgeClass(payment.status)}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {formatDateTime(payment.paidAt || payment.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Invoices
                </h3>
                <Badge
                  variant="outline"
                  className="border-border bg-muted/30 text-[10px] text-muted-foreground uppercase"
                >
                  Latest {invoices.length}
                </Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">
                              {invoice.invoiceNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.workspaceName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getBadgeClass(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap text-foreground">
                          {formatKES(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-border bg-background text-xs"
                          >
                            <Link href="/dashboard/billing">
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              Open Billing Page
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ArrowRightLeft className="h-5 w-5" />
            Billing Controls
          </CardTitle>
          <CardDescription>
            Quick operational hooks for billing support and plan management.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="border-border bg-background">
            Export Billing Report
          </Button>
          <Button variant="outline" className="border-border bg-background">
            Review Failed Payments
          </Button>
          <Button variant="outline" className="border-border bg-background">
            Manage Plan Catalog
          </Button>
          <Button>Open Billing Queue</Button>
        </CardContent>
      </Card>
    </div>
  )
}
