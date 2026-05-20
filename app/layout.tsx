import type { Metadata } from "next"

import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

const OG_TITLE = "Mizani Systems — Precision Inventory Tracking"
const OG_DESCRIPTION =
  "Stop guessing what's on your shelves. Mizani Systems gives your team real-time stock visibility, automated low-stock alerts, and deep sales insights — all in one sleek dashboard. From a single storefront to multi-warehouse operations, we scale with you."

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: OG_TITLE,
    template: "%s · Mizani Systems",
  },
  description: OG_DESCRIPTION,
  keywords: [
    "inventory management",
    "stock tracking",
    "warehouse management",
    "inventory software",
    "Mizani Systems",
    "real-time inventory",
    "stock alerts",
    "order management",
  ],
  authors: [{ name: "Mizani Systems" }],
  creator: "Mizani Systems",
  publisher: "Mizani Systems",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Mizani Systems",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Mizani Systems — Precision Inventory Tracking dashboard preview",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@mizanisystems",
  },
  icons: {
    icon: "/mizani_logo.ico",
    shortcut: "/mizani_logo.ico",
    apple: "/mizani_logo.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
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
