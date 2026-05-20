import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { paystack } from "@/lib/paystack"
import { formatKES, getPlanById } from "@/lib/plans"

function buildPaymentSummary(params: {
  currentPlanDisplayName: string
  currentPrice: number
  targetPlanDisplayName: string
  targetPrice: number
}) {
  const {
    currentPlanDisplayName,
    currentPrice,
    targetPlanDisplayName,
    targetPrice,
  } = params

  if (currentPrice === 0 && targetPrice > 0) {
    return {
      action: "checkout" as const,
      amount: targetPrice,
      amountLabel: formatKES(targetPrice),
      headline: `You're being taken to Paystack to finish your ${targetPlanDisplayName} subscription.`,
      detail: `This is your first payment for the ${targetPlanDisplayName} plan because your current plan is ${currentPlanDisplayName}.`,
    }
  }

  if (targetPrice > currentPrice) {
    const topUpAmount = targetPrice - currentPrice
    return {
      action: "upgrade" as const,
      amount: topUpAmount,
      amountLabel: formatKES(topUpAmount),
      headline: `You are upgrading from ${currentPlanDisplayName} to ${targetPlanDisplayName}.`,
      detail: `You need to pay an additional ${formatKES(topUpAmount)} now. That amount is the difference between ${formatKES(currentPrice)} and ${formatKES(targetPrice)}.`,
    }
  }

  if (targetPrice < currentPrice) {
    const refundAmount = currentPrice - targetPrice
    return {
      action: "downgrade" as const,
      amount: refundAmount,
      amountLabel: formatKES(refundAmount),
      headline: `You are downgrading from ${currentPlanDisplayName} to ${targetPlanDisplayName}.`,
      detail: `Your estimated refund is ${formatKES(refundAmount)}. The price difference is the gap between ${formatKES(currentPrice)} and ${formatKES(targetPrice)}.`,
    }
  }

  return {
    action: "no_change" as const,
    amount: 0,
    amountLabel: formatKES(0),
    headline: `You are staying on ${targetPlanDisplayName}.`,
    detail: `No payment or refund is required because both plans cost ${formatKES(targetPrice)}.`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, workspaceId } = await request.json()

    if (!planId || !workspaceId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Look up plan from static config (planId is the plan name: trial/basic/pro)
    const staticPlan = getPlanById(planId)
    if (!staticPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Get the workspace and current subscription/plan info
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        selectedPlan: true,
        subscription: { include: { plan: true } },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      )
    }

    // If it's a free/trial plan, skip Paystack
    if (staticPlan.monthlyPrice === 0) {
      // Try to find or create a DB plan record for trial
      let dbPlan = await prisma.plan.findFirst({
        where: { name: staticPlan.id },
      })

      if (!dbPlan) {
        dbPlan = await prisma.plan.create({
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

      // Create or update subscription directly
      const existingSub = await prisma.subscription.findUnique({
        where: { workspaceId },
      })

      let subscription
      if (existingSub) {
        subscription = await prisma.subscription.update({
          where: { workspaceId },
          data: {
            planId: dbPlan.id,
            status: "active",
            paymentStatus: "paid",
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000
            ), // 14-day trial
          },
        })
      } else {
        subscription = await prisma.subscription.create({
          data: {
            workspaceId,
            planId: dbPlan.id,
            status: "active",
            paymentStatus: "paid",
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000
            ),
          },
        })
      }

      // Update workspace with plan and subscription
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          subscriptionId: subscription.id,
          selectedPlanId: dbPlan.id,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Free trial activated",
        subscription,
      })
    }

    // Paid plan — ensure DB plan record exists
    let dbPlan = await prisma.plan.findFirst({
      where: { name: staticPlan.id },
    })

    if (!dbPlan) {
      dbPlan = await prisma.plan.create({
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

    // Tag the workspace with the selected plan so verify can find it
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { selectedPlanId: dbPlan.id },
    })

    // Only look at the active subscription to determine the current plan.
    // `workspace.selectedPlan` is what the user wants to BUY, not what they
    // currently have — using it as currentPrice caused every new signup to
    // appear as a "no_change" and silently skip Paystack.
    const currentSubscription = workspace.subscription
    const currentMonthlyPrice = currentSubscription?.plan?.monthlyPrice ?? 0
    const currentPlanDisplayName =
      currentSubscription?.plan?.displayName ?? "Free Trial"
    const paymentSummary = buildPaymentSummary({
      currentPlanDisplayName,
      currentPrice: currentMonthlyPrice,
      targetPlanDisplayName: staticPlan.displayName,
      targetPrice: staticPlan.monthlyPrice,
    })

    // If no payment is required, apply plan immediately.
    if (paymentSummary.action === "downgrade" || paymentSummary.action === "no_change") {
      // Create or update subscription immediately without charging
      const existingSub = await prisma.subscription.findUnique({
        where: { workspaceId },
      })

      let subscription
      if (existingSub) {
        subscription = await prisma.subscription.update({
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
        subscription = await prisma.subscription.create({
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

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { subscriptionId: subscription.id },
      })

      return NextResponse.json({
        success: true,
        message: "Plan updated — no payment required",
        subscription,
        paymentSummary,
      })
    }

    // Initialize payment with Paystack for the amount due now
    const reference = `${workspaceId.slice(0, 8)}-${Date.now()}`
    // Paystack amounts are in the smallest currency unit (kobo/cents)
    const amountInSmallestUnit = Math.round(paymentSummary.amount * 100)

    const callbackUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/payments/success`

    const paystackResponse = await paystack.initializePayment({
      email: session.user.email,
      amount: amountInSmallestUnit,
      reference,
      callback_url: callbackUrl,
      metadata: {
        workspaceId,
        planId: staticPlan.id,
        planName: staticPlan.displayName,
        topUp: paymentSummary.action === "upgrade",
        topUpAmount:
          paymentSummary.action === "upgrade" ? paymentSummary.amount : 0,
        checkoutAmount:
          paymentSummary.action === "checkout" ? paymentSummary.amount : 0,
        custom_fields: [
          {
            display_name: "Workspace",
            variable_name: "workspace_id",
            value: workspaceId,
          },
          {
            display_name: "Plan",
            variable_name: "plan_name",
            value: staticPlan.displayName,
          },
        ],
      },
    })

    if (!paystackResponse.status) {
      return NextResponse.json(
        { error: paystackResponse.message || "Failed to initialize payment" },
        { status: 400 }
      )
    }

    // Store payment intent in database
    const payment = await prisma.payment.create({
      data: {
        workspaceId,
        amount: paymentSummary.amount,
        status: "pending",
        paystackReference: reference,
        paystackAccessCode: paystackResponse.data?.access_code,
      },
    })

    return NextResponse.json({
      success: true,
      authorizationUrl: paystackResponse.data?.authorization_url,
      accessCode: paystackResponse.data?.access_code,
      reference,
      paymentId: payment.id,
      paymentSummary,
    })
  } catch (error) {
    console.error("Payment initialization error:", error)
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    )
  }
}
