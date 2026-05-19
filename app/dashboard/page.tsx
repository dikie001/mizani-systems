"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  FileText,
  Layers,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Upload,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/stat-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { formatPrice } from "@/lib/utils"

type WorkspaceSummary = {
  currency?: string | null
}

type ActivityItem = {
  id: string
  product: string
  type: string
  qty: string
  status: string
  date: string
}

type LowStockItem = {
  name: string
  category: string
  stock: number
  maxStock?: number | null
}

type CategoryStat = {
  category: string
  items: number
  value: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  orders: { label: "Orders", color: "var(--chart-2)" },
}

const categoryChartConfig: ChartConfig = {
  items: { label: "Items", color: "var(--chart-1)" },
  value: { label: "Value ($)", color: "var(--chart-3)" },
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: workspace } = useSWR<WorkspaceSummary>(
    "/api/workspaces/current",
    fetcher
  )
  const currency = workspace?.currency || "KES"
  const [revMetric, setRevMetric] = useState<"revenue" | "orders">("revenue")
  const [viewInterval, setViewInterval] = useState<"monthly" | "weekly">(
    "monthly"
  )
  const { data: stats, isLoading: statsLoading } = useSWR(
    "/api/dashboard/stats",
    fetcher
  )
  const { data: revenueData, isLoading: revLoading } = useSWR(
    `/api/dashboard/revenue?interval=${viewInterval}`,
    fetcher
  )
  const { data: categoryData, isLoading: catLoading } = useSWR(
    "/api/dashboard/categories",
    fetcher
  )
  const { data: activityData, isLoading: actLoading } = useSWR(
    "/api/stock-movements",
    fetcher
  )
  const { data: lowStockData, isLoading: lowLoading } = useSWR(
    "/api/products?status=low-stock",
    fetcher
  )

  const lowStockItems = (lowStockData ?? []) as LowStockItem[]
  const recentActivity = (activityData ?? []) as ActivityItem[]
  const categories = (categoryData ?? []) as CategoryStat[]
  const revenue = Array.isArray(revenueData) ? revenueData : []

  // Dynamic formatting for Revenue YAxis ticks without repeating currency prefix
  const maxRevVal = Math.max(
    ...revenue.map((item) => Number((item as Record<string, unknown>)[revMetric]) || 0),
    0
  )
  const formatRevenueTick = (v: number) => {
    if (revMetric === "revenue") {
      if (maxRevVal >= 1000) {
        return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
      }
      return String(v)
    }
    return String(v)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session?.user?.name?.split(" ")[0] || "User"}.
          Here&apos;s your inventory overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[
          {
            title: "Total Products",
            value: statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              stats?.totalProducts
            ),
            icon: Layers,
            valColor: "text-blue-500",
            iconColor: "text-blue-500",
            description: "Active catalog items",
          },
          {
            title: "Low Stock Alerts",
            value: statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              stats?.lowStock
            ),
            icon: AlertCircle,
            valColor: "text-orange-500",
            iconColor: "text-orange-500",
            description: "Needs restocking",
          },
          {
            title: "Monthly Revenue",
            value: statsLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              formatPrice(stats?.totalRevenue ?? 0, currency)
            ),
            icon: BarChart3,
            valColor: "text-emerald-500",
            iconColor: "text-emerald-500",
            description: "Current billing cycle",
          },
          {
            title: "Pending Orders",
            value: statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              stats?.pendingOrders
            ),
            icon: ShoppingCart,
            valColor: "text-indigo-500",
            iconColor: "text-indigo-500",
            description: "Awaiting shipment",
          },
        ].map((kpi) => (
          <StatCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            valColor={kpi.valColor}
            iconColor={kpi.iconColor}
            description={kpi.description}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>
                  Revenue Overview {revMetric === "revenue" ? `(${currency})` : ""}
                </CardTitle>
                <CardDescription>
                  {viewInterval === "monthly" ? "Monthly" : "Weekly"} revenue
                  and order trends
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg border-border/50 text-xs font-semibold"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 space-y-1 p-1.5"
                >
                  <DropdownMenuLabel className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Time Interval
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={viewInterval}
                    onValueChange={(v) =>
                      setViewInterval(v as "monthly" | "weekly")
                    }
                  >
                    <DropdownMenuRadioItem
                      value="monthly"
                      className="cursor-pointer rounded-md text-xs"
                    >
                      Monthly View
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="weekly"
                      className="cursor-pointer rounded-md text-xs"
                    >
                      Weekly View
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator className="my-1.5" />
                  <DropdownMenuLabel className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Chart Metric
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={revMetric}
                    onValueChange={(v) =>
                      setRevMetric(v as "revenue" | "orders")
                    }
                  >
                    <DropdownMenuRadioItem
                      value="revenue"
                      className="cursor-pointer rounded-md text-xs"
                    >
                      Revenue ($)
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="orders"
                      className="cursor-pointer rounded-md text-xs"
                    >
                      Order Count
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {revLoading ? (
              <div className="space-y-4 h-[252px] flex flex-col justify-end pb-4">
                <div className="flex justify-between items-center w-full px-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex items-end gap-3 h-40 w-full px-2">
                  {[...Array(12)].map((_, i) => (
                    <Skeleton
                      key={i}
                      className="w-full rounded-t opacity-70 bg-muted/60"
                      style={{ height: `${25 + (i % 4) * 15 + Math.sin(i) * 10}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <ChartContainer
                config={revenueChartConfig}
                className="aspect-auto h-[252px] w-full"
              >
                <AreaChart
                  data={revenue}
                  margin={{ top: 12, left: 10, right: 0, bottom: 30 }}
                >
                  <defs>
                    <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={
                          revMetric === "revenue"
                            ? "var(--color-revenue)"
                            : "var(--color-orders)"
                        }
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor={
                          revMetric === "revenue"
                            ? "var(--color-revenue)"
                            : "var(--color-orders)"
                        }
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickMargin={8}
                    padding={{ left: 0, right: 0 }}
                    label={{
                      value:
                        viewInterval === "monthly"
                          ? "Month"
                          : "Week (Starting Mon)",
                      position: "insideBottom",
                      offset: -10,
                      fill: "var(--muted-foreground)",
                      style: {
                        fontSize: 12,
                        fontWeight: 600,
                        textAnchor: "middle",
                      },
                    }}
                  />
                  <YAxis
                    width={50}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    tickMargin={6}
                    tickFormatter={formatRevenueTick}
                    label={{
                      value: revMetric === "revenue" ? "Revenue" : "Orders",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      fill: "var(--muted-foreground)",
                      style: {
                        fontSize: 12,
                        fontWeight: 600,
                        textAnchor: "middle",
                      },
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => value}
                        formatter={(value, name) => (
                          <div className="flex items-center justify-between gap-8">
                            <span className="text-muted-foreground">
                              {name === "revenue" ? "Revenue" : "Orders"}
                            </span>
                            <span className="font-mono font-medium">
                              {name === "revenue"
                                ? formatPrice(Number(value), currency)
                                : value}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={revMetric}
                    stroke={
                      revMetric === "revenue"
                        ? "var(--color-revenue)"
                        : "var(--color-orders)"
                    }
                    strokeWidth={1.75}
                    fill="url(#fillMetric)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Chart */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>
              Items distribution across categories
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {catLoading ? (
              <div className="space-y-4.5 h-[248px] justify-center flex flex-col px-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-24 bg-muted/70" />
                      <Skeleton className="h-3 w-8 bg-muted/50" />
                    </div>
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <ChartContainer
                config={categoryChartConfig}
                className="aspect-auto h-[248px] w-full"
              >
                <BarChart
                  data={categories}
                  margin={{ top: 12, left: 10, right: 14, bottom: 20 }}
                  layout="vertical"
                  barCategoryGap="30%"
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 13 }}
                    tickMargin={10}
                    label={{
                      value: "Total items",
                      position: "bottom",
                      offset: 8,
                      fill: "var(--muted-foreground)",
                      style: { fontSize: 13, fontWeight: 500 },
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    label={{
                      value: "Categories",
                      angle: -90,
                      position: "insideLeft",
                      offset: -2,
                      fill: "var(--muted-foreground)",
                      style: { fontSize: 13, fontWeight: 500 },
                    }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex items-center justify-between gap-8">
                            <span className="text-muted-foreground">
                              {name === "items" ? "Items" : "Value"}
                            </span>
                            <span className="font-mono font-medium">
                              {name === "items"
                                ? value
                                : formatPrice(Number(value), currency)}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="items"
                    fill="var(--color-items)"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  >
                    <LabelList
                      dataKey="category"
                      position="insideLeft"
                      offset={12}
                      fill="rgba(28, 18, 36, 0.92)"
                      fontSize={11}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest inventory movements</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/inventory">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {actLoading ? (
            <div className="space-y-4 py-2">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/40 pb-3.5 pt-3.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {item.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.product}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-medium ${item.qty.startsWith("+") ? "text-emerald-500" : item.qty.startsWith("-") ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      {item.qty}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "completed"
                            ? "secondary"
                            : item.status === "pending"
                              ? "outline"
                              : "secondary"
                        }
                        className={`text-xs ${item.status === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : item.status === "pending" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.date}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Low Stock Alerts
                </CardTitle>
                <CardDescription>
                  Items requiring immediate restock
                </CardDescription>
              </div>
              <Badge variant="destructive" className="text-xs">
                {lowStockItems.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lowLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No low stock items.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/orders?action=create">
                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                    Create restock order
                  </Link>
                </Button>
              </div>
            ) : (
              lowStockItems.slice(0, 5).map((item) => {
                const percentage = Math.round(
                  (item.stock / (item.maxStock || 100)) * 100
                )
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.stock}/{item.maxStock || 100}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })
            )}
          </CardContent>
          {lowStockItems.length > 0 && (
            <CardFooter className="justify-end border-none bg-transparent pt-0 pb-6">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/orders?action=create">
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  Create restock order
                </Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: Plus,
                  label: "Add Product",
                  desc: "Create new inventory item",
                  href: "/dashboard/inventory?action=add",
                },
                {
                  icon: Upload,
                  label: "Bulk Import",
                  desc: "Upload CSV or Excel",
                  href: "/dashboard/inventory?action=import",
                },
                {
                  icon: FileText,
                  label: "Generate Report",
                  desc: "Export analytics data",
                  href: "/dashboard/reports",
                },
                {
                  icon: Users,
                  label: "Manage Team",
                  desc: "Roles & permissions",
                  href: "/dashboard/settings",
                },
              ].map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="flex h-auto flex-col items-center gap-2 p-4"
                  asChild
                >
                  <Link href={action.href}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <action.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium">{action.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {action.desc}
                      </div>
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
