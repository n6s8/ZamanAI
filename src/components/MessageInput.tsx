// src/components/MessageInput.tsx
import { useEffect, useRef, useState } from 'react'
import { VoiceControls } from './VoiceControls'

export const MessageInput = ({ onSend }: { onSend: (v: string) => void }) => {
    const [v, setV] = useState('')
    const ref = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        const h = (e: CustomEvent<string>) => setV(String(e.detail ?? ''))
        window.addEventListener('quick:prompt', h as any)
        return () => window.removeEventListener('quick:prompt', h as any)
    }, [])

    function submit() {
        const text = v.trim()
        if (!text) return
        onSend(text)
        setV('')
        ref.current?.focus()
    }

    function handleVoiceText(text: string) {
        setV(text)
        submit()           // ← если не нужно авто-отправлять, закомментируй эту строку
    }

    return (
        <div
            style={{
                padding: 12,
                borderTop: '1px solid #eee',
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 8,
                alignItems: 'end'
            }}
        >
      <textarea
          ref={ref}
          className="input"
          rows={2}
          placeholder="Напиши запрос…"
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
              }
          }}
      />

            <button
                className="btn btn--green"
                onClick={submit}
                title="Отправить"
            >
                Отправить
            </button>

            {/* Голосовое управление */}
            <VoiceControls onText={handleVoiceText} />
        </div>
    )
}
