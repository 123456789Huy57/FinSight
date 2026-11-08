import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'
const MAX_BODY_BYTES = 1024 * 1024

async function boundedBody(request: NextRequest): Promise<string | null> {
  const declared = request.headers.get('content-length')
  if (declared && (Number.isNaN(Number(declared)) || Number(declared) > MAX_BODY_BYTES)) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

async function proxy(request: NextRequest, path: string[]) {
  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}`, BACKEND_URL)
  target.search = request.nextUrl.search
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await boundedBody(request)
    if (body === null) {
      return NextResponse.json(
        { error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 1 MiB' } },
        { status: 413 },
      )
    }
    const response = await fetch(target, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('content-type') ?? 'application/json',
        ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie')! } : {}),
        ...(request.headers.get('authorization') ? { Authorization: request.headers.get('authorization')! } : {}),
      },
      body,
      cache: 'no-store',
    })
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        ...(response.headers.get('set-cookie') ? { 'Set-Cookie': response.headers.get('set-cookie')! } : {}),
        ...(response.headers.get('x-request-id') ? { 'X-Request-ID': response.headers.get('x-request-id')! } : {}),
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Không thể kết nối API FinSight.' } },
      { status: 502 },
    )
  }
}

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  return proxy(request, (await params).path)
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return proxy(request, (await params).path)
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return proxy(request, (await params).path)
}
