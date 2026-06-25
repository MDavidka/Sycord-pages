import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"


export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params

    const client = await clientPromise
    const db = client.db()

    // Since projects are now embedded in the user document, deleting the user (or clearing the array)
    // implicitly deletes the projects.
    // The previous code deleted "projects" and "deployments" collections.
    // Now we just need to update the user to clear projects, OR if the intent is to delete the user completely?
    // The route name is `[userId]/delete/route.ts` but it seems to only delete projects in the original code?
    // "Delete all projects and deployments for this user... return User and all associated data deleted".
    // It says "User and... deleted" but only ran deleteMany on projects/deployments.
    // It didn't delete the user from `users` collection in the original code!
    // But logically, if we want to delete user data, we should probably clear the `projects` array.

    // However, looking at the previous code, it only targeted `projects` and `deployments`.
    // So I will just empty the projects array in the user document.

    await db.collection("users").updateOne(
        { id: userId },
        { $set: { projects: [] } }
    )

    // Note: If deployments are separate collection (legacy), we might want to clean them up if they exist.
    // But we are moving away from them.
    // For completeness, I'll delete from legacy collections just in case.
    await db.collection("projects").deleteMany({ userId });
    await db.collection("deployments").deleteMany({ userId });

    return NextResponse.json({
      success: true,
      message: `User projects and associated data deleted`,
    })
  } catch (error) {
    console.error("[v0] Delete user error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
