"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"

export function DashboardShell({
  children,
  requiresPayment = false,
}: {
  children: React.ReactNode
  requiresPayment?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Only redirect to billing if payment is required and not already on billing page
    if (requiresPayment && pathname !== "/dashboard/billing") {
      router.replace("/dashboard/billing")
    }
  }, [requiresPayment, pathname, router])

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16.5rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <DashboardSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
