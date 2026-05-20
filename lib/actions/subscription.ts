"use server"

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getPlanById } from "@/lib/plans"

export async function updateSubscriptionPlan(planId: "basic" | "pro") {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return { success: false, error: "Unauthorized" }
  }

  const workspaceId = session.user.workspaceId
  const userId = session.user.id
  const staticPlan = getPlanById(planId)

  if (!staticPlan) {
    return { success: false, error: "Invalid plan" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Find or create Plan
      let dbPlan = await tx.plan.findFirst({
        where: { name: staticPlan.id },
      })

      if (!dbPlan) {
        dbPlan = await tx.plan.create({
          data: {
            name: staticPlan.id,
            displayName: staticPlan.displayName,
            badge: staticPlan.badge,
            description: staticPlan.description,
            monthlyPrice: staticPlan.monthlyPrice,
            features: staticPlan.features,
          },
        })
      }

      // Find existing subscription
      const existingSub = await tx.subscription.findUnique({
        where: { workspaceId },
      })

      let subscription
      // Activate the new plan immediately
      if (existingSub) {
        subscription = await tx.subscription.update({
          where: { workspaceId },
          data: {
            planId: dbPlan.id,
            status: "active",
            paymentStatus: "paid",
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cancelledAt: null,
            cancelReason: null,
          },
        })
      } else {
        subscription = await tx.subscription.create({
          data: {
            workspaceId,
            planId: dbPlan.id,
            status: "active",
            paymentStatus: "paid",
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
      }

      // Update workspace selected plan and subscription ID
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          selectedPlanId: dbPlan.id,
          subscriptionId: subscription.id,
        },
      })

      // Add audit log
      await tx.auditLog.create({
        data: {
          action: `Upgraded subscription to ${staticPlan.displayName}`,
          entity: "Subscription",
          type: "update",
          userId,
          workspaceId,
        },
      })

      // Create notification
      await tx.notification.create({
        data: {
          workspaceId,
          type: "activity",
          title: `Subscription updated`,
          description: `Plan changed to ${staticPlan.displayName}.`,
          severity: "info",
          status: "unread",
        },
      })

      return subscription
    })

    revalidatePath("/dashboard/billing")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Failed to update subscription:", error)
    return {
      success: false,
      error: "Failed to update subscription. Please try again.",
    }
  }
}

export async function cancelSubscription() {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return { success: false, error: "Unauthorized" }
  }

  const workspaceId = session.user.workspaceId
  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      const existingSub = await tx.subscription.findUnique({
        where: { workspaceId },
      })

      if (!existingSub) {
        throw new Error("No active subscription to cancel")
      }

      await tx.subscription.update({
        where: { workspaceId },
        data: {
          status: "cancelled",
          paymentStatus: "unpaid",
          cancelledAt: new Date(),
          cancelReason: "Cancelled by user via Billing Portal",
        },
      })

      // Add audit log
      await tx.auditLog.create({
        data: {
          action: "Cancelled subscription",
          entity: "Subscription",
          type: "update",
          userId,
          workspaceId,
        },
      })

      // Create notification
      await tx.notification.create({
        data: {
          workspaceId,
          type: "activity",
          title: "Subscription Cancelled",
          description:
            "Your plan has been cancelled and features are suspended.",
          severity: "warning",
          status: "unread",
        },
      })
    })

    revalidatePath("/dashboard/billing")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Failed to cancel subscription:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
    }
  }
}
