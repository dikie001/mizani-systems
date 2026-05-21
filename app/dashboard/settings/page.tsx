"use client"

import * as React from "react"
import {
  Globe,
  Key,
  Lock,
  Moon,
  Palette,
  Save,
  Shield,
  User,
  Users,
  Loader2,
} from "lucide-react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { updateWorkspace } from "@/lib/actions/workspace"
import { toast } from "sonner"
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog"

type WorkspaceSummary = {
  id: string
  name?: string | null
  businessType?: string | null
  currency?: string | null
}

type WorkspaceMember = {
  id: string
  role: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

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

export default function SettingsPage() {
  const { data: session } = useSession()
  const workspaceId = session?.user?.workspaceId
  const { data: workspace, mutate: mutateWorkspace } = useSWR<WorkspaceSummary>(
    workspaceId ? ["/api/workspaces/current", workspaceId] : null,
    fetcher
  )
  const { data: members, isLoading: membersLoading } = useSWR<
    WorkspaceMember[]
  >(workspaceId ? ["/api/workspaces/members", workspaceId] : null, fetcher)

  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = React.useState(false)
  const [workspaceForm, setWorkspaceForm] = React.useState({
    name: "",
    businessType: "",
    currency: "KES",
  })

  React.useEffect(() => {
    if (workspace) {
      React.startTransition(() => {
        setWorkspaceForm({
          name: workspace.name || "",
          businessType: workspace.businessType || "",
          currency: workspace.currency || "KES",
        })
      })
    }
  }, [workspace])

  async function handleUpdateWorkspace() {
    if (!workspace?.id) return

    setIsUpdatingWorkspace(true)
    try {
      const result = await updateWorkspace(workspace.id, workspaceForm)
      if (result.success) {
        toast.success("Workspace updated successfully")
        mutateWorkspace()
      } else {
        toast.error(result.error || "Failed to update workspace")
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      )
    } finally {
      setIsUpdatingWorkspace(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, team, and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <User className="mr-1.5 h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Team
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your personal account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {session?.user?.name?.slice(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    Change avatar
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG or GIF. Max 2MB.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  defaultValue={session?.user?.name || ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={session?.user?.email || ""}
                  disabled
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button size="sm">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save changes
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
              <CardDescription>
                Organization details for your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="company">Company name</Label>
                  <Input
                    id="company"
                    value={workspaceForm.name}
                    onChange={(e) =>
                      setWorkspaceForm({
                        ...workspaceForm,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={workspaceForm.businessType}
                    onValueChange={(v) =>
                      setWorkspaceForm({ ...workspaceForm, businessType: v })
                    }
                  >
                    <SelectTrigger id="industry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="manufacturing">
                        Manufacturing
                      </SelectItem>
                      <SelectItem value="ecommerce">E-Commerce</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={workspaceForm.currency}
                    onValueChange={(v) =>
                      setWorkspaceForm({ ...workspaceForm, currency: v })
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KES">Kenyan Shilling (KES)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                size="sm"
                onClick={handleUpdateWorkspace}
                disabled={isUpdatingWorkspace}
              >
                {isUpdatingWorkspace ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save changes
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how the system looks for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Dark mode</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle dark theme
                    </p>
                  </div>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage who has access to this workspace
                  </CardDescription>
                </div>
                <InviteMemberDialog />
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-3.5 py-1">
                  {[...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between border-b border-border/40 pt-3 pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full bg-muted/70" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32 bg-muted/70" />
                          <Skeleton className="h-3 w-44 bg-muted/50" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-16 rounded-full bg-muted/60" />
                        <Skeleton className="h-8 w-8 rounded bg-muted/50" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members?.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={membership.user.image ?? undefined}
                              />
                              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                {membership.user.name
                                  ?.slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {membership.user.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {membership.user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {membership.role.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive"
                            disabled={
                              membership.role === "OWNER" ||
                              membership.user.id === session?.user?.id
                            }
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications & Security placeholders omitted for brevity in this task but kept in real file */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what you want to be notified about
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  title: "Low stock alerts",
                  desc: "When items fall below minimum threshold",
                  default: true,
                },
                {
                  title: "Order updates",
                  desc: "Status changes for orders",
                  default: true,
                },
              ].map((pref) => (
                <div
                  key={pref.title}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{pref.title}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch defaultChecked={pref.default} />
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button size="sm">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Password
              </CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-pw">Current password</Label>
                <Input id="current-pw" type="password" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input id="new-pw" type="password" />
              </div>
            </CardContent>
            <CardFooter>
              <Button size="sm">
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Update password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
