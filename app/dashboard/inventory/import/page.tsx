"use client"

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  DragEvent,
  ChangeEvent,
} from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileWarning,
  Trash2,
  HelpCircle,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type ParsedProduct = {
  name: string
  sku: string
  category: string
  price: number
  stock: number
  minStock: number
  maxStock: number
  description: string | null
  valid: boolean
  errors: string[]
}

type ImportResult = {
  success: boolean
  message: string
  created: number
  updated: number
}

const COLUMN_DEFS = [
  {
    key: "name",
    label: "name",
    required: true,
    hint: "Full product name",
    sample: "Wireless Keyboard",
  },
  {
    key: "sku",
    label: "sku",
    required: true,
    hint: "Unique identifier",
    sample: "ACC-KB-001",
  },
  {
    key: "category",
    label: "category",
    required: true,
    hint: "Product category",
    sample: "Accessories",
  },
  {
    key: "price",
    label: "price",
    required: true,
    hint: "Selling price (number)",
    sample: "49.99",
  },
  {
    key: "stock",
    label: "stock",
    required: true,
    hint: "Current quantity",
    sample: "100",
  },
  {
    key: "minStock",
    label: "minStock",
    required: false,
    hint: "Low stock threshold",
    sample: "15",
  },
  {
    key: "maxStock",
    label: "maxStock",
    required: false,
    hint: "Max stock level",
    sample: "200",
  },
  {
    key: "description",
    label: "description",
    required: false,
    hint: "Optional product description",
    sample: "Compact wireless keyboard with long battery life",
  },
]

export default function BulkImportPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showAlert, setShowAlert] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const validProducts = parsedProducts.filter((p) => p.valid)
  const invalidProducts = parsedProducts.filter((p) => !p.valid)

  // Auto-dismiss alert after 5 s
  useEffect(() => {
    if (!showAlert) return
    const timer = setTimeout(() => setShowAlert(false), 5000)
    return () => clearTimeout(timer)
  }, [showAlert])

  // ─── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // ─── Validation helper ────────────────────────────────────────────────────────
  const validateRow = (row: Record<string, string>): ParsedProduct => {
    const errors: string[] = []
    if (!row.name?.trim()) errors.push("Name is required")
    if (!row.sku?.trim()) errors.push("SKU is required")
    if (!row.category?.trim()) errors.push("Category is required")
    const price = parseFloat(row.price)
    if (isNaN(price) || price < 0) errors.push("Invalid price")
    const stock = parseInt(row.stock, 10)
    if (isNaN(stock) || stock < 0) errors.push("Invalid stock")
    const minStock = parseInt(row.minstock || row.minStock || "10", 10)
    const maxStock = parseInt(row.maxstock || row.maxStock || "100", 10)
    return {
      name: row.name?.trim() || "",
      sku: row.sku?.trim().toUpperCase() || "",
      category: row.category?.trim() || "",
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock,
      minStock: isNaN(minStock) ? 10 : minStock,
      maxStock: isNaN(maxStock) ? 100 : maxStock,
      description: row.description?.trim() || null,
      valid: errors.length === 0,
      errors,
    }
  }

  // ─── CSV parser ───────────────────────────────────────────────────────────────
  const parseCSV = (content: string): ParsedProduct[] => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []
    const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const missing = ["name", "sku", "category", "price", "stock"].filter(
      (h) => !rawHeaders.includes(h)
    )
    if (missing.length > 0) {
      toast.error(`Missing required columns: ${missing.join(", ")}`)
      return []
    }
    return lines.slice(1).map((line) => {
      const values: string[] = []
      let current = ""
      let inQuotes = false
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          values.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      values.push(current.trim())
      const row: Record<string, string> = {}
      rawHeaders.forEach((h, i) => {
        row[h] = values[i] || ""
      })
      return validateRow(row)
    })
  }

  // ─── XLSX parser ──────────────────────────────────────────────────────────────
  const parseXLSXFile = (buffer: ArrayBuffer): ParsedProduct[] => {
    const wb = XLSX.read(buffer, { type: "array" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
    })
    if (rows.length === 0) return []
    const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase())
    const missing = ["name", "sku", "category", "price", "stock"].filter(
      (h) => !headers.includes(h)
    )
    if (missing.length > 0) {
      toast.error(`Missing required columns: ${missing.join(", ")}`)
      return []
    }
    return rows.map((row) => {
      const normalised: Record<string, string> = {}
      Object.entries(row).forEach(([k, v]) => {
        normalised[k.trim().toLowerCase()] = String(v ?? "")
      })
      return validateRow(normalised)
    })
  }

  // ─── File parsing dispatcher ──────────────────────────────────────────────────
  const parseFile = async (selectedFile: File) => {
    setParsing(true)
    setParsedProducts([])
    setImportResult(null)
    try {
      const name = selectedFile.name.toLowerCase()
      let products: ParsedProduct[] = []
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buffer = await selectedFile.arrayBuffer()
        products = parseXLSXFile(buffer)
      } else if (name.endsWith(".csv")) {
        const content = await selectedFile.text()
        products = parseCSV(content)
      } else {
        toast.error("Please upload an Excel (.xlsx) or CSV file")
        setParsing(false)
        return
      }
      setParsedProducts(products)
      if (products.length === 0) {
        toast.error("No products found in the file")
      } else {
        const valid = products.filter((p) => p.valid).length
        const invalid = products.length - valid
        toast.success(
          invalid > 0
            ? `${products.length} rows parsed — ${valid} valid, ${invalid} with errors`
            : `${products.length} product${products.length !== 1 ? "s" : ""} ready to import`
        )
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to parse the file")
    } finally {
      setParsing(false)
    }
  }

  // ─── Drop / file select ───────────────────────────────────────────────────────
  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    const ok = [".xlsx", ".xls", ".csv"].some((ext) =>
      dropped.name.toLowerCase().endsWith(ext)
    )
    if (!ok) {
      toast.error("Please upload an Excel (.xlsx) or CSV file")
      return
    }
    setFile(dropped)
    await parseFile(dropped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    await parseFile(selected)
  }

  // ─── Excel template download ──────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = COLUMN_DEFS.map((c) => c.label)
    const sample = COLUMN_DEFS.map((c) => c.sample)
    const ws = XLSX.utils.aoa_to_sheet([headers, sample])
    ws["!cols"] = COLUMN_DEFS.map((c) => ({
      wch: Math.max(c.label.length, c.sample.length, c.hint.length) + 4,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Products")
    XLSX.writeFile(wb, "inventory-import-template.xlsx")
    toast.success("Template downloaded")
  }

  // ─── Import ───────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!workspaceId || validProducts.length === 0) return
    setImporting(true)
    setImportProgress(0)
    const tick = setInterval(
      () => setImportProgress((p) => Math.min(p + 10, 90)),
      200
    )
    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: validProducts.map(
            ({
              name,
              sku,
              category,
              price,
              stock,
              minStock,
              maxStock,
              description,
            }) => ({
              name,
              sku,
              category,
              price,
              stock,
              minStock,
              maxStock,
              description,
            })
          ),
        }),
      })
      clearInterval(tick)
      setImportProgress(100)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Import failed")
      setImportResult({
        success: true,
        message: result.message,
        created: result.created || 0,
        updated: result.updated || 0,
      })
      toast.success(result.message)
    } catch (err) {
      clearInterval(tick)
      const msg = err instanceof Error ? err.message : "Import failed"
      setImportResult({ success: false, message: msg, created: 0, updated: 0 })
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setParsedProducts([])
    setImportResult(null)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/dashboard/inventory")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Bulk Import</h1>
          <p className="text-sm text-muted-foreground">
            Add or update many products at once from an Excel file
          </p>
        </div>
        {!showAlert && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowAlert(true)}
            title="Show instructions"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dismissible instruction alert */}
      {showAlert && (
        <Alert className="relative border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm font-semibold">
            How to import
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3 text-xs text-muted-foreground">
            <ol className="space-y-1.5 pl-0.5">
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">1.</span>
                Download the Excel template — it has one sample row and
                pre-sized columns.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">2.</span>
                Keep the header row, replace the sample row with your products.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">3.</span>
                Upload your filled file by dragging it onto the drop zone or
                clicking to browse.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-foreground">4.</span>
                Review the preview, then click Import.
              </li>
            </ol>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="font-medium text-foreground">Required:</span>
              {COLUMN_DEFS.filter((c) => c.required).map((c) => (
                <Badge key={c.key} variant="secondary" className="text-[11px]">
                  {c.label}
                </Badge>
              ))}
              <span className="ml-1 font-medium text-foreground">
                Optional:
              </span>
              {COLUMN_DEFS.filter((c) => !c.required).map((c) => (
                <Badge
                  key={c.key}
                  variant="outline"
                  className="text-[11px] text-muted-foreground"
                >
                  {c.label}
                </Badge>
              ))}
            </div>
            <p className="text-[11px]">
              Products with a matching SKU will be updated, not duplicated.
            </p>
          </AlertDescription>
          <button
            onClick={() => setShowAlert(false)}
            className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </Alert>
      )}

      {/* Main card */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* Template download row */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium">Excel Template</p>
                <p className="text-xs text-muted-foreground">
                  inventory-import-template.xlsx · 1 sample row
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </div>

          {/* Drop zone */}
          {!file && (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all",
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload
                className={cn(
                  "h-10 w-10",
                  isDragging ? "text-primary" : "text-muted-foreground/50"
                )}
              />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragging ? "Drop to upload" : "Drag & drop your file here"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  or click to browse — .xlsx, .xls, .csv supported
                </p>
              </div>
            </div>
          )}

          {/* Selected file pill */}
          {file && !importResult && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 shrink-0"
                onClick={handleClear}
                disabled={importing}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Parsing spinner */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Parsing file…
              </span>
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Importing products…
                </span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}

          {/* Result banner */}
          {importResult && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                importResult.success
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              )}
            >
              {importResult.success ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {importResult.success ? "Import complete" : "Import failed"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {importResult.message}
                </p>
                {importResult.success && (
                  <div className="mt-2 flex gap-4 text-sm">
                    <span className="text-green-700 dark:text-green-400">
                      {importResult.created} created
                    </span>
                    <span className="text-blue-700 dark:text-blue-400">
                      {importResult.updated} updated
                    </span>
                  </div>
                )}
              </div>
              {importResult.success && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/dashboard/inventory")}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  View Inventory
                </Button>
              )}
            </div>
          )}

          {/* Preview + errors */}
          {parsedProducts.length > 0 && !importing && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1.5 py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {validProducts.length} ready
                </Badge>
                {invalidProducts.length > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-0.5 text-amber-600"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {invalidProducts.length} skipped
                  </Badge>
                )}
              </div>

              {invalidProducts.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <FileWarning className="h-4 w-4 shrink-0" />
                    Rows with errors will be skipped during import
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {invalidProducts.slice(0, 6).map((p, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        Row {parsedProducts.indexOf(p) + 2}:{" "}
                        {p.errors.join(", ")}
                      </li>
                    ))}
                    {invalidProducts.length > 6 && (
                      <li className="text-xs text-muted-foreground">
                        …and {invalidProducts.length - 6} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9" />
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.slice(0, 25).map((p, idx) => (
                      <TableRow
                        key={idx}
                        className={cn(!p.valid && "bg-amber-500/5")}
                      >
                        <TableCell className="pr-0">
                          {p.valid ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.name || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.sku || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.category || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.stock}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {parsedProducts.length > 25 && (
                <p className="text-center text-xs text-muted-foreground">
                  Showing 25 of {parsedProducts.length} rows
                </p>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={validProducts.length === 0}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Import {validProducts.length} product
                  {validProducts.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
