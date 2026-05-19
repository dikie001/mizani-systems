"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Package,
  TrendingUp,
  Check,
  Loader2,
  Store,
  Factory,
  Briefcase,
  Layers,
  ChevronRight,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createWorkspace } from "@/lib/actions/workspace"
import { getPlanById, formatKES, PLANS } from "@/lib/plans"
import { toast } from "sonner"

const steps = [
  {
    id: "name",
    title: "Welcome to StockVault",
    description: "Let's start with your business name.",
    icon: <Briefcase className="h-4 w-4 text-primary" />,
  },
  {
    id: "type",
    title: "Business Type",
    description: "What kind of business are you running?",
    icon: <Building2 className="h-4 w-4 text-primary" />,
  },
  {
    id: "size",
    title: "Inventory Size",
    description: "How many products do you plan to manage?",
    icon: <Package className="h-4 w-4 text-primary" />,
  },
  {
    id: "goals",
    title: "Your Goals",
    description: "What are your primary objectives?",
    icon: <TrendingUp className="h-4 w-4 text-primary" />,
  },
]

const businessTypes = [
  { id: "retail", label: "Retail", icon: <Store className="h-4 w-4" /> },
  {
    id: "manufacturing",
    label: "Manufacturing",
    icon: <Factory className="h-4 w-4" />,
  },
  { id: "wholesale", label: "Wholesale", icon: <Layers className="h-4 w-4" /> },
  {
    id: "services",
    label: "Services",
    icon: <Briefcase className="h-4 w-4" />,
  },
]

const inventorySizes = [
  { id: "small", label: "1 – 100", description: "Just starting out" },
  { id: "medium", label: "100 – 1,000", description: "Growing business" },
  {
    id: "large",
    label: "1,000 – 10,000",
    description: "Established enterprise",
  },
  { id: "enterprise", label: "10,000+", description: "Large scale operations" },
]

const goalOptions = [
  { id: "tracking", label: "Inventory Tracking" },
  { id: "sales", label: "Sales Management" },
  { id: "analytics", label: "Business Analytics" },
  { id: "low-stock", label: "Low Stock Alerts" },
]

interface OnboardingClientProps {
  initialWorkspaceId?: string
  initialWorkspaceName?: string
  initialPlanName?: string
  initialBusinessType?: string
  initialInventorySize?: string
}

export default function OnboardingClient({
  initialWorkspaceId,
  initialWorkspaceName,
  initialPlanName,
  initialBusinessType,
  initialInventorySize,
}: OnboardingClientProps) {
  const { update } = useSession()
  const searchParams = useSearchParams()

  const [hasPreselectedPlan] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      return !!(params.get("plan") || initialPlanName || sessionStorage.getItem("selectedPlan"))
    }
    return !!initialPlanName
  })

  const [currentStep, setCurrentStep] = useState(initialWorkspaceId ? 4 : 0)
  const [formData, setFormData] = useState({
    name: initialWorkspaceName || "",
    businessType: initialBusinessType || "",
    inventorySize: initialInventorySize || "",
    goals: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workspaceData, setWorkspaceData] = useState<{
    workspaceId: string
    workspaceName: string
  } | null>(
    initialWorkspaceId && initialWorkspaceName
      ? { workspaceId: initialWorkspaceId, workspaceName: initialWorkspaceName }
      : null
  )

  const [activePlanId, setActivePlanId] = useState<string>("trial")

  useEffect(() => {
    const urlPlan = searchParams.get("plan") || initialPlanName
    if (urlPlan) {
      setActivePlanId(urlPlan)
      sessionStorage.setItem("selectedPlan", urlPlan)
    } else {
      const stored = sessionStorage.getItem("selectedPlan")
      if (stored) {
        setActivePlanId(stored)
      }
    }
  }, [searchParams, initialPlanName])

  const selectedPlan = getPlanById(activePlanId)
  const isPaidPlan = selectedPlan && selectedPlan.monthlyPrice > 0

  const activeSteps = [...steps]
  if (!hasPreselectedPlan) {
    activeSteps.push({
      id: "choose-plan",
      title: "Select Your Plan",
      description: "Choose a subscription plan that fits your business.",
      icon: <Layers className="h-4 w-4 text-primary" />,
    })
  }
  if (isPaidPlan) {
    activeSteps.push({
      id: "confirm",
      title: "Confirm & Pay",
      description: "Verify your plan selection and proceed to payment.",
      icon: <CreditCard className="h-4 w-4 text-primary" />,
    })
  }

  const activeStep = activeSteps[currentStep]
  const canAdvance =
    (activeStep?.id === "name" && !!formData.name.trim()) ||
    (activeStep?.id === "type" && !!formData.businessType) ||
    (activeStep?.id === "size" && !!formData.inventorySize) ||
    activeStep?.id === "goals" ||
    activeStep?.id === "choose-plan" ||
    activeStep?.id === "confirm"

  const handleCreateWorkspace = useCallback(async () => {
    if (!formData.name || !formData.businessType || !formData.inventorySize) {
      toast.error("Please fill in all details.")
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createWorkspace({
        ...formData,
        planId: selectedPlan?.id,
      })
      if (result.success) {
        const createdWorkspaceData = {
          workspaceId: result.workspaceId!,
          workspaceName: result.workspaceName!,
        }
        setWorkspaceData(createdWorkspaceData)

        if (selectedPlan && selectedPlan.monthlyPrice > 0) {
          // Initialize Paystack payment directly using the created workspace info
          const response = await fetch("/api/payments/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId: selectedPlan.id,
              workspaceId: createdWorkspaceData.workspaceId,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || "Failed to initialize payment")
          }

          if (data.authorizationUrl) {
            toast.success("Redirecting to Paystack...")
            window.location.href = data.authorizationUrl
          } else {
            // Free plan confirmed
            await update({
              workspaceId: createdWorkspaceData.workspaceId,
              workspaceName: createdWorkspaceData.workspaceName,
            })
            toast.success("Plan confirmed!")
            window.location.href = "/dashboard"
          }
        } else {
          // Free plan or trial - complete immediately
          await update({
            workspaceId: createdWorkspaceData.workspaceId,
            workspaceName: createdWorkspaceData.workspaceName,
          })
          toast.success("Workspace created successfully!")
          window.location.href = "/dashboard"
        }
      } else {
        toast.error(result.error || "Failed to create workspace")
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred."
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, update, selectedPlan])

  const handleConfirmPlan = useCallback(async () => {
    if (!workspaceData || !selectedPlan) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          workspaceId: workspaceData.workspaceId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize payment")
      }

      if (data.authorizationUrl) {
        toast.success("Redirecting to Paystack...")
        window.location.href = data.authorizationUrl
      } else {
        // Free plan confirmed
        await update({
          workspaceId: workspaceData.workspaceId,
          workspaceName: workspaceData.workspaceName,
        })
        toast.success("Plan confirmed!")
        window.location.href = "/dashboard"
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to confirm plan"
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [workspaceData, selectedPlan, update])

  const handleNext = useCallback(() => {
    if (!canAdvance) return
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      if (initialWorkspaceId) {
        handleConfirmPlan()
      } else {
        handleCreateWorkspace()
      }
    }
  }, [canAdvance, currentStep, activeSteps.length, handleCreateWorkspace, handleConfirmPlan, initialWorkspaceId])

  // Enter key support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleNext])

  const toggleGoal = (goalId: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter((g) => g !== goalId)
        : [...prev.goals, goalId],
    }))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 selection:bg-primary/30">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute -right-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/8 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header: icon + title + description */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`header-${currentStep}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mb-4 flex items-center gap-2.5"
          >
            <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/10 p-2">
              {activeSteps[currentStep]?.icon}
            </div>
            <div>
              <h1 className="text-lg leading-tight font-semibold text-white">
                {activeSteps[currentStep]?.title}
              </h1>
              <p className="text-xs leading-snug text-slate-400">
                {activeSteps[currentStep]?.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress pills */}
        <div className="mb-4 flex gap-1.5">
          {activeSteps.map((step, idx) => (
            <div
              key={step.id}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: idx <= currentStep ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>
          ))}
        </div>

        {/* Card */}
        <Card className="overflow-hidden border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -16, filter: "blur(6px)" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="p-5"
            >
              {/* Step 0: Business name */}
              {activeStep?.id === "name" && (
                <div className="group relative">
                  <Input
                    autoFocus
                    placeholder="e.g. Acme Corporation"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-10 border-white/10 bg-white/5 px-3 text-sm text-white transition-all placeholder:text-slate-500 focus:border-primary/60 focus:ring-primary/20"
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100">
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      ↵
                    </kbd>
                  </div>
                </div>
              )}

              {/* Step 1: Business type */}
              {activeStep?.id === "type" && (
                <div className="grid grid-cols-2 gap-2">
                  {businessTypes.map((type) => {
                    const active = formData.businessType === type.id
                    return (
                      <button
                        key={type.id}
                        onClick={() =>
                          setFormData({ ...formData, businessType: type.id })
                        }
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                          active
                            ? "border-primary/60 bg-primary/15 text-white"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <div
                          className={`shrink-0 transition-colors ${active ? "text-primary" : "text-slate-500"}`}
                        >
                          {type.icon}
                        </div>
                        <span className="text-sm font-medium">
                          {type.label}
                        </span>
                        {active && (
                          <div className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
                            <Check className="h-2.5 w-2.5 stroke-3 text-slate-950" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Step 2: Inventory size */}
              {activeStep?.id === "size" && (
                <div className="space-y-2">
                  {inventorySizes.map((size) => {
                    const active = formData.inventorySize === size.id
                    return (
                      <button
                        key={size.id}
                        onClick={() =>
                          setFormData({ ...formData, inventorySize: size.id })
                        }
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                          active
                            ? "border-primary/60 bg-primary/15"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <div>
                          <div
                            className={`text-sm font-medium ${active ? "text-white" : "text-slate-200"}`}
                          >
                            {size.label}
                          </div>
                          <div className="text-xs text-slate-500">
                            {size.description}
                          </div>
                        </div>
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                            active
                              ? "border-primary bg-primary"
                              : "border-white/20"
                          }`}
                        >
                          {active && (
                            <Check className="h-2.5 w-2.5 stroke-3 text-slate-950" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Step 3: Goals */}
              {activeStep?.id === "goals" && (
                <div className="grid grid-cols-2 gap-2">
                  {goalOptions.map((goal) => {
                    const active = formData.goals.includes(goal.id)
                    return (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                          active
                            ? "border-primary/60 bg-primary/15 text-white"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {goal.label}
                        </span>
                        <div
                          className={`ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all ${
                            active
                              ? "border-primary bg-primary"
                              : "border-white/20"
                          }`}
                        >
                          {active && (
                            <Check className="h-2.5 w-2.5 stroke-3 text-slate-950" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Step: Choose Plan (Only if user signed up without pre-selecting a plan) */}
              {activeStep?.id === "choose-plan" && (
                <div className="space-y-3">
                  {PLANS.map((plan) => {
                    const active = activePlanId === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setActivePlanId(plan.id)
                          sessionStorage.setItem("selectedPlan", plan.id)
                        }}
                        className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                          active
                            ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                {plan.displayName}
                              </span>
                              {plan.badge && (
                                <Badge className="bg-primary/20 text-primary border border-primary/30 font-bold px-1.5 py-0 text-[10px] select-none">
                                  {plan.badge}
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm font-extrabold text-white">
                              {plan.monthlyPrice === 0 ? "Free" : formatKES(plan.monthlyPrice)}
                              {plan.monthlyPrice > 0 && <span className="text-[10px] font-medium text-slate-400">/mo</span>}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-400">
                            {plan.description}
                          </p>

                          <div className="flex items-center gap-1.5 pt-1.5 text-[11px] text-slate-300">
                            <Check className="h-3.5 w-3.5 text-primary" />
                            <span>{plan.features[0]}</span>
                          </div>
                        </div>

                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all mt-1 ${
                            active
                              ? "border-primary bg-primary"
                              : "border-white/20"
                          }`}
                        >
                          {active && (
                            <Check className="h-2.5 w-2.5 stroke-3 text-slate-950" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Step: Confirm Plan & Pay */}
              {activeStep?.id === "confirm" && selectedPlan && (
                <div className="space-y-4">
                  <div className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3">
                      <Badge className="bg-primary/20 border border-primary/30 text-primary font-bold px-2 py-0.5 text-[10px]">
                        Selected Plan
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Plan Summary</span>
                      <h3 className="text-base font-bold text-white">{selectedPlan.displayName} Plan</h3>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-white">
                        {formatKES(selectedPlan.monthlyPrice)}
                      </span>
                      <span className="text-xs text-slate-400">/month</span>
                    </div>

                    <p className="text-xs text-slate-400 leading-normal">
                      {selectedPlan.description}
                    </p>

                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Key Features Included:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedPlan.features.slice(0, 4).map((feature) => (
                          <div key={feature} className="flex items-center gap-1.5 text-[11px]">
                            <Check className="h-3 w-3 text-primary shrink-0 bg-primary/10 p-0.5 rounded-full" />
                            <span className="text-slate-300 truncate">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">
                      You will be securely redirected to Paystack to complete your checkout.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-4 flex gap-2">
                {currentStep > 0 && !initialWorkspaceId && (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    className="h-9 rounded-lg px-4 text-xs text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={isSubmitting || !canAdvance}
                  className="h-9 flex-1 rounded-lg bg-primary text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(var(--primary),0.25)] transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {currentStep === activeSteps.length - 1
                        ? "Confirm & Pay"
                        : "Continue"}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Footer */}
        <p className="mt-3 text-center text-xs text-slate-600">
          Step {currentStep + 1} of {activeSteps.length} · Secure & Encrypted
        </p>
      </div>
    </div>
  )
}
