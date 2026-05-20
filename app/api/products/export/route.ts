import { auth } from "@/auth"
import { createProductCsv } from "@/lib/inventory"
import { getPlanEntitlements, getWorkspacePlanName } from "@/lib/plans"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: session.user.workspaceId },
      include: { plan: true },
    })
    const planName = getWorkspacePlanName(subscription)
    const entitlements = getPlanEntitlements(planName)

    if (!entitlements.canExportCsv) {
      return new Response(
        JSON.stringify({
          error: "CSV export is available on Basic and Professional plans.",
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    type ProductWhereInput = Prisma.ProductWhereInput

    const where: ProductWhereInput = {}

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
      }
    }

    if (status && status !== "all") {
      where.status = status
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const csv = createProductCsv(products)

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="inventory-products.csv"',
      },
    })
  } catch (error) {
    console.error("Failed to export products:", error)
    return new Response(
      JSON.stringify({ error: "Failed to export products." }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    )
  }
}
