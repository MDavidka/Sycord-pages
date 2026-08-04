import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import {
  getConnectionProvider,
  resolveOAuthClientId,
  resolveOAuthClientSecret,
} from '@/lib/connection-providers'
import {
  buildAuthorizeUrl,
  connectionOAuthCallbackUrl,
  signConnectionOAuthState,
} from '@/lib/connection-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/connection/oauth/start?projectId=&addon=
 * Starts the real OAuth authorize redirect for a connection provider.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = (searchParams.get('projectId') || '').trim()
  const addon = (searchParams.get('addon') || '').trim()
  if (!projectId || !addon) {
    return Response.json({ message: 'projectId and addon are required.' }, { status: 400 })
  }

  const provider = getConnectionProvider(addon)
  if (!provider || provider.authType !== 'oauth') {
    return Response.json({ message: 'This connection does not use OAuth.' }, { status: 400 })
  }

  const clientId = resolveOAuthClientId(provider)
  const clientSecret = resolveOAuthClientSecret(provider)
  if (!clientId || !clientSecret) {
    return Response.json(
      {
        message: `OAuth is not configured for ${provider.name}. Set ${provider.oauthClientIdEnv} and ${provider.oauthClientSecretEnv} (or shared Google/GitHub client envs).`,
        needsConfig: true,
        provider: provider.id,
      },
      { status: 503 },
    )
  }

  const origin = new URL(request.url).origin
  const redirectUri = connectionOAuthCallbackUrl(origin)
  const state = signConnectionOAuthState({
    projectId,
    addon: provider.id,
    userId: session.user.id,
  })
  const authorizeUrl = buildAuthorizeUrl({
    provider,
    clientId,
    redirectUri,
    state,
  })
  if (!authorizeUrl) {
    return Response.json({ message: 'Failed to build authorize URL.' }, { status: 500 })
  }

  // Popup/redirect consumers can use JSON (?format=json)
  if (searchParams.get('format') === 'json') {
    return Response.json({
      ok: true,
      authorizeUrl,
      redirectUri,
      provider: provider.id,
    })
  }

  return Response.redirect(authorizeUrl, 302)
}
