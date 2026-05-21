import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { paystack } from "@/lib/paystack"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reference = searchParams.get("reference")

    if (!reference) {
      return NextResponse.json(
        { error: "Reference is required" },
        { status: 400 }
      )
    }

    // Verify with Paystack
    const verifyResponse = await paystack.verifyPayment(reference)

    if (!verifyResponse.status) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment verification failed",
        },
        { status: 400 }
      )
    }

    const paymentData = verifyResponse.data

    // Find the payment record
    const payment = await prisma.payment.findUnique({
      where: { paystackReference: reference },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      )
    }

    if (paymentData && (paymentData as any).status === "success") {
      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "success",
          paidAt: new Date((paymentData as any).paid_at),
          paystackAuthCode: (paymentData as any).authorization
            ?.authorization_code,
        },
      })

      // Get workspace and payment details
      const workspace = await prisma.workspace.findUnique({
        where: { id: payment.workspaceId },
        include: { selectedPlan: true },
      })

      if (!workspace || !workspace.selectedPlan) {
        return NextResponse.json(
          { error: "Workspace or plan not found" },
          { status: 404 }
        )
      }

      // Create or update subscription
      let subscription = await prisma.subscription.findUnique({
        where: { workspaceId: payment.workspaceId },
      })

      if (!subscription) {
        subscription = await prisma.subscription.create({
          data: {
            workspaceId: payment.workspaceId,
            planId: workspace.selectedPlanId!,
            status: "active",
            paymentStatus: "paid",
            paystackAuthorizationCode: (paymentData as any).authorization
              ?.authorization_code,
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
      } else {
        subscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: workspace.selectedPlanId!,
            status: "active",
            paymentStatus: "paid",
            paystackAuthorizationCode: (paymentData as any).authorization
              ?.authorization_code,
            currentBillingCycleStart: new Date(),
            currentBillingCycleEnd: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
      }

      // Update the paying workspace
      await prisma.workspace.update({
        where: { id: payment.workspaceId },
        data: {
          selectedPlanId: workspace.selectedPlanId!,
          subscriptionId: subscription.id,
        },
      })

      // Propagate subscription to every other workspace owned by the same user so
      // plan is user-scoped, not workspace-scoped.
      const ownerMembership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: payment.workspaceId, role: "OWNER" },
      })
      if (ownerMembership) {
        const otherMemberships = await prisma.workspaceMember.findMany({
          where: {
            userId: ownerMembership.userId,
            workspaceId: { not: payment.workspaceId },
          },
          select: { workspaceId: true },
        })
        for (const m of otherMemberships) {
          await prisma.subscription.upsert({
            where: { workspaceId: m.workspaceId },
            create: {
              workspaceId: m.workspaceId,
              planId: workspace.selectedPlanId!,
              status: "active",
              paymentStatus: "paid",
              currentBillingCycleStart: subscription.currentBillingCycleStart,
              currentBillingCycleEnd: subscription.currentBillingCycleEnd,
              nextBillingDate: subscription.nextBillingDate,
            },
            update: {
              planId: workspace.selectedPlanId!,
              status: "active",
              paymentStatus: "paid",
              currentBillingCycleStart: subscription.currentBillingCycleStart,
              currentBillingCycleEnd: subscription.currentBillingCycleEnd,
              nextBillingDate: subscription.nextBillingDate,
            },
          })
          await prisma.workspace.update({
            where: { id: m.workspaceId },
            data: { selectedPlanId: workspace.selectedPlanId! },
          })
        }
      }

      // Create invoice for this payment and link it to the payment
      const invoiceNumber = `INV-${Date.now()}`
      const invoice = await prisma.invoice.create({
        data: {
          workspaceId: payment.workspaceId,
          subscriptionId: subscription.id,
          invoiceNumber,
          amount: payment.amount,
          currency: "KES",
          status: "paid",
          billingPeriodStart: new Date(),
          billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paidAt: new Date(),
          description: `${workspace.selectedPlan.displayName} Plan - Monthly`,
        },
      })

      // Link invoice to payment using the invoice's actual id (CUID), not invoiceNumber
      await prisma.payment.update({
        where: { id: payment.id },
        data: { invoiceId: invoice.id },
      })

      return NextResponse.json(
        {
          success: true,
          message: "Payment verified and subscription activated",
          subscription,
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Payment failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
      },
    })

    return NextResponse.json(
      {
        success: false,
        message: "Payment failed",
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("Payment verification error:", error)
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    )
  }
}

// Webhook handler for Paystack events
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-paystack-signature")
    const body = await request.text()

    // Verify webhook signature (you should implement this for security)
    // For now, we'll process directly

    const event = JSON.parse(body)

    if (event.event === "charge.success") {
      const reference = event.data.reference

      // Verify and process as above
      const verifyResponse = await paystack.verifyPayment(reference)

      if (verifyResponse.status && verifyResponse.data) {
        const payment = await prisma.payment.findUnique({
          where: { paystackReference: reference },
        })

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "success",
              paidAt: new Date(),
            },
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
