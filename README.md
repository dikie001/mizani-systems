# Mizani Systems — Precision Inventory Tracking

> A production-grade, multi-tenant inventory management SaaS built with Next.js 16, Prisma, and Paystack.

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Authentication](#authentication)
  - [Multi-Workspace & Multi-Tenancy](#multi-workspace--multi-tenancy)
  - [Inventory Management](#inventory-management)
  - [Order Management](#order-management)
  - [Stock Alerts & Notifications](#stock-alerts--notifications)
  - [Reports & Analytics](#reports--analytics)
  - [Billing & Subscriptions](#billing--subscriptions)
  - [Audit Log](#audit-log)
  - [Super Admin Panel](#super-admin-panel)
  - [Rate Limiting](#rate-limiting)
  - [Open Graph / Social Sharing](#open-graph--social-sharing)
- [Data Model](#data-model)
- [Subscription Plans](#subscription-plans)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

**Mizani Systems** is a full-stack inventory management platform designed for modern businesses — from single storefronts to multi-warehouse enterprises. It offers real-time stock tracking, automated low-stock alerts, order management, margin analytics, and team collaboration, all wrapped in a sleek, responsive dashboard.

The application is built as a **SaaS product** with:
- Google OAuth sign-in via a seamless popup flow
- Multi-tenant workspaces with role-based access (Owner / Admin / Member)
- Tiered subscription billing through **Paystack** (Kenya Shillings)
- Production-grade rate limiting on every API endpoint
- A full super-admin panel for platform management

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16.1.7](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4, shadcn/ui, Framer Motion |
| **Auth** | [NextAuth.js v5](https://next-auth.js.org/) (Auth.js beta) — Google OAuth |
| **Database** | PostgreSQL via [Prisma ORM](https://www.prisma.io/) |
| **Payments** | [Paystack](https://paystack.com/) |
| **File Uploads** | [ImageKit](https://imagekit.io/) |
| **Toast / Notifications** | [Sonner](https://sonner.emilkowal.ski/) |
| **Charts** | [Recharts](https://recharts.org/) |
| **PDF Generation** | jsPDF + jsPDF-AutoTable |
| **State / Fetching** | React hooks + [SWR](https://swr.vercel.app/) |
| **Dev Tools** | ESLint, Prettier, pnpm |

---

## Features

### Authentication

- **Google OAuth popup flow** — sign-in happens in a small popup window, keeping the user on the landing/auth page throughout. No full-page redirects.
- **Session management** via JWT strategy (Auth.js v5)
- **Secure sign-out** — session cookies are cleared on the client and server
- **Rate-limit aware auth page** — if a user hits the global request cap, they are shown a countdown timer on the auth page and sign-in is blocked until the window resets

### Multi-Workspace & Multi-Tenancy

- Every user can belong to **multiple workspaces** with different roles
- Roles: `OWNER`, `ADMIN`, `MEMBER`
- Workspace-scoped data — products, orders, alerts, audit logs, and billing are all isolated per workspace
- Users can switch workspaces from the dashboard header
- Workspace limits are enforced per subscription plan

### Inventory Management

- **Product catalog** with SKU, description, price, image, category, min/max stock thresholds
- Product status is automatically computed: `in-stock`, `low-stock`, `critical`
- **Stock movements** — track every Restock, Sale, and Transfer with quantity, user, timestamp, and notes
- Bulk CSV **import and export** (Basic + Pro plans)
- Product images via **ImageKit** CDN
- Category management

### Order Management

- Create orders with multiple line items, automatically deducting stock
- Order statuses: `pending → processing → shipped → delivered → cancelled`
- Payment tracking per order: `unpaid`, `paid`, `refunded`
- Cancellation with reason capture
- Detailed order view with line-item breakdown
- PDF invoice generation with jsPDF

### Stock Alerts & Notifications

- **Automatic low-stock and critical alerts** generated when a product's stock falls below `minStock`
- Alert severity: `warning`, `critical`
- Alert lifecycle: `active → dismissed / resolved`
- In-app **notification centre** in the dashboard header with unread badge count
- Notification types: stock alerts and workspace activity events

### Reports & Analytics

- Dashboard overview cards: total products, active orders, low-stock count, total revenue
- **Recent activity feed** — last stock movements and order changes
- **Sales & revenue charts** via Recharts (line, bar, area)
- Stock level distribution charts
- Top-selling products ranking
- **Reports page** with filterable time ranges and PDF export

### Billing & Subscriptions

- Three subscription tiers (see [Subscription Plans](#subscription-plans))
- Integrated **Paystack** checkout — users are redirected to Paystack immediately after workspace setup with no intermediate friction
- Payment verification via Paystack webhook + server-side verify endpoint
- Invoice generation and history
- Upgrade / downgrade logic with pro-rated amounts
- Billing page shows current plan, next renewal date, and payment history
- Subscription status is enforced — features are gated by entitlements

### Audit Log

- **Immutable audit trail** for all significant actions: sign-in, sign-out, workspace creation, product changes, order updates, settings changes
- Stored per workspace and per user
- Filterable audit log viewer in the dashboard
- Super admin can view the global audit log across all workspaces

### Super Admin Panel

- Accessible only to the email defined in `SUPER_ADMIN_EMAIL`
- **Registration graph** — new user sign-ups over time
- **Billing overview** — all workspaces, their subscription status, and revenue
- **Global audit log** viewer
- **Demo booking** and **contact request** management (approve, reject, mark contacted)
- User role is automatically elevated to `super_admin` on login if the email matches

### Rate Limiting

All API routes are protected by a custom, multi-tier in-memory rate limiter:

| Tier | Window | Limit | Scope |
|---|---|---|---|
| **Global** | 15 min | 300 requests | Per IP + User ID |
| **Auth** | 15 min | 5 requests | Login/signup endpoints |
| **General API** | 1 min | 120 requests | All `/api/*` routes |
| **Admin** | 1 min | 60 requests | Super-admin routes |
| **Payments** | 5 min | 5 requests | Payment endpoints |
| **Uploads** | 1 min | 10 requests | File upload endpoint |
| **Search** | 1 min | 60 requests | Search endpoints |

- Progressive penalties after 3 violations (block time escalates up to 60 min)
- On global rate limit: toast is shown, session cookies are cleared, and the user is redirected to `/auth` with a live countdown timer
- Fully configurable via environment variables — can be toggled off entirely

### Open Graph / Social Sharing

- Full **Open Graph** and **Twitter Card** metadata on every page
- 1200×630 branded OG image in `/public/og-image.png`
- App logo (`mizani_logo.png`) used as favicon, Apple touch icon, and shortcut icon
- WhatsApp, Telegram, iMessage, and Slack previews all show the branded card

---

## Data Model

```
User
 ├── WorkspaceMember[] (many-to-many via Workspace)
 ├── StockMovement[]
 └── AuditLog[]

Workspace
 ├── WorkspaceMember[] (OWNER / ADMIN / MEMBER)
 ├── Subscription (1:1)
 ├── Plan (selected)
 ├── Payment[]
 ├── Invoice[]
 ├── Category[]
 ├── Product[]
 │    ├── OrderItem[]
 │    ├── StockMovement[]
 │    ├── Alert[]
 │    └── Notification[]
 ├── Order[]
 │    └── OrderItem[]
 ├── Alert[]
 ├── Notification[]
 └── AuditLog[]

Plan → Subscription → Payment → Invoice
```

---

## Subscription Plans

| Plan | Price | Workspaces | Products | Users | CSV Export | Analytics |
|---|---|---|---|---|---|---|
| **Free Trial** | Free (14 days) | 1 | 200 | 1 | ✗ | ✗ |
| **Basic** | KES 675 / mo | 3 | 1,000 | 2 | ✓ | ✗ |
| **Professional** | KES 1,250 / mo | Unlimited | Unlimited | Unlimited | ✓ | ✓ |

> Enterprise contracts with SLA guarantees, SSO, and dedicated infrastructure are available on request.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **PostgreSQL** ≥ 14 (local or hosted, e.g. Neon)
- A **Google Cloud** project with OAuth 2.0 credentials
- A **Paystack** account (test keys work for local dev)
- An **ImageKit** account for file uploads

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/inventory-system.git
cd inventory-system

# Install dependencies
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random 32-byte hex secret for NextAuth |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `NEXTAUTH_URL` | Public base URL (`http://localhost:3000` in dev) |
| `NEXT_PUBLIC_APP_URL` | Same as above — used for OG meta tags |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_...` or `sk_live_...`) |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `IMAGE_KIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGE_KIT_SECRET_KEY` | ImageKit private key |
| `IMAGE_KIT_ENDPOINT` | Your ImageKit URL endpoint |
| `IMAGE_KIT_BUCKET` | ImageKit folder/bucket name |
| `SUPER_ADMIN_EMAIL` | Email address that gets super admin access |
| `RATE_LIMITING_ENABLED` | `true` or `false` (default: `true`) |

> Rate limit windows and caps are all configurable — see `.env.example` for the full list.

### Database Setup

```bash
# Generate Prisma client
pnpm exec prisma generate

# Push schema to the database (creates all tables)
pnpm exec prisma db push

# (Optional) Seed with sample data
pnpm exec prisma db seed
```

### Running Locally

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000) with Turbopack enabled for fast HMR.

---

## Project Structure

```
inventory-system/
├── app/
│   ├── api/                   # API route handlers
│   │   ├── auth/              # NextAuth.js handlers
│   │   ├── payments/          # initialize, verify, list
│   │   ├── inventory/         # Products, categories, stock movements
│   │   ├── orders/            # Order CRUD
│   │   ├── alerts/            # Stock alert endpoints
│   │   ├── audit-logs/        # Audit log queries
│   │   ├── subscriptions/     # Subscription management
│   │   ├── workspaces/        # Workspace management
│   │   └── super-admin/       # Admin-only data endpoints
│   ├── auth/                  # Sign-in page + Google popup flow
│   ├── dashboard/             # Protected dashboard pages
│   │   ├── page.tsx           # Overview / home
│   │   ├── inventory/         # Product management
│   │   ├── orders/            # Order management
│   │   ├── alerts/            # Stock alerts
│   │   ├── reports/           # Analytics & PDF export
│   │   ├── audit/             # Audit log viewer
│   │   ├── billing/           # Subscription & payment history
│   │   └── settings/          # Workspace settings
│   ├── onboarding/            # New user setup wizard
│   ├── landing/               # Public marketing page sections
│   ├── payments/success/      # Paystack redirect landing
│   ├── super-admin/           # Super admin panel
│   └── layout.tsx             # Root layout + OG metadata
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── dashboard-header.tsx   # Top nav with breadcrumbs + user menu
│   ├── providers.tsx          # SessionProvider + ThemeProvider + fetch interceptor
│   └── ...
├── lib/
│   ├── actions/               # Next.js Server Actions
│   │   └── workspace.ts       # createWorkspace, switchWorkspace, etc.
│   ├── plans.ts               # Plan definitions, entitlements, helpers
│   ├── paystack.ts            # Paystack API client
│   ├── rate-limit.ts          # Multi-tier rate limiter
│   ├── prisma.ts              # Prisma client singleton
│   └── utils.ts               # cn(), formatters, etc.
├── prisma/
│   ├── schema.prisma          # Full database schema
│   └── seed.ts                # Sample data seeder
├── public/
│   ├── mizani_logo.png        # App logo
│   └── og-image.png           # 1200×630 social preview image
├── proxy.ts                   # NextAuth + rate-limit middleware (matcher: all routes)
├── auth.ts                    # NextAuth main config (Prisma adapter, JWT callbacks)
├── auth.config.ts             # Auth pages, authorized callback, route guards
└── RATE_LIMITING.md           # Rate limiting architecture documentation
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/payments/initialize` | Start a Paystack checkout session |
| `GET` | `/api/payments/verify` | Verify a completed Paystack payment |
| `GET` | `/api/payments/list` | List payment history for a workspace |
| `GET/POST` | `/api/inventory/products` | List or create products |
| `PUT/DELETE` | `/api/inventory/products/[id]` | Update or delete a product |
| `POST` | `/api/inventory/stock-movements` | Record a stock movement |
| `GET/POST` | `/api/orders` | List or create orders |
| `PUT` | `/api/orders/[id]` | Update order status |
| `GET` | `/api/alerts/counts` | Get active alert counts (used by header badge) |
| `GET` | `/api/audit-logs` | Paginated audit log |
| `GET` | `/api/dashboard` | Dashboard aggregates (overview stats) |
| `GET` | `/api/super-admin/data` | Platform-wide admin stats |
| `GET` | `/api/super-admin/billing` | All workspaces + subscription data |

All routes require an authenticated session. Admin routes additionally require `role === "super_admin"`.

---

## Deployment

1. **Set all environment variables** in your hosting platform (Vercel, Railway, Render, etc.)
2. **Update `NEXT_PUBLIC_APP_URL`** to your production domain (e.g. `https://app.mizanisystems.com`) — this is critical for WhatsApp/social link previews to show the correct OG image
3. **Update `NEXTAUTH_URL`** to match your production domain
4. **Switch Paystack keys** from `sk_test_...` to `sk_live_...`
5. **Run database migrations:**
   ```bash
   pnpm exec prisma db push
   ```
6. **Configure Paystack webhook** to point to `https://yourdomain.com/api/payments/verify`
7. **Add your production domain** to the Google OAuth authorized redirect URIs in Google Cloud Console

### Recommended Platforms

| Service | Notes |
|---|---|
| **Vercel** | Zero-config Next.js deployment. Use Neon or Supabase for Postgres |
| **Railway** | Postgres + Node in one project |
| **Render** | Web Service + Managed Postgres |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

Please follow the existing code style (Prettier config is included). Run `pnpm typecheck` before submitting.

---

<div align="center">
  <strong>Mizani Systems</strong> — Built for precision. Designed for scale.
</div>
