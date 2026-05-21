"use client"

import useSWR, { useSWRConfig } from "swr"
import { useSession } from "next-auth/react"
import { formatPrice } from "@/lib/utils"
import {
  Loader2,
  Package,
  User,
  Calendar,
  CreditCard,
  Activity,
  DollarSign,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

const statusConfig: Record<string, { style: string; label: string }> = {
  delivered: {
    style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Delivered",
  },
  shipped: {
    style: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "Shipped",
  },
  processing: {
    style: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "Processing",
  },
  pending: {
    style: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Pending",
  },
  cancelled: {
    style: "bg-red-500/10 text-red-600 dark:text-red-400",
    label: "Cancelled",
  },
}

const paymentConfig: Record<string, { style: string; label: string }> = {
  paid: {
    style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Paid",
  },
  unpaid: {
    style: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Unpaid",
  },
  refunded: { style: "bg-muted text-muted-foreground", label: "Refunded" },
}

type WorkspaceSummary = {
  currency?: string | null
}

type OrderLineItem = {
  id: string
  quantity: number
  price: number
  product: {
    name: string
    sku: string
    image: string | null
  }
}

type OrderDetails = {
  id: string
  customer: string
  createdAt: string
  status: string
  payment: string
  total: number
  cancellationReason?: string | null
  orderItems: OrderLineItem[]
}

export function OrderDetailsDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { mutate: globalMutate } = useSWRConfig()
  const {
    data: order,
    isLoading,
    mutate,
  } = useSWR<OrderDetails | null>(
    workspaceId && orderId ? [`/api/orders/${orderId}`, workspaceId] : null,
    fetcher
  )
  const { data: workspace } = useSWR<WorkspaceSummary>(
    workspaceId ? ["/api/workspaces/current", workspaceId] : null,
    fetcher
  )
  const currency = workspace?.currency || "KES"

  if (!orderId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Order{" "}
            <span className="font-mono font-semibold text-primary">
              #{orderId.slice(0, 8)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Full breakdown and status of the selected order.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="animate-pulse space-y-6 pt-4">
            {/* Metadata Preview Box Skeleton */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/5 p-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <Skeleton className="h-3 w-16 bg-muted/70" />
                  <Skeleton className="h-5 w-full bg-muted/60" />
                </div>
              ))}
            </div>

            {/* Items Table Title Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 bg-muted/70" />
              <div className="rounded-lg border">
                <div className="flex justify-between border-b p-3">
                  <Skeleton className="h-3 w-20 bg-muted/50" />
                  <Skeleton className="h-3 w-12 bg-muted/50" />
                  <Skeleton className="h-3 w-12 bg-muted/50" />
                </div>
                {[...Array(3)].map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b p-3 last:border-b-0"
                  >
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4 bg-muted/70" />
                      <Skeleton className="h-3 w-1/3 bg-muted/50" />
                    </div>
                    <Skeleton className="h-4 w-8 bg-muted/60" />
                    <Skeleton className="h-4 w-12 bg-muted/60" />
                  </div>
                ))}
              </div>
            </div>

            {/* Total Skeleton */}
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-16 bg-muted/60" />
              <Skeleton className="h-5 w-24 bg-muted/80" />
            </div>
          </div>
        ) : order ? (
          <div className="space-y-6 pt-4">
            {/* Metadata Preview Box */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/5 p-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Customer
                </span>
                <p className="truncate text-sm font-semibold text-foreground">
                  {order.customer}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Order Date
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {new Date(order.createdAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Status
                </span>
                <Select
                  value={order.status}
                  onValueChange={async (val) => {
                    try {
                      const res = await fetch(`/api/orders/${order.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: val }),
                      })
                      if (!res.ok) throw new Error("Failed to update status")
                      await mutate()
                      globalMutate(
                        (key: string | readonly unknown[] | null) =>
                          typeof key === "string" &&
                          key.startsWith("/api/orders")
                      )
                    } catch (err: unknown) {
                      console.error(err)
                    }
                  }}
                >
                  <SelectTrigger className="h-7 border-border/60 bg-muted/20 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Payment
                </span>
                <Select
                  value={order.payment}
                  onValueChange={async (val) => {
                    try {
                      const res = await fetch(`/api/orders/${order.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ payment: val }),
                      })
                      if (!res.ok)
                        throw new Error("Failed to update payment status")
                      await mutate()
                      globalMutate(
                        (key: string | readonly unknown[] | null) =>
                          typeof key === "string" &&
                          key.startsWith("/api/orders")
                      )
                    } catch (err: unknown) {
                      console.error(err)
                    }
                  }}
                >
                  <SelectTrigger className="h-7 border-border/60 bg-muted/20 text-xs">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {order.status === "cancelled" && order.cancellationReason && (
              <div className="space-y-1 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                <span className="text-[10px] font-bold tracking-wider text-destructive uppercase">
                  Cancellation Reason
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground italic">
                  &quot;{order.cancellationReason}&quot;
                </p>
              </div>
            )}

            {/* Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Items Included
                </span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                  {order.orderItems.length} Products
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-xs font-medium">
                        Product
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium">
                        Qty
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium">
                        Unit
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.orderItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-primary/5">
                        <TableCell className="py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                              {item.product.image ? (
                                <img
                                  src={item.product.image}
                                  alt={item.product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs leading-tight font-semibold text-foreground">
                                {item.product.name}
                              </span>
                              <span className="font-mono text-[9px] text-muted-foreground">
                                SKU: {item.product.sku}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs">
                          {formatPrice(item.price, currency)}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs font-semibold">
                          {formatPrice(item.price * item.quantity, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Compact integrated order sum footer */}
                <div className="space-y-1.5 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      {formatPrice(order.total, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (0%)</span>
                    <span className="font-mono">
                      {formatPrice(0, currency)}
                    </span>
                  </div>
                  <div className="my-1 flex items-baseline justify-between border-t border-border/40 pt-1.5 text-foreground">
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      Total
                    </span>
                    <span className="font-mono text-base font-extrabold text-primary">
                      {formatPrice(order.total, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-12 text-center text-destructive">
            <p className="font-bold">Error loading order</p>
            <p className="text-xs text-muted-foreground">
              Please try again or contact support.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
