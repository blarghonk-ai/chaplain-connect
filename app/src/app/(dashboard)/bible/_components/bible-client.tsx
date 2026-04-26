'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Standard Bible book list with API codes and chapter counts
const BIBLE_BOOKS = [
  // Old Testament
  { code: 'GEN', name: 'Genesis', chapters: 50 },
  { code: 'EXO', name: 'Exodus', chapters: 40 },
  { code: 'LEV', name: 'Leviticus', chapters: 27 },
  { code: 'NUM', name: 'Numbers', chapters: 36 },
  { code: 'DEU', name: 'Deuteronomy', chapters: 34 },
  { code: 'JOS', name: 'Joshua', chapters: 24 },
  { code: 'JDG', name: 'Judges', chapters: 21 },
  { code: 'RUT', name: 'Ruth', chapters: 4 },
  { code: '1SA', name: '1 Samuel', chapters: 31 },
  { code: '2SA', name: '2 Samuel', chapters: 24 },
  { code: '1KI', name: '1 Kings', chapters: 22 },
  { code: '2KI', name: '2 Kings', chapters: 25 },
  { code: '1CH', name: '1 Chronicles', chapters: 29 },
  { code: '2CH', name: '2 Chronicles', chapters: 36 },
  { code: 'EZR', name: 'Ezra', chapters: 10 },
  { code: 'NEH', name: 'Nehemiah', chapters: 13 },
  { code: 'EST', name: 'Esther', chapters: 10 },
  { code: 'JOB', name: 'Job', chapters: 42 },
  { code: 'PSA', name: 'Psalms', chapters: 150 },
  { code: 'PRO', name: 'Proverbs', chapters: 31 },
  { code: 'ECC', name: 'Ecclesiastes', chapters: 12 },
  { code: 'SNG', name: 'Song of Solomon', chapters: 8 },
  { code: 'ISA', name: 'Isaiah', chapters: 66 },
  { code: 'JER', name: 'Jeremiah', chapters: 52 },
  { code: 'LAM', name: 'Lamentations', chapters: 5 },
  { code: 'EZK', name: 'Ezekiel', chapters: 48 },
  { code: 'DAN', name: 'Daniel', chapters: 12 },
  { code: 'HOS', name: 'Hosea', chapters: 14 },
  { code: 'JOL', name: 'Joel', chapters: 3 },
  { code: 'AMO', name: 'Amos', chapters: 9 },
  { code: 'OBA', name: 'Obadiah', chapters: 1 },
  { code: 'JON', name: 'Jonah', chapters: 4 },
  { code: 'MIC', name: 'Micah', chapters: 7 },
  { code: 'NAM', name: 'Nahum', chapters: 3 },
  { code: 'HAB', name: 'Habakkuk', chapters: 3 },
  { code: 'ZEP', name: 'Zephaniah', chapters: 3 },
  { code: 'HAG', name: 'Haggai', chapters: 2 },
  { code: 'ZEC', name: 'Zechariah', chapters: 14 },
  { code: 'MAL', name: 'Malachi', chapters: 4 },
  // New Testament
  { code: 'MAT', name: 'Matthew', chapters: 28 },
  { code: 'MRK', name: 'Mark', chapters: 16 },
  { code: 'LUK', name: 'Luke', chapters: 24 },
  { code: 'JHN', name: 'John', chapters: 21 },
  { code: 'ACT', name: 'Acts', chapters: 28 },
  { code: 'ROM', name: 'Romans', chapters: 16 },
  { code: '1CO', name: '1 Corinthians', chapters: 16 },
  { code: '2CO', name: '2 Corinthians', chapters: 13 },
  { code: 'GAL', name: 'Galatians', chapters: 6 },
  { code: 'EPH', name: 'Ephesians', chapters: 6 },
  { code: 'PHP', name: 'Philippians', chapters: 4 },
  { code: 'COL', name: 'Colossians', chapters: 4 },
  { code: '1TH', name: '1 Thessalonians', chapters: 5 },
  { code: '2TH', name: '2 Thessalonians', chapters: 3 },
  { code: '1TI', name: '1 Timothy', chapters: 6 },
  { code: '2TI', name: '2 Timothy', chapters: 4 },
  { code: 'TIT', name: 'Titus', chapters: 3 },
  { code: 'PHM', name: 'Philemon', chapters: 1 },
  { code: 'HEB', name: 'Hebrews', chapters: 13 },
  { code: 'JAS', name: 'James', chapters: 5 },
  { code: '1PE', name: '1 Peter', chapters: 5 },
  { code: '2PE', name: '2 Peter', chapters: 3 },
  { code: '1JN', name: '1 John', chapters: 5 },
  { code: '2JN', name: '2 John', chapters: 1 },
  { code: '3JN', name: '3 John', chapters: 1 },
  { code: 'JUD', name: 'Jude', chapters: 1 },
  { code: 'REV', name: 'Revelation', chapters: 22 },
]

type Translation = {
  id: string
  name: string
  englishName: string
  language: string
}

type Verse = {
  number: number
  text: string
}

type ChapterData = {
  translation: { id: string; name: string }
  book: { id: string; name: string }
  chapter: { number: number }
  verses: Verse[]
}

export default function BibleClient() {
  const [translations, setTranslations] = useState<Translation[]>([])
  const [translationId, setTranslationId] = useState('BSB')
  const [bookCode, setBookCode] = useState('PSA')
  const [chapter, setChapter] = useState(23)
  const [chapterData, setChapterData] = useState<ChapterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentBook = BIBLE_BOOKS.find(b => b.code === bookCode)!

  // Fetch translations once
  useEffect(() => {
    fetch('/api/bible/translations')
      .then(r => r.json())
      .then((data) => {
        // API returns { translations: [...] }
        const list: Translation[] = data.translations ?? data
        // Filter to English translations for default view
        setTranslations(list)
      })
      .catch(() => {/* non-critical */})
  }, [])

  const loadChapter = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bible/${translationId}/${bookCode}/${chapter}`)
      if (!res.ok) throw new Error('Chapter not found')
      const data = await res.json()
      setChapterData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chapter')
      setChapterData(null)
    } finally {
      setLoading(false)
    }
  }, [translationId, bookCode, chapter])

  useEffect(() => {
    loadChapter()
  }, [loadChapter])

  function prevChapter() {
    if (chapter > 1) setChapter(c => c - 1)
    else {
      const idx = BIBLE_BOOKS.findIndex(b => b.code === bookCode)
      if (idx > 0) {
        const prev = BIBLE_BOOKS[idx - 1]
        setBookCode(prev.code)
        setChapter(prev.chapters)
      }
    }
  }

  function nextChapter() {
    if (chapter < currentBook.chapters) setChapter(c => c + 1)
    else {
      const idx = BIBLE_BOOKS.findIndex(b => b.code === bookCode)
      if (idx < BIBLE_BOOKS.length - 1) {
        setBookCode(BIBLE_BOOKS[idx + 1].code)
        setChapter(1)
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Translation */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Translation</label>
              <select
                value={translationId}
                onChange={e => setTranslationId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {translations.length === 0 ? (
                  <option value="BSB">Berean Standard Bible (BSB)</option>
                ) : (
                  translations
                    .filter(t => t.language === 'eng' || !t.language)
                    .slice(0, 50)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.englishName ?? t.name} ({t.id})
                      </option>
                    ))
                )}
              </select>
            </div>

            {/* Book */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Book</label>
              <select
                value={bookCode}
                onChange={e => { setBookCode(e.target.value); setChapter(1) }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <optgroup label="Old Testament">
                  {BIBLE_BOOKS.slice(0, 39).map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </optgroup>
                <optgroup label="New Testament">
                  {BIBLE_BOOKS.slice(39).map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Chapter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Chapter</label>
              <select
                value={chapter}
                onChange={e => setChapter(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chapter display */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {chapterData
                ? `${chapterData.book.name} ${chapterData.chapter.number}`
                : `${currentBook.name} ${chapter}`}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={prevChapter}>← Prev</Button>
              <Button variant="outline" size="sm" onClick={nextChapter}>Next →</Button>
            </div>
          </div>
          {chapterData && (
            <p className="text-xs text-muted-foreground">
              {chapterData.translation.name}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-sm text-muted-foreground animate-pulse py-4">Loading…</div>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && chapterData && (
            <div className="space-y-2 leading-relaxed text-sm">
              {chapterData.verses.map(v => (
                <p key={v.number}>
                  <sup className="text-xs font-bold text-muted-foreground mr-1">{v.number}</sup>
                  {v.text}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
