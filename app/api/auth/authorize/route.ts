import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function generateSecureRandomString(length: number) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .substring(0, length);
}

export async function GET(req: NextRequest) {
  console.log("==================================================");
  console.log("[AUTHORIZE] Step 1: Flow started");
  console.log("[AUTHORIZE] Origin:", req.nextUrl.origin);

  const state = generateSecureRandomString(43);
  const nonce = generateSecureRandomString(43);
  const code_verifier = generateSecureRandomString(43);
  const code_challenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");
  const cookieStore = await cookies();

  console.log("[AUTHORIZE] Step 2: Generated secure strings");

  cookieStore.set("oauth_state", state, {
    maxAge: 10 * 60, // 10 minutes
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
  cookieStore.set("oauth_nonce", nonce, {
    maxAge: 10 * 60, // 10 minutes
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
  cookieStore.set("oauth_code_verifier", code_verifier, {
    maxAge: 10 * 60, // 10 minutes
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
  console.log("[AUTHORIZE] Step 3: Cookies set (state, nonce, verifier)");

  const redirect_uri = `${req.nextUrl.origin}/api/auth/callback`;
  console.log("[AUTHORIZE] Step 4: Constructing redirect_uri:", redirect_uri);

  const queryParams = new URLSearchParams({
    client_id: (process.env.VERCEL_CLIENT_ID || process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID) as string,
    redirect_uri: redirect_uri,
    state,
    nonce,
    code_challenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: "openid profile email user:read deployment:write project:write offline_access",
  });

  const authorizationUrl = `https://vercel.com/oauth/authorize?${queryParams.toString()}`;
  console.log("[AUTHORIZE] Step 5: Redirecting user to Vercel:", authorizationUrl);
  console.log("==================================================");

  return NextResponse.redirect(authorizationUrl);
}
