"use client"

import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import { formatPrice } from "@/lib/utils"
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Box,
  Download,
  Edit,
  Eye,
  Filter,
  Flame,
  Layers,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShoppingCart,
  ShieldAlert,
  Trash2,
  TrendingDown,
  Upload,
  Check,
  ChevronsUpDown,
  Camera,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImgWithSpinner } from "@/components/image-with-spinner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type WorkspaceSummary = {
  currency?: string | null
}

type InventoryProduct = {
  id: string
  name: string
  sku: string
  description: string | null
  image: string | null
  category: string
  categoryId: string

  price: number
  stock: number
  minStock: number
  maxStock: number
  status: "in-stock" | "low-stock" | "critical"
  createdAt: string
  updatedAt: string
  movementCount: number
  orderCount: number
  recentMovements?: InventoryMovement[]
}

type InventoryMovement = {
  id: string
  type: string
  quantity: number
  status: string
  notes?: string | null
  userName?: string
  createdAt: string
}

type InventoryMeta = {
  categories: Array<{ id: string; name: string }>
}

type NoticeState = {
  type: "success" | "error"
  message: string
} | null

type ProductFormValues = {
  name: string
  sku: string
  category: string

  price: string
  stock: string
  minStock: string
  maxStock: string
  description: string
  image: string
}

type StockAdjustmentValues = {
  productId: string
  productName: string
  type: string
  quantity: string
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed."
    )
  }

  return payload as T
}

const statusConfig: Record<
  InventoryProduct["status"],
  { label: string; className: string }
> = {
  "in-stock": {
    label: "In Stock",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "low-stock": {
    label: "Low Stock",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
}

const emptyProductForm = (): ProductFormValues => ({
  name: "",
  sku: "",
  category: "",
  price: "",
  stock: "0",
  minStock: "10",
  maxStock: "100",
  description: "",
  image: "",
})

const emptyStockAdjustment = (): StockAdjustmentValues => ({
  productId: "",
  productName: "",
  type: "Manual Adjustment",
  quantity: "",
})

function buildProductsUrl(filters: {
  searchQuery: string
  categoryFilter: string
  statusFilter: string
}) {
  const params = new URLSearchParams()

  if (filters.searchQuery) {
    params.set("search", filters.searchQuery)
  }

  if (filters.categoryFilter !== "all") {
    params.set("category", filters.categoryFilter)
  }

  if (filters.statusFilter !== "all") {
    params.set("status", filters.statusFilter)
  }

  const query = params.toString()
  return query ? `/api/products?${query}` : "/api/products"
}

function productToFormValues(product: InventoryProduct): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,

    price: String(product.price),
    stock: String(product.stock),
    minStock: String(product.minStock),
    maxStock: String(product.maxStock),
    description: product.description ?? "",
    image: product.image ?? "",
  }
}

function formatCurrency(value: number, currency: string = "KES") {
  return formatPrice(value, currency)
}

function formatCumulativePrice(value: number, currency: string = "KES") {
  if (value >= 1000000) {
    if (currency === "USD") {
      return `$${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`
    }
    return `${currency} ${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (value >= 100000) {
    if (currency === "USD") {
      return `$${Math.round(value / 1000)}k`
    }
    return `${currency} ${Math.round(value / 1000)}k`
  }
  return formatCurrency(value, currency)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function InventoryPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-muted/80" />
          <Skeleton className="h-4 w-72 bg-muted/60" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 bg-muted/70" />
          <Skeleton className="h-9 w-28 bg-muted/70" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg bg-muted/70" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4 bg-muted/60" />
                  <Skeleton className="h-6 w-12 bg-muted/80" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Card Skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 bg-muted/80" />
              <Skeleton className="h-4 w-48 bg-muted/60" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-48 bg-muted/60" />
              <Skeleton className="h-8 w-32 bg-muted/60" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between border-b pb-3.5 pt-3.5 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg bg-muted/70" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36 bg-muted/70" />
                    <Skeleton className="h-3 w-20 bg-muted/50" />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <Skeleton className="h-4 w-12 bg-muted/60" />
                  <Skeleton className="h-4 w-16 bg-muted/60" />
                  <Skeleton className="h-5 w-20 rounded bg-muted/60" />
                  <Skeleton className="h-8 w-8 rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryPageSkeleton />}>
      <InventoryPageContent />
    </Suspense>
  )
}

function InventoryPageContent() {
  const categoryListId = useId()
  const { mutate } = useSWRConfig()

  const searchParams = useSearchParams()
  const router = useRouter()
  const action = searchParams.get("action")

  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("search") ?? ""
  )
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const [notice, setNotice] = useState<NoticeState>(null)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] =
    useState<ProductFormValues>(emptyProductForm())
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [submittingForm, setSubmittingForm] = useState(false)
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState("")
  const [categoryAdding, setCategoryAdding] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentValues, setAdjustmentValues] =
    useState<StockAdjustmentValues>(emptyStockAdjustment())
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [saleValues, setSaleValues] = useState({
    productId: "",
    productName: "",
    currentStock: 0,
    quantity: "",
    reference: "Direct Sale",
    notes: "",
  })
  const [submittingSale, setSubmittingSale] = useState(false)
  const [returnToDetailsProductId, setReturnToDetailsProductId] = useState<
    string | null
  >(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyProduct, setHistoryProduct] = useState<InventoryProduct | null>(
    null
  )
  const [uploadStage, setUploadStage] = useState<
    "idle" | "compressing" | "uploading"
  >("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

  const compressImage = (
    file: File,
    targetSizeKb: number = 100
  ): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement("canvas")
          let width = img.width
          let height = img.height

          const MAX_WIDTH = 1000
          const MAX_HEIGHT = 1000
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height = Math.round((height * MAX_WIDTH) / width)
              width = MAX_WIDTH
            } else {
              width = Math.round((width * MAX_HEIGHT) / height)
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext("2d")
          if (!ctx) {
            resolve(file)
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(file)
                  return
                }

                if (blob.size > targetSizeKb * 1024 && q > 0.15) {
                  tryCompress(q - 0.15)
                } else {
                  const compressedFile = new File(
                    [blob],
                    file.name.replace(/\.[^/.]+$/, ".jpg"),
                    {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    }
                  )
                  resolve(compressedFile)
                }
              },
              "image/jpeg",
              q
            )
          }

          tryCompress(0.75)
        }
        img.onerror = () => resolve(file)
      }
      reader.onerror = () => resolve(file)
    })
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0]
    if (!originalFile) return

    setUploadStage("compressing")
    setUploadProgress(0)

    try {
      const file = await compressImage(originalFile, 100)

      setUploadStage("uploading")

      const formData = new FormData()
      formData.append("file", file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded * 100) / event.total)
          setUploadProgress(percentage)
        }
      })

      xhr.addEventListener("load", () => {
        setUploadStage("idle")
        setUploadProgress(0)
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            setFormValues((current) => ({
              ...current,
              image: data.url,
            }))
            toast.success("Product image uploaded successfully!")
          } catch (err) {
            toast.error("Failed to parse upload response.")
          }
        } else {
          toast.error("Failed to upload image. Please try again.")
        }
      })

      xhr.addEventListener("error", () => {
        setUploadStage("idle")
        setUploadProgress(0)
        toast.error("Upload encountered an error.")
      })

      xhr.open("POST", "/api/upload")
      xhr.send(formData)
    } catch (err) {
      setUploadStage("idle")
      setUploadProgress(0)
      toast.error("Image compression failed.")
    }
  }

  const handleDetailsImageChange = async (
    e: ChangeEvent<HTMLInputElement>,
    productId: string
  ) => {
    const originalFile = e.target.files?.[0]
    if (!originalFile) return

    setUploadStage("compressing")
    setUploadProgress(0)

    try {
      const file = await compressImage(originalFile, 100)
      setUploadStage("uploading")

      const formData = new FormData()
      formData.append("file", file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded * 100) / event.total)
          setUploadProgress(percentage)
        }
      })

      xhr.addEventListener("load", async () => {
        setUploadStage("idle")
        setUploadProgress(0)
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)

            const putRes = await fetch(`/api/products/${productId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...selectedProduct,
                image: data.url,
              }),
            })

            if (!putRes.ok) throw new Error("Failed to update product image.")

            toast.success("Product image changed successfully!")
            mutateSelectedProduct()
            mutateProducts()
          } catch (err) {
            toast.error("Failed to save product image.")
          }
        } else {
          toast.error("Failed to upload image. Please try again.")
        }
      })

      xhr.addEventListener("error", () => {
        setUploadStage("idle")
        setUploadProgress(0)
        toast.error("Upload encountered an error.")
      })

      xhr.open("POST", "/api/upload")
      xhr.send(formData)
    } catch (err) {
      setUploadStage("idle")
      setUploadProgress(0)
      toast.error("Image compression failed.")
    }
  }

  const [exporting, setExporting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  const beginCreate = useCallback(() => {
    setNotice(null)
    setFormMode("create")
    setEditingProductId(null)
    setFormValues(emptyProductForm())
    setCategorySearch("")
    setFormOpen(true)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      if (action === "add") {
        beginCreate()
      } else if (action === "import") {
        setImportOpen(true)
      }
    })
  }, [action, beginCreate])

  const productsUrl = buildProductsUrl({
    searchQuery,
    categoryFilter,
    statusFilter,
  })

  const {
    data: products,
    error,
    isLoading,
    mutate: mutateProducts,
  } = useSWR<InventoryProduct[]>(productsUrl, fetcher)
  const { data: meta, mutate: mutateMeta } = useSWR<InventoryMeta>(
    "/api/inventory/meta",
    fetcher
  )
  const { data: workspace } = useSWR<WorkspaceSummary>(
    "/api/workspaces/current",
    fetcher
  )
  const currency = workspace?.currency || "KES"
  const {
    data: selectedProduct,
    error: selectedProductError,
    isLoading: loadingSelectedProduct,
    mutate: mutateSelectedProduct,
  } = useSWR<InventoryProduct>(
    detailsProductId ? `/api/products/${detailsProductId}` : null,
    fetcher
  )

  const categories = meta?.categories ?? []

  const totalUnits =
    products?.reduce((total, product) => total + product.stock, 0) ?? 0
  const lowStockCount =
    products?.filter((product) => product.status === "low-stock").length ?? 0
  const criticalCount =
    products?.filter((product) => product.status === "critical").length ?? 0

  const beginEdit = (product: InventoryProduct) => {
    setNotice(null)
    setFormMode("edit")
    setEditingProductId(product.id)
    setFormValues(productToFormValues(product))
    setCategorySearch("")
    setFormOpen(true)
  }

  const beginAdjustment = (product: InventoryProduct) => {
    setNotice(null)
    setAdjustmentValues({
      productId: product.id,
      productName: product.name,
      type: "Manual Adjustment",
      quantity: "",
    })
    setAdjustmentOpen(true)
  }

  const beginRecordSale = (product: InventoryProduct) => {
    setNotice(null)
    setSaleValues({
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
      quantity: "",
      reference: "Direct Sale",
      notes: "",
    })
    setSaleOpen(true)
  }

  const handleHistoryClose = () => {
    setHistoryOpen(false)
    if (returnToDetailsProductId) {
      setDetailsProductId(returnToDetailsProductId)
      setReturnToDetailsProductId(null)
    }
  }

  const handleCreateCategory = async () => {
    if (!categorySearch.trim() || categoryAdding) return
    const name = categorySearch.trim()
    setCategoryAdding(true)
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        throw new Error("Failed to create category")
      }
      const newCat = await response.json()
      setFormValues((current) => ({ ...current, category: newCat.name }))
      await mutateMeta()
      setCategorySearch("")
      setCategoryOpen(false)
    } catch (err) {
      console.error(err)
      setNotice({
        type: "error",
        message: "Failed to save category to database.",
      })
    } finally {
      setCategoryAdding(false)
    }
  }

  const handleFormValueChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleAdjustmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setAdjustmentValues((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const refreshInventory = async () => {
    await mutateProducts()
    if (detailsProductId) {
      await mutateSelectedProduct()
    }
    mutate(
      (key: string | readonly unknown[] | null) =>
        typeof key === "string" && key.startsWith("/api/products")
    )
  }

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittingForm(true)
    setNotice(null)

    try {
      const endpoint =
        formMode === "create"
          ? "/api/products"
          : `/api/products/${editingProductId}`
      const method = formMode === "create" ? "POST" : "PUT"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...formValues,
          sku: formValues.sku.toUpperCase(),
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to save product."
        )
      }

      setFormOpen(false)
      setEditingProductId(null)
      setFormValues(emptyProductForm())
      setNotice({
        type: "success",
        message:
          formMode === "create"
            ? "Product created successfully."
            : "Product updated successfully.",
      })
      await refreshInventory()
      if (returnToDetailsProductId) {
        setDetailsProductId(returnToDetailsProductId)
        setReturnToDetailsProductId(null)
      }
    } catch (submitError) {
      setNotice({
        type: "error",
        message:
          submitError instanceof Error
            ? submitError.message
            : "Unable to save product.",
      })
    } finally {
      setSubmittingForm(false)
    }
  }

  const handleDelete = async (product: InventoryProduct) => {
    const confirmed = window.confirm(
      `Delete ${product.name}? This action cannot be undone.`
    )
    if (!confirmed) {
      return
    }

    setNotice(null)

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to delete product."
        )
      }

      if (detailsProductId === product.id) {
        setDetailsProductId(null)
      }

      setNotice({
        type: "success",
        message: `${product.name} was deleted.`,
      })
      await refreshInventory()
    } catch (deleteError) {
      setNotice({
        type: "error",
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete product.",
      })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setNotice(null)

    try {
      const response = await fetch(
        `/api/products/export${productsUrl.replace("/api/products", "")}`
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to export products."
        )
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = "inventory-products.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)

      setNotice({
        type: "success",
        message: "Inventory export is ready.",
      })
    } catch (exportError) {
      setNotice({
        type: "error",
        message:
          exportError instanceof Error
            ? exportError.message
            : "Unable to export products.",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleAdjustmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittingAdjustment(true)
    setNotice(null)

    try {
      const response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productId: adjustmentValues.productId,
          quantity: Number(adjustmentValues.quantity),
          type: adjustmentValues.type,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to adjust stock."
        )
      }

      setAdjustmentOpen(false)
      setAdjustmentValues(emptyStockAdjustment())
      setNotice({
        type: "success",
        message: "Stock adjusted successfully.",
      })
      await refreshInventory()
      if (returnToDetailsProductId) {
        setDetailsProductId(returnToDetailsProductId)
        setReturnToDetailsProductId(null)
      }
    } catch (adjustmentError) {
      setNotice({
        type: "error",
        message:
          adjustmentError instanceof Error
            ? adjustmentError.message
            : "Unable to adjust stock.",
      })
    } finally {
      setSubmittingAdjustment(false)
    }
  }

  const handleSaleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittingSale(true)
    setNotice(null)

    const quantityToDeduct = Number(saleValues.quantity)
    if (quantityToDeduct <= 0 || quantityToDeduct > saleValues.currentStock) {
      setNotice({
        type: "error",
        message: "Invalid quantity sold.",
      })
      setSubmittingSale(false)
      return
    }

    try {
      const response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productId: saleValues.productId,
          quantity: -quantityToDeduct,
          type: saleValues.reference,
          notes: saleValues.notes,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to record sale."
        )
      }

      setSaleOpen(false)
      setSaleValues({
        productId: "",
        productName: "",
        currentStock: 0,
        quantity: "",
        reference: "Direct Sale",
        notes: "",
      })
      setNotice({
        type: "success",
        message: `Recorded sale of ${quantityToDeduct} units successfully.`,
      })
      await refreshInventory()
      if (returnToDetailsProductId) {
        setDetailsProductId(returnToDetailsProductId)
        setReturnToDetailsProductId(null)
      }
    } catch (saleError) {
      setNotice({
        type: "error",
        message:
          saleError instanceof Error
            ? saleError.message
            : "Unable to record sale.",
      })
    } finally {
      setSubmittingSale(false)
    }
  }

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!importFile) return

    setImporting(true)
    setNotice(null)

    try {
      const content = await importFile.text()
      const format = importFile.name.endsWith(".json") ? "json" : "csv"

      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, format }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Import failed.")

      setImportOpen(false)
      setImportFile(null)
      setNotice({ type: "success", message: payload.message })
      await refreshInventory()
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Monitor stock levels, manage products, and track catalog updates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || isLoading}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import
          </Button>
          <Button size="sm" onClick={beginCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {notice ? (
        <div
          className={`flex animate-in items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm duration-300 fade-in slide-in-from-top-2 ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-500/5 dark:text-emerald-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-500/5 dark:text-red-400"
          }`}
        >
          <div
            className={`h-2 w-2 animate-pulse rounded-full ${notice.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {notice.message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[
          {
            label: "Critical Alerts",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              String(criticalCount)
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
              String(lowStockCount)
            ),
            icon: AlertCircle,
            valColor: "text-orange-500",
            iconColor: "text-orange-500",
            description: "Under safe threshold",
          },
          {
            label: "Total Inventory",
            value: isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              totalUnits.toLocaleString()
            ),
            icon: Box,
            valColor: "text-blue-500",
            iconColor: "text-blue-500",
            description: "Total stock count",
          },
          {
            label: "Catalog Items",
            value: isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              String(products?.length ?? 0)
            ),
            icon: Package,
            valColor: "text-emerald-500",
            iconColor: "text-emerald-500",
            description: "Total active products",
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${products?.length || 0} items`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="h-8 w-48 pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <Filter className="mr-1.5 h-3 w-3" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
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
                    <Skeleton className="h-8 w-8 rounded-lg bg-muted/70" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36 bg-muted/70" />
                      <Skeleton className="h-3 w-20 bg-muted/50" />
                    </div>
                  </div>
                  <div className="flex gap-4 items-center">
                    <Skeleton className="h-4 w-12 bg-muted/60" />
                    <Skeleton className="h-4 w-16 bg-muted/60" />
                    <Skeleton className="h-5 w-20 rounded bg-muted/60" />
                    <Skeleton className="h-8 w-8 rounded bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              {error.message || "Failed to load products."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden w-[140px] md:table-cell">
                    SKU
                  </TableHead>
                  <TableHead className="hidden w-[140px] lg:table-cell">
                    Category
                  </TableHead>
                  <TableHead className="w-[110px] text-right">Price</TableHead>
                  <TableHead className="w-[140px] text-right">
                    Stock Level
                  </TableHead>
                  <TableHead className="w-[110px] pl-6">Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product, index) => (
                  <TableRow
                    key={product.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => setDetailsProductId(product.id)}
                  >
                    <TableCell className="py-2.5 text-center font-mono text-xs text-muted-foreground/80">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted shadow-inner transition-transform group-hover:scale-105">
                          {product.image ? (
                            <ImgWithSpinner
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary/5 text-xs font-bold text-primary">
                              {product.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {product.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono md:hidden">
                              {product.sku}
                            </span>
                            <span className="opacity-30 md:hidden">•</span>
                            <span>{product.category}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden w-[140px] py-2.5 md:table-cell">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                        {product.sku}
                      </code>
                    </TableCell>
                    <TableCell className="hidden w-[140px] py-2.5 lg:table-cell">
                      <Badge
                        variant="outline"
                        className="border-muted-foreground/20 text-xs font-normal text-muted-foreground"
                      >
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[110px] py-2.5 text-right font-medium">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-muted-foreground/30 decoration-dotted underline-offset-4 transition-colors hover:text-primary">
                              {formatCumulativePrice(
                                product.price * product.stock,
                                currency
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="z-50 border !border-border !bg-popover px-3 py-2 !text-popover-foreground shadow-lg [&_[data-slot=tooltip-arrow]]:!bg-popover [&_[data-slot=tooltip-arrow]]:!fill-popover"
                          >
                            <div className="flex min-w-[170px] flex-col gap-1.5 text-xs">
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-medium !text-muted-foreground">
                                  Total Value:
                                </span>
                                <span className="font-bold !text-popover-foreground">
                                  {formatCurrency(
                                    product.price * product.stock,
                                    currency
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-1.5">
                                <span className="font-medium !text-muted-foreground">
                                  Unit Price:
                                </span>
                                <span className="font-semibold !text-popover-foreground">
                                  {formatCurrency(product.price, currency)}
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="w-[140px] py-2.5 text-right font-mono">
                      <span
                        className={`text-sm font-semibold ${product.stock <= product.minStock ? "font-bold text-red-500" : "text-foreground"}`}
                      >
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="w-[110px] py-2.5 pl-6">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                          product.status === "in-stock"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : product.status === "low-stock"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                        } `}
                      >
                        {statusConfig[product.status].label}
                      </span>
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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => beginRecordSale(product)}
                            className="cursor-pointer font-medium text-primary focus:text-primary"
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Record Sale
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => beginEdit(product)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                            Edit Catalog
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => beginAdjustment(product)}
                            className="cursor-pointer"
                          >
                            <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                            Adjust Stock
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => handleDelete(product)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Package className="h-8 w-8 opacity-20" />
                        <p>No products found matching your filters.</p>
                        <Button
                          variant="link"
                          onClick={() => {
                            setSearchQuery("")
                            setCategoryFilter("all")
                            setStatusFilter("all")
                          }}
                        >
                          Clear all filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingProductId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {formMode === "create" ? "Add New Product" : "Edit Product"}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4 pt-2" onSubmit={handleProductSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                name="name"
                value={formValues.name}
                onChange={handleFormValueChange}
                placeholder="e.g. Wireless Noise Cancelling Headphones"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="product-sku">SKU / Item Code *</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const prefix = (formValues.category || "GEN")
                        .replace(/[^a-zA-Z]/g, "")
                        .slice(0, 3)
                        .toUpperCase() || "GEN";
                      const digits = Math.floor(1000 + Math.random() * 9000);
                      setFormValues((prev) => ({
                        ...prev,
                        sku: `${prefix}-${digits}`,
                      }));
                    }}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Auto-Generate
                  </button>
                </div>
                <Input
                  id="product-sku"
                  name="sku"
                  value={formValues.sku}
                  onChange={handleFormValueChange}
                  placeholder="WCH-2024-PRO"
                  className="font-mono uppercase"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category">Category *</Label>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryOpen}
                      className="h-9 w-full justify-between font-normal"
                    >
                      {formValues.category || "Select category..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      {categories.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No categories yet.
                        </div>
                      ) : (
                        categories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setFormValues((current) => ({
                                ...current,
                                category: category.name,
                              }))
                              setCategoryOpen(false)
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                formValues.category.toLowerCase() ===
                                category.name.toLowerCase()
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {category.name}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-2 border-t bg-muted/20 p-2">
                      <Input
                        placeholder="New category name..."
                        className="h-8 w-full bg-background text-xs"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            await handleCreateCategory()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full text-xs font-semibold"
                        disabled={!categorySearch.trim() || categoryAdding}
                        onClick={handleCreateCategory}
                      >
                        {categoryAdding ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="mr-1 h-3.5 w-3.5" />
                        )}
                        Create Category
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">Unit Price ({currency}) *</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    {currency === "USD" ? "$" : currency}
                  </span>
                  <Input
                    id="product-price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={`${currency === "USD" ? "pl-7" : "pl-11"} h-9 text-sm`}
                    value={formValues.price}
                    onChange={handleFormValueChange}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-stock">Current Stock *</Label>
                <Input
                  id="product-stock"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={formValues.stock}
                  onChange={handleFormValueChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-minStock">Min Threshold *</Label>
                <Input
                  id="product-minStock"
                  name="minStock"
                  type="number"
                  min="0"
                  step="1"
                  value={formValues.minStock}
                  onChange={handleFormValueChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Product Image</Label>
              {formValues.image ? (
                <div className="group relative flex max-h-[140px] min-h-[120px] items-center justify-center overflow-hidden rounded-xl border bg-muted/20">
                  <ImgWithSpinner
                    src={formValues.image}
                    alt="Product preview"
                    className="max-h-[120px] w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setFormValues((current) => ({ ...current, image: "" }))
                      }
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="group relative flex max-h-[140px] min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/5 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-muted/15">
                  {uploadStage === "compressing" ? (
                    <div className="flex w-full flex-col items-center gap-2.5 px-4 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                      <span className="animate-pulse text-[10px] font-semibold text-indigo-500">
                        Optimizing & Compressing...
                      </span>
                      <div className="h-1 w-full overflow-hidden rounded-full border border-border/10 bg-muted">
                        <div className="h-full w-1/2 animate-[pulse_1.5s_infinite] rounded-full bg-indigo-500" />
                      </div>
                    </div>
                  ) : uploadStage === "uploading" ? (
                    <div className="flex w-full flex-col items-center gap-2.5 px-4 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-[10px] font-medium text-foreground/80">
                        Uploading to CDN... {uploadProgress}%
                      </span>
                      <div className="h-1 w-full overflow-hidden rounded-full border border-border/10 bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary shadow-inner transition-transform duration-200 group-hover:scale-110">
                        <Upload className="h-4.5 w-4.5" />
                      </div>
                      <div className="text-center">
                        <span className="text-[11px] font-semibold text-foreground transition-colors group-hover:text-primary">
                          Upload product image
                        </span>
                        <p className="mt-0.5 text-[9px] text-muted-foreground">
                          PNG, JPG, WEBP up to 5MB
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadStage !== "idle"}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-description">Description / Notes</Label>
              <Textarea
                id="product-description"
                name="description"
                value={formValues.description}
                onChange={handleFormValueChange}
                placeholder="Provide additional details about this item..."
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false)
                  if (returnToDetailsProductId) {
                    setDetailsProductId(returnToDetailsProductId)
                    setReturnToDetailsProductId(null)
                  }
                }}
                disabled={submittingForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingForm || uploadStage !== "idle"}
              >
                {submittingForm ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {formMode === "create" ? "Creating..." : "Updating..."}
                  </>
                ) : formMode === "create" ? (
                  "Create Product"
                ) : (
                  "Update Product"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detailsProductId}
        onOpenChange={(open) => !open && setDetailsProductId(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted shadow-inner">
                {uploadStage !== "idle" ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                  </div>
                ) : selectedProduct?.image ? (
                  <>
                    <ImgWithSpinner
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                      onClick={() => setZoomImageUrl(selectedProduct.image)}
                    />
                    <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-0.5 bg-black/50 text-[8px] leading-none font-bold text-white opacity-0 transition-opacity duration-150 select-none group-hover:opacity-100">
                      <Camera className="h-3 w-3" />
                      <span>Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleDetailsImageChange(e, selectedProduct.id)
                        }
                        disabled={uploadStage !== "idle"}
                        className="hidden"
                      />
                    </label>
                  </>
                ) : (
                  <label className="group relative flex h-full w-full cursor-pointer items-center justify-center bg-primary/10 text-base font-bold text-primary transition-colors hover:bg-primary/20">
                    <span>{selectedProduct?.name.charAt(0).toUpperCase()}</span>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 text-[8px] leading-none font-bold text-white opacity-0 transition-opacity duration-150 select-none group-hover:opacity-100">
                      <Camera className="h-3 w-3" />
                      <span>Add</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        selectedProduct &&
                        handleDetailsImageChange(e, selectedProduct.id)
                      }
                      disabled={uploadStage !== "idle"}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="mb-1 truncate text-2xl leading-none font-bold">
                  {selectedProduct?.name}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {selectedProduct?.sku}
                  </code>
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${
                      selectedProduct?.status === "in-stock"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : selectedProduct?.status === "low-stock"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                    } `}
                  >
                    {selectedProduct
                      ? statusConfig[selectedProduct.status].label
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {loadingSelectedProduct ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
              <p className="animate-pulse text-xs font-medium text-muted-foreground">
                Loading details...
              </p>
            </div>
          ) : selectedProductError ? (
            <div className="rounded-xl border border-red-200 bg-red-500/5 p-4 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-xs font-semibold text-red-700">
                Failed to load product details
              </p>
            </div>
          ) : selectedProduct ? (
            <div className="space-y-4 pt-2">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-muted/50 bg-muted/30 p-3 text-center">
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Category
                  </span>
                  <span className="mt-1 truncate px-1 text-xs font-semibold text-foreground">
                    {selectedProduct.category}
                  </span>
                </div>
                <div className="flex flex-col justify-center border-x border-border/50">
                  <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Unit Price
                  </span>
                  <span className="mt-1 text-xs font-bold text-primary">
                    {formatCurrency(selectedProduct.price, currency)}
                  </span>
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Stock Level
                  </span>
                  <span
                    className={`mt-1 text-xs font-bold ${selectedProduct.stock <= selectedProduct.minStock ? "font-bold text-red-500" : "text-foreground"}`}
                  >
                    {selectedProduct.stock}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div className="rounded-xl border bg-card/30 p-3">
                  <h4 className="mb-1 text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Description
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {/* Activity Log */}
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b bg-muted/20 px-3.5 py-2">
                  <span className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    Activity Log
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/60">
                    {selectedProduct.movementCount} total movements
                  </span>
                </div>
                <div className="max-h-[130px] divide-y overflow-auto">
                  {selectedProduct.recentMovements?.length ? (
                    selectedProduct.recentMovements
                      .slice(0, 3)
                      .map((movement) => (
                        <div
                          key={movement.id}
                          className="flex items-center justify-between px-3.5 py-2 transition-colors hover:bg-muted/10"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${movement.quantity > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"} `}
                            >
                              {movement.quantity > 0 ? (
                                <Plus className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 rotate-180" />
                              )}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold">
                                {movement.type}
                              </p>
                              <p className="text-[9px] text-muted-foreground/75">
                                {formatDate(movement.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-mono text-xs font-bold ${movement.quantity > 0 ? "text-emerald-600" : "text-red-600"}`}
                            >
                              {movement.quantity > 0 ? "+" : ""}
                              {movement.quantity}
                            </p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="py-6 text-center text-[11px] text-muted-foreground">
                      No recent stock movements recorded.
                    </div>
                  )}
                </div>
                {selectedProduct.recentMovements &&
                  selectedProduct.recentMovements.length > 0 && (
                    <div className="border-t bg-muted/5 px-3.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryProduct(selectedProduct)
                          setReturnToDetailsProductId(selectedProduct.id)
                          setDetailsProductId(null)
                          setHistoryPage(1)
                          setHistoryOpen(true)
                        }}
                        className="inline-flex items-center justify-center gap-1 text-[10px] font-bold tracking-wider text-primary uppercase transition-colors hover:text-primary/80"
                      >
                        View Full History ({selectedProduct.movementCount})
                      </button>
                    </div>
                  )}
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReturnToDetailsProductId(selectedProduct.id)
                    setDetailsProductId(null)
                    beginAdjustment(selectedProduct)
                  }}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                  Adjust Stock
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReturnToDetailsProductId(selectedProduct.id)
                    setDetailsProductId(null)
                    beginEdit(selectedProduct)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                  Edit Catalog
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setReturnToDetailsProductId(selectedProduct.id)
                    setDetailsProductId(null)
                    beginRecordSale(selectedProduct)
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Record Sale
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!zoomImageUrl}
        onOpenChange={(open) => !open && setZoomImageUrl(null)}
      >
        <DialogContent className="flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-background p-2 shadow-2xl sm:max-w-[420px]">
          {zoomImageUrl && (
            <div className="relative flex max-h-[360px] min-h-[260px] w-full items-center justify-center overflow-hidden rounded-xl bg-muted/10 p-1">
              <ImgWithSpinner
                src={zoomImageUrl}
                alt="Product zoomed preview"
                className="max-h-[340px] w-full rounded-lg object-contain"
              />
              <button
                type="button"
                className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                onClick={() => setZoomImageUrl(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={saleOpen}
        onOpenChange={(open) => {
          setSaleOpen(open)
          if (!open) {
            setSaleValues({
              productId: "",
              productName: "",
              currentStock: 0,
              quantity: "",
              reference: "Direct Sale",
              notes: "",
            })
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold">
              Record Product Sale
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Deduct inventory levels immediately by logging a customer sale.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 pt-2" onSubmit={handleSaleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-product-name">Reference Product</Label>
                <Input
                  id="sale-product-name"
                  value={saleValues.productName}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-current-stock">Available Stock</Label>
                <Input
                  id="sale-current-stock"
                  value={saleValues.currentStock}
                  disabled
                  className="bg-muted/50 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-quantity">Quantity Sold *</Label>
                <Input
                  id="sale-quantity"
                  type="number"
                  min="1"
                  max={saleValues.currentStock}
                  step="1"
                  value={saleValues.quantity}
                  onChange={(e) =>
                    setSaleValues((current) => ({
                      ...current,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="e.g. 5"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-reference">Sale Reference / Channel</Label>
                <Select
                  value={saleValues.reference}
                  onValueChange={(value) =>
                    setSaleValues((current) => ({
                      ...current,
                      reference: value,
                    }))
                  }
                >
                  <SelectTrigger id="sale-reference" className="w-full">
                    <SelectValue placeholder="Select sale channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direct Sale">
                      Direct Sale (POS)
                    </SelectItem>
                    <SelectItem value="Online Order">Online Order</SelectItem>
                    <SelectItem value="Retail Sale">
                      Retail / Counter Sale
                    </SelectItem>
                    <SelectItem value="Wholesale">
                      Wholesale Distribution
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-notes">Notes / Reference Details</Label>
              <Textarea
                id="sale-notes"
                value={saleValues.notes}
                onChange={(e) =>
                  setSaleValues((current) => ({
                    ...current,
                    notes: e.target.value,
                  }))
                }
                placeholder="e.g. Invoice #1024, customer cash purchase, special delivery..."
                className="min-h-[60px] resize-none"
              />
            </div>

            {saleValues.quantity &&
              Number(saleValues.quantity) > saleValues.currentStock && (
                <p className="mt-1 text-xs font-semibold text-red-500">
                  Warning: Cannot sell more than available stock (
                  {saleValues.currentStock} units).
                </p>
              )}

            <div className="flex justify-end gap-3 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSaleOpen(false)
                  if (returnToDetailsProductId) {
                    setDetailsProductId(returnToDetailsProductId)
                    setReturnToDetailsProductId(null)
                  }
                }}
                disabled={submittingSale}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submittingSale ||
                  !saleValues.quantity ||
                  Number(saleValues.quantity) <= 0 ||
                  Number(saleValues.quantity) > saleValues.currentStock
                }
              >
                {submittingSale ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Confirm Sale
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustmentOpen}
        onOpenChange={(open) => {
          setAdjustmentOpen(open)
          if (!open) {
            setAdjustmentValues(emptyStockAdjustment())
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold">
              Stock Adjustment
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Modify inventory levels manually. Use positive for additions,
              negative for reductions.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 pt-2" onSubmit={handleAdjustmentSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-product-name">Selected Item</Label>
                <Input
                  id="adjustment-product-name"
                  value={adjustmentValues.productName}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adjustment-type">Reason for Adjustment</Label>
                <Select
                  value={adjustmentValues.type}
                  onValueChange={(value) => {
                    if (value === "Sale") {
                      setAdjustmentOpen(false)
                      const product = products?.find(
                        (p) => p.id === adjustmentValues.productId
                      )
                      if (product) {
                        beginRecordSale(product)
                      }
                    } else if (value === "Order") {
                      setAdjustmentOpen(false)
                      router.push("/dashboard/orders?action=create")
                    } else {
                      setAdjustmentValues((current) => ({
                        ...current,
                        type: value,
                      }))
                    }
                  }}
                >
                  <SelectTrigger id="adjustment-type" className="w-full">
                    <SelectValue placeholder="Select movement type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual Adjustment">
                      Manual Adjustment
                    </SelectItem>
                    <SelectItem value="Restock">
                      Restock / Procurement
                    </SelectItem>
                    <SelectItem value="Sale">Direct Sale (POS)</SelectItem>
                    <SelectItem value="Order">Customer Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adjustment-quantity">Quantity Variation *</Label>
              <Input
                id="adjustment-quantity"
                name="quantity"
                type="number"
                step="1"
                value={adjustmentValues.quantity}
                onChange={handleAdjustmentChange}
                placeholder="e.g. 25 or -4"
                required
              />
              <p className="mt-1 text-[10px] leading-normal text-muted-foreground">
                The final stock will be recalculated immediately after
                application.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAdjustmentOpen(false)
                  if (returnToDetailsProductId) {
                    setDetailsProductId(returnToDetailsProductId)
                    setReturnToDetailsProductId(null)
                  }
                }}
                disabled={submittingAdjustment}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAdjustment}>
                {submittingAdjustment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adjusting...
                  </>
                ) : (
                  <>
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Commit Adjustment
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleHistoryClose()
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold">
              Transaction History
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Complete stock history and operator logs for{" "}
              <span className="font-semibold text-foreground">
                {historyProduct?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {historyProduct && (
            <div className="space-y-4 pt-2">
              {/* Table / List */}
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="grid grid-cols-1 divide-y divide-border/60">
                  {(() => {
                    const movements = historyProduct.recentMovements ?? []
                    const totalMovements = movements.length
                    const ITEMS_PER_PAGE = 5
                    const totalPages =
                      Math.ceil(totalMovements / ITEMS_PER_PAGE) || 1

                    // Clamp page
                    const currentPage = Math.min(historyPage, totalPages)
                    const paginated = movements.slice(
                      (currentPage - 1) * ITEMS_PER_PAGE,
                      currentPage * ITEMS_PER_PAGE
                    )

                    if (paginated.length === 0) {
                      return (
                        <div className="py-12 text-center text-sm font-medium text-muted-foreground">
                          No transaction history available.
                        </div>
                      )
                    }

                    return (
                      <>
                        <div className="max-h-[350px] divide-y divide-border/50 overflow-auto">
                          {paginated.map((movement) => (
                            <div
                              key={movement.id}
                              className="space-y-1.5 p-3.5 transition-colors hover:bg-muted/10"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${movement.quantity > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"} `}
                                  >
                                    {movement.quantity > 0 ? (
                                      <Plus className="h-4.5 w-4.5" />
                                    ) : (
                                      <ArrowUpDown className="h-4.5 w-4.5 rotate-180" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-foreground">
                                        {movement.type}
                                      </p>
                                      <span className="rounded-full border border-muted-foreground/15 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        {movement.userName}
                                      </span>
                                    </div>
                                    <p className="text-[10px] font-medium text-muted-foreground/80">
                                      {formatDate(movement.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={`font-mono text-sm font-bold ${movement.quantity > 0 ? "text-emerald-600" : "text-red-600"}`}
                                  >
                                    {movement.quantity > 0 ? "+" : ""}
                                    {movement.quantity} units
                                  </p>
                                  <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                                    {movement.status}
                                  </p>
                                </div>
                              </div>

                              {movement.notes && (
                                <div className="mt-1 rounded-lg border border-muted/50 bg-muted/30 p-2">
                                  <p className="text-[10px] leading-normal text-muted-foreground">
                                    <span className="font-semibold text-foreground/75">
                                      Notes:{" "}
                                    </span>
                                    {movement.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Pagination Bar */}
                        <div className="flex items-center justify-between border-t bg-muted/20 px-3.5 py-2.5">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                            {Math.min(
                              currentPage * ITEMS_PER_PAGE,
                              totalMovements
                            )}{" "}
                            of {totalMovements} entries
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[10px] font-bold"
                              onClick={() =>
                                setHistoryPage((p) => Math.max(1, p - 1))
                              }
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="px-1 text-[10px] font-bold text-muted-foreground">
                              {currentPage} / {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[10px] font-bold"
                              onClick={() =>
                                setHistoryPage((p) =>
                                  Math.min(totalPages, p + 1)
                                )
                              }
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleHistoryClose}
                >
                  Back to Product
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Bulk Import Products
            </DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file to bulk create or update your inventory
              catalog.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-6 pt-4">
            <div className="grid gap-2">
              <Label
                htmlFor="import-file"
                className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
              >
                Inventory File (CSV or JSON)
              </Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="h-12 cursor-pointer border-2 border-dashed bg-muted/20 pt-2.5 transition-all hover:bg-muted/30"
                required
              />
              <p className="text-[10px] text-muted-foreground italic">
                Tip: SKUs are used to match existing products for updates.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={importing || !importFile}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Start Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
