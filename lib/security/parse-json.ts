import { NextResponse } from "next/server"

/**
 * Parse a request body as JSON. Returns a 400 Response on invalid JSON
 * instead of silently swallowing the error into `{}` / `null`.
 */
export async function parseJsonBody<T = unknown>(
  request: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }),
    }
  }
}
