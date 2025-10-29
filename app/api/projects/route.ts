import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db();
  const body = await request.json();

  const newProject = {
    ...body,
    userId: session.user.id,
    createdAt: new Date(),
  };

  await db.collection("projects").insertOne(newProject);
  return NextResponse.json(newProject, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const client = await clientPromise;
  const db = client.db();

  const projects = await db
    .collection("projects")
    .find({ userId: session.user.id })
    .toArray();

  return NextResponse.json(projects);
}
