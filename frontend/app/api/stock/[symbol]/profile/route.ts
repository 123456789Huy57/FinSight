import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sym = symbol.toUpperCase()
  try {
    const response = await fetch(
      `${BACKEND_URL}/stock/${encodeURIComponent(sym)}/profile`,
      { cache: 'no-store' }
    )
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { symbol: sym, company_name: null, sector: null, week52_high: null, week52_low: null },
      { status: 200 }
    )
  }
}
