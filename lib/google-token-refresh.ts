import clientPromise from "@/lib/mongodb";

/**
 * Retrieves a valid Firebase Access Token for a user.
 * If the current access token is expired, it refreshes it using the refresh token.
 */
export async function getValidFirebaseToken(userId: string): Promise<string> {
  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne({ id: userId });

  if (!user || !user.firebaseAccessToken) {
    throw new Error("Firebase not connected");
  }

  // Check if token is expired (or close to expiring, e.g., within 5 minutes)
  const now = Date.now();
  const expiresAt = user.firebaseExpiresAt || 0;

  // Buffer of 5 minutes
  if (now + 5 * 60 * 1000 < expiresAt) {
    return user.firebaseAccessToken;
  }

  console.log(`[Firebase Token] Token expired for user ${userId}, refreshing...`);

  if (!user.firebaseRefreshToken) {
    throw new Error("No refresh token available. Please reconnect Firebase.");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        refresh_token: user.firebaseRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();

    if (!response.ok) {
      console.error("[Firebase Token] Refresh failed:", tokens);
      throw new Error("Failed to refresh token");
    }

    const newAccessToken = tokens.access_token;
    const newExpiresAt = Date.now() + (tokens.expires_in * 1000);

    // Update DB
    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          firebaseAccessToken: newAccessToken,
          firebaseExpiresAt: newExpiresAt,
        },
      }
    );

    console.log(`[Firebase Token] Token refreshed successfully.`);
    return newAccessToken;

  } catch (error) {
    console.error("[Firebase Token] Error refreshing token:", error);
    throw error;
  }
}
