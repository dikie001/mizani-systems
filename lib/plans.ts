export const PLANS = [
  {
    id: "trial",
    name: "trial",
    displayName: "Free Trial",
    badge: "14 days",
    monthlyPrice: 0,
    description: "No card required. Try the full platform risk-free.",
    features: [
      "Up to 200 SKUs",
      "1 admin user",
      "Standard dashboard",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlight: false,
    variant: "secondary",
  },
  {
    id: "basic",
    name: "basic",
    displayName: "Basic",
    badge: null,
    monthlyPrice: 675,
    description: "For small operations getting off spreadsheets.",
    features: [
      "Up to 1,000 SKUs",
      "2 admin users",
      "Standard dashboard",
      "Email support",
      "CSV import/export",
    ],
    cta: "Start Basic",
    highlight: false,
    variant: "outline",
  },
  {
    id: "pro",
    name: "pro",
    displayName: "Professional",
    badge: "Most Popular",
    monthlyPrice: 1250,
    description: "For growing teams that need the full platform.",
    features: [
      "Unlimited SKUs",
      "Unlimited users",
      "Advanced analytics",
      "API access",
      "Priority 24/7 support",
      "Custom integrations",
    ],
    cta: "Start Professional",
    highlight: true,
    variant: "default",
  },
]

export const PLAN_MAP = new Map(PLANS.map((plan) => [plan.name, plan]))

export type PlanName = "trial" | "basic" | "pro"

export type PlanEntitlements = {
  maxWorkspaces: number | null
  maxProducts: number | null
  maxAdminUsers: number | null
  canExportCsv: boolean
  canUseAnalytics: boolean
  canUseApiAccess: boolean
  canUseCustomIntegrations: boolean
  canUsePrioritySupport: boolean
}

export const PLAN_ENTITLEMENTS: Record<PlanName, PlanEntitlements> = {
  trial: {
    maxWorkspaces: 1,
    maxProducts: 200,
    maxAdminUsers: 1,
    canExportCsv: false,
    canUseAnalytics: false,
    canUseApiAccess: false,
    canUseCustomIntegrations: false,
    canUsePrioritySupport: false,
  },
  basic: {
    maxWorkspaces: 3,
    maxProducts: 1000,
    maxAdminUsers: 2,
    canExportCsv: true,
    canUseAnalytics: false,
    canUseApiAccess: false,
    canUseCustomIntegrations: false,
    canUsePrioritySupport: false,
  },
  pro: {
    maxWorkspaces: null,
    maxProducts: null,
    maxAdminUsers: null,
    canExportCsv: true,
    canUseAnalytics: true,
    canUseApiAccess: true,
    canUseCustomIntegrations: true,
    canUsePrioritySupport: true,
  },
}

export function resolvePlanName(name?: string | null): PlanName {
  if (name === "basic" || name === "pro") {
    return name
  }

  return "trial"
}

export function getPlanEntitlements(name?: string | null): PlanEntitlements {
  return PLAN_ENTITLEMENTS[resolvePlanName(name)]
}

export function getWorkspacePlanName(
  subscription?: {
    plan?: { name?: string | null } | null
  } | null
): PlanName {
  return resolvePlanName(subscription?.plan?.name)
}

export function getHighestPlanName(
  planNames: Array<string | null | undefined>
) {
  if (planNames.includes("pro")) {
    return "pro" as const
  }

  if (planNames.includes("basic")) {
    return "basic" as const
  }

  return "trial" as const
}

export function countAdminSeats(memberships: Array<{ role: string }>) {
  return memberships.filter((membership) =>
    ["OWNER", "ADMIN"].includes(membership.role)
  ).length
}

export function getPlanByName(name: string) {
  return PLAN_MAP.get(name)
}

export function getPlanById(id: string) {
  return PLANS.find((plan) => plan.id === id)
}

export function formatKES(amount: number): string {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch (e) {
    return `KES ${amount}`
  }
}
