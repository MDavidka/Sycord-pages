import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  
  // Check if user is admin
  if (session?.user?.email !== "dmarton336@gmail.com") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    
    // Get model configuration from database
    const config = await db.collection("modelConfig").findOne({ _id: "test-models" })
    
    return NextResponse.json({
      thinkerModel: config?.thinkerModel || "nvidia/nemotron-3-super-120b-a12b:free",
      coderModel: config?.coderModel || "minimax/minimax-m2.5:free",
    })
  } catch (error) {
    console.error("Error fetching model config:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  // Check if user is admin
  if (session?.user?.email !== "dmarton336@gmail.com") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { thinkerModel, coderModel } = await request.json()
    
    if (!thinkerModel || !coderModel) {
      return NextResponse.json(
        { message: "Both thinkerModel and coderModel are required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db()
    
    // Save model configuration to database
    await db.collection("modelConfig").updateOne(
      { _id: "test-models" },
      { 
        $set: { 
          thinkerModel,
          coderModel,
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    )
    
    return NextResponse.json({ 
      message: "Model configuration saved successfully",
      thinkerModel,
      coderModel,
    })
  } catch (error) {
    console.error("Error saving model config:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
