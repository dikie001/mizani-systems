"use client"

import { useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  ArrowRightLeft,
  Download,
  Edit,
  Eye,
  Filter,
  LogIn,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const fetcher = async (url: string) => {
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

const typeIcons: Record<string, typeof Package> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  auth: ShieldCheck,
  transfer: ArrowRightLeft,
  settings: Settings,
}

const typeStyles: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  update: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delete: "bg-red-500/10 text-red-600 dark:text-red-400",
  auth: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  transfer: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  settings: "bg-muted text-muted-foreground",
}

const typeLabels: Record<string, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  auth: "Auth",
  transfer: "Transfer",
  settings: "Settings",
}

type AuditLog = {
  id: string
  type: string
  action: string
  entity: string
  initials: string
  user: string
  timestamp: string
  ip: string
}

export default function AuditPage() {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  let url = `/api/audit-logs?`
  if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`
  if (typeFilter !== "all") url += `type=${encodeURIComponent(typeFilter)}&`

  const {
    data: auditLogs,
    isLoading,
    error,
  } = useSWR<AuditLog[]>(workspaceId ? [url, workspaceId] : null, fetcher)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Complete activity history and change tracking
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export Log
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${auditLogs?.length || 0} events`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search activity..."
                  className="h-8 w-48 pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <Filter className="mr-1.5 h-3 w-3" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3.5 py-1">
              {[...Array(6)].map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-border/40 pt-3 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded bg-muted/70" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36 bg-muted/70" />
                      <Skeleton className="h-3.5 w-44 bg-muted/50" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-5 w-16 rounded-full bg-muted/60" />
                    <Skeleton className="h-4 w-28 bg-muted/50" />
                    <Skeleton className="h-4 w-24 bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">
              Failed to load audit logs
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log) => {
                  const Icon = typeIcons[log.type] || Settings
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeStyles[log.type]}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-medium">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {log.entity}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                              {log.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{log.user}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${typeStyles[log.type]}`}
                        >
                          {typeLabels[log.type] || log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ip}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {auditLogs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
