"use client"

import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  PlusCircle,
  Settings,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSidebar } from "@/components/ui/sidebar"
import { getWorkspaces, switchWorkspace } from "@/lib/actions/workspace"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Workspace = {
  id: string
  name: string
  slug: string
}

function formatWorkspaceName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export function WorkspaceSwitcher() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()

  const [open, setOpen] = React.useState(false)
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSwitching, setIsSwitching] = React.useState<string | null>(null)

  const currentWorkspaceId = session?.user?.workspaceId
  const currentWorkspaceName =
    session?.user?.workspaceName ||
    (workspaces.length > 0 ? workspaces[0].name : "Select Workspace")
  const displayWorkspaceName = formatWorkspaceName(currentWorkspaceName)

  React.useEffect(() => {
    async function loadWorkspaces() {
      setIsLoading(true)
      try {
        const data = await getWorkspaces()
        setWorkspaces(data)
      } finally {
        setIsLoading(false)
      }
    }

    if (session?.user?.id) {
      loadWorkspaces()
    } else if (status !== "loading") {
      setTimeout(() => {
        setIsLoading(false)
      }, 0)
    }
  }, [session?.user?.id, currentWorkspaceId, open, status])

  // Show loader when session is loading OR when workspaces are loading and we don't have a workspace name
  const showLoadingState =
    status === "loading" || (isLoading && !session?.user?.workspaceName)

  if (showLoadingState) {
    return (
      <div
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-lg border border-sidebar-border/50 bg-sidebar-accent/30 px-3 text-sidebar-foreground",
          "group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        )}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <span className="text-xs font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
          Loading workspace...
        </span>
      </div>
    )
  }

  async function onWorkspaceSelect(workspace: Workspace) {
    if (workspace.id === currentWorkspaceId) {
      setOpen(false)
      return
    }

    setIsSwitching(workspace.id)
    try {
      const result = await switchWorkspace(workspace.id)
      if (result.success) {
        toast.success(`Switched to ${workspace.name}`)
        await updateSession({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        })
        setOpen(false)
        router.refresh()
        if (isMobile) setOpenMobile(false)
      } else {
        toast.error(result.error || "Failed to switch workspace")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSwitching(null)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a workspace"
          className={cn(
            "h-12 w-full justify-between border-sidebar-border/50 bg-sidebar-accent/30 text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent/50",
            "group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:p-0"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-border transition-transform duration-200 group-hover:scale-105 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6">
              <Building2 className="h-4 w-4 group-data-[collapsible=icon]:h-3.5 group-data-[collapsible=icon]:w-3.5" />
            </div>
            <div className="flex flex-col items-start gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
              <span className="max-w-30 truncate text-sm font-semibold tracking-tight text-foreground">
                {displayWorkspaceName}
              </span>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Workspace
              </span>
            </div>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 border-sidebar-border bg-sidebar p-0 shadow-xl backdrop-blur-xl">
        <Command className="bg-transparent">
          <CommandList>
            <CommandInput placeholder="Search workspace..." className="h-9" />
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading workspaces...</span>
              </div>
            ) : (
              <CommandGroup heading="Your Workspaces">
                {workspaces.map((workspace) => (
                  <CommandItem
                    key={workspace.id}
                    onSelect={() => onWorkspaceSelect(workspace)}
                    className="flex cursor-pointer items-center gap-2 px-2 py-2"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="flex-1 truncate text-sm">
                      {formatWorkspaceName(workspace.name)}
                    </span>
                    {isSwitching === workspace.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      currentWorkspaceId === workspace.id && (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      )
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false)
                  const url = new URL(window.location.href)
                  url.searchParams.set("createWorkspace", "true")
                  router.push(url.pathname + url.search)
                }}
                className="flex cursor-pointer items-center gap-2 px-2 py-2"
              >
                <PlusCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Create Workspace</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false)
                  router.push("/dashboard/settings")
                }}
                className="flex cursor-pointer items-center gap-2 px-2 py-2"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
