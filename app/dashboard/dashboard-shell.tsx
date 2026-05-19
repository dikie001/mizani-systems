"use client"

import { useEffect, useState } from "react"
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
    // Only redirect to billing after initial UI initialization completes.
    // This prevents the billing page from flashing as the first page and
    // allows showing a custom themed loader / skeleton to the user.
    if (!initializing) {
      if (requiresPayment && pathname !== "/dashboard/billing") {
        router.replace("/dashboard/billing")
      }
    }
  }, [requiresPayment, pathname, router, initializing])

  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Show a short branded loader on first mount to improve UX while server
    // data and client state hydrate. Adjust duration as needed.
    const t = setTimeout(() => setInitializing(false), 600)
    return () => clearTimeout(t)
  }, [])

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
      {/* Delay rendering the sidebar during the initial loader so the Billing
          link doesn't appear briefly while the app is hydrating. */}
      {!initializing && <DashboardSidebar />}
      <SidebarInset className="h-svh overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {initializing ? (
            <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4 bg-background">
              <div className="animate-fade-in">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="mt-4 text-sm font-medium text-muted-foreground">
                  Loading dashboard...
                </p>
              </div>
            </div>
          ) : showContent ? (
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
