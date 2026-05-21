"use server"

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import {
  getHighestPlanName,
  getPlanById,
  getPlanEntitlements,
} from "@/lib/plans"
import { evaluateRateLimit } from "@/lib/rate-limit"

export async function getWorkspaces() {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        workspace: {
          name: "asc",
        },
      },
    })

    return memberships.map((m) => m.workspace)
  } catch (error) {
    console.error("Failed to fetch workspaces:", error)
    return []
  }
}

export async function switchWorkspace(workspaceId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: session.user.id,
      },
    },
  })

  if (!membership) {
    throw new Error("You are not a member of this workspace")
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    })

    await prisma.user.update({
      where: { id: session.user.id },
      data: { currentWorkspaceId: workspaceId },
    })

    await prisma.auditLog.create({
      data: {
        action: `Switched to workspace: ${workspace?.name || "Unknown"}`,
        entity: "Workspace",
        type: "settings",
        userId: session.user.id,
        workspaceId,
      },
    })
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Failed to switch workspace:", error)
    return { success: false, error: "Failed to switch workspace" }
  }
}

export async function createWorkspace(data: {
  name: string
  businessType: string
  inventorySize: string
  goals: string[]
  planId?: string
}) {
  const requestHeaders = (await headers()) as {
    get(name: string): string | null
  }
  const rateLimitDecision = evaluateRateLimit({
    headers: requestHeaders,
    nextUrl: {
      pathname: "/dashboard/billing",
    },
  })

  if (!rateLimitDecision.allowed) {
    return {
      success: false,
      error: rateLimitDecision.message,
    }
  }

  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const slug = data.name
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "")

  // Ensure user exists in DB and get their correct ID
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  })

  if (!user) {
    throw new Error(
      "User record not found in database. Please sign out and sign in again."
    )
  }

  const userId = user.id

  // Check workspace limits based on plans of existing workspaces
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      },
    },
  })

  const workspaceCount = memberships.length
  const highestPlan = getHighestPlanName(
    memberships.map(
      (membership) => membership.workspace.subscription?.plan?.name
    )
  )
  const entitlements = getPlanEntitlements(highestPlan)

  if (
    entitlements.maxWorkspaces !== null &&
    workspaceCount >= entitlements.maxWorkspaces
  ) {
    if (highestPlan === "basic") {
      return {
        success: false,
        error:
          "Your Basic plan is limited to 3 workspaces. Please upgrade to Professional to create more.",
      }
    }

    return {
      success: false,
      error:
        "Your Free Trial plan is limited to 1 workspace. Please upgrade to create more.",
    }
  }

  // Strictly prefer the user's highest non-trial plan when available.
  // If the user has a paid plan (basic/pro) in any workspace, always use it.
  // Otherwise fall back to an explicit `data.planId` or trial.
  const planToUse =
    highestPlan !== "trial" ? highestPlan : data.planId || "trial"

  console.log(
    `Workspace creation plan selection: planToUse=${planToUse}, highestPlan=${highestPlan}, requestedPlan=${data.planId}`
  )
  const staticPlan = getPlanById(planToUse)

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      let dbPlan = null
      if (staticPlan) {
        dbPlan = await tx.plan.findFirst({
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
      }

      // Create the workspace
      const newWorkspace = await tx.workspace.create({
        data: {
          name: data.name.trim(),
          slug: `${slug}-${Math.random().toString(36).substring(2, 7)}`,
          businessType: data.businessType,
          inventorySize: data.inventorySize,
          goals: {
            set: data.goals || [],
          },
          selectedPlanId: dbPlan ? dbPlan.id : undefined,
        },
      })

      // Add the user as an OWNER
      await tx.workspaceMember.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: userId,
          role: "OWNER",
        },
      })

      // Check if user already has an existing workspace with a subscription
      const existingWorkspaceWithSub = await tx.workspace.findFirst({
        where: {
          members: {
            some: {
              userId: userId,
              role: "OWNER",
            },
          },
          subscriptionId: { not: null },
        },
        include: {
          subscription: true,
        },
      })

      // If user has an existing subscription, link the new workspace to it
      // This ensures all workspaces under one admin share the same billing
      if (existingWorkspaceWithSub?.subscriptionId) {
        await tx.workspace.update({
          where: { id: newWorkspace.id },
          data: { subscriptionId: existingWorkspaceWithSub.subscriptionId },
        })
      } else {
        // Only create a subscription for the first workspace (trial/free plans)
        // Paid plans must go through Paystack — the subscription is created
        // by the payment verify route once payment is confirmed.
        if (dbPlan && staticPlan?.monthlyPrice === 0) {
          const subscription = await tx.subscription.create({
            data: {
              workspaceId: newWorkspace.id,
              planId: dbPlan.id,
              status: "trial",
              paymentStatus: "paid",
              currentBillingCycleStart: new Date(),
              currentBillingCycleEnd: new Date(
                Date.now() + 14 * 24 * 60 * 60 * 1000
              ), // 14-day free trial
            },
          })

          await tx.workspace.update({
            where: { id: newWorkspace.id },
            data: { subscriptionId: subscription.id },
          })
        }
        // For paid plans: workspace is created with selectedPlanId set,
        // but no subscription record yet. OnboardingClient will call
        // /api/payments/initialize next to redirect to Paystack.
      }

      // Update the user's current workspace
      await tx.user.update({
        where: { id: userId },
        data: { currentWorkspaceId: newWorkspace.id },
      })

      // Add audit log inside transaction
      await tx.auditLog.create({
        data: {
          action: `Created workspace: ${newWorkspace.name}`,
          entity: "Workspace",
          type: "create",
          userId: userId,
          workspaceId: newWorkspace.id,
        },
      })

      await tx.notification.create({
        data: {
          workspaceId: newWorkspace.id,
          type: "activity",
          title: `Created workspace "${newWorkspace.name}"`,
          description: "New workspace initialized.",
          severity: "info",
          status: "unread",
        },
      })

      return newWorkspace
    })

    revalidatePath("/")
    return {
      success: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    }
  } catch (error) {
    console.error("Failed to create workspace:", error)
    return {
      success: false,
      error: "Failed to create workspace. Please try again.",
    }
  }
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; businessType?: string; currency?: string }
) {
  const requestHeaders = (await headers()) as {
    get(name: string): string | null
  }
  const rateLimitDecision = evaluateRateLimit({
    headers: requestHeaders,
    nextUrl: {
      pathname: "/dashboard/settings",
    },
  })

  if (!rateLimitDecision.allowed) {
    return {
      success: false,
      error: rateLimitDecision.message,
    }
  }

  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  // Verify ownership/admin role
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: session.user.id,
      },
    },
  })

  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    throw new Error("Insufficient permissions")
  }

  try {
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
    })

    await prisma.auditLog.create({
      data: {
        action: `Updated workspace: ${updated.name} (${Object.keys(data).join(", ")})`,
        entity: "Workspace",
        type: "settings",
        userId: session.user.id,
        workspaceId,
      },
    })

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Failed to update workspace:", error)
    return { success: false, error: "Failed to update workspace" }
  }
}
