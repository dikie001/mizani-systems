"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"

import {
  BarChart3,
  Box,
  ClipboardList,
  Home,
  Package,
  Settings,
  ShoppingCart,
  TrendingUp,
  Shield,
  CreditCard,
  Crown,
  Sparkles,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { WorkspaceSwitcher } from "@/components/workspace-switcher"

const mainNavItems = [
  { title: "Dashboard", icon: Home, href: "/dashboard", badge: null },
  {
    title: "Inventory",
    icon: Package,
    href: "/dashboard/inventory",
    badge: null,
  },
  {
    title: "Orders",
    icon: ShoppingCart,
    href: "/dashboard/orders",
    badge: "12",
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/dashboard/reports",
    badge: null,
  },
]

const secondaryNavItems = [
  {
    title: "Stock Alerts",
    icon: TrendingUp,
    href: "/dashboard/alerts",
    badge: "3",
  },
  {
    title: "Audit Log",
    icon: ClipboardList,
    href: "/dashboard/audit",
    badge: null,
  },
  {
    title: "Billing",
    icon: CreditCard,
    href: "/dashboard/billing",
    badge: null,
  },
]

function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function getUserInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "User"
  const parts = source.split(/\s+/).filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  const { state, setOpenMobile } = useSidebar()
  const isCollapsed = state === "collapsed"
  const workspaceId = session?.user?.workspaceId

  function handleNavClick() {
    setOpenMobile(false)
  }

  const { data: counts } = useSWR(
    workspaceId ? ["/api/alerts/counts", workspaceId] : null,
    (key) => {
      const url = Array.isArray(key) ? key[0] : key
      return fetch(url).then((res) => (res.ok ? res.json() : null))
    }
  )

  const { data: subscription, isLoading: isSubLoading } = useSWR(
    workspaceId ? ["/api/subscriptions/current", workspaceId] : null,
    (key) => {
      const url = Array.isArray(key) ? key[0] : key
      return fetch(url).then((res) => (res.ok ? res.json() : null))
    }
  )
  // Show loading when session is loading, SWR is loading, subscription hasn't resolved yet,
  // or when we're waiting for workspaceId to be available
  const isPlanLoading =
    sessionStatus === "loading" ||
    isSubLoading ||
    (workspaceId && subscription === undefined) ||
    (!workspaceId && sessionStatus !== "authenticated")

  const mainNav = mainNavItems.map((item) => {
    if (item.title === "Orders") {
      return {
        ...item,
        badge: counts?.pendingOrders > 0 ? String(counts.pendingOrders) : null,
      }
    }
    return item
  })

  const secondaryNav = secondaryNavItems.map((item) => {
    if (item.title === "Stock Alerts") {
      return {
        ...item,
        badge: counts?.activeAlerts > 0 ? String(counts.activeAlerts) : null,
      }
    }
    return item
  })

  const userInitials = getUserInitials(
    session?.user?.name,
    session?.user?.email
  )

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="bg-transparent">
      <SidebarHeader className="flex h-16 items-center justify-center border-b border-sidebar-border/60 px-3 py-0 group-data-[collapsible=icon]:px-0!">
        {isCollapsed ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/50 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/25">
            {userInitials}
          </div>
        ) : (
          <WorkspaceSwitcher />
        )}
      </SidebarHeader>

      <SidebarContent className="gap-4 px-3 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-3">
        <>
          <SidebarGroup className="px-0 py-0 group-data-[collapsible=icon]:gap-2">
            <SidebarGroupLabel className="px-2.5 pb-1.5 text-xs font-semibold tracking-normal text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:gap-1">
                {mainNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavItemActive(pathname, item.href)}
                      tooltip={item.title}
                      size="lg"
                      className="flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0! hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-[active=true]:bg-primary/50 data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm"
                    >
                      <Link href={item.href} onClick={handleNavClick}>
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[active=true]/menu-button:text-primary-foreground group-data-[collapsible=icon]:m-0!" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                        {item.badge && !isCollapsed && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4.5 min-w-4.5 justify-center rounded-full px-1.5 text-[10px]"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="mx-3 w-auto bg-sidebar-border/70 group-data-[collapsible=icon]:hidden" />
        </>

        <SidebarGroup className="px-0 py-0 group-data-[collapsible=icon]:gap-2">
          <SidebarGroupLabel className="px-2.5 pb-1.5 text-xs font-semibold tracking-normal text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
            More
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:gap-1">
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={item.title}
                    size="lg"
                    className="flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0! hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm"
                  >
                    <Link href={item.href} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[active=true]/menu-button:text-primary-foreground group-data-[collapsible=icon]:m-0!" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                      {item.badge && !isCollapsed && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-4.5 min-w-4.5 justify-center rounded-full px-1.5 text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border/60 px-2.5 py-2.5 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {isPlanLoading ? (
              <div className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/10 px-3 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  Loading plan...
                </span>
              </div>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={false}
                tooltip={subscription?.plan?.displayName || "Free Trial"}
                size="lg"
                className="flex h-10 w-full items-center rounded-lg border border-sidebar-border/50 bg-sidebar-accent/25 px-3 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0! hover:bg-sidebar-accent/50 data-[active=true]:border-transparent data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm"
              >
                <Link href="/dashboard/billing" onClick={handleNavClick}>
                  <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground group-data-[active=true]/menu-button:text-primary-foreground group-data-[collapsible=icon]:m-0!" />
                  <span className="ml-2 truncate group-data-[collapsible=icon]:hidden">
                    {subscription?.plan?.displayName || "Free Trial"} Plan
                  </span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
