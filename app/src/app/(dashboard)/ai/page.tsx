import AIClient from './_components/ai-client'

export const metadata = { title: 'AI Assistant — Chaplain Connect' }

export default function AIPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold">AI Chaplain Assistant</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Powered by Ollama — your private, local AI model. No data leaves your infrastructure.
        </p>
      </div>
      <AIClient />
    </div>
  )
}
