import React from "react"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  valColor?: string
  iconColor?: string
  description?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  valColor = "text-foreground",
  iconColor = "text-muted-foreground",
  description,
}: StatCardProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {title}
            </p>

            <div className={`mt-2 mb-2 text-2xl leading-none font-bold ${valColor}`}>
              {value}
            </div>

            {description && (
              <p className="mt-1 truncate text-[11px] leading-none text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <Icon className={`h-4.5 w-4.5 shrink-0 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  )
}
