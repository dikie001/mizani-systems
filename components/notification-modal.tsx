"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import useSWR, { useSWRConfig } from "swr"
import {
  LoaderCircle,
  ExternalLink,
  ShoppingCart,
  Trash2,
  Bell,
  Check,
  Activity,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const fetcher = async (key: string | [string, string]) => {
  const url = Array.isArray(key) ? key[0] : key
  const res = await fetch(url)
  if (!res.ok) {
    const errorMsg = await res
      .json()
      .catch(() => ({}))
      .then((data) => data.error || "An error occurred")
    throw new Error(errorMsg)
  }
  return res.json()
}

interface NotificationItem {
  id: string
  type: "alert" | "activity"
  title: string
  description: string
  severity: string
  category: string
  sku?: string
  stock?: number
  minStock?: number
  createdAt: string
}

interface NotificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationModal({
  open,
  onOpenChange,
}: NotificationModalProps) {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { mutate: globalMutate } = useSWRConfig()
  const { data: notifications, isLoading } = useSWR<NotificationItem[]>(
    open && workspaceId ? ["/api/notifications", workspaceId] : null,
    fetcher
  )
  const [dismissingIds, setDismissingIds] = useState<Record<string, boolean>>(
    {}
  )
  const [isDismissingAll, setIsDismissingAll] = useState(false)

  const activeAlerts = notifications?.filter((n) => n.type === "alert") || []
  const hasActiveAlerts = activeAlerts.length > 0

  const handleDismiss = async (id: string) => {
    setDismissingIds((prev) => ({ ...prev, [id]: true }))
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "dismissed" }),
      })

      if (!response.ok) {
        throw new Error("Failed to dismiss alert")
      }

      await Promise.all([
        globalMutate("/api/notifications"),
        globalMutate("/api/alerts/counts"),
      ])
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
    } finally {
      setDismissingIds((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDismissAll = async () => {
    if (activeAlerts.length === 0) return
    setIsDismissingAll(true)
    try {
      await Promise.all(
        activeAlerts.map((alert) =>
          fetch(`/api/notifications/${alert.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "dismissed" }),
          })
        )
      )

      await Promise.all([
        globalMutate("/api/notifications"),
        globalMutate("/api/alerts/counts"),
      ])
    } catch (error) {
      console.error("Failed to dismiss all alerts:", error)
    } finally {
      setIsDismissingAll(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="md:bg-transparent md:backdrop-blur-none"
        className="gap-0 overflow-hidden rounded-xl border border-border/70 p-0 shadow-2xl sm:max-w-105 md:top-17 md:right-6 md:left-auto md:translate-x-0 md:translate-y-0"
      >
        <DialogHeader className="border-b border-border/50 p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                Notifications
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Recent workspace events and stock alerts
              </DialogDescription>
            </div>
            {hasActiveAlerts && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissAll}
                disabled={isDismissingAll}
                className="gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                {isDismissingAll ? (
                  <LoaderCircle className="h-3 w-3 animate-spin text-destructive" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Dismiss Alerts
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-87.5 flex-1 space-y-4 overflow-y-auto p-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Fetching notifications...
              </p>
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <div className="absolute inset-0 animate-pulse rounded-full border border-emerald-500/20" />
                <Bell className="h-7 w-7 animate-none" />
                <div className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-500/20 bg-background text-emerald-600">
                  <Check className="h-3.5 w-3.5 stroke-3" />
                </div>
              </div>
              <h3 className="text-sm font-semibold">All caught up!</h3>
              <p className="mt-1.5 max-w-60 text-xs leading-relaxed text-muted-foreground">
                No active stock warnings or recent workspace actions.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              if (item.type === "activity") {
                return (
                  <div
                    key={item.id}
                    className="group flex flex-col justify-between gap-2.5 rounded-xl border border-border/40 bg-muted/10 p-4 transition-all duration-200 hover:border-border/60 hover:bg-muted/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm leading-tight font-semibold text-foreground">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }

              const isDismissing = dismissingIds[item.id]
              const isCritical = item.severity === "critical"

              return (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-4 transition-all duration-200 hover:border-border/80 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 text-sm font-semibold">
                          {item.title}
                        </span>
                        <Badge
                          variant={isCritical ? "destructive" : "outline"}
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            !isCritical
                              ? "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : ""
                          }`}
                        >
                          {item.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        <span>SKU: {item.sku}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/30 pt-3">
                    <div className="text-xs text-muted-foreground">
                      Stock:{" "}
                      <span className="font-mono font-bold text-destructive">
                        {item.stock}
                      </span>{" "}
                      / Min:{" "}
                      <span className="font-mono font-semibold">
                        {item.minStock}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(item.id)}
                        disabled={isDismissing}
                        className="h-8 rounded-full px-2.5 text-xs hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isDismissing ? (
                          <LoaderCircle className="h-3 w-3 animate-spin text-destructive" />
                        ) : (
                          "Dismiss"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        onClick={() => onOpenChange(false)}
                        className="h-8 rounded-full border-border/80 bg-background/50 px-2.5 text-xs hover:bg-background"
                      >
                        <Link href="/dashboard/orders?action=create">
                          <ShoppingCart className="mr-1 h-3 w-3" />
                          Restock
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t border-border/50 bg-muted/15 p-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            onClick={() => onOpenChange(false)}
            className="gap-1 rounded-full text-xs font-semibold text-primary hover:bg-muted/40"
          >
            <Link href="/dashboard/alerts">
              Alert History
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
