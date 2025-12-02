import clientPromise from "@/lib/mongodb";

export async function getValidVercelToken(userId: string): Promise<string> {
  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne({ id: userId });

  if (!user || !user.vercelAccessToken) {
    throw new Error("Vercel account not connected");
  }

  // Check if token is expired or about to expire (e.g., within 5 minutes)
  const now = Date.now();
  const expiresAt = user.vercelExpiresAt || 0; // Default to 0 if missing (treat as expired)
  const buffer = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt > now + buffer) {
    return user.vercelAccessToken;
  }

  // Token is expired or missing expiry, attempt refresh
  if (!user.vercelRefreshToken) {
    // If we don't have a refresh token but have an access token without expiry (legacy),
    // we might try to use it, but if it fails, the user must re-authenticate.
    // Ideally, we should have stored expiresAt. If strictly missing, we might assume valid if legacy,
    // but better to fail safe if we suspect expiration.
    // However, if we just implemented persistence, old users might not have refresh tokens.
    // We'll try to use the existing token if no refresh token is present, but warn.
    if (expiresAt === 0) {
        console.warn("[Vercel] No expiry or refresh token found. Using existing token.");
        return user.vercelAccessToken;
    }
    throw new Error("Vercel session expired. Please reconnect your Vercel account.");
  }

  console.log("[Vercel] Refreshing expired access token...");

  try {
    const response = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID as string,
        client_secret: process.env.VERCEL_APP_CLIENT_SECRET as string,
        grant_type: "refresh_token",
        refresh_token: user.vercelRefreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Vercel] Token refresh failed:", errorData);
      throw new Error(`Failed to refresh Vercel token: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const newExpiresIn = data.expires_in;
    const newExpiresAt = Date.now() + (newExpiresIn * 1000);

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

    console.log("[Vercel] Token refreshed successfully.");
    return newAccessToken;

  } catch (error) {
    console.error("[Vercel] Error refreshing token:", error);
    throw new Error("Failed to refresh Vercel authentication.");
  }
}
