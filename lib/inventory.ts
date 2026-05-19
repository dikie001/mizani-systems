import type { Prisma, Product } from "@prisma/client"

type PrismaTransactionClient = Prisma.TransactionClient
type ProductInclude = Prisma.ProductInclude

export const productExportHeaders = [
  "name",
  "sku",
  "category",

  "price",
  "stock",
  "minStock",
  "maxStock",
  "description",
] as const

export type ProductExportHeader = (typeof productExportHeaders)[number]

export type InventoryProductPayload = {
  name: string
  sku: string
  category: string

  price: number
  stock: number
  minStock: number
  maxStock: number
  description: string | null
  image: string | null
}

type ProductWithRelations = Product & {
  category: {
    id: string
    name: string
  }

  stockMovements?: Array<{
    id: string
    type: string
    quantity: number
    status: string
    notes?: string | null
    user?: {
      name: string | null
      email: string
    } | null
    createdAt: Date
  }>
  _count?: {
    orderItems: number
    stockMovements: number
  }
}

export function computeProductStatus(stock: number, minStock: number) {
  if (stock <= Math.max(0, Math.floor(minStock / 2))) {
    return "critical"
  }

  if (stock <= minStock) {
    return "low-stock" 
  }

  return "in-stock"
}

/**
 * Checks product stock levels and manages alerts.
 * Should be called within a Prisma transaction whenever stock changes.
 */
export async function updateProductAlerts(
  tx: PrismaTransactionClient,
  productId: string
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true, minStock: true, workspaceId: true },
  })

  if (!product) return

  const status = computeProductStatus(product.stock, product.minStock)

  // Find active alerts for this product
  const activeAlert = await tx.alert.findFirst({
    where: { productId, workspaceId: product.workspaceId, status: "active" },
  })

  if (status === "in-stock") {
    // If it's now in-stock, resolve any active alerts
    if (activeAlert) {
      await tx.alert.update({
        where: { id: activeAlert.id },
        data: { status: "resolved" },
      })
      await tx.notification.updateMany({
        where: { alertId: activeAlert.id },
        data: { status: "resolved" },
      })
    }
  } else {
    // It's low-stock or critical
    const severity = status === "critical" ? "critical" : "warning"

    if (activeAlert) {
      // Update severity if it changed
      if (activeAlert.severity !== severity) {
        await tx.alert.update({
          where: { id: activeAlert.id },
          data: { severity },
        })
        await tx.notification.updateMany({
          where: { alertId: activeAlert.id },
          data: {
            severity,
            description: `Stock level: ${product.stock} items left (minimum threshold is ${product.minStock}).`,
          },
        })
      }
    } else {
      // Create new alert
      const createdAlert = await tx.alert.create({
        data: {
          productId,
          severity,
          status: "active",
          workspaceId: product.workspaceId,
        },
      })

      await tx.notification.create({
        data: {
          workspaceId: product.workspaceId,
          type: "alert",
          title: product.name,
          description: `Stock level: ${product.stock} items left (minimum threshold is ${product.minStock}).`,
          severity,
          status: "unread",
          productId,
          alertId: createdAlert.id,
        },
      })
    }
  }
}

export function normalizeProductPayload(
  input: unknown
): InventoryProductPayload {
  if (!input || typeof input !== "object") {
    throw new Error("Product payload is required.")
  }

  const data = input as Record<string, unknown>
  const name = requireString(data.name, "Product name")
  const sku = requireString(data.sku, "SKU").toUpperCase()
  const category = requireString(data.category, "Category")

  const price = requireNumber(data.price, "Price")
  const stock = requireInteger(data.stock ?? 0, "Stock")
  const minStock = requireInteger(data.minStock ?? 10, "Minimum stock")
  const maxStock = requireInteger(data.maxStock ?? 100, "Maximum stock")
  const description = optionalString(data.description)
  const image = optionalString(data.image)

  if (price < 0) {
    throw new Error("Price must be 0 or greater.")
  }

  if (stock < 0) {
    throw new Error("Stock must be 0 or greater.")
  }

  if (minStock < 0) {
    throw new Error("Minimum stock must be 0 or greater.")
  }

  if (maxStock < minStock) {
    throw new Error(
      "Maximum stock must be greater than or equal to minimum stock."
    )
  }

  return {
    name,
    sku,
    category,

    price,
    stock,
    minStock,
    maxStock,
    description,
    image,
  }
}

export function formatProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    image: product.image,
    category: product.category.name,
    categoryId: product.categoryId,

    price: product.price,
    stock: product.stock,
    minStock: product.minStock,
    maxStock: product.maxStock,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    movementCount:
      product._count?.stockMovements ?? product.stockMovements?.length ?? 0,
    orderCount: product._count?.orderItems ?? 0,
    recentMovements: product.stockMovements?.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      status: movement.status,
      notes: movement.notes ?? null,
      userName: movement.user?.name ?? movement.user?.email ?? "System",
      createdAt: movement.createdAt.toISOString(),
    })),
  }
}

export function createProductCsv(products: ProductWithRelations[]) {
  const lines = [
    productExportHeaders.join(","),
    ...products.map((product) =>
      [
        product.name,
        product.sku,
        product.category.name,

        formatCsvValue(product.price),
        formatCsvValue(product.stock),
        formatCsvValue(product.minStock),
        formatCsvValue(product.maxStock),
        product.description ?? "",
      ]
        .map((value) => formatCsvValue(value))
        .join(",")
    ),
  ]

  return lines.join("\n")
}

export function parseProductImport(input: {
  content?: unknown
  format?: unknown
}) {
  const format =
    typeof input.format === "string" && input.format.trim().length > 0
      ? input.format.trim().toLowerCase()
      : "csv"

  if (format === "json") {
    return parseJsonImport(input.content)
  }

  return parseCsvImport(input.content)
}

export function productQueryInclude(includeMovements = false) {
  return {
    category: true,

    _count: {
      select: {
        orderItems: true,
        stockMovements: true,
      },
    },
    ...(includeMovements
      ? {
          stockMovements: {
            take: 100,
            orderBy: {
              createdAt: "desc" as const,
            },
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        }
      : {}),
  } satisfies ProductInclude
}

function parseCsvImport(content: unknown) {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("CSV content is required.")
  }

  const rows = splitCsvRows(content)
  if (rows.length < 2) {
    throw new Error(
      "CSV file must include a header row and at least one product row."
    )
  }

  const header = parseCsvRow(rows[0]).map((cell) => cell.trim())
  const missingHeaders = productExportHeaders.filter(
    (column) => !header.includes(column)
  )
  if (missingHeaders.length > 0) {
    throw new Error(
      `CSV is missing required columns: ${missingHeaders.join(", ")}`
    )
  }

  return rows
    .slice(1)
    .filter((row) => row.trim().length > 0)
    .map((row, rowIndex) => {
      const values = parseCsvRow(row)
      const entry = header.reduce<Record<string, string>>((acc, key, index) => {
        acc[key] = values[index] ?? ""
        return acc
      }, {})

      try {
        return normalizeProductPayload(entry)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid row."
        throw new Error(`Row ${rowIndex + 2}: ${message}`)
      }
    })
}

function parseJsonImport(content: unknown) {
  const value = typeof content === "string" ? JSON.parse(content) : content

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("JSON import must contain an array of products.")
  }

  return value.map((entry, index) => {
    try {
      return normalizeProductPayload(entry)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid entry."
      throw new Error(`Item ${index + 1}: ${message}`)
    }
  })
}

function splitCsvRows(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    const next = normalized[index + 1]

    if (character === '"') {
      current += character

      if (inQuotes && next === '"') {
        current += next
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (character === "\n" && !inQuotes) {
      rows.push(current)
      current = ""
      continue
    }

    current += character
  }

  if (current.length > 0) {
    rows.push(current)
  }

  return rows
}

function parseCsvRow(row: string) {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index]
    const next = row[index + 1]

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }

    current += character
  }

  values.push(current)
  return values
}

function formatCsvValue(value: string | number) {
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`)
  }

  return value.trim()
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requireNumber(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`)
  }

  return parsed
}

function requireInteger(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`)
  }

  return parsed
}
