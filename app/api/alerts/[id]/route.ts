import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const { status } = await request.json()

  if (!status || !["active", "dismissed", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  try {
    // Verify the alert belongs to the user's workspace
    const alert = await prisma.alert.findFirst({
      where: { 
        id,
        workspaceId: session.user.workspaceId 
      }
    })

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to update alert:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
