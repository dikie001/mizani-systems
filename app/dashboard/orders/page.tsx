"use client"

import { startTransition, useEffect, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import {
  Clock,
  DollarSign,
  Filter,
  MoreHorizontal,
  Package,
  Search,
  ShoppingCart,
  Truck,
  Loader2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/stat-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// New Dialogs
import { CreateOrderDialog } from "@/components/orders/create-order-dialog"
import { OrderDetailsDialog } from "@/components/orders/order-details-dialog"
import { formatPrice } from "@/lib/utils"
import { ImgWithSpinner } from "@/components/image-with-spinner"

type WorkspaceSummary = {
  currency?: string | null
}

type OrderSummary = {
  id: string
  customer: string
  productImages?: string[]
  items: number
  status: string
  payment: string
  total: number
  date: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errorMsg = await res.json().catch(() => ({})).then((data) => data.error || "An error occurred")
    throw new Error(errorMsg)
  }
  return res.json()
}

const statusConfig: Record<string, { style: string; label: string }> = {
  delivered: {
    style:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    label: "Delivered",
  },
  shipped: {
    style: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    label: "Shipped",
  },
  processing: {
    style:
      "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
    label: "Processing",
  },
  pending: {
    style:
      "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    label: "Pending",
  },
  cancelled: {
    style: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
    label: "Cancelled",
  },
}

const paymentConfig: Record<string, { style: string; label: string }> = {
  paid: {
    style:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    label: "Paid",
  },
  unpaid: {
    style:
      "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    label: "Unpaid",
  },
  refunded: {
    style: "bg-muted text-muted-foreground border-muted",
    label: "Refunded",
  },
}

export default function OrdersPage() {
  const { mutate } = useSWRConfig()
  const { data: workspace } = useSWR<WorkspaceSummary>(
    "/api/workspaces/current",
    fetcher
  )
  const currency = workspace?.currency || "KES"
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Cancel Order States
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  )
  const [cancelReason, setCancelReason] = useState("")
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("action") === "create") {
        startTransition(() => {
          setIsCreateOpen(true)
        })
        const newUrl = window.location.pathname
        window.history.replaceState({}, "", newUrl)
      }
    }
  }, [])

  let url = `/api/orders?`
  if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`
  if (statusFilter !== "all")
    url += `status=${encodeURIComponent(statusFilter)}&`

  const {
    data: orders,
    error,
    isLoading,
  } = useSWR<OrderSummary[]>(url, fetcher)

  const totalRevenue =
    orders
      ?.filter((o) => o.payment === "paid")
      .reduce((s, o) => s + o.total, 0) || 0

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancellingOrderId) return
    setIsSubmittingCancel(true)

    try {
      const res = await fetch(`/api/orders/${cancellingOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          reason: cancelReason,
        }),
      })

      if (!res.ok) throw new Error("Failed to cancel order")

      toast.success("Order cancelled and stock restored")
      setCancelConfirmOpen(false)
      setCancellingOrderId(null)
      setCancelReason("")
      mutate(
        (key: string | readonly unknown[] | null) =>
          typeof key === "string" && key.startsWith("/api/orders")
      )
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel order"
      )
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) throw new Error("Failed to update status")

      toast.success(`Order marked as ${status}`)
      mutate(
        (key: string | readonly unknown[] | null) =>
          typeof key === "string" && key.startsWith("/api/orders")
      )
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status"
      )
    }
  }

  const handleUpdatePayment = async (id: string, payment: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment }),
      })

      if (!res.ok) throw new Error("Failed to update payment status")

      toast.success(`Payment marked as ${payment}`)
      mutate(
        (key: string | readonly unknown[] | null) =>
          typeof key === "string" && key.startsWith("/api/orders")
      )
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update payment status"
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage customer orders
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          Create Order
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[
          {
            label: "Total Orders",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              orders?.length.toString()
            ),
            icon: Package,
            valColor: "text-blue-500",
            iconColor: "text-blue-500",
            description: "Full transactions",
          },
          {
            label: "Pending",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              orders?.filter((o) => o.status === "pending").length.toString()
            ),
            icon: Clock,
            valColor: "text-amber-500",
            iconColor: "text-amber-500",
            description: "Awaiting fulfillment",
          },
          {
            label: "In Transit",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              orders?.filter((o) => o.status === "shipped").length.toString()
            ),
            icon: Truck,
            valColor: "text-indigo-500",
            iconColor: "text-indigo-500",
            description: "Dispatched & active",
          },
          {
            label: "Revenue",
            value: isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              formatPrice(totalRevenue, currency)
            ),
            icon: DollarSign,
            valColor: "text-emerald-500",
            iconColor: "text-emerald-500",
            description: "Gross sales revenue",
          },
        ].map((s) => (
          <StatCard
            key={s.label}
            title={s.label}
            value={s.value}
            icon={s.icon}
            valColor={s.valColor}
            iconColor={s.iconColor}
            description={s.description}
          />
        ))}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Order History</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${orders?.length || 0} orders`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  className="h-8 w-48 pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <Filter className="mr-1.5 h-3 w-3" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/40 pb-3.5 pt-3.5 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 bg-muted/50" />
                    <Skeleton className="h-5 w-20 rounded bg-muted/60" />
                    <Skeleton className="h-4 w-28 bg-muted/70" />
                  </div>
                  <div className="flex gap-4 items-center">
                    <Skeleton className="h-4 w-12 bg-muted/60" />
                    <Skeleton className="h-4 w-16 bg-muted/60" />
                    <Skeleton className="h-5 w-20 rounded bg-muted/60" />
                    <Skeleton className="h-5 w-20 rounded bg-muted/60" />
                    <Skeleton className="h-8 w-8 rounded bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              Failed to load orders
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead className="w-[120px]">Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[120px]">Products</TableHead>
                  <TableHead className="w-[100px] text-right">Items</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[130px] pl-6">Status</TableHead>
                  <TableHead className="w-[130px] pl-6">Payment</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order, index) => (
                  <TableRow
                    key={order.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => {
                      setSelectedOrderId(order.id)
                      setIsDetailsOpen(true)
                    }}
                  >
                    <TableCell className="py-2.5 text-center font-mono text-xs text-muted-foreground/80">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-2.5 font-mono">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        {order.id.slice(0, 8)}
                      </code>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {order.customer}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center -space-x-2.5 overflow-hidden">
                        {order.productImages &&
                        order.productImages.length > 0 ? (
                          order.productImages
                            .slice(0, 3)
                            .map((imgUrl: string, idx: number) => (
                              <div
                                key={idx}
                                className="relative inline-block h-7 w-7 overflow-hidden rounded-full border border-border/40 bg-muted shadow-sm ring-2 ring-background"
                              >
                                <ImgWithSpinner
                                  src={imgUrl}
                                  alt="Product"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))
                        ) : (
                          <div className="flex inline-block h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted shadow-sm ring-2 ring-background">
                            <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
                          </div>
                        )}
                        {order.productImages &&
                          order.productImages.length > 3 && (
                            <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-muted text-[9px] font-bold text-muted-foreground shadow-sm ring-2 ring-background">
                              +{order.productImages.length - 3}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-sm">
                      {order.items}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-sm font-medium">
                      {formatPrice(order.total, currency)}
                    </TableCell>
                    <TableCell className="py-2.5 pl-6">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${statusConfig[order.status]?.style || "border-muted bg-muted text-muted-foreground"} `}
                      >
                        {statusConfig[order.status]?.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 pl-6">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${paymentConfig[order.payment]?.style || "border-muted bg-muted text-muted-foreground"} `}
                      >
                        {paymentConfig[order.payment]?.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {order.date}
                    </TableCell>
                    <TableCell
                      className="w-[50px] py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 space-y-0.5 p-1.5"
                        >
                          {/* Order Status Transitions */}
                          {order.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(order.id, "processing")
                              }
                              className="cursor-pointer"
                            >
                              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Mark Processing</span>
                            </DropdownMenuItem>
                          )}
                          {order.status === "processing" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(order.id, "shipped")
                              }
                              className="cursor-pointer"
                            >
                              <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Mark Shipped</span>
                            </DropdownMenuItem>
                          )}
                          {order.status === "shipped" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(order.id, "delivered")
                              }
                              className="cursor-pointer"
                            >
                              <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Mark Delivered</span>
                            </DropdownMenuItem>
                          )}

                          {/* Payment status transitions */}
                          {order.payment === "unpaid" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdatePayment(order.id, "paid")
                              }
                              className="cursor-pointer font-medium text-emerald-600 dark:text-emerald-400"
                            >
                              <DollarSign className="mr-2 h-4 w-4" />
                              <span>Mark Paid</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdatePayment(order.id, "unpaid")
                              }
                              className="cursor-pointer text-muted-foreground"
                            >
                              <DollarSign className="mr-2 h-4 w-4" />
                              <span>Mark Unpaid</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            disabled={order.status === "cancelled"}
                            onClick={() => {
                              setCancellingOrderId(order.id)
                              setCancelReason("")
                              setCancelConfirmOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Cancel order</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {orders?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="h-24 text-center text-muted-foreground italic"
                    >
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateOrderDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
              Cancel Order{" "}
              <span className="font-mono text-xs font-normal text-muted-foreground">
                #{cancellingOrderId?.slice(0, 8)}
              </span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This action will
              automatically restore all product stock and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-sm font-semibold">
                Reason for Cancellation *
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="Please provide a clear reason for cancelling this order..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                className="min-h-[90px] resize-none border-border bg-background text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelConfirmOpen(false)}
                disabled={isSubmittingCancel}
              >
                No, Keep Order
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmittingCancel}
              >
                {isSubmittingCancel ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Order"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
