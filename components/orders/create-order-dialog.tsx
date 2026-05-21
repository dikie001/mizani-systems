"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Package, Plus, Search, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { useSession } from "next-auth/react"
import { formatPrice } from "@/lib/utils"

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  image?: string | null
}

interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
  image?: string | null
}

type WorkspaceSummary = {
  currency?: string | null
}

export function CreateOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { mutate } = useSWRConfig()
  const { data: workspace } = useSWR<WorkspaceSummary>(
    workspaceId ? ["/api/workspaces/current", workspaceId] : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) {
        const errorMsg = await res.json().catch(() => ({})).then((data) => data.error || "An error occurred")
        throw new Error(errorMsg)
      }
      return res.json()
    }
  )
  const currency = workspace?.currency || "KES"
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [customer, setCustomer] = useState("")
  const [search, setSearch] = useState("")
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [items, setItems] = useState<OrderItem[]>([])

  // Fetch all products when open
  useEffect(() => {
    if (open) {
      const fetchProducts = async () => {
        setProductsLoading(true)
        try {
          const res = await fetch("/api/products")
          const data = await res.json()
          setAllProducts(data)
        } catch (error) {
          console.error("Failed to fetch products:", error)
        } finally {
          setProductsLoading(false)
        }
      }
      fetchProducts()
    }
  }, [open])

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.productId === product.id)
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      )
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
          image: product.image,
        },
      ])
    }
    setSearch("")
  }

  const filteredProducts = allProducts.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.productId !== id))
  }

  const updateQuantity = (id: string, q: number) => {
    if (q < 1) return
    setItems(items.map((i) => (i.productId === id ? { ...i, quantity: q } : i)))
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleSubmit = async () => {
    if (!customer) return toast.error("Please enter customer name")
    if (items.length === 0) return toast.error("Please add at least one item")

    setLoading(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      })

      if (!res.ok) {
        const error = (await res.json()) as { error?: string }
        throw new Error(error.error || "Failed to create order")
      }

      toast.success("Order created successfully")
      mutate(
        (key: string | readonly unknown[] | null) =>
          typeof key === "string" && key.startsWith("/api/orders")
      )
      onOpenChange(false)
      setCustomer("")
      setItems([])
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create order"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Add items and customer details to create a new order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Name *</Label>
            <Input
              id="customer"
              placeholder="e.g. John Doe"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label>Add Products *</Label>
            <div className="relative mb-2">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                className="h-9 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-1 rounded-xl border bg-muted/10 p-2">
              <div className="-mx-2 -mt-2 mb-1 flex items-center justify-between rounded-t-xl border-b border-border/40 bg-muted/30 px-3 py-1.5 pb-1.5">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Product Catalog
                </span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                  {filteredProducts.length} items
                </span>
              </div>
              <div className="max-h-[140px] space-y-0.5 divide-y divide-border/20 overflow-y-auto pr-1">
                {productsLoading ? (
                  [...Array(3)].map((_, idx) => (
                    <div key={idx} className="flex w-full items-center justify-between py-1.5 px-2 animate-pulse">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-md bg-muted/70 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-3 w-28 bg-muted/70" />
                          <Skeleton className="h-2.5 w-16 bg-muted/50" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-12 bg-muted/60" />
                        <Skeleton className="h-5 w-5 bg-muted/50" />
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0
                      const isLowStock = p.stock <= 10 && p.stock > 0

                      return (
                        <button
                          type="button"
                          key={p.id}
                          disabled={isOutOfStock}
                          onClick={() => addItem(p)}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-all hover:bg-muted/50 ${isOutOfStock ? "cursor-not-allowed opacity-40" : ""} `}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-foreground">
                                {p.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>SKU: {p.sku}</span>
                                <span>•</span>
                                <span
                                  className={`font-medium ${
                                    isOutOfStock
                                      ? "text-red-500"
                                      : isLowStock
                                        ? "font-semibold text-amber-500"
                                        : "font-semibold text-emerald-500"
                                  }`}
                                >
                                  {isOutOfStock
                                    ? "Out of Stock"
                                    : `${p.stock} in stock`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-xs font-bold text-foreground">
                              {formatPrice(p.price, currency)}
                            </p>
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors">
                              <Plus className="h-3 w-3" />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                    {filteredProducts.length === 0 && (
                      <div className="py-6 text-center text-xs text-muted-foreground italic">
                        No products found matching &quot;{search}&quot;.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-medium">Product</TableHead>
                  <TableHead className="w-[100px] text-center text-xs font-medium">
                    Qty
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium">
                    Total
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-20 text-center text-xs text-muted-foreground italic"
                    >
                      No items added yet. Search for products above to start.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/60" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm leading-tight font-semibold text-foreground">
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(item.price, currency)} each
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Input
                            type="number"
                            className="h-8 w-16 text-center"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.productId,
                                parseInt(e.target.value)
                              )
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatPrice(item.price * item.quantity, currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total
              </span>
              <span className="font-mono text-base font-extrabold text-primary">
                {formatPrice(total, currency)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || items.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Order"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
