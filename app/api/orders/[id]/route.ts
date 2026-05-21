import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const order = await prisma.order.findFirst({
      where: { 
        id,
        workspaceId: session.user.workspaceId 
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error("Failed to fetch order:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { status, payment, reason } = body

    const currentOrder = await prisma.order.findFirst({
      where: { 
        id,
        workspaceId: session.user.workspaceId 
      },
      include: { orderItems: true }
    })

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Special logic for cancellation: restore stock
    if (status === "cancelled" && currentOrder.status !== "cancelled") {
      await prisma.$transaction(async (tx) => {
        for (const item of currentOrder.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          })
          
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId: session.user.id as string,
              workspaceId: currentOrder.workspaceId,
              type: "Restock",
              quantity: item.quantity,
              status: "completed"
            }
          })
        }

        await tx.order.update({
          where: { id },
          data: { 
            status: "cancelled",
            cancellationReason: reason || null
          }
        })
        
        await tx.auditLog.create({
          data: {
            action: `Cancelled order ${id} and restored stock. Reason: ${reason || "Not specified"}`,
            entity: "Order",
            type: "update",
            userId: session.user.id as string,
            workspaceId: currentOrder.workspaceId
          }
        })
      })
      return NextResponse.json({ message: "Order cancelled and stock restored" })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(payment && { payment })
      }
    })

    await prisma.auditLog.create({
      data: {
        action: `Updated order ${id}: status=${status || currentOrder.status}, payment=${payment || currentOrder.payment}`,
        entity: "Order",
        type: "update",
        userId: session.user.id as string,
        workspaceId: currentOrder.workspaceId
      }
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error("Failed to update order:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const order = await prisma.order.findFirst({
      where: { 
        id,
        workspaceId: session.user.workspaceId 
      },
      select: { workspaceId: true }
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    await prisma.order.delete({
      where: { id }
    })
    
    await prisma.auditLog.create({
      data: {
        action: `Deleted order ${id}`,
        entity: "Order",
        type: "delete",
        userId: session.user.id as string,
        workspaceId: order.workspaceId
      }
    })

    return NextResponse.json({ message: "Order deleted successfully" })
  } catch (error) {
    console.error("Failed to delete order:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
