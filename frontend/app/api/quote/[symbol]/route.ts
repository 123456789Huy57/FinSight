import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

type Params = { params: { symbol: string } }

export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params
    const response = await fetch(`${BACKEND_URL}/quote/${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
    })
    const data = await response.json()
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 404 })
    }
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote' },
      { status: 500 }
    )
  }
}
