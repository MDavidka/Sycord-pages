import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { defaultCheatSheet } from "@/lib/generator/default-cheatsheet";
import type { CheatSheet } from "@/lib/generator/types";

const DB_NAME = "sycord";
const COLLECTION_NAME = "cheatsheet";

export async function GET(): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const cheatSheet = await collection.findOne({ _id: "current" as unknown as import("mongodb").ObjectId });
    
    if (!cheatSheet) {
      // Return default cheat sheet if none exists
      return NextResponse.json({
        success: true,
        cheatSheet: defaultCheatSheet
      });
    }

    // Remove MongoDB _id field
    const { _id, ...rest } = cheatSheet;
    
    return NextResponse.json({
      success: true,
      cheatSheet: rest as CheatSheet
    });

  } catch (error) {
    console.error("[Cheatsheet GET Error]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch cheatsheet"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { cheatSheet } = await request.json() as { cheatSheet: CheatSheet };

    if (!cheatSheet || !cheatSheet.components) {
      return NextResponse.json({
        success: false,
        error: "Invalid cheatsheet data"
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Update with upsert
    const updateData = {
      ...cheatSheet,
      updatedAt: new Date().toISOString()
    };

    await collection.updateOne(
      { _id: "current" as unknown as import("mongodb").ObjectId },
      { $set: updateData },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Cheatsheet saved successfully"
    });

  } catch (error) {
    console.error("[Cheatsheet POST Error]", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to save cheatsheet"
    }, { status: 500 });
  }
}
