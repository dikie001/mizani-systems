"use client"

import { useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users,
  ChevronRight,
  Shield,
  Loader2,
  Grid3X3,
  List,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type WorkspaceMembership = {
  id: string
  name: string
  role: string
}

type SuperAdminUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role: string
  status: string
  loginCount: number
  createdAt: string
  workspaces: WorkspaceMembership[]
}

type SuperAdminUsersData = {
  users?: SuperAdminUser[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errorMsg = await res.json().catch(() => ({})).then((data) => data.error || "An error occurred")
    throw new Error(errorMsg)
  }
  return res.json()
}

export default function SuperAdminUsersPage() {
  const { data, error, isLoading, mutate } = useSWR<SuperAdminUsersData>(
    "/api/super-admin/data",
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  )

  // Expanded workspace view per user ID
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [userViewMode, setUserViewMode] = useState<"table" | "cards">("cards")

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 shadow-lg shadow-destructive/5">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Failed to Load Users Directory
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
          Loading Administrative User Directory...
        </p>
      </div>
    )
  }

  const { users = [] } = data || {}

  return (
    <div className="flex flex-1 flex-col space-y-6 text-left">
      {/* Header with title and toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            Registered Accounts Directory
          </h1>
          <p className="text-sm text-muted-foreground">
            Total Users: {users.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={userViewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserViewMode("cards")}
            className="gap-2"
          >
            <Grid3X3 className="h-4 w-4" />
            Cards
          </Button>
          <Button
            variant={userViewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserViewMode("table")}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Users View - Table or Cards */}
      {userViewMode === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <Image
                          src={user.image}
                          alt={user.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {user.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </div>
                      )}
                      <span className="font-medium text-foreground">
                        {user.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.role === "super_admin" ? (
                      <Badge className="border-destructive/20 bg-destructive/10 text-destructive">
                        Super Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${
                        user.status === "active"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold">
                    {user.loginCount}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold text-primary">
                    {user.workspaces.length}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Users Grid Layout */
        <div className="grid gap-4 md:grid-cols-2">
          {users.map((user) => (
            <Card
              key={user.id}
              className="border-border bg-card text-left shadow-lg transition duration-300 hover:border-primary/30"
            >
              <CardContent className="space-y-4 p-5">
                {/* User Header Block */}
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-2 ring-primary/20">
                      {user.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-foreground">
                        {user.name}
                      </h4>

                      {user.role === "super_admin" && (
                        <Badge
                          variant="outline"
                          className="border-destructive/20 bg-destructive/10 px-1.5 py-0 text-[8px] font-bold tracking-wider text-destructive uppercase"
                        >
                          Super Admin
                        </Badge>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge
                      variant="outline"
                      className={`px-2 py-0 text-[9px] font-bold tracking-wider uppercase ${
                        user.status === "active"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {user.status}
                    </Badge>
                  </div>
                </div>

                {/* Middle Details Grid */}
                <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-border bg-muted/50 p-3 text-xs">
                  <div className="space-y-0.5 text-left">
                    <p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                      Logins
                    </p>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {user.loginCount}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-left">
                    <p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                      Workspaces
                    </p>
                    <span className="font-mono text-sm font-bold text-primary">
                      {user.workspaces.length}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-left">
                    <p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                      Joined
                    </p>
                    <span className="block truncate font-mono text-[10px] font-bold text-muted-foreground">
                      {user.createdAt}
                    </span>
                  </div>
                </div>

                {/* Expandable Workspace memberships list */}
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      setExpandedUser(expandedUser === user.id ? null : user.id)
                    }
                    className="flex w-full cursor-pointer items-center justify-between text-[11px] font-bold text-muted-foreground transition duration-200 hover:text-foreground"
                  >
                    <span>
                      {expandedUser === user.id
                        ? "Hide workspaces"
                        : "Show workspaces"}{" "}
                      ({user.workspaces.length})
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition duration-300 ${expandedUser === user.id ? "rotate-90 text-primary" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {expandedUser === user.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 overflow-hidden border-t border-border/60 pt-1.5"
                      >
                        {user.workspaces.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground italic">
                            No workspaces associated with this user yet.
                          </p>
                        ) : (
                          user.workspaces.map((ws) => (
                            <div
                              key={ws.id}
                              className="flex items-center justify-between rounded border border-border bg-background p-2 text-xs"
                            >
                              <span className="font-semibold text-foreground">
                                {ws.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase ${
                                  ws.role === "OWNER"
                                    ? "border-primary/20 bg-primary/10 text-primary"
                                    : "border-border bg-muted text-muted-foreground"
                                }`}
                              >
                                {ws.role}
                              </Badge>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
