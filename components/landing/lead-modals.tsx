"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Calendar, Send, Sparkles, Building, Phone, Mail, User, Loader2 } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BookDemoModal({ isOpen, onClose }: ModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Please fill in your name and email.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit demo request.")
      }

      toast.success("Demo booking submitted successfully! We will contact you soon.")
      setFormData({ name: "", email: "", company: "", phone: "", message: "" })
      onClose()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unexpected error occurred. Please try again."
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl p-6 rounded-2xl overflow-hidden">
        {/* Subtle decorative glow in top-right */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <DialogHeader className="space-y-2.5 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 shadow-md shadow-primary/5 text-primary mb-1">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Book an Online Demo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Experience how StockVault can streamline your catalog, automate orders, and cut down inventory overhead in a 1-on-1 demo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 relative z-10">
          <div className="space-y-1.5">
            <Label htmlFor="demo-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Name <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="demo-name"
                type="text"
                placeholder="John Doe"
                className="pl-9 h-10 border-border/80 bg-muted/20"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="demo-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Business Email <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="demo-email"
                type="email"
                placeholder="john@company.com"
                className="pl-9 h-10 border-border/80 bg-muted/20"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="demo-company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Company
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="demo-company"
                  type="text"
                  placeholder="Acme Corp"
                  className="pl-9 h-10 border-border/80 bg-muted/20"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="demo-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="demo-phone"
                  type="tel"
                  placeholder="+254 712..."
                  className="pl-9 h-10 border-border/80 bg-muted/20"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="demo-message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Preferred Date or Special Requests (Optional)
            </Label>
            <Textarea
              id="demo-message"
              placeholder="e.g. Next Tuesday afternoon, interested in multi-warehouse sync..."
              className="min-h-[80px] border-border/80 bg-muted/20"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-10 border-border text-foreground hover:bg-muted"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 flex items-center justify-center gap-2 shadow-lg shadow-primary/10 px-5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule Demo
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ContactSalesModal({ isOpen, onClose }: ModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in your name, email, and message.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send sales inquiry.")
      }

      toast.success("Sales inquiry sent successfully! Our team will get back to you shortly.")
      setFormData({ name: "", email: "", company: "", phone: "", message: "" })
      onClose()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An unexpected error occurred. Please try again."
      toast.error(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl p-6 rounded-2xl overflow-hidden">
        {/* Subtle decorative glow in top-right */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <DialogHeader className="space-y-2.5 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/5 shadow-md shadow-indigo-500/5 text-indigo-500 mb-1">
            <Send className="h-5 w-5 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Contact Enterprise Sales
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Discuss custom pricing contracts, SLA agreements, high-volume limits, or dedicated deployment configurations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 relative z-10">
          <div className="space-y-1.5">
            <Label htmlFor="sales-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Name <span className="text-indigo-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="sales-name"
                type="text"
                placeholder="John Doe"
                className="pl-9 h-10 border-border/80 bg-muted/20"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sales-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Work Email <span className="text-indigo-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="sales-email"
                type="email"
                placeholder="john@company.com"
                className="pl-9 h-10 border-border/80 bg-muted/20"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sales-company" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Company Name
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="sales-company"
                  type="text"
                  placeholder="Acme Corp"
                  className="pl-9 h-10 border-border/80 bg-muted/20"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sales-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="sales-phone"
                  type="tel"
                  placeholder="+254 712..."
                  className="pl-9 h-10 border-border/80 bg-muted/20"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sales-message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What are your enterprise needs? <span className="text-indigo-500">*</span>
            </Label>
            <Textarea
              id="sales-message"
              placeholder="Tell us about your estimated SKU count, monthly order volume, or integrations required..."
              className="min-h-[90px] border-border/80 bg-muted/20"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-10 border-border text-foreground hover:bg-muted"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 bg-indigo-600 text-white font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 px-5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
