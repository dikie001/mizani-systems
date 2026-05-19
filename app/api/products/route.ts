import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  computeProductStatus,
  formatProduct,
  normalizeProductPayload,
  productQueryInclude,
} from "@/lib/inventory"
import { getPlanEntitlements, getWorkspacePlanName } from "@/lib/plans"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")
  const category = searchParams.get("category")
  const status = searchParams.get("status")

  type ProductWhereInput = Prisma.ProductWhereInput

  const where: ProductWhereInput = {
    workspaceId: session.user.workspaceId,
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category && category !== "all") {
    where.category = {
      name: category,
      workspaceId: session.user.workspaceId,
    }
  }

  if (status && status !== "all") {
    if (status === "low-stock") {
      where.status = { in: ["low-stock", "critical"] }
    } else {
      where.status = status
    }
  }

  try {
    const products = await prisma.product.findMany({
      where,
      include: productQueryInclude(),
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(products.map(formatProduct))
  } catch (error) {
    console.error("Failed to fetch products:", error)
    return NextResponse.json(
      { error: "Failed to fetch products." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = session.user.workspaceId

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    })
    const planName = getWorkspacePlanName(subscription)
    const entitlements = getPlanEntitlements(planName)
    const productCount = await prisma.product.count({
      where: { workspaceId },
    })

    if (
      entitlements.maxProducts !== null &&
      productCount >= entitlements.maxProducts
    ) {
      const limitLabel = planName === "trial" ? "Free Trial" : "Basic"
      const upgradeLabel = planName === "trial" ? "Basic" : "Professional"
      return NextResponse.json(
        {
          error: `${limitLabel} workspaces are limited to ${entitlements.maxProducts.toLocaleString()} SKUs. Please upgrade to ${upgradeLabel} to create more.`,
        },
        { status: 403 }
      )
    }

    const payload = normalizeProductPayload(await request.json())

    const product = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUnique({
        where: {
          workspaceId_sku: {
            workspaceId,
            sku: payload.sku,
          },
        },
        select: { id: true },
      })

      if (existingProduct) {
        throw new Error(
          "A product with that SKU already exists in this workspace."
        )
      }

      const category = await tx.category.upsert({
        where: {
          workspaceId_name: {
            workspaceId,
            name: payload.category,
          },
        },
        update: {},
        create: {
          name: payload.category,
          workspaceId,
        },
      })

      const createdProduct = await tx.product.create({
        data: {
          name: payload.name,
          sku: payload.sku,
          description: payload.description,
          image: payload.image,
          price: payload.price,
          stock: payload.stock,
          minStock: payload.minStock,
          maxStock: payload.maxStock,
          status: computeProductStatus(payload.stock, payload.minStock),
          categoryId: category.id,
          workspaceId,
        },
        include: productQueryInclude(),
      })

      if (payload.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: createdProduct.id,
            userId: session.user.id,
            workspaceId,
            type: "Initial Stock",
            quantity: payload.stock,
            status: "completed",
          },
        })
      }

      await tx.auditLog.create({
        data: {
          action: `Added product "${createdProduct.name}" (SKU: ${createdProduct.sku})`,
          entity: "Product",
          type: "create",
          userId: session.user.id,
          workspaceId,
        },
      })

      await tx.notification.create({
        data: {
          workspaceId,
          type: "activity",
          title: `Added product "${createdProduct.name}" (SKU: ${createdProduct.sku})`,
          description: "New catalog item added.",
          severity: "info",
          status: "unread",
          productId: createdProduct.id,
        },
      })

      return createdProduct
    })

    return NextResponse.json(formatProduct(product), { status: 201 })
  } catch (error) {
    console.error("Failed to create product:", error)
    const message =
      error instanceof Error ? error.message : "Failed to create product."

    return NextResponse.json(
      { error: message },
      { status: message.includes("already exists") ? 409 : 400 }
    )
  }
}
