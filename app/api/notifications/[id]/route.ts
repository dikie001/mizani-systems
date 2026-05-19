import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const { status } = await request.json()

  if (!status || !["unread", "read", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  try {
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { status },
    })

    // If it is linked to an alert and marked as dismissed, dismiss the alert too
    if (updatedNotification.alertId && status === "dismissed") {
      await prisma.alert.update({
        where: { id: updatedNotification.alertId },
        data: { status: "dismissed" },
      })
    }

    return NextResponse.json(updatedNotification)
  } catch (error) {
    console.error("Failed to update notification:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
