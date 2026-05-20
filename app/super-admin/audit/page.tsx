"use client"

import { useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Search, Shield, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type AuditLog = {
  id: string
  type: string
  action: string
  ip?: string | null
  timestamp: string
  workspaceName?: string | null
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

type AuditData = {
  activities?: AuditLog[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errorMsg = await res.json().catch(() => ({})).then((data) => data.error || "An error occurred")
    throw new Error(errorMsg)
  }
  return res.json()
}

export default function SuperAdminAuditPage() {
  const { data, error, isLoading, mutate } = useSWR<AuditData>(
    "/api/super-admin/data",
    fetcher,
    {
      refreshInterval: 10000,
    }
  )

  const [auditSearch, setAuditSearch] = useState("")
  const [auditFilterType, setAuditFilterType] = useState<string>("all")
  const [auditTypeSort, setAuditTypeSort] = useState<"asc" | "desc">("asc")
  const [auditViewMode, setAuditViewMode] = useState<"table" | "cards">("table")
  const [auditPage, setAuditPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const logsPerPage = 12

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 shadow-lg shadow-destructive/5">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Failed to Load Activity Logs
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            There was an error communicating with the database or server. Ensure
            your database is running.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => mutate()}
          className="border-border bg-background text-foreground"
        >
          Retry Connection
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-40">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Accessing Global Audit Logs Stream...
        </p>
      </div>
    )
  }

  const { activities = [] } = data || {}

  const filteredLogs = activities.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.user?.email &&
        log.user.email.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.user?.name &&
        log.user.name.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.ip && log.ip.includes(auditSearch))

    const matchesType =
      auditFilterType === "all" || log.type === auditFilterType

    return matchesSearch && matchesType
  })

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const typeComparison = a.type.localeCompare(b.type)

    if (typeComparison !== 0) {
      return auditTypeSort === "asc" ? typeComparison : -typeComparison
    }

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const totalPages = Math.ceil(sortedLogs.length / logsPerPage)
  const paginatedLogs = sortedLogs.slice(
    (auditPage - 1) * logsPerPage,
    auditPage * logsPerPage
  )

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "create":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      case "update":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "delete":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "auth":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col space-y-3 text-left">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Global Activity Trail
          </h1>
          <Badge
            variant="outline"
            className="border-border bg-background px-3 py-1 font-mono font-bold text-foreground shadow-sm"
          >
            {activities.length} logs
          </Badge>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
          <div className="relative w-full lg:min-w-0 lg:flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <input
              id="input-audit-search"
              type="text"
              placeholder="Search logs by action, email, or IP address..."
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value)
                setAuditPage(1)
              }}
              className="h-9 w-full rounded-lg border border-border bg-background py-2 pr-4 pl-9 text-xs text-foreground placeholder-muted-foreground transition focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:items-center lg:gap-2">
            <Select
              value={auditFilterType}
              onValueChange={(value) => {
                setAuditFilterType(value)
                setAuditPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-full text-xs sm:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Logs</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={auditTypeSort}
              onValueChange={(value) => {
                setAuditTypeSort(value as "asc" | "desc")
                setAuditPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-full text-xs sm:w-36">
                <SelectValue placeholder="Sort by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Type A-Z</SelectItem>
                <SelectItem value="desc">Type Z-A</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={auditViewMode}
              onValueChange={(value) =>
                setAuditViewMode(value as "table" | "cards")
              }
            >
              <SelectTrigger className="h-9 w-full text-xs sm:w-32">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="cards">Cards</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <AnimatePresence mode="wait">
            {paginatedLogs.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-border bg-muted/10 py-20 text-center text-xs text-muted-foreground"
              >
                No activity logs match your search.
              </motion.div>
            ) : auditViewMode === "table" ? (
              <motion.div
                key="logs-table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14 whitespace-nowrap">
                          #
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          Timestamp
                        </TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Type
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Workspace
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          IP Address
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log, index) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
                            {(auditPage - 1) * logsPerPage + index + 1}
                          </TableCell>
                          <TableCell className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-xs leading-snug font-semibold text-foreground">
                                {log.action}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                ID: {log.id.slice(0, 8)}...
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase ${getLogTypeColor(
                                log.type
                              )}`}
                            >
                              {log.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.user?.image ? (
                                <Image
                                  src={log.user.image ?? ""}
                                  alt={log.user?.name ?? "User"}
                                  width={22}
                                  height={22}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                                  {log.user?.name ? log.user.name[0] : "S"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {log.user?.name || "System"}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {log.user?.email ||
                                    "system@Mizani Systems.internal"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {log.workspaceName || "Global Space"}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {log.ip || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="logs-cards"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {paginatedLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-border/80 hover:bg-muted/10"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
                          ID: {log.id.slice(0, 8)}...
                        </span>
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase ${getLogTypeColor(
                            log.type
                          )}`}
                        >
                          {log.type}
                        </Badge>
                      </div>

                      <p className="text-xs leading-snug font-bold text-foreground">
                        {log.action}
                      </p>
                      <div className="my-2 h-px bg-border" />

                      <div className="flex items-center gap-2">
                        {log.user?.image ? (
                          <Image
                            src={log.user.image ?? ""}
                            alt={log.user?.name ?? "User"}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {log.user?.name ? log.user.name[0] : "S"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[10px] leading-none font-bold text-foreground">
                            {log.user?.name || "System"}
                          </p>
                          <span className="mt-0.5 block truncate font-mono text-[8px] text-muted-foreground">
                            {log.user?.email ||
                              "system@Mizani Systems.internal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3.5 font-mono text-[9px] text-muted-foreground">
                      <div className="flex flex-col text-left">
                        {log.workspaceName ? (
                          <span className="max-w-30 truncate font-semibold text-foreground">
                            WS: {log.workspaceName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Global Space
                          </span>
                        )}
                        <span className="mt-0.5 text-[8px] text-muted-foreground">
                          IP: {log.ip}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Showing logs {(auditPage - 1) * logsPerPage + 1} -{" "}
                {Math.min(auditPage * logsPerPage, sortedLogs.length)} of{" "}
                {sortedLogs.length}
              </span>

              <div className="flex gap-1.5">
                <Button
                  id="btn-audit-prev"
                  variant="outline"
                  size="sm"
                  disabled={auditPage === 1}
                  onClick={() => setAuditPage(auditPage - 1)}
                  className="border-border bg-background text-[10px] font-bold tracking-wider uppercase"
                >
                  Prev
                </Button>
                <div className="flex items-center rounded-lg border border-border bg-background px-3 font-mono text-[10px] font-bold text-foreground">
                  Page {auditPage} / {totalPages}
                </div>
                <Button
                  id="btn-audit-next"
                  variant="outline"
                  size="sm"
                  disabled={auditPage === totalPages}
                  onClick={() => setAuditPage(auditPage + 1)}
                  className="border-border bg-background text-[10px] font-bold tracking-wider uppercase"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-140">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Full context for the selected activity event.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Action
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedLog.action}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`px-2 py-1 text-[10px] font-bold uppercase ${getLogTypeColor(
                    selectedLog.type
                  )}`}
                >
                  {selectedLog.type}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    User
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedLog.user?.name || "System"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLog.user?.email ||
                      "system@Mizani Systems.internal"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Workspace
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedLog.workspaceName || "Global Space"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    IP: {selectedLog.ip || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Timestamp
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {new Date(selectedLog.timestamp).toLocaleString([], {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
