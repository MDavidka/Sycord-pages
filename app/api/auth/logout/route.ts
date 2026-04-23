import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    // Invalidate all existing sessions for this user by incrementing sessionVersion
    await db.collection("users").updateOne(
      { id: session.user.id },
      { $set: { sessionVersion: Date.now() } }
    )

    const response = NextResponse.json({ success: true, message: "Session invalidated server-side" })
    const secure = process.env.NODE_ENV === "production"

    const clearCookie = (name: string) => {
      response.cookies.set({
        name,
        value: "",
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      })
    }

    const cookieNames = [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.csrf-token",
      "__Secure-next-auth.csrf-token",
      "next-auth.callback-url",
      "next-auth.state",
      "access_token",
      "refresh_token",
    ]

    cookieNames.forEach(clearCookie)

    return response
  } catch (error: any) {
    console.error("Error logging out:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
