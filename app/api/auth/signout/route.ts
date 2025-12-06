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

  // Delete user from database if logged in
  if (session?.user?.id) {
    try {
      const client = await clientPromise;
      const db = client.db();
      
      // Changed from updateOne($unset) to deleteOne as requested ("remove user fulder fron database")
      await db.collection("users").deleteOne({ id: session.user.id });
      
      console.log(`[Signout] Deleted user record: ${session.user.id}`);
    } catch (error) {
      console.error('[Signout] Error deleting user from database:', error);
    }
  }

  return Response.json({ success: true }, { status: 200 });
}
