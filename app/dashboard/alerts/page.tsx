"use client"

import useSWR, { mutate } from "swr"
import { useSession } from "next-auth/react"
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Flame,
  Loader2,
  ShoppingCart,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import Link from "next/link"

type AlertItem = {
  id: string
  name: string
  sku: string
  category: string
  stock: number
  maxStock?: number | null
  severity: "critical" | "warning" | string
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Request failed")
  }
  return response.json()
}

function AlertCard({
  item,
  onDismiss,
}: {
  item: AlertItem
  onDismiss: (id: string) => void
}) {
  const max = item.maxStock || 100
  const pct = Math.round((item.stock / max) * 100)
  const severity = item.severity

  return (
    <Card className={severity === "critical" ? "border-red-500/30" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${severity === "critical" ? "bg-red-500/10" : "bg-amber-500/10"}`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${severity === "critical" ? "text-red-500" : "text-amber-500"}`}
              />
            </div>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.sku} · {item.category}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-xs ${severity === "critical" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
          >
            {severity === "critical" ? "Critical" : "Low Stock"}
          </Badge>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock level</span>
            <span className="font-mono font-medium">
              {item.stock} / {max}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" asChild>
            <Link href={`/dashboard/inventory?search=${item.sku}`}>
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Restock
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDismiss(item.id)}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AlertsPage() {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { data: activeAlerts, isLoading } = useSWR<AlertItem[]>(
    workspaceId ? ["/api/alerts?status=active", workspaceId] : null,
    fetcher
  )
  const { data: resolvedAlerts, isLoading: rLoading } = useSWR<AlertItem[]>(
    workspaceId ? ["/api/alerts?status=resolved", workspaceId] : null,
    fetcher
  )

  const alerts = Array.isArray(activeAlerts) ? activeAlerts : []
  const resolved = Array.isArray(resolvedAlerts) ? resolvedAlerts : []

  const criticalAlerts = alerts.filter((a) => a.severity === "critical")
  const lowStockAlerts = alerts.filter((a) => a.severity === "warning")

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      })
      if (res.ok) {
        toast.success("Alert dismissed")
        mutate("/api/alerts?status=active")
        mutate("/api/alerts/counts")
      }
    } catch {
      toast.error("Failed to dismiss alert")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Monitor inventory levels and restock notifications
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="auto-reorder" />
            <Label htmlFor="auto-reorder" className="text-sm">
              Auto-reorder
            </Label>
          </div>
          <Button variant="outline" size="sm">
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Configure
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Critical Alerts",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              criticalAlerts.length
            ),
            icon: Flame,
            valColor: "text-red-500",
            iconColor: "text-red-500",
            description: "Needs replenishment",
          },
          {
            label: "Low Stock Warnings",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              lowStockAlerts.length
            ),
            icon: AlertCircle,
            valColor: "text-orange-500",
            iconColor: "text-orange-500",
            description: "Under safe threshold",
          },
          {
            label: "Resolved Recently",
            value: rLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              resolved.length
            ),
            icon: CheckCircle2,
            valColor: "text-emerald-500",
            iconColor: "text-emerald-500",
            description: "Active corrections",
          },
        ].map((metric) => (
          <StatCard
            key={metric.label}
            title={metric.label}
            value={metric.value}
            icon={metric.icon}
            valColor={metric.valColor}
            iconColor={metric.iconColor}
            description={metric.description}
          />
        ))}
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({alerts.length})</TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 w-full">
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0 bg-muted/70" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-3/4 bg-muted/70" />
                          <Skeleton className="h-3 w-1/2 bg-muted/50" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full bg-muted/60" />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-16 bg-muted/50" />
                        <Skeleton className="h-3.5 w-12 bg-muted/60" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-9 flex-1 rounded bg-muted/60" />
                      <Skeleton className="h-9 w-20 rounded bg-muted/50" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {criticalAlerts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-red-500">
                    <XCircle className="h-4 w-4" /> Critical — Immediate action
                    required
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {criticalAlerts.map((item) => (
                      <AlertCard
                        key={item.id}
                        item={item}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                </div>
              )}

              {criticalAlerts.length > 0 && lowStockAlerts.length > 0 && (
                <Separator />
              )}

              {lowStockAlerts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                    <AlertTriangle className="h-4 w-4" /> Low Stock Warnings
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {lowStockAlerts.map((item) => (
                      <AlertCard
                        key={item.id}
                        item={item}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                </div>
              )}

              {alerts.length === 0 && (
                <div className="rounded-xl border border-dashed p-12 text-center">
                  <div className="mb-3 flex justify-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500/20" />
                  </div>
                  <p className="text-muted-foreground">
                    No active alerts. Inventory is healthy.
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 space-y-3">
          {resolved.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {resolved.map((item) => (
                <Card key={item.id} className="opacity-70">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock replenished · {item.stock} in stock
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No alerts resolved recently.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
