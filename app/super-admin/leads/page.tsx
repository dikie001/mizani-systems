"use client"

import { useState } from "react"
import useSWR from "swr"

import {
  Sparkles,
  Search,
  Grid,
  List,
  Calendar,
  Send,
  Loader2,
  Shield,
} from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type DemoBooking = {
  id: string
  name: string
  email: string
  company: string | null
  phone: string | null
  message: string | null
  status: string
  createdAt: string
  updatedAt: string
}

type ContactRequest = {
  id: string
  name: string
  email: string
  company: string | null
  phone: string | null
  message: string
  status: string
  createdAt: string
  updatedAt: string
}

type LeadsData = {
  bookings: DemoBooking[]
  contacts: ContactRequest[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function SuperAdminLeadsPage() {
  const { data, error, isLoading, mutate } = useSWR<LeadsData>(
    "/api/super-admin/leads",
    fetcher,
    { refreshInterval: 15000 } // Poll every 15s
  )

  const [activeTab, setActiveTab] = useState<"demo" | "sales">("demo")
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleUpdateStatus = async (id: string, type: "demo" | "contact", newStatus: string) => {
    setUpdatingId(id)
    try {
      const response = await fetch("/api/super-admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, status: newStatus }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update lead status.")
      }

      toast.success(`Lead status updated to ${newStatus}`)
      mutate() // Refresh data
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An error occurred while updating status."
      toast.error(errMsg)
    } finally {
      setUpdatingId(null)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 shadow-lg shadow-destructive/5">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Failed to Load System Leads</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            There was an error communicating with the database or server. Ensure your database is running.
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
          Loading Administrative Leads Directory...
        </p>
      </div>
    )
  }

  const bookings = data?.bookings || []
  const contacts = data?.contacts || []

  // Filtering
  const filteredBookings = bookings.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredContacts = contacts.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Counters
  const pendingDemos = bookings.filter((b) => b.status === "pending").length
  const pendingSales = contacts.filter((c) => c.status === "pending").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      case "scheduled":
        return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      case "completed":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      case "contacted":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      case "cancelled":
      case "ignored":
        return "border-destructive/20 bg-destructive/10 text-destructive"
      default:
        return "border-border bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="flex flex-1 flex-col space-y-6 text-left">
      {/* Header and Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Leads & Inquiries Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage product demo requests and high-intent enterprise sales contacts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}
            className="h-9 gap-1.5"
          >
            <Grid className="h-4 w-4" />
            Cards
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-9 gap-1.5"
          >
            <List className="h-4 w-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-border bg-card/60 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Demos</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="font-heading text-2xl font-bold">{bookings.length}</span>
            {pendingDemos > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold mt-0.5">
                {pendingDemos} awaiting action
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Sales Inquiries</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="font-heading text-2xl font-bold">{contacts.length}</span>
            {pendingSales > 0 && (
              <p className="text-[10px] text-amber-500 font-semibold mt-0.5">
                {pendingSales} new messages
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Scheduled Demos</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="font-heading text-2xl font-bold text-blue-500">
              {bookings.filter((b) => b.status === "scheduled").length}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Confirmed sessions</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Conversion rate</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="font-heading text-2xl font-bold text-emerald-500">
              {bookings.length + contacts.length > 0
                ? `${Math.round(
                    ((bookings.filter((b) => b.status === "completed").length +
                      contacts.filter((c) => c.status === "contacted").length) /
                      (bookings.length + contacts.length)) *
                      100
                  )}%`
                : "0%"}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Processed leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search leads by name, email, or company..."
            className="pl-9 h-10 border-border/80 bg-muted/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
            <SelectTrigger className="h-10 border-border/80 bg-muted/20">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              {activeTab === "demo" ? (
                <>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as "demo" | "sales")
          setStatusFilter("all")
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="demo" className="text-xs font-semibold gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Demo Bookings
            {pendingDemos > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-[9px] px-1 h-4 min-w-4 flex items-center justify-center rounded-full ml-1">
                {pendingDemos}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales" className="text-xs font-semibold gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Sales Contacts
            {pendingSales > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-[9px] px-1 h-4 min-w-4 flex items-center justify-center rounded-full ml-1">
                {pendingSales}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-4">
          {filteredBookings.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-border rounded-xl bg-card/40">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No demo bookings found</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your filters or search query.</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Requested Date/Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((lead) => (
                    <TableRow key={lead.id} className="group transition-colors hover:bg-muted/20">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{lead.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{lead.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {lead.company || <span className="text-muted-foreground italic text-xs">Not specified</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {lead.phone || <span className="text-muted-foreground italic text-xs">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {lead.message || <span className="text-muted-foreground/40 italic">No notes left</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusBadge(lead.status)}`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          disabled={updatingId === lead.id}
                          value={lead.status}
                          onValueChange={(val) => handleUpdateStatus(lead.id, "demo", val)}
                        >
                          <SelectTrigger className="h-8 w-32 ml-auto text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredBookings.map((lead) => (
                <Card key={lead.id} className="border-border bg-card shadow-md transition hover:border-primary/30 relative overflow-hidden flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">{lead.name}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-0.5">{lead.email}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(lead.status)}`}>
                        {lead.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3.5 pb-4">
                    <div className="grid grid-cols-2 gap-2 text-xs rounded-lg border border-border bg-muted/30 p-2.5">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Company</span>
                        <span className="font-medium truncate block text-foreground">
                          {lead.company || <span className="text-muted-foreground/50 italic">None</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Phone</span>
                        <span className="font-mono font-medium truncate block text-foreground">
                          {lead.phone || <span className="text-muted-foreground/50 italic">None</span>}
                        </span>
                      </div>
                    </div>

                    {lead.message && (
                      <div className="rounded-lg border border-border/80 bg-background/50 p-2.5 text-xs text-muted-foreground">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Notes</span>
                        <p className="leading-relaxed">{lead.message}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-4">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Received: {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                      <Select
                        disabled={updatingId === lead.id}
                        value={lead.status}
                        onValueChange={(val) => handleUpdateStatus(lead.id, "demo", val)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          {filteredContacts.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-border rounded-xl bg-card/40">
              <Send className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No sales inquiries found</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your filters or search query.</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Message Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((lead) => (
                    <TableRow key={lead.id} className="group transition-colors hover:bg-muted/20">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{lead.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{lead.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {lead.company || <span className="text-muted-foreground italic text-xs">Not specified</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {lead.phone || <span className="text-muted-foreground italic text-xs">—</span>}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {lead.message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusBadge(lead.status)}`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          disabled={updatingId === lead.id}
                          value={lead.status}
                          onValueChange={(val) => handleUpdateStatus(lead.id, "contact", val)}
                        >
                          <SelectTrigger className="h-8 w-32 ml-auto text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="ignored">Ignored</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredContacts.map((lead) => (
                <Card key={lead.id} className="border-border bg-card shadow-md transition hover:border-primary/30 relative overflow-hidden flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">{lead.name}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-0.5">{lead.email}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(lead.status)}`}>
                        {lead.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3.5 pb-4">
                    <div className="grid grid-cols-2 gap-2 text-xs rounded-lg border border-border bg-muted/30 p-2.5">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Company</span>
                        <span className="font-medium truncate block text-foreground">
                          {lead.company || <span className="text-muted-foreground/50 italic">None</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Phone</span>
                        <span className="font-mono font-medium truncate block text-foreground">
                          {lead.phone || <span className="text-muted-foreground/50 italic">None</span>}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80 bg-background/50 p-2.5 text-xs text-muted-foreground">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Inquiry Details</span>
                      <p className="leading-relaxed whitespace-pre-wrap">{lead.message}</p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-4">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Received: {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                      <Select
                        disabled={updatingId === lead.id}
                        value={lead.status}
                        onValueChange={(val) => handleUpdateStatus(lead.id, "contact", val)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="ignored">Ignored</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
