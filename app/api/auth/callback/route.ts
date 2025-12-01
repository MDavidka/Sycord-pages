import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import clientPromise from "@/lib/mongodb";

interface TokenData {
  access_token: string;
  token_type: string;
  id_token: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log("==================================================");
    console.log("[CALLBACK] Step 1: Flow started");
    console.log("[REDIRECTED TO] Origin:", request.nextUrl.origin);
    console.log("[CALLBACK] Full URL:", request.url);
    console.log("==================================================");

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      console.error("[CALLBACK] Error: Authorization code missing");
      throw new Error("Authorization code is required");
    }
    console.log("[CALLBACK] Step 2: Code and state received");

    const cookieStore = await cookies();
    const storedState = cookieStore.get("oauth_state")?.value;
    const storedNonce = cookieStore.get("oauth_nonce")?.value;
    const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;

    console.log("[CALLBACK] Step 3: Cookies retrieved");
    console.log("[CALLBACK] Stored State exists:", !!storedState);
    console.log("[CALLBACK] Stored Nonce exists:", !!storedNonce);
    console.log("[CALLBACK] Code Verifier exists:", !!codeVerifier);

    if (!validate(state, storedState)) {
      console.error("[CALLBACK] Error: State mismatch");
      throw new Error("State mismatch");
    }
    console.log("[CALLBACK] Step 4: State validated successfully");

    const tokenData = await exchangeCodeForToken(
      code,
      codeVerifier,
      request.nextUrl.origin
    );
    console.log("[CALLBACK] Step 5: Token exchanged successfully");

    const decodedNonce = decodeNonce(tokenData.id_token);

    if (!validate(decodedNonce, storedNonce)) {
      console.error("[CALLBACK] Error: Nonce mismatch");
      throw new Error("Nonce mismatch");
    }
    console.log("[CALLBACK] Step 6: Nonce validated successfully");

    await setAuthCookies(tokenData);
    console.log("[CALLBACK] Step 7: Auth cookies set");

    // --- MongoDB Persistence (Integrated to satisfy "make it to token store" requirement) ---
    try {
        console.log("[CALLBACK] Step 8: Fetching Vercel user details...");
        const user = await fetchVercelUser(tokenData.access_token);
        console.log("[CALLBACK] Step 9: Persisting user to MongoDB...");
        await persistUserToDB(user, tokenData.access_token);
    } catch (e) {
        console.error("[CALLBACK] Warning: Failed to persist user to MongoDB, but auth was successful.", e);
    }
    // --------------------------------------------------------------------------------------

    // Clear the state, nonce, and oauth_code_verifier cookies
    cookieStore.set("oauth_state", "", { maxAge: 0 });
    cookieStore.set("oauth_nonce", "", { maxAge: 0 });
    cookieStore.set("oauth_code_verifier", "", { maxAge: 0 });
    console.log("[CALLBACK] Step 10: Cleanup done. Redirecting...");

    return Response.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("[CALLBACK] Fatal OAuth callback error:", error);
    return Response.redirect(new URL("/login?error=OAuthCallbackError", request.url));
  }
}

function validate(
  value: string | null,
  storedValue: string | undefined
): boolean {
  if (!value || !storedValue) {
    return false;
  }
  return value === storedValue;
}

function decodeNonce(idToken: string): string {
  const payload = idToken.split(".")[1];
  const decodedPayload = Buffer.from(payload, "base64").toString("utf-8");
  const nonceMatch = decodedPayload.match(/"nonce":"([^"]+)"/);
  return nonceMatch ? nonceMatch[1] : "";
}

async function exchangeCodeForToken(
  code: string,
  code_verifier: string | undefined,
  requestOrigin: string
): Promise<TokenData> {
  const redirectUri = `${requestOrigin}/api/auth/callback`;
  console.log("==================================================");
  console.log("[CALLBACK] Exchanging code for token");
  console.log("[REDIRECT_URI USED] :", redirectUri);
  console.log("==================================================");

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID as string,
    client_secret: process.env.VERCEL_APP_CLIENT_SECRET as string,
    code: code,
    code_verifier: code_verifier || "",
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[CALLBACK] Token exchange failed:", JSON.stringify(errorData));
    throw new Error(
      `Failed to exchange code for token: ${JSON.stringify(errorData)}`
    );
  }

  return await response.json();
}

async function setAuthCookies(tokenData: TokenData) {
  const cookieStore = await cookies();

  cookieStore.set("access_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: tokenData.expires_in,
  });

  cookieStore.set("refresh_token", tokenData.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

// --- Helper Functions from Previous Implementation ---

async function fetchVercelUser(token: string) {
    const response = await fetch('https://api.vercel.com/www/user', {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) throw new Error("Failed to fetch user");
    const data = await response.json();
    return data.user;
}

async function persistUserToDB(vercelUser: any, token: string) {
    try {
        const client = await clientPromise;
        const db = client.db();

        await db.collection("users").updateOne(
            { id: vercelUser.uid },
            {
                $set: {
                    id: vercelUser.uid,
                    name: vercelUser.name || vercelUser.username,
                    email: vercelUser.email,
                    image: `https://vercel.com/api/www/avatar/${vercelUser.uid}`,
                    vercelAccessToken: token,
                    vercelProvider: true,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log("[v0-DEBUG] Persisted Vercel User:", vercelUser.uid);
    } catch (e) {
        console.error("[v0-ERROR] DB Persist Failed:", e);
    }
}
