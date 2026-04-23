import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse?.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse?.json(
    { message: "Website generation is disabled. Syra UI remains available." },
    { status: 410 },
  );
}
