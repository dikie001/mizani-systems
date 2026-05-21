"use client"

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export default function BulkImportPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const validProducts = parsedProducts.filter((p) => p.valid)
  const invalidProducts = parsedProducts.filter((p) => !p.valid)

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

  const parseCSV = (content: string): ParsedProduct[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

    const requiredHeaders = ["name", "sku", "category", "price", "stock"]
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))

    if (missingHeaders.length > 0) {
      toast.error(`Missing required columns: ${missingHeaders.join(", ")}`)
      return []
    }

    return lines.slice(1).map((line) => {
      // Handle quoted CSV values
      const values: string[] = []
      let current = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
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
      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })

      const errors: string[] = []

      // Validate required fields
      if (!row.name?.trim()) errors.push("Name is required")
      if (!row.sku?.trim()) errors.push("SKU is required")
      if (!row.category?.trim()) errors.push("Category is required")

      const price = parseFloat(row.price)
      if (isNaN(price) || price < 0) errors.push("Invalid price")

      const stock = parseInt(row.stock, 10)
      if (isNaN(stock) || stock < 0) errors.push("Invalid stock")

      const minStock = parseInt(row.minstock || row["min stock"] || "10", 10)
      const maxStock = parseInt(row.maxstock || row["max stock"] || "100", 10)

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
    })
  }

  const parseFile = async (selectedFile: File) => {
    setParsing(true)
    setParsedProducts([])
    setImportResult(null)

    try {
      const content = await selectedFile.text()
      const fileName = selectedFile.name.toLowerCase()

      if (fileName.endsWith(".csv")) {
        const products = parseCSV(content)
        setParsedProducts(products)

        if (products.length === 0) {
          toast.error("No valid products found in the file")
        } else {
          const valid = products.filter((p) => p.valid).length
          const invalid = products.length - valid
          toast.success(
            `Parsed ${products.length} products (${valid} valid, ${invalid} with errors)`
          )
        }
      } else if (fileName.endsWith(".json")) {
        try {
          const jsonData = JSON.parse(content)
          const items = Array.isArray(jsonData) ? jsonData : jsonData.products || []
          
          const products: ParsedProduct[] = items.map((item: Record<string, unknown>) => {
            const errors: string[] = []
            
            if (!item.name) errors.push("Name is required")
            if (!item.sku) errors.push("SKU is required")
            if (!item.category) errors.push("Category is required")
            
            const price = parseFloat(String(item.price))
            if (isNaN(price) || price < 0) errors.push("Invalid price")
            
            const stock = parseInt(String(item.stock), 10)
            if (isNaN(stock) || stock < 0) errors.push("Invalid stock")

            return {
              name: String(item.name || "").trim(),
              sku: String(item.sku || "").trim().toUpperCase(),
              category: String(item.category || "").trim(),
              price: isNaN(price) ? 0 : price,
              stock: isNaN(stock) ? 0 : stock,
              minStock: parseInt(String(item.minStock || 10), 10) || 10,
              maxStock: parseInt(String(item.maxStock || 100), 10) || 100,
              description: item.description ? String(item.description).trim() : null,
              valid: errors.length === 0,
              errors,
            }
          })

          setParsedProducts(products)

          if (products.length === 0) {
            toast.error("No valid products found in the file")
          } else {
            const valid = products.filter((p) => p.valid).length
            const invalid = products.length - valid
            toast.success(
              `Parsed ${products.length} products (${valid} valid, ${invalid} with errors)`
            )
          }
        } catch {
          toast.error("Invalid JSON format")
        }
      } else {
        toast.error("Please upload a CSV or JSON file")
      }
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Failed to parse the file")
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return

    const validTypes = [".csv", ".json"]
    const isValid = validTypes.some((type) =>
      droppedFile.name.toLowerCase().endsWith(type)
    )

    if (!isValid) {
      toast.error("Please upload a CSV or JSON file")
      return
    }

    setFile(droppedFile)
    await parseFile(droppedFile)
  }, [])

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    await parseFile(selectedFile)
  }

  const handleDownloadTemplate = async () => {
    const headers = [
      "name",
      "sku",
      "category",
      "price",
      "stock",
      "minStock",
      "maxStock",
      "description",
    ]
    const sampleData = [
      [
        "Laptop Dell XPS 15",
        "LAP-DELL-001",
        "Electronics",
        "1299.99",
        "50",
        "10",
        "100",
        "High-performance laptop with 15-inch display",
      ],
      [
        "Wireless Mouse",
        "ACC-MOUSE-001",
        "Accessories",
        "29.99",
        "150",
        "25",
        "200",
        "Ergonomic wireless mouse",
      ],
      [
        "USB-C Hub",
        "ACC-HUB-001",
        "Accessories",
        "49.99",
        "75",
        "15",
        "150",
        "7-in-1 USB-C hub with HDMI",
      ],
      [
        "Office Chair",
        "FURN-CHAIR-001",
        "Furniture",
        "299.99",
        "20",
        "5",
        "50",
        "Ergonomic office chair with lumbar support",
      ],
      [
        "Standing Desk",
        "FURN-DESK-001",
        "Furniture",
        "599.99",
        "10",
        "3",
        "30",
        "Electric height-adjustable standing desk",
      ],
    ]

    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) =>
        row.map((cell) => (cell.includes(",") ? `"${cell}"` : cell)).join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "inventory-import-template.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    toast.success("Template downloaded successfully")
  }

  const handleImport = async () => {
    if (!workspaceId || validProducts.length === 0) return

    setImporting(true)
    setImportProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: validProducts.map((p) => ({
            name: p.name,
            sku: p.sku,
            category: p.category,
            price: p.price,
            stock: p.stock,
            minStock: p.minStock,
            maxStock: p.maxStock,
            description: p.description,
          })),
        }),
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Import failed")
      }

      setImportResult({
        success: true,
        message: result.message,
        created: result.created || 0,
        updated: result.updated || 0,
      })

      toast.success(result.message)
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : "Import failed",
        created: 0,
        updated: 0,
      })
      toast.error(error instanceof Error ? error.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setParsedProducts([])
    setImportResult(null)
    setImportProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/inventory")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Import</h1>
          <p className="text-sm text-muted-foreground">
            Import multiple products at once using a CSV or JSON file
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Instructions Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  1
                </span>
                <p className="text-muted-foreground">
                  Download the template file with sample data to understand the
                  required format
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  2
                </span>
                <p className="text-muted-foreground">
                  Fill in your product data following the template structure
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  3
                </span>
                <p className="text-muted-foreground">
                  Drag and drop or upload your completed file
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  4
                </span>
                <p className="text-muted-foreground">
                  Review the parsed data and fix any errors before importing
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Required Columns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["name", "sku", "category", "price", "stock"].map((col) => (
                  <Badge key={col} variant="secondary" className="text-xs">
                    {col}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Optional Columns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["minStock", "maxStock", "description"].map((col) => (
                  <Badge
                    key={col}
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    {col}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Existing products with matching SKUs will be updated
            </p>
          </CardContent>
        </Card>

        {/* Upload & Preview Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Upload & Preview
            </CardTitle>
            <CardDescription>
              Drag and drop your file or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone */}
            {!file && (
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet
                  className={cn(
                    "mb-4 h-12 w-12",
                    isDragging ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <p className="mb-1 text-sm font-medium">
                  {isDragging ? "Drop your file here" : "Drag & drop your file here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse (CSV, JSON)
                </p>
              </div>
            )}

            {/* File Selected */}
            {file && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={importing}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Parsing Indicator */}
            {parsing && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Parsing file...
                </span>
              </div>
            )}

            {/* Import Progress */}
            {importing && (
              <div className="space-y-2 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Importing products...</span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}

            {/* Import Result */}
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
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                )}
                <div>
                  <p className="font-medium">
                    {importResult.success ? "Import Complete" : "Import Failed"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {importResult.message}
                  </p>
                  {importResult.success && (
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-green-600">
                        {importResult.created} created
                      </span>
                      <span className="text-blue-600">
                        {importResult.updated} updated
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Table */}
            {parsedProducts.length > 0 && !importing && !importResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {validProducts.length} Valid
                    </Badge>
                    {invalidProducts.length > 0 && (
                      <Badge variant="outline" className="gap-1.5 text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        {invalidProducts.length} Errors
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Invalid Products Warning */}
                {invalidProducts.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                      <FileWarning className="h-4 w-4" />
                      Some products have errors and will be skipped
                    </div>
                    <div className="mt-2 space-y-1">
                      {invalidProducts.slice(0, 5).map((product, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          Row {parsedProducts.indexOf(product) + 2}:{" "}
                          {product.errors.join(", ")}
                        </p>
                      ))}
                      {invalidProducts.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ...and {invalidProducts.length - 5} more errors
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Products Preview Table */}
                <div className="max-h-[300px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedProducts.slice(0, 20).map((product, idx) => (
                        <TableRow
                          key={idx}
                          className={cn(!product.valid && "bg-amber-500/5")}
                        >
                          <TableCell>
                            {product.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.name || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {product.sku || "-"}
                          </TableCell>
                          <TableCell>{product.category || "-"}</TableCell>
                          <TableCell className="text-right">
                            {product.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.stock}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedProducts.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Showing 20 of {parsedProducts.length} products
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleClear}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={validProducts.length === 0}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import {validProducts.length} Products
                  </Button>
                </div>
              </div>
            )}

            {/* Back to inventory after success */}
            {importResult?.success && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => router.push("/dashboard/inventory")}
                  variant="outline"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Inventory
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
