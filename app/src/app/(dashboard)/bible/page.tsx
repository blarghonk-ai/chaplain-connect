import BibleClient from './_components/bible-client'

export const metadata = { title: 'Scripture — Chaplain Connect' }

export default function BiblePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Scripture</h1>
      <BibleClient />
    </div>
  )
}
