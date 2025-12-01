import crypto from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function generateSecureRandomString(length: number) {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomBytes, (byte) => charset[byte % charset.length]).join(
    '',
  );
}

export async function GET(req: NextRequest) {
  const state = generateSecureRandomString(43);
  const nonce = generateSecureRandomString(43);
  const code_verifier = crypto.randomBytes(43).toString('hex');
  const code_challenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url');
  const cookieStore = await cookies();

  cookieStore.set('oauth_state', state, {
    maxAge: 10 * 60, // 10 minutes
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: 'lax',
  });
  cookieStore.set('oauth_nonce', nonce, {
    maxAge: 10 * 60, // 10 minutes
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: 'lax',
  });
  cookieStore.set('oauth_code_verifier', code_verifier, {
    maxAge: 10 * 60, // 10 minutes
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: 'lax',
  });

  // Handle custom redirect URL
  const nextUrl = req.nextUrl.searchParams.get('next') || req.nextUrl.searchParams.get('callbackUrl');
  if (nextUrl) {
      cookieStore.set('oauth_redirect_to', nextUrl, {
        maxAge: 10 * 60,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: 'lax',
      });
  }

  const queryParams = new URLSearchParams({
    client_id: process.env.VERCEL_CLIENT_ID as string,
    redirect_uri: `${req.nextUrl.origin}/api/auth/callback/vercel`, // Updated path
    state,
    nonce,
    code_challenge,
    code_challenge_method: 'S256',
    response_type: 'code',
    scope: 'openid email profile offline_access',
  });

  const authorizationUrl = `https://vercel.com/oauth/authorize?${queryParams.toString()}`;
  return NextResponse.redirect(authorizationUrl);
}
