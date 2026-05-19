"use client"

import React, { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import Link from "next/link"
import {
  LoaderCircle,
  CheckCircle2,
  ExternalLink,
  ShoppingCart,
  Trash2,
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

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface AlertItem {
  id: string
  productId: string
  name: string
  sku: string
  category: string
  stock: number
  minStock: number
  maxStock: number
  severity: "warning" | "critical" | string
  status: "active" | "dismissed" | "resolved"
  createdAt: string
}

interface NotificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationModal({ open, onOpenChange }: NotificationModalProps) {
  const { mutate: globalMutate } = useSWRConfig()
  const { data: alerts, isLoading } = useSWR<AlertItem[]>(
    open ? "/api/alerts?status=active" : null,
    fetcher
  )
  const [dismissingIds, setDismissingIds] = useState<Record<string, boolean>>({})
  const [isDismissingAll, setIsDismissingAll] = useState(false)

  const handleDismiss = async (id: string) => {
    setDismissingIds((prev) => ({ ...prev, [id]: true }))
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "dismissed" }),
      })

      if (!response.ok) {
        throw new Error("Failed to dismiss alert")
      }

      // Refresh alert lists and counts
      await Promise.all([
        globalMutate("/api/alerts?status=active"),
        globalMutate("/api/alerts/counts"),
      ])
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
    } finally {
      setDismissingIds((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDismissAll = async () => {
    if (!alerts || alerts.length === 0) return
    setIsDismissingAll(true)
    try {
      await Promise.all(
        alerts.map((alert) =>
          fetch(`/api/alerts/${alert.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "dismissed" }),
          })
        )
      )

      await Promise.all([
        globalMutate("/api/alerts?status=active"),
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
      <DialogContent className="sm:max-w-[420px] md:top-[68px] md:right-6 md:left-auto md:translate-x-0 md:translate-y-0 gap-0 p-0 overflow-hidden rounded-3xl border border-border/70 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Active Alerts
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Stock levels requiring immediate attention
              </DialogDescription>
            </div>
            {alerts && alerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissAll}
                disabled={isDismissingAll}
                className="text-xs font-medium text-muted-foreground hover:text-destructive gap-1.5 rounded-full"
              >
                {isDismissingAll ? (
                  <LoaderCircle className="h-3 w-3 animate-spin text-destructive" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Dismiss All
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[350px] p-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Fetching stock alerts...</p>
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">All Caught Up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No active stock warnings in this workspace.
                </p>
              </div>
            </div>
          ) : (
            alerts.map((alert) => {
              const isDismissing = dismissingIds[alert.id]
              const isCritical = alert.severity === "critical"

              return (
                <div
                  key={alert.id}
                  className="group flex flex-col justify-between gap-3 p-4 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/80 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm line-clamp-1">
                          {alert.name}
                        </span>
                        <Badge
                          variant={isCritical ? "destructive" : "outline"}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            !isCritical ? "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400" : ""
                          }`}
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <span>SKU: {alert.sku}</span>
                        <span>•</span>
                        <span>{alert.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/30 pt-3">
                    <div className="text-xs text-muted-foreground">
                      Stock:{" "}
                      <span className="font-bold text-destructive font-mono">
                        {alert.stock}
                      </span>{" "}
                      / Min: <span className="font-semibold font-mono">{alert.minStock}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(alert.id)}
                        disabled={isDismissing}
                        className="h-8 px-2.5 rounded-full text-xs hover:bg-destructive/10 hover:text-destructive"
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
                        className="h-8 px-2.5 rounded-full text-xs bg-background/50 hover:bg-background border-border/80"
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

        <DialogFooter className="p-4 bg-muted/15 border-t border-border/50 flex flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            Dismissed alerts are logged in the history list.
          </p>
          <Button
            variant="ghost"
            size="sm"
            asChild
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold hover:bg-muted/40 gap-1 rounded-full text-primary"
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
