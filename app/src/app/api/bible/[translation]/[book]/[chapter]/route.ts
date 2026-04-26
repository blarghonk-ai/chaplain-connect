import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ translation: string; book: string; chapter: string }> }
) {
  const { translation, book, chapter } = await params
  const url = `https://bible.helloao.org/api/${translation}/${book}/${chapter}.json`

  const res = await fetch(url, {
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
