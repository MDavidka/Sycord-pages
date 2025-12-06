import { cookies } from 'next/headers';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function POST() {
  const cookieStore = await cookies();
  
  // Get session to identify user
  const session = await getServerSession(authOptions);
  
  // Delete Vercel OAuth cookies
  cookieStore.set('access_token', '', { maxAge: 0 });
  cookieStore.set('refresh_token', '', { maxAge: 0 });
  cookieStore.set('oauth_state', '', { maxAge: 0 });
  cookieStore.set('oauth_nonce', '', { maxAge: 0 });
  cookieStore.set('oauth_code_verifier', '', { maxAge: 0 });

  // Clear Vercel tokens from database if user is logged in
  if (session?.user?.id) {
    try {
      const client = await clientPromise;
      const db = client.db();
      
      await db.collection("users").updateOne(
        { id: session.user.id },
        {
          $unset: {
            vercelAccessToken: "",
            vercelRefreshToken: "",
            vercelExpiresAt: "",
            vercelTeamId: "",
            vercelId: "",
            vercelUsername: "",
            vercelEmail: "",
            vercelProvider: "",
            vercelLinkedAt: ""
          }
        }
      );
      
      console.log(`[Signout] Cleared Vercel data for user: ${session.user.id}`);
    } catch (error) {
      console.error('[Signout] Error clearing database:', error);
    }
  }

  return Response.json({ success: true }, { status: 200 });
}
