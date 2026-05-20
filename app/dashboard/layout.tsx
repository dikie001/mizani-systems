import type { Metadata } from "next"

import { DashboardShell } from "./dashboard-shell"
import { CreateWorkspaceModal } from "@/components/modals/create-workspace-modal"

export const metadata: Metadata = {
  title: "Dashboard | Mizani Systems",
  description:
    "Manage your inventory, track orders, and monitor key metrics from your Mizani Systems dashboard.",
}

import { Suspense } from "react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session?.user?.email) {
    redirect("/auth")
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  if (superAdminEmail && session.user.email.toLowerCase() === superAdminEmail.toLowerCase()) {
    redirect("/super-admin")
  }

  // Robust check to ensure user has a workspace
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      currentWorkspaceId: true,
      memberships: {
        take: 1
      }
    }
  })

  if (!user?.currentWorkspaceId && (!user?.memberships || user.memberships.length === 0)) {
    redirect("/onboarding")
  }

  // Check if current workspace has an active subscription
  let requiresPayment = false
  let workspace = null
  if (user?.currentWorkspaceId) {
    workspace = await prisma.workspace.findUnique({
      where: { id: user.currentWorkspaceId },
      include: { subscription: true, selectedPlan: true }
    })
    
    // If no subscription or status is not active/trial, prompt payment
    if (workspace && (!workspace.subscription || (workspace.subscription.status !== "active" && workspace.subscription.status !== "trial"))) {
      requiresPayment = true
    }
  }

  return (
    <>
      <DashboardShell requiresPayment={requiresPayment}>{children}</DashboardShell>
      <Suspense fallback={null}>
        <CreateWorkspaceModal />
      </Suspense>
    </>
  )
}
