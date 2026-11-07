import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''

  try {
    const response = await fetch(
      `${BACKEND_URL}/market/search?q=${encodeURIComponent(q)}`,
      { cache: 'no-store' }
    )
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed', results: [] },
      { status: 500 }
    )
  }
}
