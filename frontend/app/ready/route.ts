import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/ready`, { cache: 'no-store' })
    const body = await response.json()
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json({ status: 'error', backend: 'unavailable' }, { status: 503 })
  }
}
