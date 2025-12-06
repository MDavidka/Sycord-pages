import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("==================================================");
    console.log("[FIREBASE CALLBACK] Step 1: Flow started");

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("[FIREBASE CALLBACK] Error from provider:", error);
      return Response.redirect(new URL(`/dashboard?error=${error}`, request.url));
    }

    if (!code) {
      throw new Error("Authorization code is required");
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("firebase_oauth_state")?.value;
    const codeVerifier = cookieStore.get("firebase_code_verifier")?.value;

    if (!state || state !== storedState) {
      throw new Error("State mismatch");
    }

    // Exchange code for token
    const redirectUri = `${request.nextUrl.origin}/api/auth/firebase/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier || "",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error("[FIREBASE CALLBACK] Token exchange failed:", tokens);
        throw new Error("Failed to exchange token");
    }

    console.log("[FIREBASE CALLBACK] Token received");

    // Get current user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
       console.error("[FIREBASE CALLBACK] No session found to link Firebase account");
       return Response.redirect(new URL("/login", request.url));
    }

    // Update user in DB
    const client = await clientPromise;
    const db = client.db();

    const updateData: any = {
      firebaseAccessToken: tokens.access_token,
      firebaseRefreshToken: tokens.refresh_token, // Only returned if access_type=offline and prompt=consent
      firebaseExpiresAt: Date.now() + (tokens.expires_in * 1000),
      firebaseConnectedAt: new Date(),
    };

    // If no refresh token returned (e.g. user re-authorized without prompt=consent), keep the old one if exists
    if (!tokens.refresh_token) {
        delete updateData.firebaseRefreshToken;
    }

    await db.collection("users").updateOne(
      { email: session.user.email },
      { $set: updateData }
    );

    console.log(`[FIREBASE CALLBACK] Linked Firebase to user: ${session.user.email}`);

    // Cleanup cookies
    cookieStore.set("firebase_oauth_state", "", { maxAge: 0 });
    cookieStore.set("firebase_code_verifier", "", { maxAge: 0 });

    return Response.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("[FIREBASE CALLBACK] Fatal error:", error);
    return Response.redirect(new URL("/dashboard?error=FirebaseConnectionFailed", request.url));
  }
}
