import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { startOfDay, subDays, subMilliseconds, subMonths } from "date-fns"

type RangeKey = "7d" | "30d" | "3m" | "12m"

type RangeWindow = {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
}

function resolveRangeWindow(range: string): RangeWindow {
  const now = new Date()
  const currentEnd = now

  if (range === "7d") {
    const currentStart = startOfDay(subDays(now, 6))
    return {
      currentStart,
      currentEnd,
      previousStart: startOfDay(subDays(currentStart, 7)),
      previousEnd: subMilliseconds(currentStart, 1),
    }
  }

  if (range === "30d") {
    const currentStart = startOfDay(subDays(now, 29))
    return {
      currentStart,
      currentEnd,
      previousStart: startOfDay(subDays(currentStart, 30)),
      previousEnd: subMilliseconds(currentStart, 1),
    }
  }

  if (range === "3m") {
    const currentStart = startOfDay(subMonths(now, 3))
    return {
      currentStart,
      currentEnd,
      previousStart: startOfDay(subMonths(currentStart, 3)),
      previousEnd: subMilliseconds(currentStart, 1),
    }
  }

  const currentStart = startOfDay(subMonths(now, 12))
  return {
    currentStart,
    currentEnd,
    previousStart: startOfDay(subMonths(currentStart, 12)),
    previousEnd: subMilliseconds(currentStart, 1),
  }
}

async function getPeriodMetrics(
  workspaceId: string,
  startDate: Date,
  endDate: Date
) {
  const orderWhere = {
    workspaceId,
    status: { not: "cancelled" as const },
    createdAt: { gte: startDate, lte: endDate },
  }

  const [orderAggregate, itemAggregate] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.orderItem.aggregate({
      where: {
        order: orderWhere,
      },
      _sum: { quantity: true },
    }),
  ])

  const revenue = orderAggregate._sum.total || 0
  const orders = orderAggregate._count._all || 0
  const itemsSold = itemAggregate._sum.quantity || 0
  const aov = orders > 0 ? revenue / orders : 0

  return { revenue, orders, itemsSold, aov }
}

function getChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }

  return ((current - previous) / previous) * 100
}

function formatChange(value: number) {
  const normalized = Number.isFinite(value) ? value : 0
  const sign = normalized > 0 ? "+" : ""
  return `${sign}${normalized.toFixed(1)}%`
}

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
  const requestedRange = searchParams.get("range") || "12m"
  const range = (
    ["7d", "30d", "3m", "12m"].includes(requestedRange) ? requestedRange : "12m"
  ) as RangeKey
  const { currentStart, currentEnd, previousStart, previousEnd } =
    resolveRangeWindow(range)

  try {
    const [currentPeriod, previousPeriod] = await Promise.all([
      getPeriodMetrics(workspaceId, currentStart, currentEnd),
      getPeriodMetrics(workspaceId, previousStart, previousEnd),
    ])

    return NextResponse.json({
      revenue: {
        value: currentPeriod.revenue,
        change: formatChange(
          getChange(currentPeriod.revenue, previousPeriod.revenue)
        ),
      },
      orders: {
        value: currentPeriod.orders,
        change: formatChange(
          getChange(currentPeriod.orders, previousPeriod.orders)
        ),
      },
      itemsSold: {
        value: currentPeriod.itemsSold,
        change: formatChange(
          getChange(currentPeriod.itemsSold, previousPeriod.itemsSold)
        ),
      },
      aov: {
        value: currentPeriod.aov,
        change: formatChange(getChange(currentPeriod.aov, previousPeriod.aov)),
      },
    })
  } catch (error) {
    console.error("Failed to fetch report stats:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
