import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { subDays, subMonths, startOfDay } from "date-fns"
import { getPlanEntitlements, getWorkspacePlanName } from "@/lib/plans"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.workspaceId) {
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
    const groupedItems = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          workspaceId,
          createdAt: { gte: startDate },
          status: { not: "cancelled" },
        },
      },
      _sum: { quantity: true },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    })

    if (groupedItems.length === 0) {
      return NextResponse.json([])
    }

    const products = await prisma.product.findMany({
      where: {
        workspaceId,
        id: { in: groupedItems.map((item) => item.productId) },
      },
      select: {
        id: true,
        name: true,
      },
    })

    const productNameById = new Map(
      products.map((product) => [product.id, product.name])
    )

    const topProducts = groupedItems.map((item) => ({
      product: productNameById.get(item.productId) || "Unknown Product",
      units: item._sum.quantity || 0,
    }))

    return NextResponse.json(topProducts)
  } catch (error) {
    console.error("Failed to fetch top products:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
