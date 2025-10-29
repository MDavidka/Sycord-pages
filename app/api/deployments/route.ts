import { NextResponse } from "next/server";
import { Vercel } from "@vercel/sdk";

if (!process.env.VERCEL_TOKEN) {
  throw new Error("Missing VERCEL_TOKEN environment variable");
}

if (!process.env.VERCEL_PROJECT_ID) {
  throw new Error("Missing VERCEL_PROJECT_ID environment variable");
}

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_TOKEN,
  teamId: process.env.VERCEL_TEAM_ID, // Optional, if the project is under a team
});

export async function POST(request: Request) {
  const { subdomain } = await request.json();

  try {
    const result = await vercel.projects.addProjectDomain({
      idOrName: process.env.VERCEL_PROJECT_ID,
      requestBody: {
        name: subdomain,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to create deployment" }, { status: 500 });
  }
}
