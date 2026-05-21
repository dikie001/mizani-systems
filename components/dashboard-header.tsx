"use client"

import { startTransition, useEffect, useState } from "react"
import useSWR from "swr"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { signOut, useSession } from "next-auth/react"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sun,
  WalletCards,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NotificationModal } from "@/components/notification-modal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const fetcher = async (key: string | [string, string]) => {
  const url = Array.isArray(key) ? key[0] : key
  const res = await fetch(url)
  if (!res.ok) {
    const errorMsg = await res
      .json()
      .catch(() => ({}))
      .then((data) => data.error || "An error occurred")
    throw new Error(errorMsg)
  }
  return res.json()
}

const routeLabels: Record<string, string> = {
  alerts: "Stock Alerts",
  audit: "Audit Log",
  inventory: "Inventory",
  orders: "Orders",
  reports: "Reports",
  settings: "Settings",
}

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  }

  return email?.[0]?.toUpperCase() ?? "U"
}

function getBreadcrumbLabel(segment: string) {
  return (
    routeLabels[segment] ??
    segment
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  )
}

function getFirstName(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "User"
  const firstPart = source.split(/\s+/)[0] ?? "User"

  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase()
}
function breadcrumbSegmentsFromPath(pathname: string) {
  return pathname.split("/").filter(Boolean).slice(1)
}
export function DashboardHeader() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session, status } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { data: alertCounts } = useSWR(
    workspaceId ? ["/api/alerts/counts", workspaceId] : null,
    fetcher
  )
  const [isAvatarReady, setIsAvatarReady] = useState(false)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)

  const userName = session?.user?.name ?? ""
  const userEmail = session?.user?.email ?? ""
  const userImage = session?.user?.image ?? ""
  const userInitials = getInitials(session?.user?.name, session?.user?.email)
  const userDisplayName = getFirstName(
    session?.user?.name,
    session?.user?.email
  )

  const breadcrumbPath = breadcrumbSegmentsFromPath(pathname)
  const breadcrumbSegments = breadcrumbPath.map((segment, index) => ({
    href: `/dashboard/${breadcrumbPath.slice(0, index + 1).join("/")}`,
    label: getBreadcrumbLabel(segment),
  }))

  useEffect(() => {
    if (status !== "authenticated" || !userName) {
      return
    }

    if (!userImage) {
      startTransition(() => {
        setIsAvatarReady(true)
      })
      return
    }

    let isMounted = true
    const image = new window.Image()

    image.referrerPolicy = "no-referrer"
    image.src = userImage

    const finalize = () => {
      if (isMounted) {
        startTransition(() => {
          setIsAvatarReady(true)
        })
      }
    }

    if (image.complete) {
      finalize()
    } else {
      startTransition(() => {
        setIsAvatarReady(false)
      })
      image.onload = finalize
      image.onerror = finalize
    }

    return () => {
      isMounted = false
      image.onload = null
      image.onerror = null
    }
  }, [status, userImage, userName])

  const isProfileReady =
    status === "authenticated" && Boolean(userName) && isAvatarReady

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/85 md:px-5">
      <SidebarTrigger className="-ml-1 transition-all duration-200 ease-linear peer-data-[state=expanded]:peer-data-[collapsible=icon]:fixed peer-data-[state=expanded]:peer-data-[collapsible=icon]:top-3 peer-data-[state=expanded]:peer-data-[collapsible=icon]:left-[calc(var(--sidebar-width)-2.5rem)] peer-data-[state=expanded]:peer-data-[collapsible=icon]:z-40" />
      <Separator
        orientation="vertical"
        className="mr-1 h-5 peer-data-[state=expanded]:peer-data-[collapsible=icon]:hidden"
      />

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1 text-sm"
      >
        <Link
          href="/dashboard"
          className="truncate text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
        {breadcrumbSegments.map((item, index) => {
          const isLast = index === breadcrumbSegments.length - 1

          return (
            <div key={item.href} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              {isLast ? (
                <span className="truncate font-medium text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="relative hidden md:block">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            className="h-9 w-60 rounded-full border-border/70 bg-muted/35 pl-8 text-sm shadow-none"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          onClick={() => setIsAlertsOpen(true)}
        >
          <Bell className="h-4 w-4" />
          {alertCounts && alertCounts.activeAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {alertCounts.activeAlerts}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!isProfileReady}>
            <Button
              variant="ghost"
              className="h-8 w-8 rounded-full border-none bg-transparent p-0 shadow-none hover:bg-transparent disabled:cursor-wait disabled:opacity-100 md:h-11 md:w-auto md:border md:border-border/70 md:bg-background md:px-2.5 md:shadow-sm md:hover:bg-muted/40"
            >
              {isProfileReady ? (
                <>
                  <Avatar className="h-8 w-8">
                    {userImage ? (
                      <AvatarImage
                        src={userImage}
                        alt={userName}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-medium md:inline">
                    {userDisplayName}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:inline" />
                </>
              ) : (
                <span
                  className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"
                  style={{ width: "7.5rem" }}
                >
                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <span>Loading...</span>
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="w-72 rounded-3xl border border-border/70 p-2 shadow-xl"
          >
            <DropdownMenuLabel className="px-2 py-2">
              <div className="flex items-center gap-3 rounded-2xl px-2 py-1">
                <Avatar className="h-11 w-11">
                  {userImage ? (
                    <AvatarImage
                      src={userImage}
                      alt={userName}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {userName}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {userEmail}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className="h-11 rounded-2xl px-3 text-[15px]"
            >
              <Link href="/dashboard">
                <WalletCards className="h-4 w-4" />
                My Workspace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
            >
              <DropdownMenuRadioItem
                value="light"
                className="h-11 rounded-2xl px-3 text-[15px]"
              >
                <Sun className="h-4 w-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="dark"
                className="h-11 rounded-2xl px-3 text-[15px]"
              >
                <Moon className="h-4 w-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="system"
                className="h-11 rounded-2xl px-3 text-[15px]"
              >
                <Monitor className="h-4 w-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="h-11 rounded-2xl px-3 text-[15px]"
              onClick={() => signOut({ callbackUrl: "/auth" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NotificationModal open={isAlertsOpen} onOpenChange={setIsAlertsOpen} />
      </div>
    </header>
  )
}
