import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, company, phone, message } = body

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 })
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 })
    }

    const booking = await prisma.demoBooking.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company: company ? String(company).trim() : null,
        phone: phone ? String(phone).trim() : null,
        message: message ? String(message).trim() : null,
        status: "pending",
      },
    })

    // Log this to system audit log if required, but since this is public/unauth lead, 
    // it's not strictly tied to a user. We can log a generic audit entry.
    try {
      // Find system/owner user to associate or write a system log if needed
      // Actually, since auditLog requires userId, let's look at schema:
      // userId is String, User relation is required. So we can't easily write a system log
      // without a valid user ID. That's fine, we don't need audit log for public lead submission.
    } catch (e) {
      console.error("Failed to write lead audit log", e)
    }

    return NextResponse.json({ success: true, booking })
  } catch (error) {
    console.error("Error submitting demo booking:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
