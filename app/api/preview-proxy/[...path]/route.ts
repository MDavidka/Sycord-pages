import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VPS_PREVIEW_BASE = process.env.SYTE_VPS_PREVIEW_BASE || 'http://152.89.245.113'

function getPreviewPort(previewUrl: string): number {
  try {
    const url = new URL(previewUrl)
    return url.port ? parseInt(url.port) : 4001
  } catch {
    return 4001
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const searchParams = req.nextUrl.searchParams
  const targetBase = searchParams.get('target')
  const pathSegments = params.path ?? []
  const pathStr = '/' + pathSegments.join('/')

  // Build upstream URL — use target base if provided, strip target from forwarded qs
  let upstreamBase = VPS_PREVIEW_BASE + ':4001'
  if (targetBase) {
    const port = getPreviewPort(targetBase)
    upstreamBase = `${VPS_PREVIEW_BASE}:${port}`
  }

  // Forward all query params except 'target'
  const fwdParams = new URLSearchParams(searchParams)
  fwdParams.delete('target')
  const qs = fwdParams.toString()
  const upstreamUrl = upstreamBase + pathStr + (qs ? '?' + qs : '')

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        // Forward host so Vite doesn't reject the request
        host: new URL(targetBase || upstreamBase).host,
        accept: req.headers.get('accept') || '*/*',
        'accept-encoding': 'identity',
      },
      // @ts-ignore
      redirect: 'follow',
    })

    const body = await upstreamRes.arrayBuffer()
    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream'

    return new NextResponse(body, {
      status: upstreamRes.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
