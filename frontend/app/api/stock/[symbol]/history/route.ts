import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const url = new URL(_request.url)
  const days = url.searchParams.get('days') ?? '180'

  try {
    const response = await fetch(
      `${BACKEND_URL}/stock/${encodeURIComponent(symbol.toUpperCase())}/history?days=${days}`,
      { cache: 'no-store' }
    )
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stock history', candles: [] },
      { status: 500 }
    )
  }
}
