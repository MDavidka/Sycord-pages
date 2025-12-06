import clientPromise from "@/lib/mongodb";

export async function getValidVercelToken(userId: string): Promise<string> {
  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne({ id: userId });

  console.log(`[Vercel Token Check] User ID: ${userId}`);

  if (!user || !user.vercelAccessToken) {
    console.error("[Vercel Token Check] User not found or token missing");
    throw new Error("Vercel account not connected");
  }

  // Check if token is expired or about to expire (e.g., within 5 minutes)
  const now = Date.now();
  const expiresAt = user.vercelExpiresAt || 0; // Default to 0 if missing (treat as expired)
  const buffer = 5 * 60 * 1000; // 5 minutes buffer

  console.log(`[Vercel Token Check] Expires At: ${expiresAt} (Date: ${new Date(expiresAt).toISOString()})`);
  console.log(`[Vercel Token Check] Now: ${now} (Date: ${new Date(now).toISOString()})`);
  console.log(`[Vercel Token Check] Has Refresh Token: ${!!user.vercelRefreshToken}`);

  if (expiresAt > now + buffer) {
    console.log("[Vercel Token Check] Token is valid.");
    return user.vercelAccessToken;
  }

  // Token is expired or missing expiry, attempt refresh
  if (!user.vercelRefreshToken) {
    // If we don't have a refresh token but have an access token without expiry (legacy),
    // we might try to use it, but if it fails, the user must re-authenticate.
    if (expiresAt === 0) {
        console.warn("[Vercel] No expiry or refresh token found (Legacy). Using existing token.");
        return user.vercelAccessToken;
    }
    console.error("[Vercel] Session expired and no refresh token available.");
    throw new Error("Vercel session expired. Please reconnect your Vercel account.");
  }

  console.log("[Vercel] Refreshing expired access token...");

  try {
    const response = await fetch("https://api.vercel.com/login/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: (process.env.VERCEL_CLIENT_ID || process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID) as string,
        client_secret: (process.env.VERCEL_CLIENT_SECRET || process.env.VERCEL_APP_CLIENT_SECRET) as string,
        grant_type: "refresh_token",
        refresh_token: user.vercelRefreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Vercel] Token refresh failed. Status: ${response.status}. Body: ${errorText}`);
      throw new Error(`Failed to refresh Vercel token: ${errorText}`);
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const newExpiresIn = data.expires_in;
    const newExpiresAt = Date.now() + (newExpiresIn * 1000);

    console.log(`[Vercel] Refresh successful. New Expiry: ${new Date(newExpiresAt).toISOString()}`);

    // Update DB
    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          vercelAccessToken: newAccessToken,
          vercelRefreshToken: newRefreshToken,
          vercelExpiresAt: newExpiresAt,
          vercelUpdatedAt: new Date(),
        },
      }
    );

    console.log("[Vercel] Database updated with new tokens.");
    return newAccessToken;

  } catch (error) {
    console.error("[Vercel] Fatal error refreshing token:", error);
    throw new Error("Failed to refresh Vercel authentication.");
  }
}
