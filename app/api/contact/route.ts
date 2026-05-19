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

    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 })
    }

    const contact = await prisma.contactRequest.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company: company ? String(company).trim() : null,
        phone: phone ? String(phone).trim() : null,
        message: message.trim(),
        status: "pending",
      },
    })

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error("Error submitting contact request:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
