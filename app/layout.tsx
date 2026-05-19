import type { Metadata } from "next"

import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Mizani Systems — Precision Inventory Tracking",
  description:
    "Track inventory, manage stock levels, and gain real-time insights with Mizani Systems' modern inventory tracker.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans"
      )}
    >
      <body className="flex min-h-screen flex-col">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
