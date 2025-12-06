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
  console.log("[FIREBASE AUTHORIZE] Step 1: Flow started");

  const state = generateSecureRandomString(43);
  const nonce = generateSecureRandomString(43);

  // PKCE is recommended but not strictly required for web server apps,
  // but good for security. Google supports it.
  const code_verifier = generateSecureRandomString(43);
  const code_challenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");

  const cookieStore = await cookies();

  cookieStore.set("firebase_oauth_state", state, {
    maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  });

  cookieStore.set("firebase_code_verifier", code_verifier, {
    maxAge: 10 * 60,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  });

  const redirect_uri = `${req.nextUrl.origin}/api/auth/firebase/callback`;

  // Scopes for Firebase Hosting and Project management
  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/firebase", // Manage Firebase projects
    "https://www.googleapis.com/auth/cloud-platform" // Full access (often needed for deeper integrations or if firebase scope is insufficient for some API calls)
  ].join(" ");

  const queryParams = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirect_uri,
    state,
    nonce,
    code_challenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: scopes,
    access_type: "offline", // To get refresh token
    prompt: "consent", // Force consent screen to ensure we get refresh token
  });

  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${queryParams.toString()}`;

  console.log("[FIREBASE AUTHORIZE] Redirecting to:", authorizationUrl);

  return NextResponse.redirect(authorizationUrl);
}
