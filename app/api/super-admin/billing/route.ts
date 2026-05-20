import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { PLANS } from "@/lib/plans"

function normalizeEmail(email?: string | null) {
  return email?.replace(/"/g, "").trim().toLowerCase() ?? ""
}

export async function GET() {
  try {
    // Verify super admin access
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
    if (session.user.role === "super_admin") {
      // continue
    } else if (
      !normalizeEmail(superAdminEmail) ||
      normalizeEmail(session.user.email) !== normalizeEmail(superAdminEmail)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const workspaces = await prisma.workspace.findMany({
      include: {
        selectedPlan: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const recentPayments = await prisma.payment.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    })

    const recentInvoices = await prisma.invoice.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    })

    const billingWorkspaces = workspaces.map((workspace: any) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      planName:
        workspace.subscription?.plan?.displayName ||
        workspace.selectedPlan?.displayName ||
        null,
      subscriptionStatus: workspace.subscription?.status || null,
      paymentStatus: workspace.subscription?.paymentStatus || null,
      monthlyPrice:
        workspace.subscription?.plan?.monthlyPrice ||
        workspace.selectedPlan?.monthlyPrice ||
        null,
      nextBillingDate:
        workspace.subscription?.nextBillingDate?.toISOString() || null,
      lastPaymentStatus: workspace.payments[0]?.status || null,
      createdAt: workspace.createdAt.toISOString(),
    }))

    const billingPlans = PLANS.map((plan) => {
      const activeSubscriptions = workspaces.filter((workspace: any) => {
        const selectedPlanName =
          workspace.subscription?.plan?.name || workspace.selectedPlan?.name
        return (
          selectedPlanName === plan.name &&
          workspace.subscription?.status === "active"
        )
      }).length

      return {
        ...plan,
        activeSubscriptions,
      }
    })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const paidThisMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "success",
        paidAt: { gte: startOfMonth },
      },
    })

    const summary = {
      totalWorkspaces: workspaces.length,
      activeSubscriptions: workspaces.filter(
        (workspace: any) => workspace.subscription?.status === "active"
      ).length,
      pendingPayments: workspaces.filter(
        (workspace: any) =>
          workspace.subscription?.paymentStatus === "unpaid" ||
          workspace.payments[0]?.status === "pending"
      ).length,
      totalMonthlyRevenue: workspaces.reduce((sum: number, workspace: any) => {
        const price =
          workspace.subscription?.plan?.monthlyPrice ||
          workspace.selectedPlan?.monthlyPrice ||
          0
        const isActive = workspace.subscription?.status === "active"
        return sum + (isActive ? price : 0)
      }, 0),
      paidThisMonth: paidThisMonth._sum.amount || 0,
    }

    return NextResponse.json({
      workspaces: billingWorkspaces,
      summary,
      plans: billingPlans,
      payments: recentPayments.map((payment) => ({
        id: payment.id,
        workspaceId: payment.workspaceId,
        workspaceName: payment.workspace.name,
        workspaceSlug: payment.workspace.slug,
        subscriptionStatus: payment.subscription?.status || null,
        planName: payment.subscription?.plan?.displayName || null,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        reference: payment.paystackReference,
        paidAt: payment.paidAt?.toISOString() || null,
        createdAt: payment.createdAt.toISOString(),
        invoiceNumber: payment.invoice?.invoiceNumber || null,
        invoiceStatus: payment.invoice?.status || null,
      })),
      invoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        workspaceId: invoice.workspaceId,
        workspaceName: invoice.workspace.name,
        workspaceSlug: invoice.workspace.slug,
        subscriptionStatus: invoice.subscription?.status || null,
        planName: invoice.subscription?.plan?.displayName || null,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString(),
        paidAt: invoice.paidAt?.toISOString() || null,
        billingPeriodStart: invoice.billingPeriodStart.toISOString(),
        billingPeriodEnd: invoice.billingPeriodEnd.toISOString(),
        description: invoice.description,
        notes: invoice.notes,
        createdAt: invoice.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Super admin billing error:", error)
    return NextResponse.json(
      { error: "Failed to fetch billing data" },
      { status: 500 }
    )
  }
}
