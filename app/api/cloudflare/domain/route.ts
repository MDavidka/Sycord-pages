import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

async function cloudflareApiCall(
  url: string,
  options: RequestInit,
  apiToken: string,
  retries = 3
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401 || response.status === 403) {
        console.error(`[Cloudflare] Auth error: ${response.status}`);
        return response;
      }

      if (response.ok) {
        return response;
      }

      if (response.status < 500 && response.status !== 429) {
          return response;
      }

      lastError = await response.text();
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw new Error(`API call failed: ${lastError}`);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db();

    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    });

    if (!tokenDoc) return NextResponse.json({ error: "No Cloudflare credentials" }, { status: 400 });

    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
    if (!project?.cloudflareProjectName) {
        return NextResponse.json({ domains: [] }); // Not deployed yet
    }

    const scriptName = project.cloudflareProjectName;
    const accountId = tokenDoc.accountId;

    // Fetch Worker Domains (Custom Domains)
    const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/domains`;
    const response = await cloudflareApiCall(url, { method: "GET" }, tokenDoc.apiToken);

    if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch domains" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ domains: data.result || [] });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { projectId, hostname, zoneId } = body;

    if (!projectId || !hostname) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db();

    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    });

    if (!tokenDoc) return NextResponse.json({ error: "No Cloudflare credentials" }, { status: 400 });

    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
    const scriptName = project?.cloudflareProjectName;

    if (!scriptName) return NextResponse.json({ error: "Worker not deployed" }, { status: 400 });

    const accountId = tokenDoc.accountId;

    // Add Domain (PUT to collection endpoint usually works as "attach" for this specific domain if payload is right?)
    // Actually, to ADD a domain without removing others, we usually use PUT on the specific domain endpoint
    // `PUT /accounts/:account_id/workers/scripts/:script_name/domains` replaces the WHOLE list?
    // Docs say: "PUT .../domains" -> "Updates the list of domains".
    // So we need to FETCH, ADD, and PUT back.

    // 1. Fetch existing
    const getUrl = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/domains`;
    const getRes = await cloudflareApiCall(getUrl, { method: "GET" }, tokenDoc.apiToken);
    const getData = await getRes.json();
    const existingDomains = getData.result || [];

    // 2. Append new (avoid duplicates)
    // We need "hostname" and "zone_id" (optional if Cloudflare can infer it, but usually needed)
    const newEntry = { hostname, zone_id: zoneId || "" }; // zone_id might be needed

    // Actually, Cloudflare API allows PUTting a single domain record to `.../domains`?
    // "PUT /accounts/:account_id/workers/domains" is deprecated?
    // "PUT /accounts/:account_id/workers/scripts/:script_name/domains" replaces the list.

    const newDomainsList = [...existingDomains, newEntry].filter((v,i,a)=>a.findIndex(t=>(t.hostname===v.hostname))===i);

    // 3. Update
    const putUrl = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/domains`;
    const putRes = await cloudflareApiCall(putUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomainsList)
    }, tokenDoc.apiToken);

    if (!putRes.ok) {
        const err = await putRes.text();
        return NextResponse.json({ error: err }, { status: putRes.status });
    }

    return NextResponse.json({ success: true, domains: newDomainsList });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
