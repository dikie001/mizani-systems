"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Download,
  TrendingUp,
  Loader2,
  DollarSign,
  Package,
  ShoppingCart,
  Boxes,
  Lock,
} from "lucide-react"
import {
  Area,
  ComposedChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { formatPrice } from "@/lib/utils"

type WorkspaceSummary = {
  currency?: string | null
}

type CategoryDistribution = {
  category: string
  value: number
}

type ReportStats = {
  revenue?: { value?: number; change?: string }
  orders?: { value?: number; change?: string }
  itemsSold?: { value?: number; change?: string }
  aov?: { value?: number; change?: string }
}

type RevenueTrend = {
  month: string
  revenue: number
  orders: number
}

type TopProduct = {
  product: string
  units: number
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.error || "Failed to load reports") as Error & {
      status?: number
    }
    error.status = response.status
    throw error
  }

  return data
}

const revenueConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  orders: { label: "Orders", color: "var(--chart-2)" },
}

const productConfig: ChartConfig = {
  units: { label: "Units Sold", color: "var(--chart-2)" },
}

const pieConfig: ChartConfig = {
  value: { label: "Share" },
}

const pieColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--color-chart-1)",
]

export default function ReportsPage() {
  const [range, setRange] = useState("12m")

  const { data: stats, error: statsError, isLoading: statsLoading } = useSWR(
    `/api/dashboard/reports/stats?range=${range}`,
    fetcher
  )
  const { data: revenueData, error: revenueError, isLoading: revLoading } = useSWR(
    `/api/dashboard/revenue?range=${range}`,
    fetcher
  )
  const { data: categoryData, error: categoryError, isLoading: catLoading } = useSWR(
    `/api/dashboard/categories?range=${range}`,
    fetcher
  )
  const { data: topProducts, error: topProductsError, isLoading: topLoading } = useSWR(
    `/api/dashboard/reports/top-products?range=${range}`,
    fetcher
  )
  const { data: workspace } = useSWR<WorkspaceSummary>(
    "/api/workspaces/current",
    fetcher
  )
  const currency = workspace?.currency || "KES"
  const reportStats = (stats ?? {}) as ReportStats
  const trendData = (
    Array.isArray(revenueData) ? revenueData : []
  ) as RevenueTrend[]

  // Dynamic formatting for Reports page YAxis ticks without repeating currency prefix
  const maxTrendVal = Math.max(...trendData.map((item: any) => Number(item.revenue) || 0), 0)
  const formatTrendTick = (v: number) => {
    if (maxTrendVal >= 1000) {
      return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
    }
    return String(v)
  }
  const productData = (
    Array.isArray(topProducts) ? topProducts : []
  ) as TopProduct[]
  const pieData = (categoryData ?? []) as CategoryDistribution[]
  const analyticsError =
    statsError || revenueError || categoryError || topProductsError

  if (analyticsError instanceof Error && (analyticsError as { status?: number }).status === 403) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-xl border-border/60 bg-card/80 shadow-lg backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Professional Plan Required
              </h2>
              <p className="text-sm text-muted-foreground">
                Advanced analytics are available on the Professional plan. Upgrade to unlock revenue trends, category insights, and top-product reports.
              </p>
            </div>
            <a
              href="/dashboard/billing"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Upgrade Plan
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleExport = () => {
    window.print()
  }

  const kpis = [
    {
      label: "Total Revenue",
      value: reportStats.revenue?.value,
      change: reportStats.revenue?.change,
      valueType: "currency",
      icon: DollarSign,
      color: "text-emerald-500",
    },
    {
      label: "Total Orders",
      value: reportStats.orders?.value,
      change: reportStats.orders?.change,
      valueType: "count",
      icon: ShoppingCart,
      color: "text-sky-500",
    },
    {
      label: "Units Sold",
      value: reportStats.itemsSold?.value,
      change: reportStats.itemsSold?.change,
      valueType: "count",
      icon: Boxes,
      color: "text-violet-500",
    },
    {
      label: "Avg Order Value",
      value: reportStats.aov?.value,
      change: reportStats.aov?.change,
      valueType: "currency",
      icon: Package,
      color: "text-amber-500",
    },
  ]

  return (
    <div className="space-y-6 print:space-y-4 print:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analytics, trends, and business insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="mb-6 hidden print:block">
        <h1 className="text-3xl font-bold">Inventory System Report</h1>
        <p className="text-muted-foreground">
          Range: {range} | Generated on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="print:shadow-none">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              {statsLoading ? (
                <Skeleton className="mt-1 h-8 w-24" />
              ) : (
                <>
                  <p className="mt-1 text-2xl font-bold">
                    {typeof kpi.value === "number"
                      ? kpi.valueType === "currency"
                        ? formatPrice(kpi.value, currency)
                        : new Intl.NumberFormat().format(kpi.value)
                      : "0"}
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1 text-[10px] ${kpi.change?.startsWith("+") ? "text-emerald-500" : kpi.change?.startsWith("-") ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    <TrendingUp className="h-2.5 w-2.5" />
                    {kpi.change || "0.0%"} vs last period
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue vs Costs Chart */}
      <Card className="print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Revenue Trend ({currency})</CardTitle>
          <CardDescription>
            Revenue and order volume for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revLoading ? (
            <div className="space-y-4 h-56 flex flex-col justify-end pb-2">
              <div className="flex justify-between items-center w-full px-2">
                <Skeleton className="h-3 w-28 bg-muted/70" />
                <Skeleton className="h-3 w-16 bg-muted/50" />
              </div>
              <div className="flex items-end gap-3.5 h-36 w-full px-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="w-full rounded-t opacity-70 bg-muted/60"
                    style={{ height: `${30 + (i % 3) * 20 + Math.sin(i) * 12}%` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ChartContainer config={revenueConfig} className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendData}
                  margin={{ top: 8, left: 4, right: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="fillRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-revenue)"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-revenue)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={formatTrendTick}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => new Intl.NumberFormat().format(v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex items-center justify-between gap-8">
                            <span className="text-muted-foreground">
                              {name === "revenue"
                                ? "Revenue"
                                : name === "orders"
                                  ? "Orders"
                                  : name}
                            </span>
                            <span className="font-mono font-medium">
                              {name === "revenue"
                                ? formatPrice(Number(value), currency)
                                : new Intl.NumberFormat().format(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    yAxisId="left"
                    type="natural"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    fill="url(#fillRevenue)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="var(--color-orders)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Bottom row: Top Products + Category Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Top Selling Products</CardTitle>
            <CardDescription>Units sold in this period</CardDescription>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <div className="space-y-4 h-52 justify-center flex flex-col px-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-32 bg-muted/70" />
                      <Skeleton className="h-3 w-8 bg-muted/50" />
                    </div>
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <ChartContainer config={productConfig} className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productData}
                    layout="vertical"
                    margin={{ top: 0, left: 0, right: 20, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="product"
                      tickLine={false}
                      axisLine={false}
                      width={100}
                      tickMargin={8}
                      className="text-[10px]"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="units"
                      fill="var(--color-units)"
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Sales Distribution</CardTitle>
            <CardDescription>Revenue share by category</CardDescription>
          </CardHeader>
          <CardContent>
            {catLoading ? (
              <div className="flex h-52 items-center justify-center gap-6 px-4">
                <Skeleton className="h-32 w-32 rounded-full border-8 border-muted/30 bg-transparent flex items-center justify-center shrink-0">
                  <div className="h-16 w-16 rounded-full bg-background" />
                </Skeleton>
                <div className="max-w-35 flex-1 space-y-2.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0 bg-muted/80" />
                      <Skeleton className="h-3.5 w-full bg-muted/60" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ChartContainer config={pieConfig} className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="category"
                          hideLabel
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-8">
                              <span className="text-muted-foreground">
                                {name || "Revenue Share"}
                              </span>
                              <span className="font-mono font-medium">
                                {formatPrice(Number(value), currency)}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={categoryData || []}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={72}
                      paddingAngle={4}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="category" />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
