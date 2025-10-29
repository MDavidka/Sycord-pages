import { NextResponse } from "next/server";
import { Vercel } from "@vercel/sdk";

export async function POST(request: Request) {
  if (!process.env.VERCEL_TOKEN) {
    return NextResponse.json(
      { message: "Missing VERCEL_TOKEN environment variable" },
      { status: 500 }
    );
  }

  if (!process.env.VERCEL_PROJECT_ID) {
    return NextResponse.json(
      { message: "Missing VERCEL_PROJECT_ID environment variable" },
      { status: 500 }
    );
  }

  const vercel = new Vercel({
    bearerToken: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID, // Optional, if the project is under a team
  });
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
    return NextResponse.json(
      { message: "Failed to create deployment" },
      { status: 500 }
    );
  }
}
