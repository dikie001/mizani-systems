"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ImageWithSpinner } from "@/components/image-with-spinner"
import type { Session } from "next-auth"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Check,
  BarChart3,
  Layers,
  Smartphone,
  Shield,
  TrendingUp,
  Users,
  Menu,
  X,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import PricingSection from "./landing/pricing.section"
import {
  BookDemoModal,
  ContactSalesModal,
} from "@/components/landing/lead-modals"

// ─── Animation Variants ──────────────────────────────────────────────────────

const ease = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease },
  }),
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ─── Background ──────────────────────────────────────────────────────────────

function HeroBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden
    >
      {/* Fine dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / 0.12) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)",
        }}
      />

      {/* Slow horizontal gradient sweep — enterprise scanner effect */}
      <motion.div
        className="absolute top-0 right-0 left-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.4) 50%, transparent 100%)",
        }}
        animate={{ y: [0, 560, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />

      {/* Top-right soft glow — geometric cone, not blob */}
      <div
        className="absolute -top-40 right-0 h-[520px] w-[520px] opacity-[0.07]"
        style={{
          background:
            "conic-gradient(from 180deg at 100% 0%, hsl(var(--primary)) 0deg, transparent 120deg)",
        }}
      />

      {/* Bottom-left soft glow */}
      <div
        className="absolute -bottom-40 -left-20 h-[400px] w-[400px] opacity-[0.05]"
        style={{
          background:
            "conic-gradient(from 0deg at 0% 100%, hsl(var(--primary)) 0deg, transparent 100deg)",
        }}
      />

      {/* Vertical column accent lines */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: `${(i + 1) * 16.66}%`,
            background:
              "linear-gradient(180deg, hsl(var(--border) / 0.6) 0%, transparent 100%)",
          }}
          initial={{ opacity: 0, scaleY: 0, originY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease }}
        />
      ))}
    </div>
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ session }: { session: Session | null }) {
  const [isOpen, setIsOpen] = useState(false)

  const navLinks = ["Features", "Pricing", "About"]

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight whitespace-nowrap"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <Image
                src="/mizani_logo.png"
                alt="Mizani"
                width={32}
                height={32}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <span className="hidden sm:inline">Mizani Systems</span>
            <span className="sm:hidden">Mizani</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {navLinks.map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase()}`}
                className="transition-colors duration-150 hover:text-foreground"
              >
                {item}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg md:hidden"
            onClick={() => setIsOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b border-border/60 px-5 py-4">
            <SheetTitle asChild>
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <Image
                    src="/mizani_logo.png"
                    alt="Mizani"
                    width={28}
                    height={28}
                    className="h-full w-full object-contain"
                  />
                </div>
                Mizani Systems
              </Link>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {navLinks.map((item) => (
              <SheetClose key={item} asChild>
                <Link
                  href={`#${item.toLowerCase()}`}
                  className="flex h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item}
                </Link>
              </SheetClose>
            ))}
          </nav>

          <div className="space-y-2 border-t border-border/60 px-4 py-5">
            {session ? (
              <SheetClose asChild>
                <Button className="w-full" asChild>
                  <Link href="/dashboard">
                    Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </SheetClose>
            ) : (
              <>
                <SheetClose asChild>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/auth">Sign in</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button className="w-full" asChild>
                    <Link href="/auth">Get started</Link>
                  </Button>
                </SheetClose>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const INVENTORY_ROWS = [
  {
    name: "Adidas Ultraboost 24",
    price: "$159.00",
    status: "In Stock",
    stock: "240",
    trend: "+12%",
  },
  {
    name: "Adidas Predator Elite",
    price: "$129.00",
    status: "In Stock",
    stock: "220",
    trend: "+8%",
  },
  {
    name: "Nike Air Force 1 '07",
    price: "$110.00",
    status: "Low Stock",
    stock: "12",
    trend: "-3%",
  },
  {
    name: "Puma Suede Classic",
    price: "$89.00",
    status: "Out of Stock",
    stock: "0",
    trend: "—",
  },
]

const STATUS_COLOR: Record<string, string> = {
  "In Stock": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Low Stock": "bg-amber-500/10  text-amber-700  dark:text-amber-400",
  "Out of Stock": "bg-red-500/10    text-red-700    dark:text-red-400",
}

function HeroSection({
  session,
  onBookDemo,
}: {
  session: Session | null
  onBookDemo: () => void
}) {
  return (
    <section className="relative overflow-hidden bg-background pt-20 pb-28 md:pt-28 md:pb-36">
      <HeroBackground />

      <div className="relative z-10 container mx-auto px-6">
        {/* Top pill + headline */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mx-auto mb-14 max-w-3xl text-center"
        >
          <motion.h1
            variants={fadeUp}
            custom={0.08}
            className="text-3xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
          >
            Inventory tracking built <br className="hidden sm:inline" />
            <span className="font-normal text-muted-foreground">
              for the modern enterprise
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={0.16}
            className="mx-auto mt-4 max-w-xl px-4 text-sm leading-relaxed text-muted-foreground sm:px-0 sm:text-base md:text-[1.05rem]"
          >
            Monitor stock levels, automate replenishment, and surface insights
            across your entire catalog — all in one place.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={0.24}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button size="lg" className="h-10 px-6 text-sm font-medium" asChild>
              <Link href={session ? "/dashboard" : "/auth"}>
                {session ? "Open Dashboard" : "Start free trial"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-10 px-6 text-sm font-medium"
              onClick={onBookDemo}
            >
              Book a demo
            </Button>
          </motion.div>
        </motion.div>

        {/* Hero table card */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.35, ease }}
          className="mx-auto max-w-4xl"
        >
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg shadow-black/5">
            {/* Card header bar */}
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Inventory · Live
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Syncing
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="py-3 pl-5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Product
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Price
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Status
                    </TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Stock
                    </TableHead>
                    <TableHead className="py-3 pr-5 text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                      30d
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INVENTORY_ROWS.map((row, i) => (
                    <motion.tr
                      key={row.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: 0.55 + i * 0.07,
                        ease,
                      }}
                      className="border-border/40 whitespace-nowrap transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="py-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-foreground/70">
                            {row.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">
                            {row.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="font-mono text-sm">{row.price}</span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <span className="text-sm font-medium tabular-nums">
                          {row.stock}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 pr-5 text-right">
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${row.trend.startsWith("+") ? "text-emerald-600" : row.trend === "—" ? "text-muted-foreground" : "text-red-600"}`}
                        >
                          {row.trend}
                        </span>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Layers,
    title: "Unified Management",
    desc: "One dashboard for every warehouse, SKU, and supplier relationship. Reduce context-switching with a single source of truth.",
  },
  {
    icon: BarChart3,
    title: "Automated Workflows",
    desc: "Set reorder points, trigger purchase orders, and receive low-stock alerts before stockouts happen — automatically.",
  },
  {
    icon: Smartphone,
    title: "Mobile-First Operations",
    desc: "Full-featured mobile app for warehouse staff. Scan barcodes, adjust quantities, and receive transfers from the floor.",
  },
  {
    icon: Shield,
    title: "Audit & Compliance",
    desc: "Immutable audit logs, role-based access control, and SOC 2 Type II compliant infrastructure baked in by default.",
  },
  {
    icon: TrendingUp,
    title: "Demand Forecasting",
    desc: "Machine-learning models trained on your historical data surface seasonality trends and recommended stock levels.",
    comingSoon: true,
  },
  {
    icon: Users,
    title: "Multi-Team Collaboration",
    desc: "Fine-grained permissions for finance, ops, and logistics teams so everyone sees exactly what they need — nothing more.",
    comingSoon: true,
  },
]

function FeatureSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden border-y border-border/50 bg-muted/20 py-16 md:py-24"
    >
      {/* Section background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="mb-14 max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Platform capabilities
          </motion.p>
          <motion.h2
            variants={fadeUp}
            custom={0.06}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Everything your team needs, nothing it doesn&apos;t
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i * 0.05}>
              <Card className="group relative h-full overflow-hidden border border-border/60 bg-card/80 transition-all duration-200 hover:bg-card hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/5">
                      <f.icon className="h-4 w-4 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
                    </div>
                    {"comingSoon" in f && f.comingSoon && (
                      <span className="mb-4 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-primary uppercase">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base font-semibold">
                    {f.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Manage Section ───────────────────────────────────────────────────────────

function ManageSection() {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto grid items-center gap-16 px-6 lg:grid-cols-2">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.p
            variants={fadeUp}
            className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Pricing control
          </motion.p>
          <motion.h2
            variants={fadeUp}
            custom={0.06}
            className="mb-5 text-3xl leading-snug font-bold tracking-tight sm:text-4xl"
          >
            Precision pricing <br className="hidden sm:block" /> across every
            SKU
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={0.12}
            className="mb-8 max-w-md leading-relaxed text-muted-foreground"
          >
            Set tiered pricing rules, monitor cost fluctuations, and forecast
            margin impact before committing to bulk orders — all without leaving
            your inventory view.
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={0.18}
            className="flex flex-wrap items-center gap-4"
          >
            <Button className="h-10 px-5 text-sm">
              Learn more <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              className="h-10 px-5 text-sm text-muted-foreground"
            >
              See pricing rules →
            </Button>
          </motion.div>

          {/* Feature bullets */}
          <motion.ul
            variants={stagger}
            className="mt-10 grid grid-cols-2 gap-3"
          >
            {[
              "Tiered price rules",
              "Margin forecasting",
              "Cost tracking",
              "Supplier comparison",
              "Currency support",
              "Bulk import/export",
            ].map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease }}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-3">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Price ledger
            </span>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              Live
            </Badge>
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="pl-5 text-[11px] tracking-wider text-muted-foreground uppercase">
                    Product
                  </TableHead>
                  <TableHead className="text-right text-[11px] tracking-wider text-muted-foreground uppercase">
                    Cost
                  </TableHead>
                  <TableHead className="text-right text-[11px] tracking-wider text-muted-foreground uppercase">
                    Price
                  </TableHead>
                  <TableHead className="pr-5 text-right text-[11px] tracking-wider text-muted-foreground uppercase">
                    Margin
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    name: "Ultraboost 24",
                    cost: "$89",
                    price: "$159",
                    margin: "44%",
                  },
                  {
                    name: "Predator Elite",
                    cost: "$71",
                    price: "$129",
                    margin: "45%",
                  },
                  {
                    name: "Air Force 1",
                    cost: "$55",
                    price: "$110",
                    margin: "50%",
                  },
                  {
                    name: "NB 990 v6",
                    cost: "$104",
                    price: "$185",
                    margin: "44%",
                  },
                ].map((row) => (
                  <TableRow
                    key={row.name}
                    className="border-border/40 whitespace-nowrap transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="py-3.5 pl-5 text-sm font-medium">
                      {row.name}
                    </TableCell>
                    <TableCell className="py-3.5 text-right font-mono text-sm text-muted-foreground">
                      {row.cost}
                    </TableCell>
                    <TableCell className="py-3.5 text-right font-mono text-sm">
                      {row.price}
                    </TableCell>
                    <TableCell className="py-3.5 pr-5 text-right">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                        {row.margin}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mini bar chart */}
          <div className="border-t border-border/50 bg-muted/20 px-5 py-4">
            <p className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Avg margin — last 7 months
            </p>
            <div className="flex h-14 items-end gap-1.5">
              {[38, 42, 40, 46, 43, 47, 45].map((h, i) => (
                <div
                  key={i}
                  className="group relative flex-1 cursor-default rounded-sm bg-primary/15 transition-colors hover:bg-primary/30"
                  style={{ height: `${(h / 50) * 100}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {h}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

// const PLANS = [
//   {
//     name: "Basic",
//     price: "$49",
//     period: "/month",
//     desc: "For small operations getting off spreadsheets.",
//     features: [
//       "Up to 1,000 SKUs",
//       "2 admin users",
//       "Standard dashboard",
//       "Email support",
//       "CSV import/export",
//     ],
//     cta: "Start Basic",
//     highlight: false,
//   },
//   {
//     name: "Professional",
//     price: "$129",
//     period: "/month",
//     desc: "For growing teams that need the full platform.",
//     features: [
//       "Unlimited SKUs",
//       "Unlimited users",
//       "Advanced analytics",
//       "API access",
//       "Priority 24/7 support",
//       "Custom integrations",
//     ],
//     cta: "Start Professional",
//     highlight: true,
//   },
// ]

// function PricingSection() {
//   return (
//     <section
//       id="pricing"
//       className="relative overflow-hidden border-t border-border/50 bg-muted/20 py-24"
//     >
//       <div
//         className="pointer-events-none absolute inset-0 opacity-[0.025]"
//         style={{
//           backgroundImage: `
//             linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
//             linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
//           `,
//           backgroundSize: "40px 40px",
//         }}
//       />

//       <div className="relative z-10 container mx-auto px-6">
//         <motion.div
//           initial="hidden"
//           whileInView="visible"
//           viewport={{ once: true }}
//           variants={stagger}
//           className="mb-14 text-center"
//         >
//           <motion.p
//             variants={fadeUp}
//             className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
//           >
//             Pricing
//           </motion.p>
//           <motion.h2
//             variants={fadeUp}
//             custom={0.06}
//             className="text-3xl font-bold tracking-tight sm:text-4xl"
//           >
//             Transparent, straightforward pricing
//           </motion.h2>
//           <motion.p
//             variants={fadeUp}
//             custom={0.12}
//             className="mx-auto mt-3 max-w-md text-muted-foreground"
//           >
//             No hidden fees. No seat limits on the plans that matter. Cancel
//             anytime.
//           </motion.p>
//         </motion.div>

//         <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
//           {PLANS.map((plan, i) => (
//             <motion.div
//               key={plan.name}
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.55, delay: i * 0.1, ease }}
//             >
//               <Card
//                 className={`relative flex h-full flex-col transition-shadow duration-200 ${
//                   plan.highlight
//                     ? "border-foreground/20 shadow-lg ring-1 ring-foreground/10"
//                     : "border-border/60"
//                 }`}
//               >
//                 {plan.highlight && (
//                   <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
//                 )}
//                 <CardHeader className="pt-7 pb-5">
//                   <div className="mb-4 flex items-center justify-between">
//                     <span className="text-sm font-semibold">{plan.name}</span>
//                     {plan.highlight && (
//                       <Badge className="rounded-full px-2.5 text-[10px]">
//                         Most popular
//                       </Badge>
//                     )}
//                   </div>
//                   <p className="mb-5 text-sm text-muted-foreground">
//                     {plan.desc}
//                   </p>
//                   <div className="flex items-baseline gap-1">
//                     <span className="text-4xl font-bold tracking-tight">
//                       {plan.price}
//                     </span>
//                     <span className="text-sm text-muted-foreground">
//                       {plan.period}
//                     </span>
//                   </div>
//                 </CardHeader>

//                 <Separator className="mx-6" />

//                 <CardContent className="flex flex-1 flex-col pt-5">
//                   <ul className="mb-7 flex-1 space-y-3">
//                     {plan.features.map((f) => (
//                       <li key={f} className="flex items-center gap-2.5 text-sm">
//                         <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
//                           <Check className="h-2.5 w-2.5 text-primary" />
//                         </div>
//                         <span className="text-muted-foreground">{f}</span>
//                       </li>
//                     ))}
//                   </ul>
//                   <Button
//                     className="h-10 w-full text-sm"
//                     variant={plan.highlight ? "default" : "outline"}
//                   >
//                     {plan.cta}
//                   </Button>
//                 </CardContent>
//               </Card>
//             </motion.div>
//           ))}
//         </div>

//         {/* Enterprise callout */}
//         <motion.div
//           initial={{ opacity: 0 }}
//           whileInView={{ opacity: 1 }}
//           viewport={{ once: true }}
//           transition={{ duration: 0.5, delay: 0.3 }}
//           className="mx-auto mt-8 flex max-w-3xl flex-col items-start justify-between gap-4 rounded-xl border border-border/50 bg-card px-6 py-5 sm:flex-row sm:items-center"
//         >
//           <div>
//             <p className="text-sm font-semibold">Enterprise</p>
//             <p className="mt-0.5 text-sm text-muted-foreground">
//               Custom contracts, SLA guarantees, SSO, and dedicated
//               infrastructure.
//             </p>
//           </div>
//           <Button variant="outline" size="sm" className="shrink-0">
//             Contact sales
//           </Button>
//         </motion.div>
//       </div>
//     </section>
//   )
// }

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex shrink-0 items-center gap-2.5 text-sm font-semibold whitespace-nowrap">
              <div className="rounded- flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-border bg-card shadow-sm">
                <Image
                  src="/mizani_logo.png"
                  alt="Mizani"
                  width={28}
                  height={28}
                  className="h-full w-full object-contain"
                />
              </div>
              Mizani Systems
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Precision inventory tracking for modern operations. Built for
              teams who demand reliability.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            {[
              {
                heading: "Product",
                links: ["Features", "Pricing", "Changelog", "Roadmap"],
              },
              {
                heading: "Company",
                links: ["About", "Blog", "Careers", "Contact"],
              },
              { heading: "Legal", links: ["Privacy", "Terms", "Security"] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <p className="mb-3 text-[11px] font-semibold tracking-wider text-foreground uppercase">
                  {heading}
                </p>
                <ul className="space-y-2">
                  {links.map((l) => (
                    <li key={l}>
                      <Link
                        href={
                          l === "Privacy"
                            ? "/privacy"
                            : l === "Terms"
                              ? "/terms"
                              : "#"
                        }
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} Mizani Systems, Inc. All rights
            reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Branded page loader ─────────────────────────────────────────────────────

function PageLoader() {
  return (
    <motion.div
      key="page-loader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
    >
      {/* Custom spinner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease }}
        className="relative flex items-center justify-center"
      >
        {/* Outer ring */}
        <svg
          className="h-14 w-14 animate-spin"
          viewBox="0 0 56 56"
          fill="none"
          aria-hidden
        >
          <circle
            cx="28"
            cy="28"
            r="22"
            stroke="hsl(var(--primary) / 0.15)"
            strokeWidth="4"
          />
          <path
            d="M28 6 a22 22 0 0 1 22 22"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        {/* Inner pulsing dot */}
        <span className="absolute h-3 w-3 animate-pulse rounded-full bg-primary/70" />
      </motion.div>
    </motion.div>
  )
}

export default function LandingClient({
  session,
}: {
  session: Session | null
}) {
  const [isDemoOpen, setIsDemoOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowLoader(false), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/15">
      {/* AnimatePresence here so exit animation on PageLoader actually runs */}
      <AnimatePresence>
        {showLoader && <PageLoader key="page-loader" />}
      </AnimatePresence>

      <div
        style={{
          opacity: showLoader ? 0 : 1,
          transition: "opacity 0.45s ease",
          // keep it out of the accessibility tree while hidden
          visibility: showLoader ? "hidden" : "visible",
        }}
      >
        <Navbar session={session} />
        <main>
          <HeroSection
            session={session}
            onBookDemo={() => setIsDemoOpen(true)}
          />
          <FeatureSection />
          <ManageSection />
          <PricingSection onContactSales={() => setIsContactOpen(true)} />
        </main>
        <Footer />
      </div>

      <BookDemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
      <ContactSalesModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  )
}
