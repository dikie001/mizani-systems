"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
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
    if (requiresPayment && pathname !== "/dashboard/billing") {
      router.replace("/dashboard/billing")
    }
  }, [requiresPayment, pathname, router])

  const showContent = !requiresPayment || pathname === "/dashboard/billing"

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
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {showContent ? (
            children
          ) : (
            <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4 bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">
                Redirecting to Billing Portal...
              </p>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
