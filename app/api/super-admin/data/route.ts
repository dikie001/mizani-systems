import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL

  // Extra robust checks (both email matching and DB role validation)
  const isSuperAdminEmail = !!(
    superAdminEmail &&
    session.user.email.toLowerCase() === superAdminEmail.toLowerCase()
  )
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  const isSuperAdminRole = dbUser?.role === "super_admin"

  if (!isSuperAdminEmail && !isSuperAdminRole) {
    return NextResponse.json(
      { error: "Forbidden: Super Admin access required" },
      { status: 403 }
    )
  }

  try {
    // 1. Fetch Systems KPIs / Stats
    const totalUsers = await prisma.user.count()
    const totalWorkspaces = await prisma.workspace.count()
    const totalProducts = await prisma.product.count()
    const totalOrders = await prisma.order.count()

    const sumLoginCount = await prisma.user.aggregate({
      _sum: {
        loginCount: true,
      },
    })
    const totalLogins = sumLoginCount._sum.loginCount || 0
    const totalLogs = await prisma.auditLog.count()

    const stats = {
      totalUsers,
      totalWorkspaces,
      totalProducts,
      totalOrders,
      totalLogins,
      totalLogs,
    }

    // 2. Fetch Users with memberships details
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            workspace: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name || "Unknown User",
      email: u.email,
      image: u.image,
      role: u.role,
      status: u.status,
      loginCount: u.loginCount,
      createdAt: u.createdAt.toISOString().split("T")[0],
      workspaces: u.memberships.map((m) => ({
        id: m.workspaceId,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
      })),
    }))

    // 3. Fetch Workspaces with owners, products count, orders count
    const workspaces = await prisma.workspace.findMany({
      include: {
        selectedPlan: {
          select: {
            name: true,
            displayName: true,
            monthlyPrice: true,
          },
        },
        subscription: {
          include: {
            plan: {
              select: {
                name: true,
                displayName: true,
                monthlyPrice: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        members: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            orders: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedWorkspaces = workspaces.map((w) => {
      const ownerMember =
        w.members.find((m) => m.role === "OWNER") || w.members[0]
      const billingPlan = w.subscription?.plan || w.selectedPlan || null
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        businessType: w.businessType || "Not Specified",
        inventorySize: w.inventorySize || "Not Specified",
        currency: w.currency,
        createdAt: w.createdAt.toISOString().split("T")[0],
        owner: ownerMember
          ? {
              name: ownerMember.user.name || "Unknown",
              email: ownerMember.user.email,
            }
          : null,
        planName: billingPlan?.displayName || billingPlan?.name || null,
        planKey: billingPlan?.name || null,
        subscriptionStatus: w.subscription?.status || null,
        paymentStatus: w.subscription?.paymentStatus || null,
        monthlyPrice: billingPlan?.monthlyPrice || null,
        nextBillingDate: w.subscription?.nextBillingDate?.toISOString() || null,
        productCount: w._count.products,
        orderCount: w._count.orders,
        memberCount: w._count.members,
      }
    })

    const billingPlanCounts = {
      trial: 0,
      basic: 0,
      pro: 0,
      unassigned: 0,
    }

    let activeSubscriptions = 0
    let pendingPayments = 0
    let totalMonthlyRevenue = 0

    workspaces.forEach((workspace: any) => {
      const planKey =
        workspace.subscription?.plan?.name ||
        workspace.selectedPlan?.name ||
        "unassigned"

      if (planKey === "trial" || planKey === "basic" || planKey === "pro") {
        billingPlanCounts[planKey as keyof typeof billingPlanCounts] += 1
      } else {
        billingPlanCounts.unassigned += 1
      }

      const monthlyPrice =
        workspace.subscription?.plan?.monthlyPrice ||
        workspace.selectedPlan?.monthlyPrice ||
        0
      const isActive = workspace.subscription?.status === "active"

      if (isActive) {
        activeSubscriptions += 1
        totalMonthlyRevenue += monthlyPrice
      }

      if (
        workspace.subscription?.paymentStatus === "unpaid" ||
        workspace.payments?.[0]?.status === "pending"
      ) {
        pendingPayments += 1
      }
    })

    const billingSummary = {
      totalWorkspaces: workspaces.length,
      activeSubscriptions,
      pendingPayments,
      totalMonthlyRevenue,
      planCounts: billingPlanCounts,
    }

    // 4. Fetch Global Activities (Audit Logs)
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // Rich list but bounded
    })

    const formattedLogs = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      type: l.type,
      user: {
        name: l.user?.name || "System",
        email: l.user?.email || "system@Mizani Systems.internal",
        image: l.user?.image || null,
      },
      workspaceName: l.workspace?.name || null,
      timestamp: l.createdAt.toISOString(),
      ip: l.ip || "Unknown",
    }))

    return NextResponse.json({
      stats,
      users: formattedUsers,
      workspaces: formattedWorkspaces,
      activities: formattedLogs,
      billingSummary,
      superAdminEmail,
    })
  } catch (error) {
    console.error("Failed to fetch super admin dashboard data:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
