import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch('https://bible.helloao.org/api/available_translations.json', {
    next: { revalidate: 86400 }, // cache 24h
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch translations' }, { status: 502 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
