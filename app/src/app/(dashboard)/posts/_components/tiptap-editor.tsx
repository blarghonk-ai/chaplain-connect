'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'

type Props = {
  content: string
  onChange: (html: string) => void
}

export default function TiptapEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your devotional, prayer guide, or announcement…' }),
      CharacterCount,
      Link.configure({ openOnClick: false }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[16rem] p-4 focus:outline-none',
      },
    },
  })

  // Sync external content changes (e.g. loading an existing post)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  const btn = (label: string, action: () => boolean, isActive: () => boolean) => (
    <button
      type="button"
      onClick={action}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        isActive()
          ? 'bg-foreground text-background'
          : 'hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
        {btn('B', () => editor.chain().focus().toggleBold().run(), () => editor.isActive('bold'))}
        {btn('I', () => editor.chain().focus().toggleItalic().run(), () => editor.isActive('italic'))}
        {btn('S', () => editor.chain().focus().toggleStrike().run(), () => editor.isActive('strike'))}
        <span className="w-px bg-border mx-1" />
        {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), () => editor.isActive('heading', { level: 1 }))}
        {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), () => editor.isActive('heading', { level: 2 }))}
        {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), () => editor.isActive('heading', { level: 3 }))}
        <span className="w-px bg-border mx-1" />
        {btn('• List', () => editor.chain().focus().toggleBulletList().run(), () => editor.isActive('bulletList'))}
        {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), () => editor.isActive('orderedList'))}
        {btn('" Quote', () => editor.chain().focus().toggleBlockquote().run(), () => editor.isActive('blockquote'))}
        <span className="w-px bg-border mx-1" />
        {btn('↩ Break', () => editor.chain().focus().setHardBreak().run(), () => false)}
        {btn('― Rule', () => editor.chain().focus().setHorizontalRule().run(), () => false)}
        <span className="w-px bg-border mx-1" />
        {btn('↩ Undo', () => editor.chain().focus().undo().run(), () => false)}
        {btn('↪ Redo', () => editor.chain().focus().redo().run(), () => false)}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Footer */}
      <div className="px-4 py-2 border-t text-xs text-muted-foreground">
        {editor.storage.characterCount.words()} words · {editor.storage.characterCount.characters()} characters
      </div>
    </div>
  )
}
