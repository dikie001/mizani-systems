import type { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SuperAdminSidebar } from "@/components/super-admin-sidebar"
import { SuperAdminHeader } from "@/components/super-admin-header"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Super Admin Control Center | Mizani Systems",
  description:
    "Restricted administrative dashboard for managing registered users, multi-tenant workspaces, system performance, and complete audit trail logs.",
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/auth")
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL

  if (
    !superAdminEmail ||
    session.user.email.toLowerCase() !== superAdminEmail.toLowerCase()
  ) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "16.5rem",
            "--sidebar-width-icon": "4.5rem",
          } as React.CSSProperties
        }
      >
        <Suspense fallback={null}>
          <SuperAdminSidebar />
        </Suspense>

        <SidebarInset className="flex h-svh flex-col overflow-hidden">
          <Suspense fallback={null}>
            <SuperAdminHeader />
          </Suspense>
          <main className="relative flex-1 overflow-auto bg-background p-4 text-foreground md:p-6">
            <div className="max-w-7.5xl mx-auto w-full">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
