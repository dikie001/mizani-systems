import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { getPlanEntitlements, getWorkspacePlanName } from "@/lib/plans"

import { subDays, subMonths, startOfDay } from "date-fns"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = session.user.workspaceId
  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  })
  const planName = getWorkspacePlanName(subscription)
  const entitlements = getPlanEntitlements(planName)

  if (!entitlements.canUseAnalytics) {
    return NextResponse.json(
      { error: "Advanced analytics are available on the Professional plan." },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get("range") || "12m"

  let startDate = new Date()
  if (range === "7d") startDate = subDays(startDate, 7)
  else if (range === "30d") startDate = subDays(startDate, 30)
  else if (range === "3m") startDate = subMonths(startDate, 3)
  else startDate = subMonths(startDate, 12)

  startDate = startOfDay(startDate)

  try {
    // Fetch all categories for this workspace
    const categories = await prisma.category.findMany({
      where: { workspaceId },
    })

    // Fetch order items within range to calculate sales distribution
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          workspaceId,
          createdAt: { gte: startDate },
          status: { not: "cancelled" },
        },
      },
      include: {
        product: {
          select: { categoryId: true },
        },
      },
    })

    const data = categories
      .map((cat) => {
        const filteredItems = orderItems.filter(
          (item) => item.product.categoryId === cat.id
        )
        const catSales = filteredItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )
        const catItems = filteredItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        )

        return {
          category: cat.name,
          value: catSales,
          items: catItems,
        }
      })
      .filter((c) => c.items > 0 || c.value > 0)

    // If no sales data for range, fallback to stock value for visualization
    if (data.length === 0) {
      const stockData = await prisma.category.findMany({
        where: { workspaceId },
        include: {
          products: true,
        },
      })
      return NextResponse.json(
        stockData
          .map((c) => ({
            category: c.name,
            value: c.products.reduce((acc, p) => acc + p.price * p.stock, 0),
            items: c.products.reduce((acc, p) => acc + p.stock, 0),
          }))
          .filter((c) => c.items > 0 || c.value > 0)
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to fetch categories:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
