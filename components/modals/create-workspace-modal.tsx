"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Building2, 
  Package, 
  Store,
  Factory,
  Briefcase,
  Layers,
  Loader2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkspace } from "@/lib/actions/workspace"
import { toast } from "sonner"

const businessTypes = [
  { id: "retail", label: "Retail", icon: <Store className="w-4 h-4" /> },
  { id: "manufacturing", label: "Manufacturing", icon: <Factory className="w-4 h-4" /> },
  { id: "wholesale", label: "Wholesale", icon: <Layers className="w-4 h-4" /> },
  { id: "services", label: "Services", icon: <Briefcase className="w-4 h-4" /> },
]

const inventorySizes = [
  { id: "small", label: "1 - 100" },
  { id: "medium", label: "100 - 1k" },
  { id: "large", label: "1k - 10k" },
  { id: "enterprise", label: "10k+" },
]

export function CreateWorkspaceModal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update } = useSession()
  
  const isOpen = searchParams.get("createWorkspace") === "true"

  const [formData, setFormData] = useState({
    name: "",
    businessType: "",
    inventorySize: "",
    goals: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onClose = () => {
    // Reset form when closing
    setFormData({
      name: "",
      businessType: "",
      inventorySize: "",
      goals: [],
    })
    
    // Remove query param
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.delete("createWorkspace")
    // Keep the current path but update search params
    const path = window.location.pathname
    router.push(`${path}?${newSearchParams.toString()}`, { scroll: false })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.businessType || !formData.inventorySize) {
      toast.error("Please fill in all required fields.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createWorkspace(formData)
      if (result.success) {
        await update({ workspaceId: result.workspaceId, workspaceName: result.workspaceName })
        toast.success("Workspace created successfully!")
        onClose()
        router.refresh()
      } else {
        toast.error(result.error || "Failed to create workspace")
      }
    } catch (error) {
      toast.error("An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Add a new workspace to manage a different business or inventory location.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Acme Corporation"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Business Type *</Label>
            <div className="grid grid-cols-2 gap-3">
              {businessTypes.map((type) => (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => setFormData({ ...formData, businessType: type.id })}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm text-left ${
                    formData.businessType === type.id
                      ? "bg-primary/20 border-primary text-foreground"
                      : "bg-transparent border-border hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <div className={formData.businessType === type.id ? "text-primary" : "text-muted-foreground"}>
                    {type.icon}
                  </div>
                  <span className="font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Inventory Size *</Label>
            <div className="grid grid-cols-4 gap-2">
              {inventorySizes.map((size) => (
                <button
                  type="button"
                  key={size.id}
                  onClick={() => setFormData({ ...formData, inventorySize: size.id })}
                  className={`p-2 rounded-lg border transition-all text-xs font-medium text-center ${
                    formData.inventorySize === size.id
                      ? "bg-primary/20 border-primary text-foreground"
                      : "bg-transparent border-border hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name || !formData.businessType || !formData.inventorySize}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
