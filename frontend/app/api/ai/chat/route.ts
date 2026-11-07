import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch(`${BACKEND_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate chat response' },
      { status: 500 }
    )
  }
}
