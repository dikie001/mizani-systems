import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  computeProductStatus,
  formatProduct,
  normalizeProductPayload,
  productQueryInclude,
  updateProductAlerts,
} from "@/lib/inventory"
import prisma from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const product = await prisma.product.findFirst({
      where: { 
        id,
        workspaceId: session.user.workspaceId 
      },
      include: productQueryInclude(true),
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 })
    }

    return NextResponse.json(formatProduct(product))
  } catch (error) {
    console.error("Failed to fetch product:", error)
    return NextResponse.json(
      { error: "Failed to fetch product." },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const payload = normalizeProductPayload(await request.json())

    const product = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findFirst({
        where: { 
          id,
          workspaceId: session.user.workspaceId 
        },
      })

      if (!existingProduct) {
        throw new Error("Product not found.")
      }

      const conflictingProduct = await tx.product.findUnique({
        where: {
          workspaceId_sku: {
            workspaceId: existingProduct.workspaceId,
            sku: payload.sku,
          }
        },
        select: { id: true },
      })

      if (conflictingProduct && conflictingProduct.id !== id) {
        throw new Error("A product with that SKU already exists.")
      }

      const category = await tx.category.upsert({
        where: {
          workspaceId_name: {
            workspaceId: existingProduct.workspaceId,
            name: payload.category,
          }
        },
        update: {},
        create: {
          name: payload.category,
          workspaceId: existingProduct.workspaceId,
        },
      })



      const updatedProduct = await tx.product.update({
        where: { id },
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
        },
        include: productQueryInclude(true),
      })

      await updateProductAlerts(tx, id)

      const stockDelta = payload.stock - existingProduct.stock
      if (stockDelta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: id,
            userId: session.user.id,
            workspaceId: existingProduct.workspaceId,
            type: stockDelta > 0 ? "Manual Restock" : "Manual Reduction",
            quantity: stockDelta,
            status: "completed",
          },
        })
      }

      await tx.auditLog.create({
        data: {
          action: `Updated product "${updatedProduct.name}" (SKU: ${updatedProduct.sku})`,
          entity: "Product",
          type: "update",
          userId: session.user.id,
          workspaceId: existingProduct.workspaceId,
        },
      })

      await tx.notification.create({
        data: {
          workspaceId: existingProduct.workspaceId,
          type: "activity",
          title: `Updated product "${updatedProduct.name}" (SKU: ${updatedProduct.sku})`,
          description: "Catalog item updated.",
          severity: "info",
          status: "unread",
          productId: id,
        },
      })

      return updatedProduct
    })

    return NextResponse.json(formatProduct(product))
  } catch (error) {
    console.error("Failed to update product:", error)
    const message =
      error instanceof Error ? error.message : "Failed to update product."

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Product not found."
            ? 404
            : message.includes("already exists")
              ? 409
              : 400,
      },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { 
          id,
          workspaceId: session.user.workspaceId 
        },
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      })

      if (!product) {
        throw new Error("Product not found.")
      }

      if (product._count.orderItems > 0) {
        throw new Error(
          "This product is linked to existing orders and cannot be deleted.",
        )
      }

      await tx.stockMovement.deleteMany({
        where: { productId: id },
      })

      await tx.auditLog.create({
        data: {
          action: `Deleted product "${product.name}" (SKU: ${product.sku})`,
          entity: "Product",
          type: "delete",
          userId: session.user.id,
          workspaceId: product.workspaceId,
        },
      })

      await tx.notification.create({
        data: {
          workspaceId: product.workspaceId,
          type: "activity",
          title: `Deleted product "${product.name}" (SKU: ${product.sku})`,
          description: "Catalog item removed.",
          severity: "info",
          status: "unread",
        },
      })

      await tx.product.delete({
        where: { id },
      })

      return { id: product.id, name: product.name }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to delete product:", error)
    const message =
      error instanceof Error ? error.message : "Failed to delete product."

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Product not found."
            ? 404
            : message.includes("cannot be deleted")
              ? 409
              : 400,
      },
    )
  }
}
