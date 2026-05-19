import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

// Helper check for super admin authorization
async function isAuthorizedSuperAdmin() {
  const session = await auth()
  if (!session?.user?.email) return false

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  const isSuperAdminEmail = !!(
    superAdminEmail &&
    session.user.email.toLowerCase() === superAdminEmail.toLowerCase()
  )

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  const isSuperAdminRole = dbUser?.role === "super_admin"

  return isSuperAdminEmail || isSuperAdminRole
}

export async function GET() {
  if (!(await isAuthorizedSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const bookings = await prisma.demoBooking.findMany({
      orderBy: { createdAt: "desc" },
    })

    const contacts = await prisma.contactRequest.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ bookings, contacts })
  } catch (error) {
    console.error("Failed to fetch super admin leads:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthorizedSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, type, status } = body

    if (!id || !type || !status) {
      return NextResponse.json({ error: "Missing required fields (id, type, status)." }, { status: 400 })
    }

    if (type !== "demo" && type !== "contact") {
      return NextResponse.json({ error: "Invalid lead type. Must be 'demo' or 'contact'." }, { status: 400 })
    }

    if (type === "demo") {
      const updated = await prisma.demoBooking.update({
        where: { id },
        data: { status },
      })
      return NextResponse.json({ success: true, lead: updated })
    } else {
      const updated = await prisma.contactRequest.update({
        where: { id },
        data: { status },
      })
      return NextResponse.json({ success: true, lead: updated })
    }
  } catch (error) {
    console.error("Failed to update lead status:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
