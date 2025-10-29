import { NextResponse } from "next/server";

let projects = [];

export async function POST(request: Request) {
  const body = await request.json();
  const newProject = { ...body, id: Date.now() };
  projects.push(newProject);
  return NextResponse.json(newProject);
}

export async function GET() {
  return NextResponse.json(projects);
}
